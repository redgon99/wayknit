-- =============================================
-- 시장 인사이트 — 수동 등록(관리자 검토 2026-09-23)
--
-- 자동 수집(YouTube/네이버/Reddit)은 edge function이 API로 긁어오지만,
-- 인스타그램·틱톡처럼 API 없이 URL만으로 못 긁는 플랫폼이나, 관리자가
-- 눈으로 본 다른 웹페이지 텍스트는 수동으로 넣을 방법이 없었다.
-- `insight_raw_items`에 'manual' 소스를 추가하고, 이후 파이프라인
-- (AI 분석 `insight-analyze`, 장소 매칭 `insight-place-match`)은
-- source를 안 가리므로 그대로 태운다 — 이 마이그레이션만으로 충분.
--
-- 자동 수집은 서비스 롤(edge function)로 RLS를 우회해 쓰지만, 수동
-- 등록은 관리자 브라우저 세션(anon+JWT)에서 직접 insert하므로 INSERT
-- 정책이 필요하다. 다른 소스를 사칭해 끼워 넣을 수 없도록 source가
-- 'manual'인 행만 허용한다.
-- =============================================

alter table public.insight_raw_items
  drop constraint if exists insight_raw_items_source_check;

alter table public.insight_raw_items
  add constraint insight_raw_items_source_check
  check (source in ('youtube', 'naver_blog', 'naver_kin', 'reddit', 'manual'));

drop policy if exists "insight_raw_items_admin_insert" on public.insight_raw_items;
create policy "insight_raw_items_admin_insert" on public.insight_raw_items
  for insert
  with check (public.is_admin() and source = 'manual');
