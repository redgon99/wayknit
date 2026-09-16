const STORAGE_KEY = 'wayknit:onboarding-v1';
const SHARE_STORAGE_KEY = 'wayknit:share-onboarding-v1';

export function isOnboardingDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissOnboarding(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function shouldShowOnboarding(totalPinCount: number, hydrated: boolean): boolean {
  if (!hydrated || totalPinCount > 0) return false;
  return !isOnboardingDismissed();
}

export function isShareOnboardingDismissed(): boolean {
  try {
    return localStorage.getItem(SHARE_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissShareOnboarding(): void {
  try {
    localStorage.setItem(SHARE_STORAGE_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function shouldShowShareOnboarding(tripReady: boolean): boolean {
  if (!tripReady) return false;
  return !isShareOnboardingDismissed();
}

const FIRST_ITINERARY_GUIDE_KEY = 'wayknit:first-itinerary-guide-dismissed-v1';

export function isFirstItineraryGuideDismissed(): boolean {
  try {
    return localStorage.getItem(FIRST_ITINERARY_GUIDE_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissFirstItineraryGuide(): void {
  try {
    localStorage.setItem(FIRST_ITINERARY_GUIDE_KEY, '1');
  } catch {
    /* ignore */
  }
}

/**
 * N08(모바일 UX 리포트 2026-09-13) — `shouldShowOnboarding`(탭 안내 투어)이
 * 끝난 자리를 이어받는다. 투어와 동시에 뜨면 안내가 겹치므로 `!onboardingActive`가
 * 첫 조건이다. 목표(핀 3곳 + 동선 1개)를 채우면 매번 그 자리에서 꺼진다 —
 * 완료를 별도로 기록하지 않고 여행에 저장된 실제 상태(핀 수·동선 유무)로만
 * 판단한다(§FirstItineraryGuide.tsx 주석 참고).
 */
export function shouldShowFirstItineraryGuide(
  onboardingActive: boolean,
  hydrated: boolean,
  totalPinCount: number,
  pinGoal: number,
  hasRoute: boolean
): boolean {
  if (!hydrated || onboardingActive) return false;
  if (totalPinCount >= pinGoal && hasRoute) return false;
  return !isFirstItineraryGuideDismissed();
}

const PLAZA_NAV_KEY = 'wayknit:plaza-nav-unlocked-v1';

export function isPlazaNavUnlocked(): boolean {
  try {
    return localStorage.getItem(PLAZA_NAV_KEY) === '1';
  } catch {
    return false;
  }
}

export function unlockPlazaNav(): void {
  try {
    localStorage.setItem(PLAZA_NAV_KEY, '1');
  } catch {
    /* ignore */
  }
}
