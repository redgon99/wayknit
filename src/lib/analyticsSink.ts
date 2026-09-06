import { registerAnalyticsSink, type AnalyticsRecord } from './analytics';
import { getSupabase, isSupabaseConfigured } from './supabase';
import { normalizeLocale } from './locale';
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

  try {
    await sb.from('analytics_events').insert(
      batch.map((r) => ({
        event: r.event,
        props: r.props,
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
  started = true;

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
