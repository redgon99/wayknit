/**
 * 구 브랜드(Tripasist → WayMeld → Wayknit) 로컬 스토리지 키 이전.
 * 앱 기동 시 한 번 호출해 기존 사용자 데이터·세션을 유지한다.
 *
 * 키를 하나씩 나열하지 않고 접두사로 훑는다 — 전에 쓰던 수기 목록은
 * 나중에 추가된 키(analytics·map-viewport·presence-guest-id 등)를 놓치고 있었다.
 * 개명이 또 생기면 LEGACY_BRANDS에 한 줄만 더하면 된다.
 */
const CURRENT_BRAND = 'wayknit';
/** 최신 브랜드부터 나열할 것 — 먼저 옮겨진 값이 이긴다(§migrate 루프) */
const LEGACY_BRANDS = ['waymeld', 'tripasist'];

/** `waymeld:locale-v1` → `wayknit:locale-v1`, `waymeld-auth` → `wayknit-auth` */
function rebrand(key: string, legacy: string): string | null {
  for (const sep of [':', '-']) {
    const prefix = legacy + sep;
    if (key.startsWith(prefix)) return CURRENT_BRAND + sep + key.slice(prefix.length);
  }
  return null;
}

export function migrateLegacyStorageKeys(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    // 반복 중 삭제하므로 키 목록을 먼저 뜬다
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k != null) keys.push(k);
    }

    // 최신 브랜드부터 옮긴다. 아래 setItem이 "대상이 비어 있을 때만" 쓰므로
    // waymeld 값이 먼저 자리를 잡고, 더 오래된 tripasist 값은 덮어쓰지 못한 채 정리된다.
    for (const legacy of LEGACY_BRANDS) {
      for (const key of keys) {
        const next = rebrand(key, legacy);
        if (next == null) continue;
        try {
          if (localStorage.getItem(next) == null) {
            const prev = localStorage.getItem(key);
            if (prev != null) localStorage.setItem(next, prev);
          }
          localStorage.removeItem(key);
        } catch {
          /* 개별 키 실패는 건너뛴다 */
        }
      }
    }
  } catch {
    /* private mode 등 localStorage 접근 자체가 막힌 경우 */
  }
}
