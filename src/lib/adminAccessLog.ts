import { normalizeLocale, pathWithLocale } from './locale';
import { getSupabase, isSupabaseConfigured } from './supabase';

/**
 * 관리자 접속 로그 화면(§42) — `analytics_events`에 쌓이는 `page_view` 이벤트를 본다.
 * 이벤트 자체는 LocaleLayout이 페이지 이동마다 기록(analytics.ts/analyticsSink.ts).
 *
 * 집계는 `admin_access_log` RPC가 DB에서 한다 — 브라우저가 최신 N건만 받아 세면
 * 방문이 늘수록 합계·TOP 10·경로 검색이 조용히 잘리기 때문이다. 관리자·테스트 계정과
 * 그 계정이 쓴 브라우저의 접속("내부 접속")도 RPC가 기본으로 뺀다.
 * 개인 식별정보를 담지 않는 설계에 따라 user_id는 받지 않고 로그인 여부만 받는다.
 */

function requireSupabase() {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase가 설정되어야 접속 로그를 볼 수 있습니다.');
  }
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase 클라이언트를 초기화할 수 없습니다.');
  return sb;
}

export interface AccessLogEntry {
  id: number;
  path: string;
  locale: string | null;
  loggedIn: boolean;
  sessionId: string | null;
  createdAt: string;
}

export interface AccessLogPathCount {
  path: string;
  count: number;
}

export interface AccessLogReport {
  /** 조건에 맞는 전체 조회수 — rows 길이와 다를 수 있다 */
  total: number;
  /** 고유 방문자(로그인 계정 또는 브라우저 세션 기준) */
  visitors: number;
  /** 내부 접속이라 빠진 조회수 — 내부 접속을 포함해 조회하면 0 */
  excluded: number;
  topPaths: AccessLogPathCount[];
  /** 최신순 기록 */
  rows: AccessLogEntry[];
}

/** 화면에 보여줄 최근 기록 수 */
export const ACCESS_LOG_ROW_LIMIT = 300;
/** CSV로 내려받을 수 있는 최대 건수(RPC 상한과 같다) */
export const ACCESS_LOG_EXPORT_LIMIT = 50000;

interface FetchAccessLogParams {
  since: string;
  path?: string;
  includeInternal?: boolean;
  rowLimit?: number;
}

interface AccessLogRpcResult {
  total: number;
  visitors: number;
  excluded: number;
  top_paths: AccessLogPathCount[];
  rows: Array<{
    id: number;
    path: string;
    locale: string | null;
    logged_in: boolean;
    session_id: string | null;
    created_at: string;
  }>;
}

export async function fetchAccessLog({
  since,
  path,
  includeInternal = false,
  rowLimit = ACCESS_LOG_ROW_LIMIT,
}: FetchAccessLogParams): Promise<AccessLogReport> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc('admin_access_log', {
    p_since: since,
    p_path: path?.trim() || null,
    p_include_internal: includeInternal,
    p_row_limit: rowLimit,
  });
  // Supabase 오류는 Error 인스턴스가 아니라서 그대로 던지면 화면이 원인을 못 보여준다.
  if (error) throw new Error(`접속 로그를 불러오지 못했습니다: ${error.message}`);

  const result = data as AccessLogRpcResult;
  return {
    total: result.total,
    visitors: result.visitors,
    excluded: result.excluded,
    topPaths: result.top_paths,
    rows: result.rows.map((r) => ({
      id: r.id,
      path: r.path,
      locale: r.locale,
      loggedIn: r.logged_in,
      sessionId: r.session_id,
      createdAt: r.created_at,
    })),
  };
}

/** 관리자 로그인 상태로 열어도 아무것도 바뀌지 않는 공개 페이지의 첫 경로 조각 */
const PREVIEW_SECTIONS = new Set([
  'guides',
  'plaza',
  'info',
  'setup',
  'help',
  'themes',
  'terms',
  'privacy',
  'trip',
]);

/**
 * 미리보기로 열 주소. 열면 안 되는 경로는 null을 준다.
 *
 * `analytics_events`는 누구나 쓸 수 있어 경로 값을 믿을 수 없다 — 외부 주소나
 * `javascript:`가 관리자 화면에서 열리지 않도록 같은 사이트의 공개 페이지만 허용하고,
 * 쿼리는 버린다. 플래너·관리자처럼 로그인 계정으로 동작하는 페이지도 열지 않는다.
 */
export function accessLogPreviewUrl(path: string, locale: string | null): string | null {
  if (!path.startsWith('/')) return null;
  let url: URL;
  try {
    url = new URL(path, window.location.origin);
  } catch {
    return null;
  }
  if (url.origin !== window.location.origin) return null;
  // `/..//evil.com`은 정리되면 `//evil.com`이 되므로 첫 조각이 비었다고 홈으로 보면 안 된다.
  if (url.pathname !== '/' && !PREVIEW_SECTIONS.has(url.pathname.split('/')[1])) return null;
  return pathWithLocale(url.pathname, normalizeLocale(locale));
}

export type AccessLogBucket = 'hour' | 'day';

