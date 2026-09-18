import type { GuideCoursePin } from '../types/guides';
import type { SimpleCategory } from '../types';
import { applyImportRows, type PinImportOptions, type PinImportResult, type RawPinRow } from './importPins';
import { suggestStayMinutes } from './categories';

const SIMPLE_TO_LABEL: Record<SimpleCategory, string> = {
  tour: '관광지',
  food: '맛집',
  cafe: '카페',
  stay: '숙소',
  culture: '문화',
  shop: '쇼핑',
  beauty: '뷰티',
  market: '시장',
  transport: '교통',
  road: '거리',
  other: '기타',
};

function dayFromPin(pin: GuideCoursePin): number {
  const t = `${pin.dayLabel ?? ''} ${pin.label ?? ''}`;
  const m = t.match(/(\d+)\s*일차/) || t.match(/day\s*(\d+)/i);
  if (m) return Math.max(1, Number(m[1]));
  return 1;
}

function stayFromTime(time?: string): number | undefined {
  if (!time) return undefined;
  const m = time.match(/(\d{1,2}):(\d{2})\s*[–\-~〜～]\s*(\d{1,2}):(\d{2})/);
  if (!m) return undefined;
  const a = Number(m[1]) * 60 + Number(m[2]);
  const b = Number(m[3]) * 60 + Number(m[4]);
  const d = b - a;
  if (d >= 15 && d <= 8 * 60) return d;
  return undefined;
}

function inferSimpleCategory(pin: GuideCoursePin): SimpleCategory {
  const hay = `${pin.categoryLabel ?? ''} ${pin.name}`;
  if (/카페|커피|cafe|coffee/i.test(hay)) return 'cafe';
  if (/맛집|식당|음식|한식|일식|중식|food|restaurant/i.test(hay)) return 'food';
  if (/숙소|호텔|리조트|stay|hotel/i.test(hay)) return 'stay';
  if (/시장|마켓|market/i.test(hay)) return 'market';
  if (/박물관|전시|뮤지엄|아트|museum/i.test(hay)) return 'culture';
  if (/해변|해수욕|사찰|궁|타워|관광|공원|정자/i.test(hay)) return 'tour';
  if (/쇼핑|면세|백화점/i.test(hay)) return 'shop';
  return 'tour';
}

export function guideCoursePinsToRows(pins: GuideCoursePin[]): RawPinRow[] {
  return pins
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
    .map((pin) => {
      const simple = inferSimpleCategory(pin);
      const stay = stayFromTime(pin.time) ?? suggestStayMinutes(simple).minutes;
      return {
        day: dayFromPin(pin),
        order: pin.order,
        name: pin.name.trim() || `장소 ${pin.order}`,
        categoryLabel: SIMPLE_TO_LABEL[simple],
        address: pin.address || '',
        phone: pin.phone,
        lat: pin.lat,
        lng: pin.lng,
        stayMinutes: stay || undefined,
        note: pin.time,
        placeUrl: pin.googlePlaceId
          ? `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(pin.googlePlaceId)}`
          : undefined,
      };
    });
}

export function importGuideCoursePins(
  pins: GuideCoursePin[],
  options: PinImportOptions
): PinImportResult {
  const rows = guideCoursePinsToRows(pins);
  if (rows.length === 0) {
    return {
      pinnedByDay: options.existingByDay,
      totalDays: options.totalDays,
      importedCount: 0,
    };
  }
  return applyImportRows(rows, { ...options, scope: 'all', mode: 'merge' });
}
