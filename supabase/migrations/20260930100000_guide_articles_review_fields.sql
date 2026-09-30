-- =============================================
-- 가이드 카드 검수자 필드 (관리자 검토 보고서 C3)
-- 관리자가 1명뿐이라 auth.users FK로 엮지 않고 자유 텍스트로 둔다.
-- =============================================

alter table public.guide_articles
  add column if not exists reviewed_by text,
  add column if not exists reviewed_at timestamptz;
