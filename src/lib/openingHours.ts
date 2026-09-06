/**
 * 자유 문장으로 된 영업시간을 요일별 구간으로 정규화하고,
 * "이 시각에 갔을 때 열려 있는가"를 판정한다.
 *
 * 원문은 출처마다 제각각이다.
 *   Google  "Monday: 9:00 AM – 6:00 PM" / "Sunday: Closed"
 *   TourAPI "09:00~18:00", "하절기 09:00~19:00", 휴무일은 restDate에 따로
 *   수동입력 "매일 10:00~22:00", "월요일 휴무"
 * 읽어낼 수 있는 만큼만 읽고, 확신이 없으면 unknown으로 남긴다.
 * (틀린 "영업중"보다 모름이 낫다)
 */

export interface HoursInterval {
  /** 자정 기준 분 */
  start: number;
  /** 자정 기준 분. 자정을 넘기면 1440보다 커진다 */
  end: number;
}

/** byDay의 키 — 요일 구분이 없는(매일 같은) 구간 */
export const EVERY_DAY = -1;

export interface NormalizedHours {
  /** 0=일 … 6=토, EVERY_DAY=요일 구분 없음 */
  byDay: Record<number, HoursInterval[]>;
  alwaysOpen: boolean;
  raw: string;
}

export type VisitHoursStatus =
  | 'unknown'
  | 'open'
  | 'closes-early'
  | 'before-open'
  | 'closed';

export interface VisitHoursCheck {
  status: VisitHoursStatus;
  /** 해당 요일의 영업 시작·종료 (분) */
  opensAt?: number;
  closesAt?: number;
}

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'];
const WEEKDAY_EN = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

const ALWAYS_RE = /(24\s*시간|24\s*hours|open\s*24|상시\s*개방|연중\s*24)/i;

function normalizeText(text: string): string {
  return text
    .replace(/[～〜]/g, '~')
    .replace(/[–—−]/g, '-')
    .replace(/\u00a0/g, ' ')
    .trim();
}

/** "9:00 AM", "18:30", "오후 6시", "24:00" → 자정 기준 분 */
function parseTimeToken(token: string): number | null {
  const t = token.trim().toLowerCase();
  if (!t) return null;

  const meridiemBefore = /^(오전|오후|am|pm)\s*/.exec(t);
  const rest = meridiemBefore ? t.slice(meridiemBefore[0].length) : t;

  const m =
    /^(\d{1,2})\s*[:시]\s*(\d{1,2})?\s*분?\s*(am|pm)?/.exec(rest) ??
    /^(\d{1,2})()\s*(am|pm)/.exec(rest);
  if (!m) return null;

  let hour = Number(m[1]);
  const minute = m[2] ? Number(m[2]) : 0;
  if (!Number.isInteger(hour) || hour < 0 || hour > 24) return null;
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) return null;

  const meridiem = (meridiemBefore?.[1] ?? m[3] ?? '').toLowerCase();
  if (meridiem === 'pm' || meridiem === '오후') {
    if (hour < 12) hour += 12;
  } else if (meridiem === 'am' || meridiem === '오전') {
    if (hour === 12) hour = 0;
  }

  return hour * 60 + minute;
}

const RANGE_RE =
  /((?:오전|오후|am|pm)?\s*\d{1,2}\s*(?::\d{2}|시(?:\s*\d{1,2}\s*분)?)?\s*(?:am|pm)?)\s*(?:~|-|to|부터)\s*((?:오전|오후|am|pm)?\s*\d{1,2}\s*(?::\d{2}|시(?:\s*\d{1,2}\s*분)?)?\s*(?:am|pm)?)/gi;

function extractIntervals(line: string): HoursInterval[] {
  const out: HoursInterval[] = [];
  RANGE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = RANGE_RE.exec(line))) {
    const start = parseTimeToken(m[1]);
    let end = parseTimeToken(m[2]);
    if (start === null || end === null) continue;
    // 자정을 넘겨 영업하는 경우 (예: 18:00~02:00)
    if (end <= start) end += 24 * 60;
    out.push({ start, end });
  }
  return out;
}

function weekdayIndexFromWord(word: string): number | null {
  const w = word.trim().toLowerCase();
  if (!w) return null;
  const ko = WEEKDAY_KO.indexOf(w.replace(/요일$/, ''));
  if (ko >= 0) return ko;
  const en = WEEKDAY_EN.findIndex((d) => d === w || d.slice(0, 3) === w.replace(/\.$/, ''));
  return en >= 0 ? en : null;
}

