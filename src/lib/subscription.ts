import { getSupabase, isSupabaseConfigured } from './supabase';

export type PlanId = 'free' | 'plus' | 'team';

export const FREE_MAX_TRIPS = 3;
export const FREE_DAILY_GOOGLE_SEARCHES = 40;
/** Free 여행 1개당 업로드 자료(사진·파일) 개수 캡 — 텍스트 메모는 스토리지를 안 쓰므로 제외 */
export const FREE_MAX_TRIP_MATERIALS = 20;
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

/** Free는 여행당 업로드 자료 20개까지 — 협업자가 여럿이어도 저장 용량이 무한정 늘지 않게 막는다 */
export function canAddTripMaterial(
  plan: PlanId,
  currentFileCount: number,
  isAdmin = false
): boolean {
  if (hasUnlimitedAccess(plan, isAdmin)) return true;
  return currentFileCount < FREE_MAX_TRIP_MATERIALS;
}

/** 자료(사진·파일) 오프라인 저장 — Plus/Team/관리자 전용 킬러기능 */
export function canUseOfflineMaterials(plan: PlanId, isAdmin = false): boolean {
  return hasUnlimitedAccess(plan, isAdmin);
}

/**
 * §30-4 — localStorage 카운트는 시크릿창·캐시삭제로 즉시 리셋돼 사실상
 * 무의미했다(§30-1 재검토에서 발견). 로그인 사용자는 서버(Supabase RPC,
 * `can_run_google_search`/`record_google_search`)로 옮기고, 계정이 없는
 * 게스트만 이 localStorage 폴백을 그대로 쓴다.
 *
 * 이건 비용 방어가 아니다 — Google Maps SDK는 API 키를 브라우저에
 * 그대로 노출해 client→Google로 직접 호출한다(googleMaps.ts). 진짜
 * 비용 방어는 Google Cloud Console의 키 제한(HTTP 리퍼러+쿼터)이고
 * 이 저장소 밖의 설정이다. 여기서 막는 건 "로그인한 Free 사용자가
 * 평범한 사용 흐름에서 하루 40회를 못 넘게" 뿐이다(마이그레이션 파일
 * 상단 주석 참고).
 */
function canRunGoogleSearchLocal(): boolean {
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

function recordGoogleSearchLocal(): void {
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

/** Free + Google 검색 일일 캡 (관리자·Plus/Team 제외) — §30-4 주석 참고 */
export async function canRunGoogleSearch(
  plan: PlanId,
  isAdmin = false,
  userId?: string | null
): Promise<boolean> {
  if (hasUnlimitedAccess(plan, isAdmin)) return true;
  if (!userId || !isSupabaseConfigured) return canRunGoogleSearchLocal();

  const sb = getSupabase();
  if (!sb) return canRunGoogleSearchLocal();
  try {
    const { data, error } = await sb.rpc('can_run_google_search');
    if (error) throw error;
    return data === true;
  } catch (e) {
    // 서버 조회가 안 되면(오프라인 등) 막는 것보다 로컬 기준으로 이어가는 편이 낫다
    console.warn('검색 한도 서버 조회 실패 — 로컬 기준으로 대체', e);
    return canRunGoogleSearchLocal();
  }
}

export async function recordGoogleSearch(
  plan: PlanId,
  isAdmin = false,
  userId?: string | null
): Promise<void> {
  if (hasUnlimitedAccess(plan, isAdmin)) return;
  if (!userId || !isSupabaseConfigured) {
    recordGoogleSearchLocal();
    return;
  }

  const sb = getSupabase();
  if (!sb) {
    recordGoogleSearchLocal();
    return;
  }
  try {
    const { error } = await sb.rpc('record_google_search');
    if (error) throw error;
  } catch (e) {
    // 이번 한 건이 서버에 안 찍힐 뿐, 검색 자체는 이미 끝났다 — 조용히 넘어간다
    console.warn('검색 횟수 서버 기록 실패', e);
  }
}

