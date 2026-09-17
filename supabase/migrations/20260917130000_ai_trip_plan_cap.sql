-- AI 일정 생성(§31-22 Step 6) 하루 사용량 캡 — google_search_cap_server.sql과
-- 완전히 같은 패턴(테이블 + can_*/record_* SECURITY DEFINER 함수 쌍).
--
-- 이 기능은 trip-intent-parse/trip-candidates-search 둘 다 verify_jwt=true라
-- 로그인 없이는 애초에 호출이 안 된다 — Google 검색 캡과 달리 게스트용
-- localStorage 폴백이 필요 없다.
--
-- ⚠️ 3이라는 숫자는 src/lib/tripIntent.ts의
-- FREE_DAILY_AI_TRIP_PLANS와 반드시 같이 맞출 것.

create table if not exists public.ai_trip_plan_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  generate_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

alter table public.ai_trip_plan_usage enable row level security;
-- google_search_usage와 같은 패턴 — 클라이언트 직접 접근 정책 없음,
-- 읽기·쓰기 전부 아래 SECURITY DEFINER 함수로만 오간다.

create or replace function public.can_generate_ai_trip_plan()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_uid uuid := auth.uid();
  v_count integer;
begin
  if v_uid is null then
    return false;
  end if;

  if public.has_unlimited_access() then
    return true;
  end if;

  select generate_count into v_count
  from public.ai_trip_plan_usage
  where user_id = v_uid and usage_date = current_date;

  return coalesce(v_count, 0) < 3;
end;
$fn$;

create or replace function public.record_ai_trip_plan_generation()
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return;
  end if;

  if public.has_unlimited_access() then
    return;
  end if;

  insert into public.ai_trip_plan_usage (user_id, usage_date, generate_count)
  values (v_uid, current_date, 1)
  on conflict (user_id, usage_date)
  do update set
    generate_count = public.ai_trip_plan_usage.generate_count + 1,
    updated_at = now();
end;
$fn$;

revoke all on function public.can_generate_ai_trip_plan() from public;
revoke all on function public.record_ai_trip_plan_generation() from public;
grant execute on function public.can_generate_ai_trip_plan() to authenticated;
grant execute on function public.record_ai_trip_plan_generation() to authenticated;
