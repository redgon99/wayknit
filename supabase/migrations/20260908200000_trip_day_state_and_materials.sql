-- payload 통짜 저장을 행으로 쪼갠다 — 공동편집 5단계 (HANDOFF §19).
--
-- §5-2 에서 핀만 먼저 쪼갰고(`trip_pins`), 나머지 셋은 아직 `wayknit_trips.payload`
-- jsonb 한 덩어리다. 그래서 핀에서 고쳤던 last-write-wins 가 그대로 남아 있다:
--
--   A가 동선 생성 → payload 통째 저장
--   B가 동선 생성 → payload 통째 저장 (A의 것이 없는 자기 사본으로)
--   결과: A의 동선 소멸
--
-- 700ms 디바운스라 몇 초 안에 벌어진다.
--
-- 부수 효과도 크다. 실측하니 payload 가 **최대 151kB** 인데, 자동저장이 돌 때마다
-- 그 전체를 다시 쓰고 있었다. 일차 단위로 쪼개면 건드린 일차만 쓴다.
--
-- ── 쪼개는 단위를 어떻게 잡았나 ─────────────────────────────────────
--
-- `materials`      항목마다 독립된 id·createdAt 이 있다 → **행 1개 = 자료 1개**.
--                  핀과 같은 성격이라 같은 3-way 병합을 그대로 쓸 수 있다.
--
-- `routeOptionsByDay` · `generatedRouteByDay`
--                  둘 다 일차로 키가 잡힌 덩어리다 → **행 1개 = (여행, 일차)**.
--                  더 잘게 쪼갤 수도 있지만(구간·정거장) 그럴 이유가 없다.
--                  동선은 "그 일차 전체를 다시 계산한 결과"라 부분 병합이
--                  의미를 갖지 않는다. 일차 단위면 서로 다른 날을 만지는 흔한
--                  경우에 충돌이 아예 사라지고, 같은 날을 동시에 생성하는 것은
--                  나중 것이 이기는 게 의미상 맞다.
--
--                  둘을 **한 테이블에** 둔다. 키가 같고(여행,일차) 동선을 생성할 때
--                  함께 쓰인다(GeneratedRoute 안에 options 가 들어 있다).
--                  따로 만들면 생성 한 번에 두 테이블을 써야 한다.
--                  옵션만 바꿀 때는 그 컬럼만 UPDATE 하면 되므로 큰 동선 blob 을
--                  덩달아 다시 쓰지 않는다.

-- ── 1. 일차 상태 ────────────────────────────────────────────────────

create table if not exists public.trip_day_state (
  trip_id         uuid    not null references public.wayknit_trips(id) on delete cascade,
  day             integer not null,
  -- 둘 다 null 을 허용한다. 옵션만 있고 아직 동선을 안 만든 일차가 흔하다.
  route_options   jsonb,
  generated_route jsonb,
  updated_at      timestamptz not null default now(),
  updated_by      uuid references auth.users(id) on delete set null,
  primary key (trip_id, day)
);

drop trigger if exists trip_day_state_updated_at on public.trip_day_state;
create trigger trip_day_state_updated_at
  before update on public.trip_day_state
  for each row execute function public.set_updated_at();

alter table public.trip_day_state enable row level security;

-- 조회는 핀과 같은 규칙 — 부모 여행의 가시성에 위임한다(공개 여행 열람 포함).
drop policy if exists "trip_day_state_select" on public.trip_day_state;
create policy "trip_day_state_select" on public.trip_day_state
  for select using (
    exists (select 1 from public.wayknit_trips t where t.id = trip_day_state.trip_id)
  );

drop policy if exists "trip_day_state_insert" on public.trip_day_state;
create policy "trip_day_state_insert" on public.trip_day_state
  for insert with check (
    public.is_trip_owner(trip_id) or public.is_trip_editor(trip_id)
  );

drop policy if exists "trip_day_state_update" on public.trip_day_state;
create policy "trip_day_state_update" on public.trip_day_state
  for update using (
    public.is_trip_owner(trip_id) or public.is_trip_editor(trip_id)
  ) with check (
    public.is_trip_owner(trip_id) or public.is_trip_editor(trip_id)
  );

drop policy if exists "trip_day_state_delete" on public.trip_day_state;
create policy "trip_day_state_delete" on public.trip_day_state
  for delete using (
    public.is_trip_owner(trip_id) or public.is_trip_editor(trip_id)
  );

-- ── 2. 여행 자료 ────────────────────────────────────────────────────

create table if not exists public.trip_materials (
  trip_id     uuid not null references public.wayknit_trips(id) on delete cascade,
  -- 앱이 만든 자료 id 를 그대로 쓴다(핀의 place_id 와 같은 방식).
  material_id text not null,
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id) on delete set null,
  updated_by  uuid references auth.users(id) on delete set null,
  primary key (trip_id, material_id)
);

