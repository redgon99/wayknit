-- 실시간 공동편집 1단계 (A안) — 핀을 payload jsonb에서 행으로 분리.
--
-- 문제: writeRemote가 여행 전체를 payload 한 덩어리로 upsert해서, 두 사람이
-- 같은 여행을 편집하면 나중에 저장한 쪽이 상대 핀을 통째로 덮어썼다
-- (700ms 자동저장이라 몇 초 안에 발생). 핀 1개 = 행 1개로 쪼개면 동시 편집이
-- 구조적으로 안전해진다.
--
-- 자연키는 (trip_id, day, place_id)다 — 앱이 이미 같은 날 같은 장소를
-- `p.id === place.id`로 중복 판정하고 있어(handleTogglePin) 이 조합이 유일하다.

create table if not exists public.trip_pins (
  trip_id    uuid not null references public.wayknit_trips(id) on delete cascade,
  day        int  not null check (day >= 1),
  place_id   text not null,
  -- 일차 내 순서. 동시 재정렬은 나중 쓰기가 이기지만 핀이 사라지지는 않는다.
  position   int  not null,
  -- PinnedPlace 전체(좌표·카테고리·체류시간·메모 등). 스키마가 자주 바뀌는
  -- 표현 데이터라 컬럼으로 펴지 않는다 — 충돌 단위는 "핀 1개"면 충분하다.
  data       jsonb not null,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (trip_id, day, place_id)
);

-- 읽기는 항상 "여행의 특정 일차를 순서대로"라서 이 순서 그대로 인덱스를 만든다.
create index if not exists trip_pins_trip_day_pos_idx
  on public.trip_pins (trip_id, day, position);

drop trigger if exists trip_pins_updated_at on public.trip_pins;
create trigger trip_pins_updated_at
  before update on public.trip_pins
  for each row execute function public.set_updated_at();

alter table public.trip_pins enable row level security;

-- SELECT: 부모 여행을 내가 볼 수 있으면 그 핀도 볼 수 있다.
-- wayknit_trips의 SELECT 정책 4개(소유·협업 / 공개 slug / 마당등록 / 관리자)를
-- 하나하나 베끼지 않고 서브쿼리로 위임한다 — 정책이 추가돼도 자동으로 따라온다.
-- (wayknit_trips 정책은 trip_pins를 참조하지 않으므로 순환은 생기지 않는다.)
drop policy if exists "trip_pins_select" on public.trip_pins;
create policy "trip_pins_select" on public.trip_pins
  for select
  using (
    exists (select 1 from public.wayknit_trips t where t.id = trip_pins.trip_id)
  );

-- 쓰기: 소유자 또는 editor 협업자만. viewer는 막힌다.
-- 여기서는 is_trip_owner/is_trip_editor(security definer)를 쓴다 —
-- 서브쿼리로 wayknit_trips를 읽으면 공개 여행까지 통과해버린다.
drop policy if exists "trip_pins_insert" on public.trip_pins;
create policy "trip_pins_insert" on public.trip_pins
  for insert
  with check (
    public.is_trip_owner(trip_id) or public.is_trip_editor(trip_id)
  );

drop policy if exists "trip_pins_update" on public.trip_pins;
create policy "trip_pins_update" on public.trip_pins
  for update
  using (
    public.is_trip_owner(trip_id) or public.is_trip_editor(trip_id)
  )
  with check (
    public.is_trip_owner(trip_id) or public.is_trip_editor(trip_id)
  );

drop policy if exists "trip_pins_delete" on public.trip_pins;
create policy "trip_pins_delete" on public.trip_pins
  for delete
  using (
    public.is_trip_owner(trip_id) or public.is_trip_editor(trip_id)
  );

-- ── 기존 payload.pinnedByDay → 행 이전 ─────────────────────────────────
-- payload는 지우지 않는다. 롤백하려면 이 테이블만 버리면 되고,
-- 읽기 경로가 아직 payload를 폴백으로 쓸 수 있어야 한다.
insert into public.trip_pins (trip_id, day, place_id, position, data, created_by)
select t.id,
       d.key::int,
       p.value->>'id',
       p.ordinality::int,
       p.value,
       t.owner_id
  from public.wayknit_trips t
  cross join lateral jsonb_each(coalesce(t.payload->'pinnedByDay', '{}'::jsonb)) d
  cross join lateral jsonb_array_elements(d.value) with ordinality p(value, ordinality)
 where jsonb_typeof(d.value) = 'array'
   and d.key ~ '^[0-9]+$'
   and p.value->>'id' is not null
on conflict (trip_id, day, place_id) do nothing;

-- 핀 행을 실시간 구독 대상으로 (2단계에서 postgres_changes로 쓴다)
alter publication supabase_realtime add table public.trip_pins;
