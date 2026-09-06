/** 클라이언트용 수집 기간 헬퍼 (Edge _shared/insightPeriod 와 동일 규칙) */

export interface InsightCollectPeriod {
  periodDays?: number;
  from?: string;
  to?: string;
}

export type InsightPeriodPreset = 7 | 30 | 90 | 0 | 'custom';

const STORAGE_KEY = 'wayknit:insight-collect-period';

export function defaultInsightCollectPeriod(): InsightCollectPeriod {
  return { periodDays: 30 };
}

export function loadInsightCollectPeriod(): InsightCollectPeriod {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultInsightCollectPeriod();
    const parsed = JSON.parse(raw) as InsightCollectPeriod;
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {
    /* ignore */
  }
  return defaultInsightCollectPeriod();
}

export function saveInsightCollectPeriod(period: InsightCollectPeriod): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(period));
  } catch {
    /* ignore */
  }
}

export function describeInsightCollectPeriod(period: InsightCollectPeriod): string {
  if (period.from || period.to) {
    if (period.from && period.to) return `${period.from} ~ ${period.to}`;
    if (period.from) return `${period.from} 이후`;
    return `${period.to} 이전`;
  }
  if (period.periodDays && period.periodDays > 0) return `최근 ${period.periodDays}일`;
  return '전체 기간';
}
