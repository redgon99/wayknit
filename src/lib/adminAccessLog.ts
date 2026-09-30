import { getSupabase, isSupabaseConfigured } from './supabase';

/**
 * 관리자 접속 로그 화면(§42) — `analytics_events`에 쌓이는 `page_view` 이벤트를 읽는다.
 * 이벤트 자체는 LocaleLayout이 페이지 이동마다 기록(analytics.ts/analyticsSink.ts).
 * 개인 식별정보를 담지 않는 기존 설계를 그대로 따라 이메일은 저장·조회하지 않고,
 * 로그인 여부만 user_id 존재로 구분한다.
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
  userId: string | null;
  sessionId: string | null;
  createdAt: string;
}

export const ACCESS_LOG_LIMIT = 2000;

interface ListAccessLogParams {
  since: string;
  path?: string;
  limit?: number;
}

export async function listAccessLog({ since, path, limit = ACCESS_LOG_LIMIT }: ListAccessLogParams): Promise<AccessLogEntry[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('analytics_events')
    .select('id, props, user_id, session_id, locale, created_at')
    .eq('event', 'page_view')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;

  const rows = (data ?? []) as Array<{
    id: number;
    props: Record<string, unknown> | null;
    user_id: string | null;
    session_id: string | null;
    locale: string | null;
    created_at: string;
  }>;

  const trimmed = path?.trim().toLowerCase();
  const mapped: AccessLogEntry[] = rows.map((r) => ({
    id: r.id,
    path: typeof r.props?.path === 'string' ? r.props.path : '/',
    locale: r.locale,
    userId: r.user_id,
    sessionId: r.session_id,
    createdAt: r.created_at,
  }));

  return trimmed ? mapped.filter((e) => e.path.toLowerCase().includes(trimmed)) : mapped;
}

export interface AccessLogPathCount {
  path: string;
  count: number;
}

/** 경로별 조회수 상위 N개(내려받은 로그 안에서 집계 — 별도 API 호출 없음) */
export function topPaths(entries: AccessLogEntry[], limit = 10): AccessLogPathCount[] {
  const counts = new Map<string, number>();
  for (const e of entries) {
    counts.set(e.path, (counts.get(e.path) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([path, count]) => ({ path, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** 로그인 사용자(user_id)와 비로그인 세션(session_id)을 합친 고유 방문자 수 */
export function uniqueVisitors(entries: AccessLogEntry[]): number {
  const ids = new Set<string>();
  for (const e of entries) {
    ids.add(e.userId ? `u:${e.userId}` : `s:${e.sessionId ?? 'unknown'}`);
  }
  return ids.size;
}
