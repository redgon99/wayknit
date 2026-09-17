/**
 * 추천 여행코스 「붙여넣기 매크로」
 * ChatGPT·메모 등에서 복사한 일정 텍스트 → guide_articles(course) 초안 필드.
 */

export interface CourseGuideDraft {
  title: string;
  summary: string;
  bodyMd: string;
  topicTags: string[];
  kind: 'course';
  /** 일정 표에서 뽑은 행 (지도 핀 geocode용) */
  scheduleRows: ScheduleRow[];
}

export interface ParseCourseGuideOptions {
  /** 비우면 본문에서 추론 */
  title?: string;
  sourceUrl?: string;
  /** 기본 true — 본문 끝에 운영시간 고지 */
  includeDisclaimer?: boolean;
}

export interface ScheduleRow {
  time: string;
  place: string;
  point: string;
}

const TIME_RE =
  /(\d{1,2}:\d{2})\s*[–\-~〜～]\s*(\d{1,2}:\d{2}|이후)|(\d{1,2}:\d{2})\s*이후/;

const REGION_TAGS: { re: RegExp; tag: string }[] = [
  { re: /경주/, tag: '경주' },
  { re: /춘천/, tag: '춘천' },
  { re: /부산|해운대|광안리/, tag: '부산' },
  { re: /강릉|경포|안목/, tag: '강릉' },
  { re: /속초|고성/, tag: '속초' },
  { re: /전주|한옥마을/, tag: '전주' },
  { re: /제주|서귀포/, tag: '제주' },
  { re: /서울|명동|홍대/, tag: '서울' },
  { re: /여수/, tag: '여수' },
  { re: /통영/, tag: '통영' },
  { re: /충주|수안보|수주팔봉|중앙탑/, tag: '충주' },
  { re: /제천|의림지|청풍|옥순봉/, tag: '제천' },
];

const THEME_TAGS: { re: RegExp; tag: string }[] = [
  { re: /야경|월지|전망대/, tag: '야경' },
  { re: /맛집|닭갈비|한식|카페|간식|먹거리/, tag: '맛집' },
  { re: /역사|유적|박물관|대릉원|첨성대/, tag: '역사' },
  { re: /하루|당일/, tag: '하루코스' },
  { re: /2박\s*3일|이틀/, tag: '2박3일' },
  { re: /케이블카|스카이워크/, tag: '전망' },
];

function normalizeDashes(text: string): string {
  return text.replace(/[—―﹘﹣]/g, '–').replace(/\u00a0/g, ' ');
}

function cleanCell(s: string): string {
  return s
    .replace(/^\*+|\*+$/g, '')
    .replace(/^[-•·]\s*/, '')
    .trim();
}

function splitPipeRow(line: string): string[] | null {
  if (!line.includes('|')) return null;
  const cells = line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
  if (cells.length < 2) return null;
  if (cells.every((c) => /^:?-{3,}:?$/.test(c) || c === '---')) return null;
  if (/^시간$/i.test(cells[0]) || /^time$/i.test(cells[0])) return null;
  return cells;
}

function parseScheduleLine(line: string): ScheduleRow | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;

  const pipe = splitPipeRow(trimmed);
  if (pipe && pipe.length >= 2) {
    const timeMatch = pipe[0].match(TIME_RE);
    if (timeMatch) {
      return {
        time: cleanCell(pipe[0]),
        place: cleanCell(pipe[1] ?? ''),
        point: cleanCell(pipe[2] ?? ''),
      };
    }
  }

  const timeMatch = trimmed.match(TIME_RE);
  if (!timeMatch) return null;
  const time = timeMatch[0].replace(/\s+/g, '');
  let rest = trimmed.slice(timeMatch.index! + timeMatch[0].length).trim();
  rest = rest.replace(/^[\s|·•\-:]+/, '');

  // "장소 | 포인트" or tab-separated
  const parts = rest.includes('|')
    ? rest.split('|').map(cleanCell)
    : rest.includes('\t')
      ? rest.split('\t').map(cleanCell)
      : [rest];

  if (!parts[0]) return null;
  return {
    time: cleanCell(time.includes('–') || time.includes('-') ? timeMatch[0].trim() : timeMatch[0].trim()),
    place: parts[0],
    point: parts[1] ?? '',
  };
}

