-- N06(모바일 UX 리포트 2026-09-13, 신규 제안) — 동행자 후보 투표.
--
-- 왜 핀 data(jsonb)에 안 넣고 별도 테이블인가:
--   협업자 둘이 같은 핀에 동시에 투표하면 핀 행을 통째로 덮어써 한쪽이
--   사라진다(last-writer-wins). 투표자마다 자기 행을 가지면 충돌이 없다.
--   PK (trip_id, place_id, user_id) = "한 사람은 한 장소에 표 하나".
--
-- 적용: 이 파일은 기록용이고, 실제 적용은 MCP apply_migration으로 한다
--   (HANDOFF §1-2 — CLI db push는 이력 드리프트 때문에 쓰지 않는다).

create table if not exists public.trip_pin_votes (
  trip_id    uuid        not null references public.wayknit_trips(id) on delete cascade,
  place_id   text        not null,
  user_id    uuid        not null references auth.users(id) on delete cascade,
  vote       text        not null check (vote in ('want', 'hold')),
  updated_at timestamptz not null default now(),
  primary key (trip_id, place_id, user_id)
);

create index if not exists trip_pin_votes_trip_idx on public.trip_pin_votes (trip_id);

alter table public.trip_pin_votes enable row level security;

-- 읽기: 그 여행을 볼 수 있는 사람이면 누구나(소유자·협업자). wayknit_trips의
-- RLS가 "볼 수 있는가"를 이미 정하므로 trip_pins와 같은 방식으로 위임한다.
drop policy if exists trip_pin_votes_select on public.trip_pin_votes;
create policy trip_pin_votes_select on public.trip_pin_votes
  for select using (
    exists (select 1 from public.wayknit_trips t where t.id = trip_pin_votes.trip_id)
  );

-- 쓰기: **자기 표만**, 그리고 소유자거나 협업자(열람 전용 포함 — 투표는 편집이
-- 아니라 의견이라 viewer도 낼 수 있어야 한다).
drop policy if exists trip_pin_votes_insert on public.trip_pin_votes;
create policy trip_pin_votes_insert on public.trip_pin_votes
  for insert with check (
    user_id = auth.uid()
    and (public.is_trip_owner(trip_id) or public.is_trip_collaborator(trip_id))
  );

drop policy if exists trip_pin_votes_update on public.trip_pin_votes;
create policy trip_pin_votes_update on public.trip_pin_votes
  for update using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (public.is_trip_owner(trip_id) or public.is_trip_collaborator(trip_id))
  );

drop policy if exists trip_pin_votes_delete on public.trip_pin_votes;
create policy trip_pin_votes_delete on public.trip_pin_votes
  for delete using (user_id = auth.uid());

-- 실시간: 상대의 표가 바로 보이게
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public' and tablename = 'trip_pin_votes'
  ) then
    alter publication supabase_realtime add table public.trip_pin_votes;
  end if;
end $$;
