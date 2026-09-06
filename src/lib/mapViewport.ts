import { KAKAO_LEVEL_DEFAULT } from './mapZoom';

const LS_KEY = 'wayknit:map-viewport-v1';

/** 서울 시청 근처 — 빈 여행·저장 뷰포트 없을 때 기본 */
export const DEFAULT_MAP_CENTER = { lat: 37.5665, lng: 126.978 };

export interface MapViewport {
  center: { lat: number; lng: number };
  level: number;
}

function isValidCoord(lat: unknown, lng: unknown): lat is number {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

export function readMapViewport(): MapViewport | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      lat?: unknown;
      lng?: unknown;
      level?: unknown;
    };
    if (!isValidCoord(parsed.lat, parsed.lng)) return null;
    const lat = parsed.lat as number;
    const lng = parsed.lng as number;
    const level =
      typeof parsed.level === 'number' && Number.isFinite(parsed.level)
        ? Math.min(14, Math.max(1, Math.round(parsed.level)))
        : KAKAO_LEVEL_DEFAULT;
    return { center: { lat, lng }, level };
  } catch {
    return null;
  }
}

export function writeMapViewport(center: { lat: number; lng: number }, level: number): void {
  if (!isValidCoord(center.lat, center.lng)) return;
  try {
    localStorage.setItem(
      LS_KEY,
      JSON.stringify({
        lat: center.lat,
        lng: center.lng,
        level: Math.min(14, Math.max(1, Math.round(level))),
      })
    );
  } catch {
    /* private mode 등 */
  }
}
