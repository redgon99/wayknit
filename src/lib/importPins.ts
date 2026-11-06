import type { CategoryCode, PinnedPlace, SimpleCategory } from '../types';
import { DEFAULT_CODE_BY_SIMPLE_CATEGORY } from './categories';
import i18n from './i18n';

/**
 * 화면에 보여 줄 문구는 호출부가 `import.<code>` 번역으로 바꾼다 — 이 파일은 언어를 모른다.
 * `message`의 한국어는 번역이 없을 때의 안전망이다.
 */
export class PinImportError extends Error {
  constructor(
    public readonly code: 'errNoPins' | 'errCsvColumns' | 'errNoDayPins',
    message: string
  ) {
    super(message);
    this.name = 'PinImportError';
  }
}

/**
 * 보내기 파일의 열 이름·줄 머리말은 보낸 사람의 화면 언어로 써진다. 영어 화면에서 내보낸
 * 파일을 다시 읽어올 수 있게, 모든 언어의 표기를 받아들인다(한국어는 번역이 없어도 항상 포함).
 */
function exportLabelVariants(key: string, korean: string): string[] {
  const variants = new Set<string>([korean]);
  for (const lng of Object.keys(i18n.store?.data ?? {})) {
    const value = i18n.getResource(lng, 'planner', `export.${key}`);
    if (typeof value === 'string' && value) variants.add(value);
  }
  return [...variants];
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** `labelPattern('address', '주소')` → `(?:주소|Address|…)` */
function labelPattern(key: string, korean: string): string {
  return `(?:${exportLabelVariants(key, korean).map(escapeRegExp).join('|')})`;
}

/** "{{day}}일차" / "Day {{day}}" 같은 머리말 번역에서 일차 숫자를 뽑는 식 */
function dayHeadingPattern(): string {
  const parts = exportLabelVariants('dayHeading', '{{day}}일차').map((tpl) =>
    escapeRegExp(tpl).replace(escapeRegExp('{{day}}'), '(\\d+)')
  );
  return `(?:${parts.join('|')})`;
}

export type PinImportScope = 'current' | 'all';
export type PinImportMode = 'replace' | 'merge';

export interface PinImportOptions {
  currentDay: number;
  totalDays: number;
  existingByDay: Record<number, PinnedPlace[]>;
  scope: PinImportScope;
  mode: PinImportMode;
}

export interface PinImportResult {
  pinnedByDay: Record<number, PinnedPlace[]>;
  totalDays: number;
  importedCount: number;
}

export interface RawPinRow {
  day: number;
  order: number;
  name: string;
  categoryLabel: string;
  categoryDetail?: string;
  address: string;
  roadAddress?: string;
  phone?: string;
  lat: number;
  lng: number;
  stayMinutes?: number;
  note?: string;
  placeUrl?: string;
}

const LABEL_TO_SIMPLE: Record<string, SimpleCategory> = {
  맛집: 'food',
  카페: 'cafe',
  관광: 'tour',
  관광지: 'tour',
  문화: 'culture',
  숙소: 'stay',
  쇼핑: 'shop',
  편의점: 'shop',
  주차장: 'other',
  기타: 'other',
  '직접 지정': 'other',
};

export function parseImportFile(
  content: string,
  filename: string,
  options: PinImportOptions
): PinImportResult {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  let rows: RawPinRow[] = [];

  if (ext === 'json') {
    rows = parseJsonImport(content, options);
  } else if (ext === 'csv') {
    rows = parseCsvImport(content, options.currentDay);
  } else {
    rows = parseTextImport(content, options.currentDay);
  }

  if (rows.length === 0) {
    throw new PinImportError('errNoPins', '가져올 핀업 장소가 없습니다');
  }

  return applyImportRows(rows, options);
}

function parseJsonImport(content: string, options: PinImportOptions): RawPinRow[] {
  const data = JSON.parse(content) as {
    scope?: string;
    days?: Array<{
      day: number;
      places?: Array<Record<string, unknown>>;
    }>;
    places?: Array<Record<string, unknown>>;
  };

  const useAll =
    options.scope === 'all' ||
    data.scope === 'all' ||
    (Array.isArray(data.days) && data.days.length > 1);

  if (useAll && Array.isArray(data.days)) {
    const rows: RawPinRow[] = [];
    for (const dayBlock of data.days) {
      const day = Number(dayBlock.day) || 1;
      for (const place of dayBlock.places ?? []) {
        const row = rawFromRecord(place, day);
        if (row) rows.push(row);
      }
    }
    return rows;
  }

  const day = options.currentDay;
  const places =
    data.days?.[0]?.places ??
    data.places ??
    (Array.isArray(data.days) ? data.days.flatMap((d) => d.places ?? []) : []);
  if (!Array.isArray(places)) return [];

  return places
    .map((p) => rawFromRecord(p, day))
    .filter((r): r is RawPinRow => r !== null);
}

function parseCsvImport(content: string, currentDay: number): RawPinRow[] {
  const text = content.replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const header = splitCsvLine(lines[0]).map((h) => h.trim());
  const idx = (key: string, korean: string) => {
    const names = exportLabelVariants(`csvHeaders.${key}`, korean);
    return header.findIndex((h) => names.includes(h));
  };

  const dayIdx = idx('day', '일차');
  const orderIdx = idx('order', '순서');
  const nameIdx = idx('name', '장소명');
  const catIdx = idx('category', '카테고리');
  const addrIdx = idx('address', '주소');
  const roadIdx = idx('road', '도로명주소');
  const phoneIdx = idx('phone', '전화');
  const latIdx = idx('lat', '위도');
  const lngIdx = idx('lng', '경도');
  const stayIdx = idx('stay', '체류시간(분)');
  const noteIdx = idx('note', '메모');

  if (nameIdx < 0 || latIdx < 0 || lngIdx < 0) {
    throw new PinImportError('errCsvColumns', 'CSV에 장소명·위도·경도 열이 필요합니다');
  }

  const rows: RawPinRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const lat = parseFloat(cols[latIdx] ?? '');
    const lng = parseFloat(cols[lngIdx] ?? '');
    if (Number.isNaN(lat) || Number.isNaN(lng)) continue;

    rows.push({
      day: dayIdx >= 0 ? Number(cols[dayIdx]) || currentDay : currentDay,
      order: orderIdx >= 0 ? Number(cols[orderIdx]) || rows.length + 1 : rows.length + 1,
      name: cols[nameIdx]?.trim() ?? '이름 없음',
      categoryLabel: catIdx >= 0 ? cols[catIdx]?.trim() || '기타' : '기타',
      address: addrIdx >= 0 ? cols[addrIdx]?.trim() || '' : '',
      roadAddress: roadIdx >= 0 ? cols[roadIdx]?.trim() : undefined,
      phone: phoneIdx >= 0 ? cols[phoneIdx]?.trim() : undefined,
      lat,
      lng,
      stayMinutes: stayIdx >= 0 ? parseOptionalInt(cols[stayIdx]) : undefined,
      note: noteIdx >= 0 ? cols[noteIdx]?.trim() : undefined,
    });
  }
  return rows;
}