-- 목록은 만든 순서대로 보여준다.
create index if not exists trip_materials_trip_created_idx
  on public.trip_materials (trip_id, created_at);

drop trigger if exists trip_materials_updated_at on public.trip_materials;
create trigger trip_materials_updated_at
  before update on public.trip_materials
  for each row execute function public.set_updated_at();

alter table public.trip_materials enable row level security;

drop policy if exists "trip_materials_select" on public.trip_materials;
create policy "trip_materials_select" on public.trip_materials
  for select using (
    exists (select 1 from public.wayknit_trips t where t.id = trip_materials.trip_id)
  );

drop policy if exists "trip_materials_insert" on public.trip_materials;
create policy "trip_materials_insert" on public.trip_materials
  for insert with check (
    public.is_trip_owner(trip_id) or public.is_trip_editor(trip_id)
  );

drop policy if exists "trip_materials_update" on public.trip_materials;
create policy "trip_materials_update" on public.trip_materials
  for update using (
    public.is_trip_owner(trip_id) or public.is_trip_editor(trip_id)
  ) with check (
    public.is_trip_owner(trip_id) or public.is_trip_editor(trip_id)
  );

drop policy if exists "trip_materials_delete" on public.trip_materials;
create policy "trip_materials_delete" on public.trip_materials
  for delete using (
    public.is_trip_owner(trip_id) or public.is_trip_editor(trip_id)
  );

-- ── 3. 기존 payload 를 옮긴다 (반드시 필요) ─────────────────────────
--
-- 읽기가 새 테이블만 보게 되므로, 옮기지 않으면 **기존 53개 여행의 동선·옵션·자료가
-- 통째로 사라진 것처럼 보인다.** 여기서는 읽기만 한다 — payload 는 그대로 둔다.
-- 다만 앱이 앞으로 payload 를 `{}` 로 덮으므로, 되돌릴 근거는 아래 5번에서
-- 별도 스냅샷 테이블로 뜬다(payload 컬럼 자체는 백업이 되지 못한다).
--
-- `generatedRouteByDay` 의 값은 null 일 수 있다(그 일차를 아직 안 만듦).
-- jsonb 의 'null' 과 SQL NULL 을 섞지 않도록 여기서 정리해 둔다.

insert into public.trip_day_state (trip_id, day, route_options, generated_route)
select
  t.id,
  k.key::int,
  nullif(t.payload->'routeOptionsByDay'->k.key, 'null'::jsonb),
  nullif(t.payload->'generatedRouteByDay'->k.key, 'null'::jsonb)
from public.wayknit_trips t
cross join lateral (
  select key from jsonb_object_keys(coalesce(t.payload->'routeOptionsByDay', '{}'::jsonb)) as key
  union
  select key from jsonb_object_keys(coalesce(t.payload->'generatedRouteByDay', '{}'::jsonb)) as key
) k
where k.key ~ '^[0-9]+$'
on conflict (trip_id, day) do nothing;

insert into public.trip_materials (trip_id, material_id, data)
select t.id, m->>'id', m
from public.wayknit_trips t
cross join lateral jsonb_array_elements(coalesce(t.payload->'materials', '[]'::jsonb)) m
where m->>'id' is not null
on conflict (trip_id, material_id) do nothing;

-- ── 4. 실시간 ───────────────────────────────────────────────────────
--
-- 핀(trip_pins)과 같은 자리에 올려 둔다. 앱이 아직 구독하지 않아도
-- publication 에 있는 것 자체는 해가 없고, 나중에 붙일 때 DB 를 다시 만지지
-- 않아도 된다. (이미 들어 있으면 에러가 나므로 존재 여부를 보고 추가한다.)

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public' and tablename = 'trip_day_state'
  ) then
    alter publication supabase_realtime add table public.trip_day_state;
  end if;

  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public' and tablename = 'trip_materials'
  ) then
    alter publication supabase_realtime add table public.trip_materials;
  end if;
end $$;

-- ── 5. payload 원본 스냅샷 ──────────────────────────────────────────
--
-- 앱이 payload 를 더는 쓰지 않으므로(첫 저장에서 `{}` 로 덮인다) 되돌릴 근거를
-- 따로 남긴다. 핀 때 "payload.pinnedByDay 가 백업으로 남는다"고 적어 뒀던 것은
-- 사실이 아니었다 — writeRemote 가 payload 를 매번 새로 만들어 통째로 덮는다.

create table if not exists public.wayknit_trips_payload_backup_20260908 as
select id, payload, now() as backed_up_at from public.wayknit_trips;

alter table public.wayknit_trips_payload_backup_20260908 enable row level security;
-- 정책을 만들지 않는다 = 클라이언트는 한 행도 읽지 못한다. service_role 만 본다.
