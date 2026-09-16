-- 여행 자료에 작성자를 남긴다 — 공유받은 자료 배지 (HANDOFF §22).
--
-- `trip_materials` 에는 `created_by`(uuid) 만 있고 이메일이 없다. 클라이언트는
-- `auth.users` 를 읽을 수 없으므로 uuid 로는 화면에 아무것도 표시할 수 없다.
-- `trip_pins` 와 같은 방식으로 이메일을 기록 시점에 복사해 둔다.

alter table public.trip_materials
  add column if not exists created_by_email text;

-- 작성자는 **트리거가 auth.uid() 로 찍는다.** 클라이언트가 보내는 값은 무시된다 —
-- 그래야 위조가 안 되고, §19-4 에서 겪은 "협업자 자료가 소유자 것으로 기록되는"
-- 사고도 구조적으로 막힌다.
create or replace function public.stamp_trip_material_author()
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
    -- 남이 내용을 고쳐도 "누가 올렸는지"는 바뀌지 않는다.
    new.created_by := old.created_by;
    new.created_by_email := old.created_by_email;
  end if;
  new.updated_by := auth.uid();
  return new;
end;
$$;

-- 🔴 **트리거보다 backfill 을 먼저 한다.** 순서를 뒤집으면 트리거의 UPDATE 분기가
-- `new.created_by_email := old.created_by_email`(= NULL) 로 되돌려 backfill 이
-- 조용히 아무 효과도 내지 않는다. 실제로 처음에 그렇게 했다가 전 행이 NULL 로
-- 남았다. (이미 트리거가 있는 DB 에 다시 적용한다면 이 UPDATE 앞뒤로
--  `alter table ... disable/enable trigger trip_materials_author` 로 감쌀 것.)
--
-- §19 이전(payload)에서 옮겨 온 행은 created_by 가 비어 있어 채울 값이 없다 —
-- 그런 자료는 배지 없이 보인다(작성자를 모르는 것이지 내 것이라는 뜻은 아니지만,
-- 모르는 사람의 이니셜을 지어내는 것보다 낫다).
update public.trip_materials m
   set created_by_email = u.email::text
  from auth.users u
 where m.created_by = u.id
   and m.created_by_email is null;

drop trigger if exists trip_materials_author on public.trip_materials;
create trigger trip_materials_author
  before insert or update on public.trip_materials
  for each row execute function public.stamp_trip_material_author();

-- ── 🔴 비로그인 열람자에게 이메일이 새지 않게 한다 ─────────────────
--
-- §14-3 과 **같은 함정이다.** SELECT 정책이 부모 여행 가시성에 위임하므로,
-- 공개 여행이면 anon 이 REST 로 이 테이블을 읽을 수 있다. RLS 는 행 단위라
-- 컬럼을 가리지 못한다. 실제로 anon 은 지금 테이블 전체 SELECT 권한을 갖고 있다.
--
-- 컬럼 단위 REVOKE 만으로는 안 된다 — 테이블 권한이 남아 있으면 그것이 모든
-- 컬럼을 덮는다. 테이블 권한을 걷고 필요한 컬럼만 다시 준다.
--
-- 공개 열람 경로(readMaterialsRemote)가 실제로 쓰는 것만 남긴다:
--   trip_id     RLS/WHERE
--   material_id 키
--   data        화면이 쓰는 값
--   created_at  ORDER BY
-- 하나라도 빠지면 공개 여행에서 자료가 통째로 안 보인다.

revoke select on public.trip_materials from anon;

grant select (trip_id, material_id, data, created_at, updated_at)
  on public.trip_materials to anon;

-- authenticated 는 그대로 둔다(전 컬럼). 로그인한 제3자가 공개 여행의 작성자를
-- REST 로 읽는 것은 여전히 가능하다 — §14-3 과 같은 남은 노출이고, 막으려면
-- 뷰나 SECURITY DEFINER RPC 가 필요하다. 지금은 익명 노출만 닫는다.
--
-- 앱도 함께 나눈다: readMaterialsRemote(tripId, includeAuthors) 로,
-- 소유자·협업자 경로에서만 created_by_email 을 요청한다.
