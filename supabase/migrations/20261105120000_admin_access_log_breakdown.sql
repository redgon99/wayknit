-- 접속 로그 구역별 집계와 방문 지표.
--
-- session_id는 브라우저에 계속 남는 값이라 "한 번의 방문"이 아니다. 그대로 묶으면 몇 주에
-- 걸친 접속이 한 세션이 되어 방문당 페이지 수가 부풀려지므로, 같은 방문자의 조회 사이가
-- 30분을 넘으면 새 방문으로 나눈다.
--
-- 경로 필터를 받지 않는다: 방문은 여러 경로에 걸치므로 경로로 잘라 계산하면 값이 틀어진다.

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
    )
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.admin_access_log_breakdown(timestamptz, timestamptz, boolean) from public, anon;
grant execute on function public.admin_access_log_breakdown(timestamptz, timestamptz, boolean) to authenticated;

notify pgrst, 'reload schema';
