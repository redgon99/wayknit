import type { GeneratedRoute, PinnedPlace } from '../types';
import type { Trip } from './trips';
import { districtFromAddress } from './districtFromAddress';
import i18n from './i18n';

export interface ItineraryTableRow {
  key: string;
  day: number;
  dayLabel: string;
  time: string;
  placeName: string;
  district: string;
  placeId: string;
  required: boolean;
}

/** null = 전체 */
export type ItineraryTableDayFilter = number | null;

function dayLabelFor(day: number): string {
  return i18n.t('table.dayLabel', { ns: 'planner', day });
}

function formatTimeRange(arriveAt?: string, leaveAt?: string, note?: string): string {
  let base = '—';
  if (arriveAt && leaveAt) {
    base = arriveAt === leaveAt ? arriveAt : `${arriveAt}–${leaveAt}`;
  } else if (arriveAt) {
    base = arriveAt;
  }
  const noteTrim = note?.trim();
  if (noteTrim) return `${base} (${noteTrim})`;
  return base;
}

function formatPinTime(pin: PinnedPlace): string {
  const minutesUnit = i18n.t('route.minutes', { ns: 'planner' });
  if (pin.note?.trim()) {
    const stay =
      pin.stayMinutes != null && pin.stayMinutes > 0 ? `${pin.stayMinutes}${minutesUnit}` : '—';
    return `${stay} (${pin.note.trim()})`;
  }
  if (pin.stayMinutes != null && pin.stayMinutes > 0) {
    return `${pin.stayMinutes}${minutesUnit}`;
  }
  return '—';
}

function rowFromPin(
  pin: PinnedPlace,
  time: string,
  day: number
): ItineraryTableRow {
  return {
    key: `${day}-${pin.id}-${pin.order}`,
    day,
    dayLabel: dayLabelFor(day),
    time,
    placeName: pin.nameKo || pin.name,
    district: districtFromAddress(pin.address, pin.roadAddress),
    placeId: pin.id,
    required: Boolean(pin.required),
  };
}

/**
 * 해당 일차의 모든 핀을 행으로 만든다.
 * 동선(stops)이 있으면 그 순서를 우선하고 시각을 붙이며, 동선에 없는 핀도 뒤에 이어 붙인다.
 */
function rowsForDay(
  day: number,
  pins: PinnedPlace[],
  route: GeneratedRoute | null | undefined
): ItineraryTableRow[] {
  if (pins.length === 0) return [];

  const pinById = new Map(pins.map((p) => [p.id, p]));
  const stopById = new Map((route?.stops ?? []).map((s) => [s.id, s]));
  const seen = new Set<string>();
  const ordered: PinnedPlace[] = [];

  if (route?.stops?.length) {
    for (const stop of route.stops) {
      const pin = pinById.get(stop.id) ?? stop;
      if (seen.has(pin.id)) continue;
      ordered.push(pin);
      seen.add(pin.id);
    }
  }

  for (const pin of [...pins].sort((a, b) => a.order - b.order)) {
    if (seen.has(pin.id)) continue;
    ordered.push(pin);
    seen.add(pin.id);
  }

  return ordered.map((pin) => {
    const stop = stopById.get(pin.id);
    const time = stop
      ? formatTimeRange(stop.arriveAt, stop.leaveAt, pin.note ?? stop.note)
      : formatPinTime(pin);
    return rowFromPin(pin, time, day);
  });
}

/** 여행 전체 일차 → 표 행 (모든 핀 포함, 동선 시각은 있으면 병합) */
export function buildItineraryTableRows(trip: Trip): ItineraryTableRow[] {
  const rows: ItineraryTableRow[] = [];
  for (let day = 1; day <= trip.totalDays; day++) {
    rows.push(
      ...rowsForDay(day, trip.pinnedByDay[day] ?? [], trip.generatedRouteByDay[day])
    );
  }
  return rows;
}

export function filterItineraryTableRows(
  rows: ItineraryTableRow[],
  dayFilter: ItineraryTableDayFilter
): ItineraryTableRow[] {
  if (dayFilter == null) return rows;
  return rows.filter((r) => r.day === dayFilter);
}

export function countPinsByDay(trip: Trip): Record<number, number> {
  const counts: Record<number, number> = {};
  for (let day = 1; day <= trip.totalDays; day++) {
    counts[day] = (trip.pinnedByDay[day] ?? []).length;
  }
  return counts;
}
