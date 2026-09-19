-- link-places-extract 하루 IP당 사용량 제한 (2026-09-20 보안 점검 후속)
--
-- 이 함수는 verify_jwt:true로 바꿔도 소용없다 — 공개 anon 키 자체가 유효한
-- JWT라 로그인 여부와 무관하게 통과한다(Supabase 공식 문서로 확인). 게다가
-- /plan은 로그인 없이 쓰는 게스트 기능이라 로그인을 강제할 수도 없다.
-- 그래서 로그인 게이트 대신 IP 기준 하루 호출 횟수를 제한한다.
--
-- 다른 두 캡(google_search_usage·ai_trip_plan_usage)과 다른 점: 그것들은
-- 클라이언트가 호출 "전에" 확인하는 구조(authenticated에게 grant)라 직접
-- 엣지 함수를 호출하면 우회된다. 이번엔 엣지 함수 안(서비스 롤)에서만
-- 확인+기록을 원자적으로 한 번에 하므로 service_role에게만 grant한다 —
-- 클라이언트가 이 함수를 직접 호출할 방법이 없다.
--
-- 한도 숫자는 DB에 저장하지 않는다 — 호출부(link-places-extract의
-- LINK_EXTRACT_DAILY_LIMIT)가 p_daily_limit 인자로 매번 넘긴다.

create table if not exists public.link_extract_usage (
  ip_hash text not null,
  usage_date date not null,
  request_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (ip_hash, usage_date)
);

alter table public.link_extract_usage enable row level security;
-- 클라이언트 직접 접근 정책 없음 — 아래 SECURITY DEFINER 함수(service_role 전용)로만 접근

create or replace function public.check_and_record_link_extract(p_ip_hash text, p_daily_limit integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_count integer;
begin
  insert into public.link_extract_usage (ip_hash, usage_date, request_count)
  values (p_ip_hash, current_date, 1)
  on conflict (ip_hash, usage_date)
  do update set
    request_count = public.link_extract_usage.request_count + 1,
    updated_at = now()
  returning request_count into v_count;

  return v_count <= p_daily_limit;
end;
$fn$;

revoke all on function public.check_and_record_link_extract(text, integer) from public;
grant execute on function public.check_and_record_link_extract(text, integer) to service_role;
