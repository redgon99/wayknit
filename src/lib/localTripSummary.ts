/**
 * 이 기기에 저장된 여행 목록의 localStorage 키 — trips.ts가 읽고 쓴다.
 * 랜딩은 아래 요약만 필요해서, 플래너 저장 코드(trips.ts) 전체를 첫 화면 번들에 넣지 않으려고 따로 뺐다(§68).
 */
export const LS_TRIPS_STORE = 'wayknit:trips-store:v2';

/**
 * 랜딩 첫 화면의 "이어서 하기"(개편 3단계, 2026-11-21) — 이 기기에서 마지막으로 연 여행.
 * 핀이 하나도 없는 빈 "새 여행"은 이어서 할 게 없으니 보여 주지 않는다.
 */
export function readActiveLocalTripSummary(): { title: string; totalDays: number } | null {
  try {
    const raw = localStorage.getItem(LS_TRIPS_STORE);
    if (!raw) return null;
    const store = JSON.parse(raw) as {
      activeId?: string | null;
      trips?: { id: string; title: string; totalDays?: number; pinnedByDay?: Record<string, unknown[] | undefined> }[];
    };
    const trips = Array.isArray(store.trips) ? store.trips : [];
    const trip = trips.find((t) => t.id === (store.activeId ?? null));
    if (!trip) return null;
    const pins = Object.values(trip.pinnedByDay ?? {}).reduce((n, list) => n + (list?.length ?? 0), 0);
    if (pins === 0) return null;
    return { title: trip.title, totalDays: Math.max(1, trip.totalDays || 1) };
  } catch {
    return null;
  }
}
