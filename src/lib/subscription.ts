export type PlanId = 'free' | 'plus' | 'team';

export const FREE_MAX_TRIPS = 3;
export const FREE_DAILY_GOOGLE_SEARCHES = 40;
/** Plus 월 구독료(원) — docs/Wayknit_수익화_실행계획_2026-08-27.md §0 */
export const PLUS_MONTHLY_PRICE_KRW = 4900;

const SEARCH_COUNT_KEY = 'wayknit:google-search-count';
const SEARCH_COUNT_DATE_KEY = 'wayknit:google-search-date';

export function isPlusOrTeam(plan: PlanId): boolean {
  return plan === 'plus' || plan === 'team';
}

/** Plus/Team 또는 관리자 — 유료 기능·한도 해제 */
export function hasUnlimitedAccess(plan: PlanId, isAdmin = false): boolean {
  return isAdmin || isPlusOrTeam(plan);
}

export function canCreateTrip(
  plan: PlanId,
  currentCount: number,
  isAdmin = false
): boolean {
  if (hasUnlimitedAccess(plan, isAdmin)) return true;
  return currentCount < FREE_MAX_TRIPS;
}

export function canExportItinerary(plan: PlanId, isAdmin = false): boolean {
  return hasUnlimitedAccess(plan, isAdmin);
}

export function canUseCloudSync(
  plan: PlanId,
  isLoggedIn: boolean,
  isAdmin = false
): boolean {
  if (!isLoggedIn) return false;
  return hasUnlimitedAccess(plan, isAdmin);
}

/** Free + Google 검색 일일 캡 (관리자·Plus/Team 제외) */
export function canRunGoogleSearch(plan: PlanId, isAdmin = false): boolean {
  if (hasUnlimitedAccess(plan, isAdmin)) return true;
  const today = new Date().toISOString().slice(0, 10);
  try {
    const storedDate = localStorage.getItem(SEARCH_COUNT_DATE_KEY);
    let count = Number(localStorage.getItem(SEARCH_COUNT_KEY) ?? '0');
    if (storedDate !== today) {
      count = 0;
      localStorage.setItem(SEARCH_COUNT_DATE_KEY, today);
      localStorage.setItem(SEARCH_COUNT_KEY, '0');
    }
    return count < FREE_DAILY_GOOGLE_SEARCHES;
  } catch {
    return true;
  }
}

export function recordGoogleSearch(plan: PlanId, isAdmin = false): void {
  if (hasUnlimitedAccess(plan, isAdmin)) return;
  const today = new Date().toISOString().slice(0, 10);
  try {
    const storedDate = localStorage.getItem(SEARCH_COUNT_DATE_KEY);
    let count = Number(localStorage.getItem(SEARCH_COUNT_KEY) ?? '0');
    if (storedDate !== today) count = 0;
    count += 1;
    localStorage.setItem(SEARCH_COUNT_DATE_KEY, today);
    localStorage.setItem(SEARCH_COUNT_KEY, String(count));
  } catch {
    /* ignore */
  }
}

