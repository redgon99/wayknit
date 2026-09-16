-- Free 캡(여행 3개·자료 20개)에 서버측 백스톱 추가 (§30-2)
--
-- 왜: subscription.ts의 canCreateTrip/canAddTripMaterial은 전부 클라이언트
-- 함수 호출이다. §29-45에서 이미 3곳이 이 체크를 빠뜨려 무제한으로 뚫려
-- 있던 걸 발견·수정했는데, 그건 "지금 아는 경로"만 막은 것이고 구조 자체는
-- 그대로였다 — 새 코드 경로가 생길 때마다 같은 구멍이 재발할 수 있다.
-- 클라이언트 체크는 UX용(즉시 피드백)으로 남겨두고, 이 마이그레이션은
-- 그 뒤에 최후의 저지선을 하나 더 둔다.
--
-- ⚠️ 숫자는 src/lib/subscription.ts의 FREE_MAX_TRIPS(3)·
-- FREE_MAX_TRIP_MATERIALS(20)와 반드시 같이 맞춰야 한다. 한쪽만 바꾸면
-- "클라이언트는 되는데 저장은 실패" 또는 그 반대가 된다.

-- ── 공용: 무제한 접근 판정 (admin 또는 plus/team) ─────────────────────
-- is_admin()과 같은 패턴(SECURITY DEFINER, 현재 세션 기준)을 그대로 따른다.
-- 항상 auth.uid()(현재 세션)만 보고, 임의의 다른 사용자 id는 받지 않는다 —
-- created_by 컬럼값을 신뢰하지 않고 실제 세션으로 판정하기 위함이다
-- (누가 다른 사람 id로 created_by를 채워도 우회가 안 된다).
create or replace function public.has_unlimited_access()
returns boolean
language sql
stable security definer
set search_path = public
as $$
  select
    public.is_admin()
    or coalesce(
      (select plan from public.profiles where id = auth.uid()) in ('plus', 'team'),
      false
    );
$$;

-- ── 여행 개수 캡 ────────────────────────────────────────────────────
create or replace function public.enforce_trip_count_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_count integer;
begin
  -- 서비스 롤(Edge Function 등 JWT 없는 컨텍스트)은 대상 밖 — 이미 RLS를
  -- 우회하는 특권 경로이므로 이 비즈니스 규칙도 적용하지 않는다.
  if v_uid is null then
    return new;
  end if;

  -- 오토세이브는 .upsert()를 쓴다(trips.ts). 기존 행 id면 UPDATE로
  -- 귀결될 뿐 "새 여행"이 아니므로 캡 대상이 아니다 — 여기서 걸러내지
  -- 않으면 이미 3개를 가진 사용자가 기존 여행을 고칠 때마다(700ms
  -- 오토세이브) 막혀버린다.
  if exists (select 1 from public.wayknit_trips where id = new.id) then
    return new;
  end if;

  if public.has_unlimited_access() then
    return new;
  end if;

  select count(*) into v_count from public.wayknit_trips where owner_id = v_uid;
  if v_count >= 3 then
    raise exception 'Free 플랜은 여행을 3개까지 저장할 수 있습니다.'
      using errcode = 'P0001', hint = 'FREE_TRIP_CAP_EXCEEDED';
  end if;
  return new;
end;
$$;

drop trigger if exists wayknit_trips_free_cap_guard on public.wayknit_trips;
create trigger wayknit_trips_free_cap_guard
  before insert on public.wayknit_trips
  for each row execute function public.enforce_trip_count_cap();

-- ── 여행 자료(사진·파일) 개수 캡 ───────────────────────────────────
create or replace function public.enforce_trip_material_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_count integer;
begin
  if v_uid is null then
    return new;
  end if;

  -- 자료 동기화도 upsert(trip_materials.upsert, onConflict trip_id+material_id).
  -- 기존 material_id를 수정(캡션 변경 등)하는 것도 여기 걸리므로, 이미
  -- 있는 행이면 "새 자료"가 아니니 건너뛴다.
  if exists (
    select 1 from public.trip_materials
    where trip_id = new.trip_id and material_id = new.material_id
  ) then
    return new;
  end if;

  -- 텍스트 메모는 스토리지를 안 쓴다 — canAddTripMaterial과 같은 기준으로
  -- 캡 계산에서 뺀다(클라이언트의 `materials.filter(m => m.storagePath)`와 동일).
  if (new.data ->> 'storagePath') is null then
    return new;
  end if;

  if public.has_unlimited_access() then
    return new;
  end if;

  select count(*) into v_count
  from public.trip_materials
  where trip_id = new.trip_id
    and (data ->> 'storagePath') is not null;

  if v_count >= 20 then
    raise exception 'Free 플랜은 여행당 자료를 20개까지 올릴 수 있습니다.'
      using errcode = 'P0001', hint = 'FREE_MATERIAL_CAP_EXCEEDED';
  end if;
  return new;
end;
$$;

drop trigger if exists trip_materials_free_cap_guard on public.trip_materials;
create trigger trip_materials_free_cap_guard
  before insert on public.trip_materials
  for each row execute function public.enforce_trip_material_cap();
