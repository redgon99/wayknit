import type { MapProvider } from './mapProvider';
import { inferMapProviderFromLocation, resolveMapProvider } from './mapProvider';

const LS_KEY = 'wayknit:map-provider-choice-v1';

const DEFAULT_CENTER = { lat: 37.5665, lng: 126.978 };

export function hasSavedMapProviderChoice(): boolean {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw === 'kakao' || raw === 'google';
  } catch {
    return false;
  }
}

export function readMapProviderChoice(): MapProvider {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw === 'kakao' || raw === 'google') return raw;
  } catch {
    /* ignore */
  }
  return inferMapProviderFromLocation(DEFAULT_CENTER);
}

export function writeMapProviderChoice(choice: MapProvider): void {
  try {
    localStorage.setItem(LS_KEY, choice);
  } catch {
    /* ignore */
  }
}

export function isGoogleMapsConfigured(): boolean {
  return Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY);
}

export function isKakaoMapsConfigured(): boolean {
  return Boolean(import.meta.env.VITE_KAKAO_JS_KEY);
}