function parseTextImport(content: string, currentDay: number): RawPinRow[] {
  const withCoords: RawPinRow[] = [];
  let day = currentDay;
  let order = 0;
  let pending: RawPinRow | null = null;
  const dayRe = new RegExp(`^##\\s*${dayHeadingPattern()}`);
  const addrRe = new RegExp(`^\\s*${labelPattern('address', '주소')}:\\s*(.+)$`);
  const coordRe = new RegExp(`^\\s*${labelPattern('coords', '좌표')}:\\s*([-\\d.]+)\\s*,\\s*([-\\d.]+)`);
  const phoneRe = new RegExp(`^\\s*${labelPattern('phone', '전화')}:\\s*(.+)$`);
  const stayRe = new RegExp(`^\\s*${labelPattern('stay', '체류')}:\\s*(\\d+)`);
  const noteRe = new RegExp(`^\\s*${labelPattern('note', '메모')}:\\s*(.+)$`);

  for (const line of content.split(/\r?\n/)) {
    const dayMatch = line.match(dayRe);
    if (dayMatch) {
      if (pending && !Number.isNaN(pending.lat)) withCoords.push(pending);
      pending = null;
      day = Number(dayMatch.slice(1).find(Boolean)) || currentDay;
      continue;
    }
    const pinMatch = line.match(/^(\d+)\.\s+(.+?)\s*\(([^)]+)\)\s*$/);
    if (pinMatch) {
      if (pending && !Number.isNaN(pending.lat)) withCoords.push(pending);
      order = Number(pinMatch[1]) || order + 1;
      pending = {
        day,
        order,
        name: pinMatch[2].trim(),
        categoryLabel: pinMatch[3].trim(),
        address: '',
        lat: NaN,
        lng: NaN,
      };
      continue;
    }
    if (!pending) continue;
    const addr = line.match(addrRe);
    if (addr) pending.address = addr[1].trim();
    const coord = line.match(coordRe);
    if (coord) {
      pending.lat = parseFloat(coord[1]);
      pending.lng = parseFloat(coord[2]);
    }
    const tel = line.match(phoneRe);
    if (tel) pending.phone = tel[1].trim();
    const stay = line.match(stayRe);
    if (stay) pending.stayMinutes = Number(stay[1]);
    const memo = line.match(noteRe);
    if (memo) pending.note = memo[1].trim();
  }
  if (pending && !Number.isNaN(pending.lat)) withCoords.push(pending);

  return withCoords.filter((r) => !Number.isNaN(r.lat) && !Number.isNaN(r.lng));
}

