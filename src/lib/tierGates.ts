import { countLocalEvents, type AnalyticsEvent } from './analytics';
import { getSupabase, isSupabaseConfigured } from './supabase';

/**
 * Tier 3 착수 게이트.
 *
 * Tier 3 항목은 "하면 좋은 것"이 아니라 "수요가 확인되면 하는 것"으로 미뤄 뒀다.
 * 무엇을 얼마나 보면 시작할지를 코드에 적어 두어야 나중에 감으로 결정하지 않는다.
 */

export interface TierGate {
  id: string;
  /** 착수를 검토할 항목 */
  item: string;
  /** 판단 근거가 되는 계측 이벤트 */
  event: AnalyticsEvent;
  /** 관찰 기간(일) 동안 이 값을 넘으면 착수 검토 */
  threshold: number;
  windowDays: number;
  /** 왜 이 지표로 판단하는가 */
  rationale: string;
}

export const TIER3_GATES: TierGate[] = [
  {
    id: 'T3-01',
    item: '실시간 공동편집',
    event: 'presence_multi_viewer',
    threshold: 30,
    windowDays: 30,
    rationale:
      '같은 여행을 두 명 이상이 동시에 보는 일이 실제로 반복될 때만 동시편집이 값을 한다.',
  },
  {
    id: 'T3-02',
    item: '예약 제휴 API 연동',
    event: 'booking_link_click',
    threshold: 100,
    windowDays: 30,
    rationale:
      '사용자가 직접 붙인 예약 링크를 실제로 누르는지 먼저 확인한다. 클릭이 없으면 제휴는 이르다.',
  },
  {
    id: 'T3-03',
    item: 'AI 완전 자동 일정 생성',
    event: 'route_generated',
    threshold: 500,
    windowDays: 30,
    rationale:
      '현재 결정론적 최적화기의 사용량이 충분히 쌓여야 자동 생성의 품질을 비교할 기준이 생긴다.',
  },
  {
    id: 'T3-04',
    item: '일정 엔진 고도화(VRPTW 등)',
    event: 'route_conflict',
    threshold: 50,
    windowDays: 30,
    rationale:
      '지금 엔진이 앵커·영업시간을 못 지키는 사례가 쌓일 때 비로소 엔진 교체가 정당해진다.',
  },
];

export interface GateStatus extends TierGate {
  count: number;
  /** 서로 다른 사용자·세션 수 (원격 집계에서만) */
  sessions?: number;
  met: boolean;
  source: 'remote' | 'local';
}

interface EventCountRow {
  event: string;
  total: number;
  sessions: number;
}

async function fetchRemoteCounts(sinceIso: string): Promise<Map<string, EventCountRow> | null> {
  if (!isSupabaseConfigured) return null;
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc('analytics_event_counts', { p_since: sinceIso });
  if (error || !data) return null;
  const map = new Map<string, EventCountRow>();
  for (const row of data as EventCountRow[]) map.set(row.event, row);
  return map;
}

/**
 * 게이트별 현재 수치. 원격 집계를 쓸 수 없으면(비관리자·미설정·조회 실패)
 * 이 브라우저에 쌓인 로컬 이벤트로 대신 보여준다.
 *
 * M1(관리자 검토 2026-09-16) — 예전엔 "이 이벤트의 원격 행이 있는가"로
 * source를 판단해서, 원격 조회 자체는 성공했는데 그 기간에 특정 이벤트가
 * 0건이면(group by라 0건인 이벤트는 행 자체가 없다) 로컬 값으로 조용히
 * 바뀌면서 "원격 집계 불가" 배너가 잘못 떴다. 원격 호출 성공 여부(remote가
 * null인지)로만 source를 정하고, 성공했는데 그 이벤트가 없으면 0건·
 * source='remote'로 둔다.
 */
export async function evaluateTier3Gates(): Promise<GateStatus[]> {
  const maxWindow = Math.max(...TIER3_GATES.map((g) => g.windowDays));
  const since = new Date(Date.now() - maxWindow * 24 * 60 * 60 * 1000).toISOString();
  const remote = await fetchRemoteCounts(since);
  const remoteOk = remote !== null;

  return TIER3_GATES.map((gate) => {
    const row = remote?.get(gate.event);
    const count = remoteOk ? (row?.total ?? 0) : countLocalEvents(gate.event);
    return {
      ...gate,
      count,
      sessions: row?.sessions,
      met: count >= gate.threshold,
      source: remoteOk ? 'remote' : 'local',
    };
  });
}