/** 줄 앞머리의 요일 표기를 읽는다. "월~금", "Mon-Fri", "매일", "주말" 등 */
function weekdaysFromLabel(line: string): number[] | null {
  const t = line.trim().toLowerCase();
  if (!t) return null;

  if (/(매일|everyday|every day|daily|연중무휴)/.test(t)) {
    return [0, 1, 2, 3, 4, 5, 6];
  }
  if (/(평일|weekday)/.test(t)) return [1, 2, 3, 4, 5];
  if (/(주말|weekend)/.test(t)) return [0, 6];

  const koRange = /([일월화수목금토])\s*(?:요일)?\s*[~-]\s*([일월화수목금토])\s*(?:요일)?/.exec(t);
  const enRange =
    /\b(sun|mon|tue|wed|thu|fri|sat)[a-z]*\.?\s*[~-]\s*(sun|mon|tue|wed|thu|fri|sat)[a-z]*\.?/.exec(
      t,
    );
  const range = koRange ?? enRange;
  if (range) {
    const from = weekdayIndexFromWord(range[1]);
    const to = weekdayIndexFromWord(range[2]);
    if (from !== null && to !== null) {
      const days: number[] = [];
      for (let i = 0; i < 7; i++) {
        const d = (from + i) % 7;
        days.push(d);
        if (d === to) break;
      }
      return days;
    }
  }

  const days = new Set<number>();
  // "월요일"을 먼저 소비한다 — 뒤의 "일"이 일요일로 잡히지 않도록
  let rest = t;
  const koFull = t.match(/[일월화수목금토]요일/g) ?? [];
  for (const w of koFull) {
    const idx = weekdayIndexFromWord(w);
    if (idx !== null) days.add(idx);
    rest = rest.replace(w, ' ');
  }
  const koSingles = rest.match(/[일월화수목금토](?=\s*[:,·/]|\s|$)/g) ?? [];
  for (const w of koSingles) {
    const idx = weekdayIndexFromWord(w);
    if (idx !== null) days.add(idx);
  }
  const enSingles = t.match(/\b(sun|mon|tue|wed|thu|fri|sat)[a-z]*\b/g) ?? [];
  for (const w of enSingles) {
    const idx = weekdayIndexFromWord(w);
    if (idx !== null) days.add(idx);
  }

  return days.size > 0 ? [...days] : null;
}

function pushInterval(byDay: Record<number, HoursInterval[]>, day: number, iv: HoursInterval) {
  const list = byDay[day] ?? (byDay[day] = []);
  if (!list.some((x) => x.start === iv.start && x.end === iv.end)) list.push(iv);
}

/**
 * 영업시간 원문을 요일별 구간으로 정규화한다.
 * 읽어낼 수 있는 정보가 하나도 없으면 null.
 *
 * 요일 지정 없이 "10:00~20:00"처럼 적힌 구간은 EVERY_DAY로, "월-금 10~20시"처럼
 * 요일이 붙은 구간은 그 요일별로 저장해 둔다 — 다만 우리는 실제 방문 요일을
 * 모르므로(§ checkVisitWindow) 판정에는 EVERY_DAY만 쓴다. 요일별 구간을
 * EVERY_DAY로 합쳐버리면 실제로는 쉬는 요일에 "영업중"이라고 잘못 확신하게
 * 되므로 그렇게 하지 않는다(모르면 unknown이 틀린 open보다 낫다).
 */
export function parseOpeningHours(hoursText?: string | null): NormalizedHours | null {
  const raw = hoursText ?? '';
  if (!raw.trim()) return null;

  const byDay: Record<number, HoursInterval[]> = {};
  let alwaysOpen = false;

  const hoursLines = normalizeText(hoursText ?? '')
    .split(/\n|\r|·|\||\//)
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of hoursLines) {
    const labelPart = line.includes(':') ? line.slice(0, line.indexOf(':')) : line;
    const days = weekdaysFromLabel(labelPart);
    const intervals = extractIntervals(line);

    if (ALWAYS_RE.test(line) && intervals.length === 0) {
      alwaysOpen = true;
      continue;
    }

    if (intervals.length === 0) continue;

    if (days) {
      for (const d of days) for (const iv of intervals) pushInterval(byDay, d, iv);
    } else {
      for (const iv of intervals) pushInterval(byDay, EVERY_DAY, iv);
    }
  }

  const hasIntervals = Object.keys(byDay).length > 0;
  if (!hasIntervals && !alwaysOpen) return null;

  return { byDay, alwaysOpen, raw };
}

/** 예정 방문 시각에 문을 여는지 판정한다(요일 구분 없는 시간대만 본다). */
export function checkVisitWindow(
  hours: NormalizedHours,
  arriveMinutes: number,
  leaveMinutes?: number,
): VisitHoursCheck {
  if (hours.alwaysOpen) return { status: 'open' };

  const intervals = hours.byDay[EVERY_DAY];
  if (!intervals || intervals.length === 0) return { status: 'unknown' };

  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const active = sorted.find((iv) => arriveMinutes >= iv.start && arriveMinutes < iv.end);

  if (active) {
    const leave = leaveMinutes ?? arriveMinutes;
    if (leave > active.end) {
      return { status: 'closes-early', opensAt: active.start, closesAt: active.end };
    }
    return { status: 'open', opensAt: active.start, closesAt: active.end };
  }

  const next = sorted.find((iv) => arriveMinutes < iv.start);
  if (next) return { status: 'before-open', opensAt: next.start, closesAt: next.end };

  const last = sorted[sorted.length - 1];
  return { status: 'closed', opensAt: last.start, closesAt: last.end };
}

/** 일정에 문제가 되는 상태인지 (열려 있음·모름은 문제 아님) */
export function isHoursProblem(status: VisitHoursStatus | undefined): boolean {
  return status === 'closed' || status === 'before-open' || status === 'closes-early';
}
