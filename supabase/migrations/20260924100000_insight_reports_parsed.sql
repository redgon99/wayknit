-- =============================================
-- 리서치 리포트 — 붙여넣은 본문에서 규칙 기반으로 뽑은 구조화 데이터
-- (지역별 언급·관심사·긍정/부정 신호) 저장 칸(2026-09-24).
--
-- LLM 호출 없이 클라이언트(src/lib/insightReportParser.ts)가 저장 직전에
-- 계산해서 넣는다 — guide_articles.translations/course_pins와 같은 패턴
-- (서버 쪽 파싱 로직을 따로 안 두고 클라이언트에서 계산해 넣음).
-- =============================================

alter table public.insight_reports
  add column if not exists parsed jsonb;
