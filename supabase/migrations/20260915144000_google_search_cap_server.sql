-- Google 검색 일일 캡을 로그인 사용자에 한해 서버로 이관 (§30-4)
--
-- 왜: canRunGoogleSearch/recordGoogleSearch(subscription.ts)가 지금은
-- localStorage에만 카운트를 쌓는다 — 시크릿창을 열거나 캐시를 지우면
-- 즉시 리셋된다. §30-1 재검토에서 발견한 것을 docs/Wayknit_수익화_실행계획
-- Tier 2 계획대로 서버 집계로 옮긴다.
--
-- 범위를 분명히 해 둔다: 이건 **비용 방어가 아니다.** Google Maps SDK는
-- `VITE_GOOGLE_MAPS_*` API 키를 브라우저에 그대로 노출해 client→Google로
-- 직접 호출한다(googleMaps.ts). 개발자도구로 그 키를 그대로 뽑아 우리
-- 앱을 거치지 않고 Google을 직접 두드리면 이 서버 캡도 완전히 우회된다
-- — 진짜 비용 방어는 Google Cloud Console의 API 키 제한(HTTP 리퍼러
-- 제한 + 일일 쿼터)이고, 그건 이 저장소 밖의 설정이라 여기서 손댈 수
-- 없다. 이 마이그레이션이 실제로 막는 건 "로그인한 Free 사용자가 우리
-- 앱의 평범한 사용 흐름에서 하루 40회를 넘기지 못하게" 하는 것뿐이다.
--
-- 게스트(비로그인)는 auth.uid()가 없어 서버로 추적할 계정이 없다 —
-- 기존 localStorage 캡을 게스트 전용으로 그대로 둔다(subscription.ts).
--
-- ⚠️ 40이라는 숫자는 src/lib/subscription.ts의
-- FREE_DAILY_GOOGLE_SEARCHES와 반드시 같이 맞출 것.

create table if not exists public.google_search_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  search_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

alter table public.google_search_usage enable row level security;
-- billing_customers/billing_events와 같은 패턴 — 클라이언트 직접 접근
-- 정책을 만들지 않는다. 카운트를 직접 0으로 되돌리는 것도 막기 위해
-- 읽기·쓰기 전부 아래 SECURITY DEFINER 함수로만 오간다.

create or replace function public.can_run_google_search()
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
    return false; -- 게스트는 클라이언트가 이 함수를 안 부르고 로컬 캡을 쓴다
  end if;

  if public.has_unlimited_access() then
    return true;
  end if;

  select search_count into v_count
  from public.google_search_usage
  where user_id = v_uid and usage_date = current_date;

  return coalesce(v_count, 0) < 40;
end;
$fn$;

create or replace function public.record_google_search()
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
    return; -- 무제한 플랜은 카운트를 쌓을 필요 없음
  end if;

  insert into public.google_search_usage (user_id, usage_date, search_count)
  values (v_uid, current_date, 1)
  on conflict (user_id, usage_date)
  do update set
    search_count = public.google_search_usage.search_count + 1,
    updated_at = now();
end;
$fn$;

revoke all on function public.can_run_google_search() from public;
revoke all on function public.record_google_search() from public;
grant execute on function public.can_run_google_search() to authenticated;
grant execute on function public.record_google_search() to authenticated;

-- 오래된 행은 굳이 안 지워도 (user_id, usage_date) 몇십~몇백 행/유저/년
-- 수준이라 저장비용이 미미하다 — 별도 정리 배치 없이 둔다.
