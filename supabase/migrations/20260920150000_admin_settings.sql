-- 관리자 설정 키-값 저장소(§32-19). 첫 용도: 가이드 카드 "AI 자동 생성"의
-- AI 공급자를 Claude API/로컬 LLM 중에서 선택 — 관리자 화면에서 재배포 없이
-- 바꿀 수 있어야 해서 env var가 아니라 이 테이블에 둔다.
create table if not exists public.admin_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.admin_settings enable row level security;

create policy "admin_settings_admin_all" on public.admin_settings
  for all
  using (public.is_admin())
  with check (public.is_admin());

comment on table public.admin_settings is
  '관리자 화면에서 바꾸는 설정 키-값 저장소. key 예: course_guide_ai_provider';
