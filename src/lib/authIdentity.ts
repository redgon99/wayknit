/**
 * "지금 세션을 확인할 수 없는 것"과 "로그아웃한 것"을 구분한다.
 *
 * 왜 필요한가 (§29-31, 오프라인 데이터 소실 버그):
 *   로컬 저장소의 여행은 `ownerId`로 소유자를 구분하고, 읽을 때
 *   `ownedBy(trip, userId)`로 거른다. 그런데 `userId`가 null이면 이 함수는
 *   "ownerId가 없는 여행"만 내 것으로 본다 — 로그인해서 만든 여행은 전부
 *   ownerId가 있으니 **하나도 안 잡힌다**.
 *
 *   오프라인에서 새로고침하면 supabase가 만료된 토큰을 갱신하지 못해
 *   세션을 못 돌려준다(user=null). 그 순간 로컬에 멀쩡히 있는 내 여행이
 *   전부 필터에 걸려 "새 여행 · 핀 0"으로 보였다. 데이터가 지워진 게 아니라
 *   읽을 자격을 잃은 것이다.
 *
 * 판정 기준을 `navigator.onLine`으로 삼았다가 실패한 기록:
 *   비행기모드/Playwright 오프라인에서도 `navigator.onLine === true`로 남는
 *   경우가 확인됐다(2026-09-14 진단). 이 값은 신뢰할 수 없다.
 *
 *   대신 **supabase가 저장해 둔 세션(localStorage 'wayknit-auth')이 아직
 *   남아 있는가**를 본다. supabase-js는 사용자가 로그아웃하거나 리프레시
 *   토큰이 확실히 무효일 때만 이 키를 지우고, 네트워크 실패로 갱신하지
 *   못한 경우에는 그대로 둔다. 즉 "키는 있는데 세션을 못 받았다" =
 *   "지금 확인할 수 없을 뿐, 이 기기는 여전히 그 사람의 것"이다.
 *   키가 없으면(=진짜 로그아웃) 절대 대체하지 않는다 — 로그아웃한 사람에게
 *   이전 사용자의 여행이 보이면 안 되기 때문이다.
 */

/** supabase 클라이언트의 storageKey와 반드시 같아야 한다 (src/lib/supabase.ts) */
const AUTH_STORAGE_KEY = 'wayknit-auth';
const LAST_USER_KEY = 'wayknit-last-user';

export function rememberUserId(userId: string) {
  try {
    localStorage.setItem(LAST_USER_KEY, userId);
  } catch {
    /* 사파리 프라이빗 모드 등 — 기억 못 해도 온라인 동작엔 영향이 없다 */
  }
}

export function forgetUserId() {
  try {
    localStorage.removeItem(LAST_USER_KEY);
  } catch {
    /* ignore */
  }
}

export function lastKnownUserId(): string | null {
  try {
    return localStorage.getItem(LAST_USER_KEY);
  } catch {
    return null;
  }
}

/**
 * supabase가 기기에 저장해 둔 세션을 그대로 읽는다.
 * 네트워크가 없어 서버에 확인할 수 없을 때 "직전까지 로그인해 있던 상태"로
 * 화면을 이어가기 위한 것이므로, 만료 여부는 따지지 않는다.
 */
export function readPersistedSession(): { user?: { id?: unknown } } | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // supabase-js v2는 세션 객체를 그대로, v1은 { currentSession } 으로 감싼다
    return parsed?.currentSession ?? parsed ?? null;
  } catch {
    return null;
  }
}

/** 저장돼 있는(=아직 로그아웃되지 않은) 세션의 사용자 id. 없으면 null */
export function persistedSessionUserId(): string | null {
  const id = readPersistedSession()?.user?.id;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

/** 아직 로그아웃되지 않은 세션이 기기에 남아 있는가 */
export function hasPersistedSession(): boolean {
  return persistedSessionUserId() !== null;
}

/** 오프라인에서 로그아웃을 눌렀을 때처럼, 세션 정리가 네트워크 때문에 실패한 경우의 뒷정리 */
export function forgetPersistedSession() {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * 로컬 저장소 읽기에 쓸 소유자 id.
 * 세션이 살아 있으면 그대로, 세션을 **일시적으로** 확인하지 못하는 경우에만
 * 저장된 세션의 주인으로 메운다.
 */
export function effectiveOwnerId(userId?: string | null): string | null {
  if (userId) return userId;
  const persisted = persistedSessionUserId();
  if (!persisted) return null; // 로그아웃 상태 — 게스트 여행만 보여준다
  const last = lastKnownUserId();
  // 마지막 로그인 기록과 저장된 세션의 주인이 다르면 보수적으로 포기한다
  if (last && last !== persisted) return null;
  return persisted;
}
