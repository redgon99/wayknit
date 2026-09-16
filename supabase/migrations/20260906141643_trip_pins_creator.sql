-- 핀 작성자 표시 — 공동편집 4단계 (HANDOFF §14).
--
-- 🔴 재구성 파일이다. 이 마이그레이션은 2026-09-06에 MCP로 원격에 직접
-- 적용됐지만 그때 저장소에 옮겨적지 않았다 — trip_collaborators.sql 상단에
-- 남긴 경고("정작 생성 구문이 저장소에 없어서 새 환경에서는 재현되지 않았다")와
-- 똑같은 구멍이 핀 작성자 기능에도 있었던 것을 2026-09-09 마이그레이션
-- 드리프트 감사(HANDOFF §23)에서 뒤늦게 찾아 이 파일로 채워 넣는다.
-- 실제 DB는 이미 이 상태이므로 재실행은 전부 멱등하게만 짠다.
--
-- `trip_materials`에 같은 것을 만들 때(20260909100000_trip_materials_author.sql)
-- 이 구조를 그대로 베꼈다 — 아래는 그 원본이다.

alter table public.trip_pins
  add column if not exists created_by uuid references auth.users(id) on delete set null;

alter table public.trip_pins
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

alter table public.trip_pins
  add column if not exists created_by_email text;

-- 작성자는 **트리거가 auth.uid() 로 찍는다.** 클라이언트가 보내는 값은 무시된다.
create or replace function public.stamp_trip_pin_author()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.created_by_email := public.current_actor_email();
  else
    -- 남이 핀을 옮기거나 메모를 고쳐도 "누가 찍었는지"는 바뀌지 않는다.
    new.created_by := old.created_by;
    new.created_by_email := old.created_by_email;
  end if;
  new.updated_by := auth.uid();
  return new;
end;
$$;

-- 🔴 트리거보다 backfill 을 먼저 한다 — trip_materials_author.sql 과 같은 이유로,
-- 순서를 뒤집으면 트리거의 UPDATE 분기가 backfill 값을 도로 NULL 로 되돌린다.
update public.trip_pins p
   set created_by_email = u.email::text
  from auth.users u
 where p.created_by = u.id
   and p.created_by_email is null;

drop trigger if exists trip_pins_author on public.trip_pins;
create trigger trip_pins_author
  before insert or update on public.trip_pins
  for each row execute function public.stamp_trip_pin_author();

-- ── 비로그인 열람자에게 이메일이 새지 않게 한다 ────────────────────────
-- §14-3 — 뒤이은 20260908120000_trip_pins_hide_authors_from_anon.sql 이 이미
-- 원격에 적용해 둔 것과 같은 내용이다. 여기서도 다시 실행해도 안전하도록
-- 남겨 순서를 신경 쓰지 않고 재현할 수 있게 한다.
revoke select on public.trip_pins from anon;

grant select (trip_id, day, place_id, position, data, created_at, updated_at)
  on public.trip_pins to anon;
