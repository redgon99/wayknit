-- =============================================
-- 시장 인사이트 — 리서치 리포트 아카이브(2026-09-23)
--
-- insight_raw_items/insight_analysis는 게시물 단위 자동 수집·분류다.
-- 이것과 다르게, 여러 원문을 이미 종합해 지역별 언급·관심사·긍정/부정
-- 신호로 정리한 "완성된 리포트"(예: r/koreatravel 주간 정리)를 쌓아두고
-- 키워드로 검색할 수 있는 별도 저장소다. admin_notices와 같은 패턴 —
-- 완전히 관리자 전용이라 공개 select 정책은 없다.
-- =============================================

create table if not exists public.insight_reports (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  summary text,
  body_md text not null,
  keywords text[] not null default '{}',
  period_from date,
  period_to date,
  source_note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists insight_reports_keywords_idx
  on public.insight_reports using gin (keywords);

create index if not exists insight_reports_created_idx
  on public.insight_reports (created_at desc);

alter table public.insight_reports enable row level security;

drop policy if exists "insight_reports_admin_all" on public.insight_reports;
create policy "insight_reports_admin_all" on public.insight_reports
  for all using (public.is_admin()) with check (public.is_admin());

drop trigger if exists insight_reports_updated_at on public.insight_reports;
create trigger insight_reports_updated_at
  before update on public.insight_reports
  for each row execute procedure public.set_updated_at();
