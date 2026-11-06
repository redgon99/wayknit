-- 관리자 접속 로그 집계를 DB로 옮긴다.
--
-- 예전엔 브라우저가 page_view를 최대 2,000건 내려받아 직접 집계해서, 방문이 늘면
-- 합계·TOP 10·경로 검색이 최신 N건 안에서만 계산됐다. 또 관리자·테스트 계정 접속이
-- 섞여 있어(2026-11 기준 최근 30일 조회수의 절반 이상) 실제 방문을 알 수 없었다.
--
-- "내부 접속" 판정: 관리자 페이지 경로 / 관리자·테스트 계정 / 그 계정이 한 번이라도
-- 쓴 세션(브라우저). session_id는 로그아웃해도 유지되므로 로그아웃 상태의 내 접속도 빠진다.
-- 'anon'은 localStorage를 못 쓰는 브라우저들이 공유하는 값이라 세션 판정에서 뺀다.
--
-- 표(rows)를 jsonb로 돌려주는 이유: 테이블 반환 RPC는 PostgREST의 max-rows에 잘린다.
-- user_id는 내보내지 않고 로그인 여부만 준다(analytics_events의 비식별 원칙).

create or replace function public.admin_access_log(
  p_since timestamptz,
  p_path text default null,
  p_include_internal boolean default false,
  p_row_limit integer default 300
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_row_limit, 300), 1), 50000);
  v_path text := nullif(lower(trim(coalesce(p_path, ''))), '');
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  with internal_users as (
    select u.id
    from auth.users u
    join public.admin_users a on lower(a.email) = lower(u.email)
    union
    select v.user_id
    from public.admin_user_verifications v
    where v.is_test
  ),
  internal_sessions as (
    select distinct e.session_id
    from public.analytics_events e
    join internal_users i on i.id = e.user_id
    where e.session_id is not null
      and e.session_id <> 'anon'
  ),
  base as (
    select
      e.id,
      coalesce(e.props->>'path', '/') as path,
      e.locale,
      e.user_id,
      e.session_id,
      e.created_at
    from public.analytics_events e
    where e.event = 'page_view'
      and e.created_at >= p_since
  ),
  views as (
    select
      b.*,
      -- in 대신 exists: user_id가 NULL(비로그인)이면 in은 NULL이 되어 실제 방문자가 통째로 빠진다.
      (
        b.path = '/admin'
        or b.path like '/admin/%'
        or exists (select 1 from internal_users i where i.id = b.user_id)
        or exists (select 1 from internal_sessions s where s.session_id = b.session_id)
      ) as internal,
      -- 로그인 전후 방문이 두 명으로 세어지지 않게 세션의 소유자로 묶는다.
      case
        when b.session_id is not null
          then max(b.user_id::text) over (partition by b.session_id)
      end as session_owner
    from base b
    where v_path is null or strpos(lower(coalesce(b.path, '')), v_path) > 0
  ),
  filtered as (
    select *
    from views v
    where p_include_internal or not v.internal
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'visitors', (
      select count(distinct coalesce(f.user_id::text, f.session_owner, f.session_id, 'unknown'))
      from filtered f
    ),
    'excluded', case
      when p_include_internal then 0
      else (select count(*) from views v where v.internal)
    end,
    'top_paths', (
      select coalesce(jsonb_agg(jsonb_build_object('path', t.path, 'count', t.cnt) order by t.cnt desc, t.path), '[]'::jsonb)
      from (
        select f.path, count(*) as cnt
        from filtered f
        group by f.path
        order by cnt desc, f.path
        limit 10
      ) t
    ),
    'rows', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', r.id,
            'path', r.path,
            'locale', r.locale,
            'logged_in', r.user_id is not null,
            'session_id', r.session_id,
            'created_at', r.created_at
          )
          order by r.created_at desc, r.id desc
        ),
        '[]'::jsonb
      )
      from (
        select f.*
        from filtered f
        order by f.created_at desc, f.id desc
        limit v_limit
      ) r
    )
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.admin_access_log(timestamptz, text, boolean, integer) from public, anon;
grant execute on function public.admin_access_log(timestamptz, text, boolean, integer) to authenticated;

notify pgrst, 'reload schema';
