/**
 * 예약 자료(메모·파일 제목)에서 "시각 / 날짜 / 장소" 후보를 뽑는다 —
 * N04(모바일 UX 리포트 2026-09-13, 신규 제안).
 *
 * 왜 AI가 아니라 규칙 기반인가:
 * - 제안은 **사용자 확인을 거쳐야만** 반영된다(리포트 문구 그대로). 틀린 추측이
 *   조용히 일정에 들어가지 않으므로, 즉시·무료·오프라인에서 되는 쪽이 낫다.
 * - 자료 패널은 오프라인에서도 열린다(§29-29). API 호출로 만들면 그때 죽는다.
 *
 * 날짜의 한계: `Trip`에는 여행 시작 날짜가 없다(일차만 있다). 그래서 "9월 20일"을
 * 몇 일차인지로 옮길 수 없다 — 날짜는 **표시용 근거**로만 돌려주고, 일차는 매칭된
 * 핀이 속한 일차를 그대로 쓴다.
 */

export interface ReservationPinCandidate {
  id: string;
  name: string;
  nameKo?: string;
  day: number;
}

export interface ReservationSuggestion {
  /** "HH:MM" (24시간) */
  time?: string;
  /** 시각을 뽑아낸 원문 조각 — 사용자가 왜 이렇게 제안됐는지 보게 한다 */
  timeRaw?: string;
  /** 날짜 원문 조각(표시용). 일차 매핑은 하지 않는다 */
  dateRaw?: string;
  placeId?: string;
  placeName?: string;
  /** 매칭된 핀의 일차 */
  placeDay?: number;
}

/** 예약 문서에서 시각 앞뒤에 흔히 붙는 말 — 여러 시각이 잡힐 때 우선순위로 쓴다 */
const TIME_CONTEXT = [
  '체크인',
  '체크아웃',
  '입실',
  '퇴실',
  '예약',
  '도착',
  '출발',
  '탑승',
  '시작',
  '입장',
  'check-in',
  'checkin',
  'check in',
];

