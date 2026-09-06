-- 실시간 공동편집 3단계 — 활동 로그.
--
-- 누가 언제 무엇을 했는지 남긴다. 핀 변경은 §2-3 감사 로그와 같은 이유로
-- **DB 트리거**로 붙인다 — 호출부마다 로깅을 넣으면 새 경로가 생길 때 빠뜨리고,
-- 실시간 병합처럼 우회 경로가 늘어나면 더 그렇다.
--
-- 반대로 "동선 생성"·"일차 추가"는 trip_pins를 건드리지 않는 데다
-- wayknit_trips에 트리거를 달면 700ms 자동저장이 로그를 뒤덮으므로
-- (§2-5에서 같은 이유로 wayknit_trips는 감사 대상에서 뺐다),
-- 클라이언트가 그 순간에만 명시적으로 부르는 RPC로 받는다.

create table if not exists public.trip_activity (
  id          bigint generated always as identity primary key,
  trip_id     uuid not null references public.wayknit_trips(id) on delete cascade,
  actor_id    uuid references auth.users(id) on delete set null,
  -- auth.users를 클라이언트가 읽을 수 없으므로(RLS) 기록 시점에 복사해 둔다.
  -- trip_collaborators.email과 같은 방식.
  actor_email text,
  action      text not null,
  target      text,
  detail      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists trip_activity_trip_created_idx
  on public.trip_activity (trip_id, created_at desc);

alter table public.trip_activity enable row level security;

-- 조회는 그 여행의 소유자·협업자만. 공개 여행이라도 활동 이력은 공개하지 않는다
-- (누가 언제 편집했는지는 열람자에게 줄 정보가 아니다) — 그래서 trip_pins처럼
-- 부모 가시성에 위임하지 않고 소유·협업으로 좁힌다.
drop policy if exists "trip_activity_select" on public.trip_activity;
create policy "trip_activity_select" on public.trip_activity
  for select
  using (
    public.is_trip_owner(trip_id) or public.is_trip_collaborator(trip_id)
  );

-- INSERT/UPDATE/DELETE 정책은 일부러 만들지 않는다 — append-only.
-- 기록은 아래 SECURITY DEFINER 경로로만 들어간다(자기 흔적을 지울 수 없다).

create or replace function public.current_actor_email()
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select u.email::text from auth.users u where u.id = auth.uid();
$$;

create or replace function public.log_trip_pin_activity()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_action text;
  v_target text;
  v_detail jsonb := '{}'::jsonb;
begin
  if tg_op = 'INSERT' then
    v_action := 'pin_add';
    v_target := new.data->>'name';
    v_detail := jsonb_build_object('day', new.day);
  elsif tg_op = 'DELETE' then
    v_action := 'pin_remove';
    v_target := old.data->>'name';
    v_detail := jsonb_build_object('day', old.day);
  else
    -- 순서만 바뀐 UPDATE는 재정렬이다. 내용까지 바뀌었으면 편집으로 본다.
    if old.data = new.data and old.position is distinct from new.position then
      v_action := 'pin_reorder';
    elsif old.data = new.data then
      return new;  -- 실질 변화 없음 — 기록하지 않는다
    else
      v_action := 'pin_update';
    end if;
    v_target := new.data->>'name';
    v_detail := jsonb_build_object('day', new.day);
  end if;

  insert into public.trip_activity (trip_id, actor_id, actor_email, action, target, detail)
  values (
    coalesce(new.trip_id, old.trip_id),
    auth.uid(),
    public.current_actor_email(),
    v_action,
    v_target,
    v_detail
  );

  return coalesce(new, old);
end;
$$;

drop trigger if exists trip_pins_activity on public.trip_pins;
create trigger trip_pins_activity
  after insert or update or delete on public.trip_pins
  for each row execute function public.log_trip_pin_activity();

-- 핀 밖의 행동(동선 생성·일차 추가)을 클라이언트가 그 순간에만 기록하는 통로.
create or replace function public.log_trip_activity(
  p_trip_id uuid,
  p_action  text,
  p_target  text default null,
  p_detail  jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  -- SECURITY DEFINER라 RLS를 우회한다 — 권한을 여기서 직접 확인해야 한다.
  if not (public.is_trip_owner(p_trip_id) or public.is_trip_editor(p_trip_id)) then
    raise exception '이 여행을 편집할 권한이 없습니다.' using errcode = '42501';
  end if;
  -- 호출자가 아무 action이나 심지 못하게 화이트리스트로 막는다.
  if p_action not in ('route_generate', 'day_add', 'day_remove', 'trip_rename') then
    raise exception '허용되지 않은 action입니다: %', p_action using errcode = '22023';
  end if;

  insert into public.trip_activity (trip_id, actor_id, actor_email, action, target, detail)
  values (p_trip_id, auth.uid(), public.current_actor_email(), p_action, p_target,
          coalesce(p_detail, '{}'::jsonb));
end;
$$;

revoke all on function public.log_trip_activity(uuid, text, text, jsonb) from public;
grant execute on function public.log_trip_activity(uuid, text, text, jsonb) to authenticated;
revoke all on function public.current_actor_email() from public;
grant execute on function public.current_actor_email() to authenticated;