function rawFromRecord(
  place: Record<string, unknown>,
  day: number
): RawPinRow | null {
  const lat = Number(place.lat);
  const lng = Number(place.lng);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

  return {
    day,
    order: Number(place.order) || 1,
    name: String(place.name ?? '이름 없음').trim(),
    categoryLabel: String(place.category ?? '기타').trim(),
    categoryDetail:
      place.categoryDetail != null ? String(place.categoryDetail) : undefined,
    address: String(place.address ?? '').trim(),
    roadAddress: place.roadAddress != null ? String(place.roadAddress) : undefined,
    phone: place.phone != null ? String(place.phone) : undefined,
    lat,
    lng,
    stayMinutes: parseOptionalInt(place.stayMinutes),
    note: place.note != null ? String(place.note) : undefined,
    placeUrl: place.placeUrl != null ? String(place.placeUrl) : undefined,
  };
}

export function applyImportRows(
  rows: RawPinRow[],
  options: PinImportOptions
): PinImportResult {
  const byDay = new Map<number, RawPinRow[]>();
  for (const row of rows) {
    const day = Math.max(1, Math.floor(row.day) || options.currentDay);
    if (options.scope === 'current' && day !== options.currentDay) continue;
    const list = byDay.get(day) ?? [];
    list.push({ ...row, day });
    byDay.set(day, list);
  }

  if (byDay.size === 0) {
    throw new PinImportError('errNoDayPins', '현재 일차에 해당하는 장소가 없습니다');
  }

  let totalDays = options.totalDays;
  const pinnedByDay: Record<number, PinnedPlace[]> = { ...options.existingByDay };

  for (const [dayKey, dayRows] of byDay) {
    const day = Number(dayKey);
    totalDays = Math.max(totalDays, day);
    dayRows.sort((a, b) => a.order - b.order);
    const incoming = dayRows.map((r, i) => toPinnedPlace(r, i + 1, day));

    if (options.mode === 'replace') {
      pinnedByDay[day] = incoming.map((p, i) => ({ ...p, order: i + 1 }));
    } else {
      pinnedByDay[day] = mergePinLists(pinnedByDay[day] ?? [], incoming);
    }
  }

  const importedCount = [...byDay.values()].reduce((n, list) => n + list.length, 0);

  return { pinnedByDay, totalDays, importedCount };
}

function toPinnedPlace(row: RawPinRow, order: number, day: number): PinnedPlace {
  const simple = LABEL_TO_SIMPLE[row.categoryLabel] ?? 'other';
  const categoryCode = DEFAULT_CODE_BY_SIMPLE_CATEGORY[simple] as CategoryCode;
  const id = `import:${day}:${order}:${row.lat.toFixed(5)},${row.lng.toFixed(5)}:${encodeURIComponent(row.name).slice(0, 40)}`;

  return {
    id,
    name: row.name,
    category: simple,
    categoryCode,
    categoryLabel: row.categoryLabel || '기타',
    categoryDetail: row.categoryDetail,
    address: row.address || row.roadAddress || '주소 없음',
    roadAddress: row.roadAddress,
    phone: row.phone,
    lat: row.lat,
    lng: row.lng,
    placeUrl: row.placeUrl,
    pinnedAt: Date.now(),
    order,
    stayMinutes: row.stayMinutes,
    note: row.note,
    day,
  };
}

function mergePinLists(
  existing: PinnedPlace[],
  incoming: PinnedPlace[]
): PinnedPlace[] {
  const key = (p: PinnedPlace) =>
    `${p.name}|${p.lat.toFixed(5)}|${p.lng.toFixed(5)}`;
  const seen = new Set(existing.map(key));
  const out = [...existing];
  for (const pin of incoming) {
    if (seen.has(key(pin))) continue;
    seen.add(key(pin));
    out.push({ ...pin, order: out.length + 1 });
  }
  return out.map((p, i) => ({ ...p, order: i + 1 }));
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function parseOptionalInt(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = typeof value === 'number' ? value : parseInt(String(value), 10);
  return Number.isNaN(n) ? undefined : n;
}
