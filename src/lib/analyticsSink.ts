import { registerAnalyticsSink, type AnalyticsRecord } from './analytics';
import { getSupabase, isSupabaseConfigured } from './supabase';
import { normalizeLocale } from './locale';
import { loadVisitCountry } from './visitContext';
import i18n from './i18n';

/**
 * 로컬에 쌓이는 계측 이벤트를 Supabase로도 흘려보낸다.
 *
 * 착수 게이트는 여러 사용자의 합계를 봐야 의미가 있으므로 원격 적재가 필요하다.
 * 화면을 막지 않도록 모아서 보내고, 실패하면 조용히 버린다.
 */

const SESSION_KEY = 'wayknit:analytics-session';
const FLUSH_DELAY_MS = 5000;
const MAX_BATCH = 25;

let queue: AnalyticsRecord[] = [];
let timer: number | null = null;
let started = false;

function sessionId(): string {
  try {
    const saved = localStorage.getItem(SESSION_KEY);
    if (saved) return saved;
    const next = Math.random().toString(36).slice(2, 14);
    localStorage.setItem(SESSION_KEY, next);
    return next;
  } catch {
    return 'anon';
  }
}

async function flush(): Promise<void> {
  if (timer !== null) {
    window.clearTimeout(timer);
    timer = null;
  }
  const batch = queue.slice(0, MAX_BATCH);
  if (batch.length === 0) return;
  queue = queue.slice(batch.length);

  const sb = getSupabase();
  if (!sb) return;

  const { data } = await sb.auth.getSession();
  const userId = data.session?.user?.id ?? null;
  const locale = normalizeLocale(i18n.language);
  const sid = sessionId();
  // 국가는 비동기로 오므로 기록 시점이 아니라 보낼 때 붙인다.
  const country = await loadVisitCountry();

  try {
    await sb.from('analytics_events').insert(
      batch.map((r) => ({
        event: r.event,
        props: r.event === 'page_view' && country ? { ...r.props, country } : r.props,
        user_id: userId,
        session_id: sid,
        locale,
        created_at: new Date(r.at).toISOString(),
      })),
    );
  } catch {
    /* 계측 실패로 사용자 흐름이 막히지 않게 한다 */
  }
}

function schedule() {
  if (timer !== null) return;
  timer = window.setTimeout(() => void flush(), FLUSH_DELAY_MS);
}

/** 앱 시작 시 한 번 호출 */
export function startAnalyticsSink(): void {
  if (started || !isSupabaseConfigured || typeof window === 'undefined') return;
  // 접속 로그 미리보기처럼 액자 안에서 열린 페이지는 실제 방문이 아니다.
  if (window.self !== window.top) return;
  started = true;
  // 일찍 시작해 두어야 탭을 곧 닫아도 첫 전송 전에 답을 받을 수 있다.
  void loadVisitCountry();

  registerAnalyticsSink((record) => {
    queue.push(record);
    if (queue.length >= MAX_BATCH) {
      void flush();
    } else {
      schedule();
    }
  });

  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flush();
  });
}
