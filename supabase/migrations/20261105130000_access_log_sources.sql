-- 접속 로그 유입 경로·접속 국가.
--
-- page_view의 props에 쌓이는 값을 읽는다(새 컬럼 없음).
--   entry       탭을 처음 열어 들어온 조회에만 true. 내부 이동이 유입으로 세어지지 않게 한다.
--   ref         직전 사이트의 도메인만. 주소 전체엔 검색어 등이 섞일 수 있어 남기지 않는다.
--   utm_source  캠페인 코드. 있으면 도메인보다 우선한다.
--   country     ISO 두 글자 코드. IP는 어디에도 저장하지 않는다.
--
-- analytics_events는 누구나 insert할 수 있으므로 props를 형변환하지 않는다
-- (('abc')::boolean 같은 값 하나로 관리자 화면 전체가 오류가 나면 안 된다).
--
-- 반환 형태가 바뀌어 create or replace로는 안 되므로 지우고 다시 만든다.

drop function if exists public.access_log_views(timestamptz, timestamptz);

create function public.access_log_views(
  p_since timestamptz,
  p_until timestamptz default null
)
returns table (
  id bigint,
  path text,
  locale text,
  user_id uuid,
  session_id text,
  created_at timestamptz,
  internal boolean,
  visitor text,
  entry boolean,
  source text,
  country text
)
language sql
stable
set search_path = public
as $$
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
      e.props,
      coalesce(e.props->>'path', '/') as path,
      e.locale,
      e.user_id,
      e.session_id,
      e.created_at
    from public.analytics_events e
    where e.event = 'page_view'
      and e.created_at >= p_since
      and e.created_at < coalesce(p_until, 'infinity'::timestamptz)
  )
  select
    b.id,
    b.path,
    b.locale,
    b.user_id,
    b.session_id,
    b.created_at,
    -- in 대신 exists: user_id가 NULL(비로그인)이면 in은 NULL이 되어 실제 방문자가 통째로 빠진다.
    (
      b.path = '/admin'
      or b.path like '/admin/%'
      or exists (select 1 from internal_users i where i.id = b.user_id)
      or exists (select 1 from internal_sessions s where s.session_id = b.session_id)
    ) as internal,
    -- 로그인 전후 방문이 두 명으로 세어지지 않게 세션의 소유자로 묶는다.
    coalesce(
      b.user_id::text,
      case
        when b.session_id is not null
          then max(b.user_id::text) over (partition by b.session_id)
      end,
      b.session_id,
      'unknown'
    ) as visitor,
    coalesce(b.props->>'entry' = 'true', false) as entry,
    coalesce(nullif(lower(b.props->>'utm_source'), ''), nullif(lower(b.props->>'ref'), '')) as source,
    nullif(b.props->>'country', '') as country
  from base b;
$$;

revoke all on function public.access_log_views(timestamptz, timestamptz) from public, anon, authenticated;

create or replace function public.admin_access_log_breakdown(
  p_since timestamptz,
  p_until timestamptz,
  p_include_internal boolean default false
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  with scoped as (
    select
      a.id,
      a.created_at,
      a.visitor,
      a.entry,
      a.source,
      a.country,
      case
        when a.path = '/' then 'home'
        when a.path = '/guides' or a.path like '/guides/%' then 'guides'
        when a.path = '/plan' or a.path like '/plan/%' then 'planner'
        when a.path = '/plaza' or a.path like '/plaza/%'
          or a.path = '/share' or a.path like '/share/%'
          or a.path like '/trip/%' then 'plaza'
        when a.path = '/info' or a.path like '/info/%'
          or a.path = '/setup' or a.path like '/setup/%' then 'info'
        when a.path = '/admin' or a.path like '/admin/%' then 'admin'
        else 'other'
      end as section
    from public.access_log_views(p_since, p_until) a
    where p_include_internal or not a.internal
  ),
  gaps as (
    select
      s.visitor,
      s.id,
      s.created_at,
      s.created_at - lag(s.created_at) over (partition by s.visitor order by s.created_at, s.id) as gap
    from scoped s
  ),
  numbered as (
    select
      g.visitor,
      sum(case when g.gap is null or g.gap > interval '30 minutes' then 1 else 0 end)
        over (partition by g.visitor order by g.created_at, g.id) as visit_no
    from gaps g
  ),
  visits as (
    select n.visitor, n.visit_no, count(*) as pages
    from numbered n
    group by n.visitor, n.visit_no
  )
  select jsonb_build_object(
    'sections', (
      select coalesce(jsonb_agg(jsonb_build_object('key', t.section, 'views', t.views, 'visitors', t.visitors) order by t.views desc, t.section), '[]'::jsonb)
      from (
        select s.section, count(*) as views, count(distinct s.visitor) as visitors
        from scoped s
        group by s.section
      ) t
    ),
    'views', (select count(*) from scoped),
    'visitors', (select count(distinct s.visitor) from scoped s),
    'visits', (select count(*) from visits),
    'bounced_visits', (select count(*) from visits v where v.pages = 1),
    'returning_visitors', (
      select count(*)
      from (select v.visitor from visits v group by v.visitor having count(*) >= 2) r
    ),
    'sources', (
      select coalesce(jsonb_agg(jsonb_build_object('key', t.key, 'count', t.cnt) order by t.cnt desc, t.key), '[]'::jsonb)
      from (
        select coalesce(s.source, 'direct') as key, count(*) as cnt
        from scoped s
        where s.entry
        group by 1
        order by cnt desc, key
        limit 10
      ) t
    ),
    'source_total', (select count(*) from scoped s where s.entry),
    'countries', (
      select coalesce(jsonb_agg(jsonb_build_object('key', t.key, 'count', t.cnt) order by t.cnt desc, t.key), '[]'::jsonb)
      from (
        select s.country as key, count(distinct s.visitor) as cnt
        from scoped s
        where s.country is not null
        group by 1
        order by cnt desc, key
        limit 10
      ) t
    ),
    'country_total', (select count(distinct s.visitor) from scoped s where s.country is not null)
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.admin_access_log_breakdown(timestamptz, timestamptz, boolean) from public, anon;
grant execute on function public.admin_access_log_breakdown(timestamptz, timestamptz, boolean) to authenticated;

notify pgrst, 'reload schema';
