-- 활동 로그 보존 정책 (HANDOFF §18).
--
-- 문제는 두 겹이다.
--
-- (1) 재정렬이 행을 폭발시킨다. 핀 하나를 5번째에서 1번째로 끌면 1~5번 위치가
--     전부 밀려 `syncPins` 가 5행을 UPDATE 하고, 행 트리거가 `pin_reorder` 를
--     5건 남긴다. 화면은 `tripActivity.ts` 의 collapse() 로 이미 하나로 묶어
--     보여준다 — 즉 **남는 4건은 아무도 보지 않는 행**이다.
--
-- (2) 아무리 줄여도 무한히 쌓인다. 지우는 규칙이 아예 없었다.
--
-- (1)을 먼저 고친다. 쓰고 나서 지우는 것보다 안 쓰는 게 낫다.
--
-- 그리고 이 작업을 검증하다가 **기존 버그를 하나 찾아 같이 고쳤다** — 핀이 있는
-- 여행은 아예 삭제되지 않고 있었다. 아래 (0) 을 볼 것.

-- ── 0. 🔴 여행 삭제가 깨져 있었다 ───────────────────────────────────
--
-- `wayknit_trips` 를 지우면 `trip_pins` 와 `trip_activity` 가 함께 cascade 된다.
-- 그런데 핀이 cascade 로 지워질 때 이 트리거가 깨어나 `pin_remove` 를
-- `trip_activity` 에 넣으려 하고, 그 시점엔 부모 여행 행이 이미 사라졌다:
--
--   ERROR: 23503 insert or update on table "trip_activity"
--          violates foreign key constraint "trip_activity_trip_id_fkey"
--
-- 즉 **핀이 하나라도 있는 여행은 삭제 자체가 실패했다.** 2026-09-06 활동 로그
-- 트리거를 붙인 §5 3단계부터 있던 버그이고, `deleteRemote` 는 cascade 에
-- 전적으로 기대므로(여행 행 하나만 지운다) 앱에서 그대로 터진다.
--
-- 고침: DELETE 인데 부모 여행이 이미 없으면 = 여행 삭제 cascade 중이면
-- 아무것도 기록하지 않는다. 어차피 그 로그도 같은 cascade 로 사라진다.

-- ── 1. 재정렬을 기록 시점에 묶는다 ──────────────────────────────────
--
-- 화면의 collapse() 규칙과 **똑같이** 맞춘다: 직전 기록이 같은 사람의
-- pin_reorder 이고 1분 안이면 새로 남기지 않는다. 화면이 어차피 합쳐서
-- 보여주던 것이므로 **보이는 결과는 달라지지 않고 행만 줄어든다.**
--
-- "직전 한 건"만 보는 게 중요하다. 1분 창 안에 아무거나 있으면 건너뛰는
-- 방식으로 하면, 재정렬 → 핀 추가 → 재정렬 같은 경우에 마지막 재정렬이
-- 사라진다. 그건 화면이 합쳐 주지 않는(사이에 다른 항목이 낀) 별개 사건이다.
--
-- 같은 트랜잭션 안에서 앞선 행 트리거가 넣은 행도 보인다(같은 트랜잭션의
-- 자기 쓰기는 뒤 명령에서 보인다). 그래서 한 번의 재정렬이 정확히 1행이 된다.
-- created_at 기본값이 now() = 트랜잭션 시작 시각이라 같은 트랜잭션의 행은
-- 시각이 모두 같다 — 그래서 정렬에 id 를 함께 쓴다.

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
  v_trip   uuid;
  v_last_action text;
  v_last_actor  uuid;
  v_last_at     timestamptz;
begin
  v_trip := coalesce(new.trip_id, old.trip_id);

  -- (0) 여행 자체가 지워지는 중이면 아무것도 기록하지 않는다.
  if tg_op = 'DELETE' and not exists (
    select 1 from public.wayknit_trips t where t.id = v_trip
  ) then
    return old;
  end if;

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

  if v_action = 'pin_reorder' then
    select a.action, a.actor_id, a.created_at
      into v_last_action, v_last_actor, v_last_at
      from public.trip_activity a
     where a.trip_id = v_trip
     order by a.created_at desc, a.id desc
     limit 1;

    if v_last_action = 'pin_reorder'
       and v_last_actor is not distinct from auth.uid()
       and v_last_at > now() - interval '1 minute'
    then
      return coalesce(new, old);  -- 직전 재정렬에 이미 묶인다
    end if;
  end if;

  insert into public.trip_activity (trip_id, actor_id, actor_email, action, target, detail)
  values (
    v_trip,
    auth.uid(),
    public.current_actor_email(),
    v_action,
    v_target,
    v_detail
  );

  return coalesce(new, old);
end;
$$;

-- ── 2. 오래된 기록을 걷어낸다 ────────────────────────────────────────
--
-- 두 기준을 함께 쓴다. 날짜만 쓰면 짧은 기간에 폭주한 여행을 못 막고,
-- 개수만 쓰면 몇 년 전 기록이 조용한 여행에 영영 남는다.
--
--   보관 기간   180일
--   여행당 상한 500건 (최신 순)
--
-- 활동 탭은 한 번에 100건만 읽으므로(listTripActivity 의 limit) 500건이면
-- 화면에서 체감되는 손실이 없다.
--
-- SECURITY DEFINER 다 — 소유자가 테이블 소유자(postgres)와 같고
-- relforcerowsecurity=false 라 RLS 를 우회한다(적용 전 실제로 조회해 확인).
-- 사용자에게 DELETE 권한을 주는 것이 아니다. trip_activity 는 여전히
-- append-only 이고, 자기 흔적을 지우는 경로는 생기지 않는다.

create or replace function public.prune_trip_activity(
  p_keep_days     integer default 180,
  p_keep_per_trip integer default 500
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer := 0;
  v_n       integer;
begin
  delete from public.trip_activity
   where created_at < now() - make_interval(days => p_keep_days);
  get diagnostics v_n = row_count;
  v_deleted := v_deleted + v_n;

  with ranked as (
    select id,
           row_number() over (partition by trip_id order by created_at desc, id desc) as rn
      from public.trip_activity
  )
  delete from public.trip_activity a
   using ranked r
   where a.id = r.id
     and r.rn > p_keep_per_trip;
  get diagnostics v_n = row_count;
  v_deleted := v_deleted + v_n;

  return v_deleted;
end;
$$;

-- 클라이언트가 부를 일이 없다. 크론(postgres)만 실행한다.
revoke all on function public.prune_trip_activity(integer, integer) from public;

-- ── 3. 하루 한 번 돌린다 ─────────────────────────────────────────────
--
-- 공유 DB라 다른 서비스의 잡과 섞인다(jobid 1 investment-intelligence,
-- 2 easyshare-cleanup). 이름에 wayknit- 를 붙여 소속을 분명히 하고,
-- 그 둘과 겹치지 않는 한산한 시각(UTC 04:30 = KST 13:30)에 둔다.
-- 저 둘은 net.http_post 로 엣지 함수를 부르지만 이건 순수 SQL 이라
-- 함수 배포가 필요 없다.

select cron.schedule(
  'wayknit-trip-activity-retention',
  '30 4 * * *',
  $job$select public.prune_trip_activity();$job$
);
