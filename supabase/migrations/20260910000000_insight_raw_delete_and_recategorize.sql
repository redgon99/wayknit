-- 시장 인사이트 관리자 미비점 2건 (HANDOFF §2-7 → §24)
--
-- 1) insight_raw_items 는 SELECT 정책만 있어 잘못 수집된 원문을 관리자도
--    지울 방법이 없었다(DB 직접 조작만 가능). DELETE 정책을 추가한다.
--    insight_analysis · insight_place_mentions 의 raw_item_id FK가 이미
--    on delete cascade 라 원문을 지우면 그 분석·장소 언급도 함께 지워진다.
--
-- 2) insight_analysis 는 SELECT 정책만 있어 AI가 잘못 분류한 category를
--    관리자가 고칠 방법이 없었다. UPDATE 정책을 추가하되 category만
--    바꾸는 용도이므로 raw_item_id·id 등은 그대로 두는 것을 애플리케이션
--    책임으로 둔다(RLS는 행 단위이지 컬럼 단위가 아니다).

drop policy if exists "insight_raw_items_admin_delete" on public.insight_raw_items;
create policy "insight_raw_items_admin_delete" on public.insight_raw_items
  for delete using (public.is_admin());

drop policy if exists "insight_analysis_admin_update" on public.insight_analysis;
create policy "insight_analysis_admin_update" on public.insight_analysis
  for update
  using (public.is_admin())
  with check (public.is_admin());
