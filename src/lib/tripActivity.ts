/**
 * 여행 활동 로그 — 공동편집 3단계.
 *
 * 핀 변경은 DB 트리거(`trip_pins_activity`)가 자동으로 남긴다.
 * 핀 밖의 행동(동선 생성·일차 추가)만 여기서 명시적으로 기록한다 —
 * wayknit_trips에 트리거를 달면 700ms 자동저장이 로그를 뒤덮는다.
 */
import { getSupabase } from './supabase';

export type TripActivityAction =
  | 'pin_add'
  | 'pin_remove'
  | 'pin_reorder'
  | 'pin_update'
  | 'route_generate'
  | 'day_add'
  | 'day_remove'
  | 'trip_rename';

/** 클라이언트가 직접 부를 수 있는 것만 — DB의 화이트리스트와 일치시킬 것 */
type ManualAction = 'route_generate' | 'day_add' | 'day_remove' | 'trip_rename';

export interface TripActivityEntry {
  id: number;
  actorId: string | null;
  actorEmail: string | null;
  action: TripActivityAction;
  target: string | null;
  detail: Record<string, unknown>;
  createdAt: number;
  /** 연속된 같은 종류를 묶었을 때 몇 건인지 (1이면 단건) */
  count: number;
}

interface ActivityRow {
  id: number;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  target: string | null;
  detail: Record<string, unknown> | null;
  created_at: string;
}

/**
 * 활동 로그를 최신순으로 읽는다.
 * 재정렬 한 번이 핀 개수만큼 행을 만들기 때문에 그대로 보여주면 목록이 도배된다 —
 * 같은 사람의 연속된 같은 action을 1분 단위로 묶어서 돌려준다.
 */
export async function listTripActivity(
  tripId: string,
  limit = 100
): Promise<TripActivityEntry[]> {
  const sb = getSupabase();
  if (!sb || !tripId) return [];
  const { data, error } = await sb
    .from('trip_activity')
    .select('id, actor_id, actor_email, action, target, detail, created_at')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.warn('활동 로그 조회 실패', error);
    return [];
  }
  return collapse((data ?? []) as ActivityRow[]);
}

const GROUP_WINDOW_MS = 60_000;

function collapse(rows: ActivityRow[]): TripActivityEntry[] {
  const out: TripActivityEntry[] = [];
  for (const row of rows) {
    const entry: TripActivityEntry = {
      id: row.id,
      actorId: row.actor_id,
      actorEmail: row.actor_email,
      action: row.action as TripActivityAction,
      target: row.target,
      detail: row.detail ?? {},
      createdAt: new Date(row.created_at).getTime(),
      count: 1,
    };
    const prev = out[out.length - 1];
    // 재정렬만 묶는다. 추가·삭제는 어떤 장소였는지가 정보라서 묶으면 안 된다.
    if (
      prev &&
      entry.action === 'pin_reorder' &&
      prev.action === 'pin_reorder' &&
      prev.actorId === entry.actorId &&
      Math.abs(prev.createdAt - entry.createdAt) <= GROUP_WINDOW_MS
    ) {
      prev.count += 1;
      continue;
    }
    out.push(entry);
  }
  return out;
}

/** 핀 밖의 행동을 기록한다. 실패해도 사용자 흐름을 막지 않는다. */
export async function logTripActivity(
  tripId: string,
  action: ManualAction,
  target?: string | null,
  detail?: Record<string, unknown>
): Promise<void> {
  const sb = getSupabase();
  if (!sb || !tripId) return;
  const { error } = await sb.rpc('log_trip_activity', {
    p_trip_id: tripId,
    p_action: action,
    p_target: target ?? null,
    p_detail: detail ?? {},
  });
  // 로그는 부수적인 기능이다 — 실패했다고 동선 생성을 되돌리지 않는다.
  if (error) console.warn('활동 기록 실패', action, error);
}

/**
 * 화면에 쓸 작성자 표기.
 * `'self'`면 "나", `'system'`이면 작성자를 알 수 없는 기록(서비스 롤 등)이다 —
 * 이 둘을 구분하지 않으면 남이 남긴 기록이 "나"로 보인다.
 */
export function actorKind(
  entry: TripActivityEntry,
  selfId: string | null
): { kind: 'self' } | { kind: 'system' } | { kind: 'other'; name: string } {
  if (selfId && entry.actorId === selfId) return { kind: 'self' };
  const email = entry.actorEmail;
  if (!email) return { kind: 'system' };
  return { kind: 'other', name: email.split('@')[0] };
}
