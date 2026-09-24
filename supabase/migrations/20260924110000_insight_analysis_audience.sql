-- =============================================
-- 인사이트 분석 — 외국인/국내 대상 구분(2026-09-24)
--
-- 서비스 목적은 "외국인 여행자의 한국여행 관심·자료" 분석인데, 자동수집된
-- 네이버(블로그·지식인)는 한국 플랫폼·한국어라 애초에 한국인이 한국인
-- 대상으로 쓴 글이다. 유튜브도 영어/한국어 키워드가 섞여 있어 외국인
-- 대상 콘텐츠와 국내용 콘텐츠가 뒤섞여 있다.
--
-- insight-analyze는 "분석 행이 없는 것만" 다시 골라오는 구조(§34, 300건
-- 창 버그 수정)라 국내 콘텐츠를 조용히 건너뛰면 매번 50건 한도 안에
-- 다시 끼어들어 실제 분석 대상 자리를 뺏는다. 그래서 분석 행은 그대로
-- 남기고(카테고리·요약은 여전히 받음) audience만 태깅해 큐에서 빠지게
-- 한다.
-- =============================================

alter table public.insight_analysis
  add column if not exists audience text
  check (audience in ('foreign', 'domestic', 'unclear'));

-- 네이버는 소스만 보고 100% 확정 가능 — AI 재호출 없이 소급 채움(비용 없음)
update public.insight_analysis a
set audience = 'domestic'
from public.insight_raw_items r
where r.id = a.raw_item_id
  and r.source in ('naver_blog', 'naver_kin')
  and a.audience is null;
