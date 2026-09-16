-- 핀 작성자를 비로그인 열람자에게 감춘다 (공동편집 4단계, HANDOFF §5-2-3 과 같은 판단)
--
-- 문제: trip_pins 의 SELECT 정책은 부모 여행 가시성에 위임한다
--   (EXISTS (SELECT 1 FROM wayknit_trips t WHERE t.id = trip_pins.trip_id))
-- RLS 는 행 단위라 컬럼을 가리지 못하므로, 공개 여행이면 anon 이 REST 로
-- created_by_email 을 그대로 읽을 수 있었다. 실측으로 확인했다:
--   curl .../trip_pins?select=created_by_email&trip_id=eq.<공개여행>  →  이메일 노출
--
-- §5-2-3 에서 "공개 여행이라도 누가 언제 편집했는지는 열람자에게 줄 정보가 아니다"라며
-- 활동 로그를 소유자·협업자로 좁혔다. 핀 작성자도 같은 성격의 정보다.
--
-- 컬럼 단위 REVOKE 만으로는 안 된다 — anon 에 테이블 전체 SELECT 권한이 있으면
-- 그것이 모든 컬럼을 덮어 컬럼 회수가 무효가 된다. 테이블 권한을 걷고
-- 필요한 컬럼만 다시 준다.
--
-- 주의: 공개 여행 열람(readBySlugRemote → attachPins)도 같은 테이블을 읽는다.
-- 아래 목록에서 하나라도 빠지면 공개 여행에 핀이 통째로 안 보인다.
--   trip_id     WHERE 절
--   created_at  ORDER BY 2차 기준
--   day/place_id/position/data  화면이 쓰는 값
-- 앱 쪽도 함께 고쳤다 — readPinsRemote(tripId, includeAuthors) 로 나눠,
-- 소유자·협업자 경로에서만 created_by_email 을 요청한다.

revoke select on public.trip_pins from anon;

grant select (trip_id, day, place_id, position, data, created_at, updated_at)
  on public.trip_pins to anon;

-- authenticated / service_role 은 그대로 둔다(전 컬럼 조회 가능).
-- 로그인한 제3자가 공개 여행의 작성자를 REST 로 읽는 것은 여전히 가능하다 —
-- 그것까지 막으려면 뷰나 SECURITY DEFINER RPC 가 필요하다. 지금은 익명 노출만 닫는다.
