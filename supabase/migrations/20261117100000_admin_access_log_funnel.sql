-- 접속 로그 전환 흐름(해외 사용자 개선계획 1-6).
--
-- 가이드 상세를 본 방문자가 "내 일정에 담기"를 누르고, 코스를 가져오고, 로그인까지 가는지 본다.
-- 단계는 앞 단계를 거친 방문자만 센다(가이드를 안 보고 플래너로 바로 온 사람은 3단계 이후에 없다).
-- 플래너 방문자 전체와 코스를 가져온 방문자 전체는 따로 돌려준다.
--
-- guide_cta_click·guide_trip_import는 2026-11-17부터 쌓인다(HANDOFF §52). 그 전 기간은 0으로 나오므로
-- tracking_since로 기록 시작 시점을 함께 알려 준다.
--
-- analytics_events는 누구나 insert할 수 있으므로 props를 형변환하지 않는다(places도 문자열로 비교).
-- 방문자·내부 접속 판단은 access_log_views를 그대로 쓴다. 다른 이벤트는 같은 브라우저 세션으로 방문자에 붙인다.

create or replace function public.admin_access_log_funnel(
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
    select a.visitor, a.path, a.user_id, a.session_id
    from public.access_log_views(p_since, p_until) a
    where p_include_internal or not a.internal
  ),
  sessions as (
    select distinct s.session_id, s.visitor
    from scoped s
    where s.session_id is not null
      and s.session_id <> 'anon'
  ),
  actions as (
    select e.event, e.props, e.session_id
    from public.analytics_events e
    where e.event in ('guide_cta_click', 'guide_trip_import')
      and e.created_at >= p_since
      and e.created_at < coalesce(p_until, 'infinity'::timestamptz)
  ),
  readers as (
    select distinct s.visitor from scoped s where s.path like '/guides/_%'
  ),
  clickers as (
    select distinct s.visitor
    from actions x
    join sessions s on s.session_id = x.session_id
    where x.event = 'guide_cta_click'
      and x.props->>'cta' = 'auto_route'
  ),
  importers as (
    select distinct s.visitor
    from actions x
    join sessions s on s.session_id = x.session_id
    where x.event = 'guide_trip_import'
      and coalesce(x.props->>'places', '0') <> '0'
  ),
  members as (
    select distinct s.visitor from scoped s where s.user_id is not null
  )
  select jsonb_build_object(
    'visitors', (select count(distinct s.visitor) from scoped s),
    'guide_readers', (select count(*) from readers),
    'course_clickers', (select count(*) from readers r join clickers c using (visitor)),
    'course_importers', (
      select count(*) from readers r join clickers c using (visitor) join importers i using (visitor)
    ),
    'members', (
      select count(*)
      from readers r
      join clickers c using (visitor)
      join importers i using (visitor)
      join members m using (visitor)
    ),
    'planner_visitors', (select count(distinct s.visitor) from scoped s where s.path = '/plan'),
    'all_importers', (select count(*) from importers),
    'tracking_since', (
      select min(e.created_at) from public.analytics_events e where e.event = 'guide_cta_click'
    )
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.admin_access_log_funnel(timestamptz, timestamptz, boolean) from public, anon;
grant execute on function public.admin_access_log_funnel(timestamptz, timestamptz, boolean) to authenticated;

notify pgrst, 'reload schema';
