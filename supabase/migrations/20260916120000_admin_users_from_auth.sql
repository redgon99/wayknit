-- =============================================
-- 관리자 회원 목록 — 가입자(auth.users) 기준으로, 테스트 계정 플래그
-- (관리자 검토 2026-09-16, U1·U2)
--
-- U1: admin_user_rows가 wayknit_trips를 owner_id로 묶는 데서 시작해서
-- auth.users를 LEFT JOIN했다 — 여행을 한 번도 안 만든 가입자는 목록에
-- 아예 안 보였다. auth.users를 시작점으로 뒤집는다.
--
-- U2: user1~30@mail.com·mock 메타데이터 식별 수단은 삭제 스크립트
-- (20260904040000)에만 있어서, 목록·집계엔 테스트 계정이 실제 계정과
-- 섞여 나왔다. admin_user_verifications.is_test로 명시적으로 표시한다.
-- =============================================

alter table public.admin_user_verifications
  add column if not exists is_test boolean not null default false;

-- 이미 mock 메타데이터가 있는 계정은 소급 표시
insert into public.admin_user_verifications (user_id, is_test)
select u.id, true
  from auth.users u
 where coalesce(u.raw_user_meta_data->>'mock', 'false') = 'true'
on conflict (user_id) do update set is_test = true;

create or replace function public.admin_user_rows(
  p_search text default null,
  p_limit int default 50,
  p_offset int default 0,
  p_include_test boolean default false
)
returns table (
  user_id uuid,
  email text,
  trip_count bigint,
  first_trip_at timestamptz,
  last_updated_at timestamptz,
  is_verified boolean,
  memo text,
  verified_at timestamptz,
  is_test boolean,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  plan text,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
begin
  if not public.is_admin() then
    raise exception '관리자만 조회할 수 있습니다.' using errcode = '42501';
  end if;

  return query
  with agg as (
    select t.owner_id as uid,
           count(*)::bigint as cnt,
           min(t.created_at) as first_at,
           max(t.updated_at) as last_at
      from public.wayknit_trips t
     where t.owner_id is not null
     group by t.owner_id
  ),
  joined as (
    select u.id as uid,
           u.email::text as em,
           coalesce(a.cnt, 0) as cnt,
           a.first_at,
           a.last_at,
           coalesce(v.is_verified, false) as verified,
           v.memo as note,
           v.verified_at as verified_at_v,
           coalesce(v.is_test, false) as test_flag,
           u.created_at as signed_up_at,
           u.last_sign_in_at as last_sign_in,
           p.plan as plan_v
      from auth.users u
      left join agg a on a.uid = u.id
      left join public.admin_user_verifications v on v.user_id = u.id
      left join public.profiles p on p.id = u.id
  ),
  filtered as (
    select * from joined j
     where (p_include_test or not j.test_flag)
       and (
         v_search is null
         or j.em ilike '%' || v_search || '%'
         or j.note ilike '%' || v_search || '%'
         or j.uid::text ilike '%' || v_search || '%'
       )
  )
  select f.uid, f.em, f.cnt, f.first_at, f.last_at,
         f.verified, f.note, f.verified_at_v, f.test_flag,
         f.signed_up_at, f.last_sign_in, f.plan_v,
         count(*) over ()::bigint
    from filtered f
   order by coalesce(f.last_at, f.last_sign_in, f.signed_up_at) desc nulls last
   limit greatest(coalesce(p_limit, 50), 1)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

-- ---------------------------------------------
-- 대시보드 — 가입자 수(users.total)·테스트 계정 수(users.test) 추가.
-- 기존 trips.owners(여행 소유자 수)는 그대로 둔다 — 다른 의미라 둘 다 필요.
-- ---------------------------------------------
create or replace function public.admin_dashboard_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v jsonb;
begin
  if not public.is_admin() then
    raise exception '관리자만 조회할 수 있습니다.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'users', (
      select jsonb_build_object(
        'total', count(*),
        'test', count(*) filter (
          where exists (
            select 1 from public.admin_user_verifications v
             where v.user_id = u.id and v.is_test
          )
        )
      ) from auth.users u
    ),
    'trips', (
      select jsonb_build_object(
        'total', count(*),
        'public', count(*) filter (where is_public),
        'listed', count(*) filter (where listed_in_plaza),
        'owners', count(distinct owner_id) filter (where owner_id is not null),
        'created_7d', count(*) filter (where created_at > now() - interval '7 days')
      ) from public.wayknit_trips
    ),
    'reports', (
      select jsonb_build_object(
        'open', count(*) filter (where status in ('open', 'reviewing')),
        'total', count(*)
      ) from public.content_reports
    ),
    'guides', (
      select jsonb_build_object(
        'published', count(*) filter (where status = 'published'),
        'draft', count(*) filter (where status <> 'published'),
        'total', count(*)
      ) from public.guide_articles
    ),
    'scenarios', (
      select jsonb_build_object(
        'published', count(*) filter (where status = 'published'),
        'draft', count(*) filter (where status = 'draft'),
        'themes_covered', count(distinct theme) filter (where status = 'published'),
        'regions_covered', count(distinct region) filter (where status = 'published')
      ) from public.scenario_catalog
    ),
    'insights', (
      select jsonb_build_object(
        'raw_items', (select count(*) from public.insight_raw_items),
        'keywords', (select count(*) from public.insight_keywords),
        'place_mentions', (select count(*) from public.insight_place_mentions),
        'last_run_at', (select max(started_at) from public.insight_collection_runs)
      )
    ),
    'distribution', (
      select jsonb_build_object(
        'accounts', (select count(*) from public.distribution_accounts),
        'posted', count(*) filter (where status = 'posted'),
        'failed', count(*) filter (where status = 'failed'),
        'draft', count(*) filter (where status = 'draft')
      ) from public.distribution_posts
    ),
    'notices', (
      select jsonb_build_object(
        'published', count(*) filter (where is_published),
        'total', count(*)
      ) from public.admin_notices
    ),
    'admins', (select count(*) from public.admin_users),
    'audit', (
      select jsonb_build_object(
        'total', count(*),
        'today', count(*) filter (where created_at > date_trunc('day', now()))
      ) from public.admin_audit_log
    )
  ) into v;

  return v;
end;
$function$;
