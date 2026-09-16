-- 협업자가 서로를 볼 수 있게 한다 (활동 로그 마감, HANDOFF §16).
--
-- 문제: `collab_select` 는 `auth.uid() = user_id OR is_trip_owner(trip_id)` 였다.
-- 그래서 협업자는 **자기 행 하나만** 읽었다. 공동편집자 모달을 협업자에게도
-- 열어 줘도 "사람" 탭에 자기밖에 안 나온다 — 함께 편집하는 사람이 누구인지
-- 모르는 채로 같은 여행을 고치게 된다.
--
-- 이 여행의 협업자면 같은 여행의 협업자 명단을 볼 수 있게 넓힌다.
-- 범위는 여전히 그 여행 하나다 — 남의 여행 협업자는 보이지 않는다.
--
-- 노출되는 것: 같은 여행 협업자의 이메일과 역할.
-- 이미 §14 에서 핀 작성자 배지로 협업자 이메일을 서로에게 보여주고 있고,
-- 활동 로그(§5-2-3, trip_activity_select)도 소유자·협업자에게 열려 있다.
-- 즉 새로 여는 정보가 아니라 같은 선을 맞추는 것이다.
-- 공개 여행 열람자(anon·제3자)에게는 여전히 아무것도 열리지 않는다 —
-- 조건이 is_trip_collaborator 라 그 여행의 협업자여야만 한다.
--
-- 재귀 걱정: `is_trip_collaborator` 는 trip_collaborators 를 다시 읽지만
-- SECURITY DEFINER 이고 소유자가 테이블 소유자(postgres)와 같으며
-- 테이블에 FORCE ROW LEVEL SECURITY 가 걸려 있지 않다. 따라서 함수 안에서는
-- RLS 를 우회하고 정책이 재진입하지 않는다. (확인함: relforcerowsecurity=false)
--
-- 초대 대기 목록(trip_invites)은 그대로 소유자 전용으로 둔다 — 아직 수락하지
-- 않은 사람의 이메일까지 협업자에게 보여 줄 이유가 없다.

drop policy if exists "collab_select" on public.trip_collaborators;

create policy "collab_select" on public.trip_collaborators
  for select
  using (
    auth.uid() = user_id
    or public.is_trip_owner(trip_id)
    or public.is_trip_collaborator(trip_id)
  );