export interface AccessLogPeriod {
  since: string;
  until: string;
  prevSince: string;
  prevUntil: string;
  bucket: AccessLogBucket;
}

/**
 * 조회 기간과 비교할 이전 기간. 오늘을 포함해 달력 기준 `days`일이라 그래프 첫 칸이
 * 하루의 일부만 담기는 일이 없다. 이전 기간은 지금과 같은 시각에서 끊는다 —
 * 오후 3시에 어제 하루 전체와 비교하면 오늘이 늘 줄어든 것처럼 보이기 때문이다.
 */
export function accessLogPeriod(days: number, now = new Date()): AccessLogPeriod {
  const since = new Date(now);
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (days - 1));
  const prevSince = new Date(since);
  prevSince.setDate(prevSince.getDate() - days);
  const prevUntil = new Date(now);
  prevUntil.setDate(prevUntil.getDate() - days);
  return {
    since: since.toISOString(),
    until: now.toISOString(),
    prevSince: prevSince.toISOString(),
    prevUntil: prevUntil.toISOString(),
    bucket: days === 1 ? 'hour' : 'day',
  };
}

export interface AccessLogTrendPoint {
  /** 조회 시간대 기준 `YYYY-MM-DDTHH:mm` */
  at: string;
  views: number;
  visitors: number;
}

export interface AccessLogTotals {
  views: number;
  visitors: number;
}

export interface AccessLogTrend {
  points: AccessLogTrendPoint[];
  current: AccessLogTotals;
  previous: AccessLogTotals;
  /** 이전 기간 전체에 기록이 있는지 — false면 증감을 보여주지 않는다 */
  previousComplete: boolean;
}

interface AccessLogTrendRpcResult {
  buckets: AccessLogTrendPoint[];
  current: AccessLogTotals;
  previous: AccessLogTotals;
  previous_complete: boolean;
}

export async function fetchAccessLogTrend(
  period: AccessLogPeriod,
  { path, includeInternal = false }: { path?: string; includeInternal?: boolean }
): Promise<AccessLogTrend> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc('admin_access_log_trend', {
    p_since: period.since,
    p_until: period.until,
    p_prev_since: period.prevSince,
    p_prev_until: period.prevUntil,
    p_path: path?.trim() || null,
    p_include_internal: includeInternal,
    p_bucket: period.bucket,
    p_tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  if (error) throw new Error(`추세를 불러오지 못했습니다: ${error.message}`);

  const result = data as AccessLogTrendRpcResult;
  return {
    points: result.buckets,
    current: result.current,
    previous: result.previous,
    previousComplete: result.previous_complete,
  };
}

export type AccessLogSection = 'home' | 'guides' | 'planner' | 'plaza' | 'info' | 'admin' | 'other';

export interface AccessLogSectionCount {
  key: AccessLogSection;
  views: number;
  visitors: number;
}

export interface AccessLogRankItem {
  key: string;
  count: number;
}

export interface AccessLogBreakdown {
  /** 조회수 많은 순 */
  sections: AccessLogSectionCount[];
  views: number;
  visitors: number;
  /** 같은 방문자의 조회가 30분 이상 끊기면 새 방문으로 센다 */
  visits: number;
  /** 한 페이지만 보고 끝난 방문 수 */
  bouncedVisits: number;
  /** 기간 안에 2번 이상 방문한 방문자 수 */
  returningVisitors: number;
  /** 유입별 진입 수 상위 10개. key가 'direct'면 직접 유입 */
  sources: AccessLogRankItem[];
  sourceTotal: number;
  /** 국가별 방문자 수 상위 10개. key는 ISO 두 글자 코드 */
  countries: AccessLogRankItem[];
  countryTotal: number;
}

interface AccessLogBreakdownRpcResult {
  sections: AccessLogSectionCount[];
  views: number;
  visitors: number;
  visits: number;
  bounced_visits: number;
  returning_visitors: number;
  sources?: AccessLogRankItem[];
  source_total?: number;
  countries?: AccessLogRankItem[];
  country_total?: number;
}

/** 방문은 여러 경로에 걸치므로 경로 검색을 받지 않는다 — 사이트 전체 기준이다. */
export async function fetchAccessLogBreakdown(
  period: AccessLogPeriod,
  includeInternal: boolean
): Promise<AccessLogBreakdown> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc('admin_access_log_breakdown', {
    p_since: period.since,
    p_until: period.until,
    p_include_internal: includeInternal,
  });
  if (error) throw new Error(`구역별 집계를 불러오지 못했습니다: ${error.message}`);

  const result = data as AccessLogBreakdownRpcResult;
  return {
    sections: result.sections,
    views: result.views,
    visitors: result.visitors,
    visits: result.visits,
    bouncedVisits: result.bounced_visits,
    returningVisitors: result.returning_visitors,
    // DB 함수가 이 항목을 돌려주기 전이어도 페이지가 깨지지 않게 한다.
    sources: result.sources ?? [],
    sourceTotal: result.source_total ?? 0,
    countries: result.countries ?? [],
    countryTotal: result.country_total ?? 0,
  };
}