function inferTitle(text: string, rows: ScheduleRow[]): string {
  const heading = text.match(/^#{1,3}\s+(.+)$/m);
  if (heading) return heading[1].replace(/🏛️|🗓️|✨/g, '').trim();

  for (const { re, tag } of REGION_TAGS) {
    if (re.test(text)) {
      const dayTrip = /하루|당일/.test(text);
      return dayTrip ? `${tag} 하루 여행 코스 추천` : `${tag} 여행 코스 추천`;
    }
  }

  if (rows[0]?.place) {
    return `${rows[0].place} 등 여행 코스 추천`;
  }
  return '추천 여행 코스';
}

function firstParagraph(text: string): string {
  const blocks = text
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  for (const b of blocks) {
    if (b.startsWith('#') || b.startsWith('|')) continue;
    if (TIME_RE.test(b) && b.split('\n').length <= 2 && b.length < 80) continue;
    const oneLine = b.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
    if (oneLine.length >= 40) return oneLine.slice(0, 280);
  }
  return '';
}

function collectTags(text: string, rows: ScheduleRow[]): string[] {
  const tags = new Set<string>();
  for (const { re, tag } of REGION_TAGS) {
    if (re.test(text)) tags.add(tag);
  }
  for (const { re, tag } of THEME_TAGS) {
    if (re.test(text)) tags.add(tag);
  }
  for (const row of rows.slice(0, 4)) {
    const short = (row.place.split(/[\s·・/]/)[0] ?? '').replace(/[()（）]/g, '');
    if (short.length >= 2 && short.length <= 14) tags.add(short);
  }
  return [...tags].slice(0, 10);
}

function tipParagraphs(text: string, scheduleLines: Set<string>): string[] {
  const blocks = text
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  const tips: string[] = [];
  let skippedIntro = false;
  for (const b of blocks) {
    if (b.startsWith('#')) continue;
    if (b.startsWith('|') && b.includes('---')) continue;
    const lines = b.split('\n');
    if (lines.every((l) => parseScheduleLine(l) || splitPipeRow(l) === null && !l.trim())) {
      continue;
    }
    if (lines.every((l) => scheduleLines.has(l.trim()) || parseScheduleLine(l))) {
      continue;
    }
    // skip first long intro (used as summary)
    if (!skippedIntro && b.replace(/\n+/g, ' ').length >= 40 && !TIME_RE.test(b.split('\n')[0] ?? '')) {
      skippedIntro = true;
      continue;
    }
    const cleaned = b
      .split('\n')
      .filter((l) => !parseScheduleLine(l))
      .join('\n')
      .trim();
    if (cleaned.length >= 30) tips.push(cleaned);
  }
  return tips.slice(0, 6);
}

function buildBodyMd(
  intro: string,
  rows: ScheduleRow[],
  tips: string[],
  includeDisclaimer: boolean
): string {
  const parts: string[] = ['## 추천 일정', ''];
  if (intro) {
    parts.push(intro, '');
  }
  parts.push('### 하루 일정', '');
  parts.push('| 시간 | 일정 | 포인트 |');
  parts.push('| --- | --- | --- |');
  for (const r of rows) {
    parts.push(`| ${r.time} | ${r.place} | ${r.point || '—'} |`);
  }
  if (tips.length > 0) {
    parts.push('', '### 코스 포인트', '');
    for (const tip of tips) {
      parts.push(tip, '');
    }
  }
  if (includeDisclaimer) {
    parts.push('*운영시간·요금·입장료는 변동될 수 있으니 방문 전 공식 안내를 확인하세요.*');
  }
  return parts.join('\n').trim() + '\n';
}

/**
 * 붙여넣은 일정 텍스트를 추천 여행코스 초안 필드로 변환한다.
 * 시간 행이 2개 미만이면 에러를 throw한다.
 */
export function parseCourseGuideText(
  raw: string,
  options: ParseCourseGuideOptions = {}
): CourseGuideDraft {
  const text = normalizeDashes(raw.trim());
  if (!text) throw new Error('붙여넣을 내용을 입력하세요.');

  const lines = text.split(/\r?\n/);
  const rows: ScheduleRow[] = [];
  const scheduleLineSet = new Set<string>();
  for (const line of lines) {
    const row = parseScheduleLine(line);
    if (row && row.place) {
      rows.push(row);
      scheduleLineSet.add(line.trim());
    }
  }

  if (rows.length < 2) {
    throw new Error(
      '시간표 행을 2개 이상 찾지 못했습니다. 예: 10:00–11:00 소양강스카이워크'
    );
  }

  const intro = firstParagraph(text);
  const title = (options.title?.trim() || inferTitle(text, rows)).slice(0, 80);
  const summary =
    intro.slice(0, 200) ||
    `${rows.map((r) => r.place).slice(0, 4).join(' → ')} 순서로 즐기는 추천 코스입니다.`;
  const tips = tipParagraphs(text, scheduleLineSet);
  const bodyMd = buildBodyMd(intro || summary, rows, tips, options.includeDisclaimer !== false);
  const topicTags = collectTags(text, rows);

  return {
    title,
    summary,
    bodyMd,
    topicTags,
    kind: 'course',
    scheduleRows: rows,
  };
}

/** body_md의 시간표에서 일정 행 추출 */
export function extractScheduleRowsFromBody(bodyMd: string): ScheduleRow[] {
  const text = normalizeDashes(bodyMd);
  const rows: ScheduleRow[] = [];
  for (const line of text.split(/\r?\n/)) {
    const row = parseScheduleLine(line);
    if (row?.place) rows.push(row);
  }
  return rows;
}

function inferRegionHint(tags: string[], text: string): string {
  for (const { re, tag } of REGION_TAGS) {
    if (tags.includes(tag) || re.test(text)) return tag;
  }
  return '';
}

/** 식사·이동만 있는 행은 지도에서 건너뛰기 */
function isSkipPlace(place: string): boolean {
  const p = place.replace(/\s+/g, '');
  return /^(저녁|점심|아침|식사|야식|이동|출발|도착|체크인|체크아웃)/.test(p) && p.length <= 8;
}

/**
 * 카카오 Places로 일정 장소를 좌표화한다. (브라우저 SDK 필요)
 * AI 토큰 없음.
 */
export async function resolveCoursePins(
  rows: ScheduleRow[],
  options?: { regionHint?: string; topicTags?: string[] }
): Promise<{ pins: import('../types/guides').GuideCoursePin[]; missed: string[] }> {
  const { resolveAddressToCoords } = await import('./kakao');
  const hint =
    options?.regionHint?.trim() ||
    inferRegionHint(options?.topicTags ?? [], rows.map((r) => r.place).join(' '));
  const pins: import('../types/guides').GuideCoursePin[] = [];
  const missed: string[] = [];
  let order = 1;
  for (const row of rows) {
    if (isSkipPlace(row.place)) continue;
    const query = hint && !row.place.includes(hint) ? `${hint} ${row.place}` : row.place;
    const hit = await resolveAddressToCoords(query);
    if (!hit) {
      missed.push(row.place);
      continue;
    }
    pins.push({
      order: order++,
      name: row.place,
      time: row.time || undefined,
      lat: hit.lat,
      lng: hit.lng,
      label: hit.label,
    });
    // 카카오 rate 여유
    await new Promise((r) => setTimeout(r, 120));
  }
  return { pins, missed };
}
