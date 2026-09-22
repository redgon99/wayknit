-- =============================================
-- I1(관리자 검토 2026-09-16) 나머지 — 수집 운영 대시보드에
-- 소스별 미분석/미매칭 건수를 보여준다. `insight_raw_items`·
-- `insight_analysis`·`insight_place_mentions`는 전부 관리자 전용
-- select 정책이라 화면에서 직접 group by 집계를 못 낸다(supabase-js는
-- group by를 지원하지 않음) — admin_dashboard_summary와 같은 패턴으로
-- SECURITY DEFINER RPC 하나로 집계한다.
--
-- "미매칭"은 분석은 끝났지만 insight_place_mentions에 아직 한 건도
-- 없는 게시물 수다 — 게시물이 애초에 장소를 언급하지 않았을 수도 있어
-- 반드시 오류를 뜻하진 않는다(화면 쪽 라벨에서 이 뉘앙스를 유지한다).
-- =============================================

create or replace function public.insight_source_stats()
returns table (
  source text,
  total_raw bigint,
  unanalyzed bigint,
  analyzed_unmatched bigint
)
language plpgsql
stable
security definer
set search_path = public
as $fn$
begin
  if not public.is_admin() then
    raise exception '관리자만 조회할 수 있습니다.' using errcode = '42501';
  end if;

  return query
    select
      r.source,
      count(*)::bigint as total_raw,
      count(*) filter (where a.id is null)::bigint as unanalyzed,
      count(*) filter (where a.id is not null and m.analysis_id is null)::bigint as analyzed_unmatched
    from public.insight_raw_items r
    left join public.insight_analysis a on a.raw_item_id = r.id
    left join (select distinct analysis_id from public.insight_place_mentions) m
      on m.analysis_id = a.id
    group by r.source;
end;
$fn$;

grant execute on function public.insight_source_stats() to authenticated;