function clampTime(h: number, m: number): string | null {
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function to24h(meridiem: string | undefined, h: number): number {
  if (!meridiem) return h;
  const isPm = /오후|pm/i.test(meridiem);
  const isAm = /오전|am/i.test(meridiem);
  if (isPm) return h === 12 ? 12 : h + 12;
  if (isAm) return h === 12 ? 0 : h;
  return h;
}

interface TimeHit {
  time: string;
  raw: string;
  index: number;
  end: number;
}

/**
 * 시각 후보를 전부 찾는다. 전화번호(010-1234-5678)처럼 숫자만 이어진 것에
 * 걸리지 않도록 `:` 또는 `시`를 반드시 요구한다.
 */
function findTimes(text: string): TimeHit[] {
  const hits: TimeHit[] = [];
  /*
   * 규칙은 구체적인 것부터 돌린다. 나중 규칙이 **앞 규칙이 이미 잡은 구간과
   * 겹치면 버린다** — "오후 3시"를 단순 규칙이 "3시"로 또 잡으면 오전/오후가
   * 떨어져 나가 03:00이 되고, 맥락 거리 계산에서 그 조각이 더 가까워 이겨버린다
   * (실제로 이 테스트에서 잡힌 버그다).
   */
  const push = (h: number, m: number, raw: string, index: number) => {
    const t = clampTime(h, m);
    if (!t) return;
    const end = index + raw.length;
    const overlaps = hits.some((prev) => index < prev.end && prev.index < end);
    if (overlaps) return;
    hits.push({ time: t, raw: raw.trim(), index, end });
  };

  // 오전/오후/AM/PM + 시:분 또는 N시 M분
  const withMeridiem =
    /(오전|오후|AM|PM|am|pm)\s*(\d{1,2})\s*(?::\s*(\d{1,2})|시\s*(?:(\d{1,2})\s*분)?)/g;
  for (const m of text.matchAll(withMeridiem)) {
    const h = to24h(m[1], Number(m[2]));
    const min = Number(m[3] ?? m[4] ?? 0);
    push(h, min, m[0], m.index ?? 0);
  }

  // 시:분 + 뒤따르는 AM/PM ("2:30 PM")
  const trailingMeridiem = /(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)/g;
  for (const m of text.matchAll(trailingMeridiem)) {
    push(to24h(m[3], Number(m[1])), Number(m[2]), m[0], m.index ?? 0);
  }

  // 24시간 "14:00" — 앞뒤가 숫자면 제외(전화번호·요금 등)
  const plain = /(^|[^\d:])(\d{1,2}):(\d{2})(?![\d:])/g;
  for (const m of text.matchAll(plain)) {
    push(Number(m[2]), Number(m[3]), `${m[2]}:${m[3]}`, (m.index ?? 0) + m[1].length);
  }

  // "14시", "14시 30분" — 오전/오후 없이
  const kor = /(^|[^\d])(\d{1,2})\s*시\s*(?:(\d{1,2})\s*분)?/g;
  for (const m of text.matchAll(kor)) {
    push(Number(m[2]), Number(m[3] ?? 0), m[0].trim(), (m.index ?? 0) + m[1].length);
  }

  return hits;
}

/** 예약 맥락 단어에 가장 가까운 시각을 고른다. 없으면 첫 번째. */
function pickTime(text: string, hits: TimeHit[]): TimeHit | undefined {
  if (hits.length === 0) return undefined;
  if (hits.length === 1) return hits[0];

  const lower = text.toLowerCase();
  let best: { hit: TimeHit; distance: number } | null = null;
  for (const word of TIME_CONTEXT) {
    let from = 0;
    for (;;) {
      const at = lower.indexOf(word.toLowerCase(), from);
      if (at < 0) break;
      from = at + word.length;
      for (const hit of hits) {
        const distance = Math.abs(hit.index - at);
        // 같은 줄 정도의 거리 안에 있을 때만 "맥락"으로 본다
        if (distance <= 30 && (!best || distance < best.distance)) {
          best = { hit, distance };
        }
      }
    }
  }
  return best?.hit ?? hits[0];
}

function findDate(text: string): string | undefined {
  const patterns = [
    /\d{4}[.\-/]\s?\d{1,2}[.\-/]\s?\d{1,2}/, // 2026-09-20, 2026.09.20
    /\d{1,2}\s*월\s*\d{1,2}\s*일/, // 9월 20일
    /(^|[^\d])\d{1,2}\/\d{1,2}(?!\d)/, // 9/20
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return m[0].trim();
  }
  return undefined;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '');
}

/**
 * 핀 이름이 본문에 나오는지 본다. 여러 개가 걸리면 **가장 긴 이름**을 고른다 —
 * "스타벅스"와 "스타벅스 원주봉산DT점"이 같이 걸리면 구체적인 쪽이 맞다.
 */
function findPlace(
  text: string,
  pins: ReservationPinCandidate[]
): ReservationPinCandidate | undefined {
  const hay = normalize(text);
  let best: { pin: ReservationPinCandidate; len: number } | undefined;
  for (const pin of pins) {
    for (const raw of [pin.nameKo, pin.name]) {
      if (!raw) continue;
      const needle = normalize(raw);
      // 너무 짧은 이름은 우연히 걸리기 쉬워 제외한다
      if (needle.length < 2) continue;
      if (!hay.includes(needle)) continue;
      if (!best || needle.length > best.len) best = { pin, len: needle.length };
    }
  }
  return best?.pin;
}

/**
 * 자료 본문에서 예약 정보를 뽑는다. 아무것도 못 찾으면 null.
 * `text`에는 제목과 본문을 합쳐서 넘기면 된다.
 */
export function extractReservation(
  text: string,
  pins: ReservationPinCandidate[]
): ReservationSuggestion | null {
  const source = (text ?? '').trim();
  if (!source) return null;

  const time = pickTime(source, findTimes(source));
  const place = findPlace(source, pins);
  const dateRaw = findDate(source);

  if (!time && !place) return null;

  return {
    time: time?.time,
    timeRaw: time?.raw,
    dateRaw,
    placeId: place?.id,
    placeName: place?.nameKo ?? place?.name,
    placeDay: place?.day,
  };
}
