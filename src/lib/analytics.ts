/**
 * 최소한의 제품 계측.
 *
 * 외부 분석 SDK를 붙이지 않고, 이벤트를 로컬에 누적하면서 등록된 싱크로도 흘려보낸다.
 * (원격 적재는 registerAnalyticsSink로 나중에 연결 — 실패해도 UI에 영향을 주지 않는다)
 */

export type AnalyticsEvent =
  | 'booking_link_click'
  | 'booking_search_click'
  | 'share_target_receive'
  | 'share_target_extract'
  | 'fixed_arrival_set'
  | 'trip_share_created'
  | 'plaza_import'
  | 'content_report_submit'
  /** 같은 여행을 두 명 이상이 동시에 보고 있음 — 공동편집 착수 판단 */
  | 'presence_multi_viewer'
  | 'route_generated'
  /** 앵커·영업시간을 지킬 수 없는 일정이 나옴 — 엔진 고도화 착수 판단 */
  | 'route_conflict';

export type AnalyticsProps = Record<string, string | number | boolean | null>;

export interface AnalyticsRecord {
  event: AnalyticsEvent;
  props: AnalyticsProps;
  at: number;
}

const STORAGE_KEY = 'wayknit:analytics-v1';
/** 로컬 버퍼 상한 — 브라우저 저장소를 계속 키우지 않는다 */
const MAX_RECORDS = 500;

type Sink = (record: AnalyticsRecord) => void;
const sinks: Sink[] = [];

export function registerAnalyticsSink(sink: Sink): () => void {
  sinks.push(sink);
  return () => {
    const idx = sinks.indexOf(sink);
    if (idx >= 0) sinks.splice(idx, 1);
  };
}

function readRecords(): AnalyticsRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AnalyticsRecord[]) : [];
  } catch {
    return [];
  }
}

export function trackEvent(event: AnalyticsEvent, props: AnalyticsProps = {}): void {
  const record: AnalyticsRecord = { event, props, at: Date.now() };

  try {
    const records = readRecords();
    records.push(record);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(-MAX_RECORDS)));
  } catch {
    /* 저장소가 막혀 있어도 계측 때문에 기능이 멈추면 안 된다 */
  }

  for (const sink of sinks) {
    try {
      sink(record);
    } catch {
      /* 싱크 실패는 무시 */
    }
  }
}

export function listLocalEvents(event?: AnalyticsEvent): AnalyticsRecord[] {
  const records = readRecords();
  return event ? records.filter((r) => r.event === event) : records;
}

export function countLocalEvents(event: AnalyticsEvent): number {
  return listLocalEvents(event).length;
}

export function clearLocalEvents(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
