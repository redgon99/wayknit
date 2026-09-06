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
