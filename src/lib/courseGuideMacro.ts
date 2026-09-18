/**
 * 추천 여행코스 「붙여넣기 매크로」
 * ChatGPT·메모 등에서 복사한 일정 텍스트 → guide_articles(course) 초안 필드.
 */

import { inferCourseTaxonomyTags } from './courseGuideTaxonomy';
import { rewriteChatGptCites } from './guideSources';

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
  lat?: number;
  lng?: number;
}

const TIME_RE =
  /(\d{1,2}:\d{2})\s*[–\-~〜～]\s*(\d{1,2}:\d{2}|이후)?|(\d{1,2}:\d{2})\s*이후/;

const REGION_TAGS: { re: RegExp; tag: string }[] = [
  { re: /경주/, tag: '경주' },
  { re: /춘천/, tag: '춘천' },
  { re: /부산|해운대|광안리/, tag: '부산' },
  { re: /강릉|경포|안목/, tag: '강릉' },
  { re: /속초|고성|설악/, tag: '속초' },
  { re: /전주|한옥마을/, tag: '전주' },
  { re: /제주|서귀포/, tag: '제주' },
  { re: /서울|명동|홍대/, tag: '서울' },
  { re: /여수/, tag: '여수' },
  { re: /통영/, tag: '통영' },
  { re: /충주|수안보|수주팔봉|중앙탑/, tag: '충주' },
  { re: /제천|의림지|청풍|옥순봉/, tag: '제천' },
  { re: /삼척|장호|근덕|새천년해안/, tag: '삼척' },
  { re: /동해|추암|묵호/, tag: '동해' },
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

/** ChatGPT 표 칸의 이미지·cite 링크·좌표를 걷어 장소명만 남긴다. */
function stripMarkdownNoise(s: string): string {
  let out = s;
  let prev = '';
  while (out !== prev) {
    prev = out;
    out = out.replace(/!\[[^\]]*\]\([^)]*\)/g, '');
    out = out.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
  }
  return out
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\bVisit Korea(?: Data)?\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseEmbeddedCoords(s: string): { lat: number; lng: number } | undefined {
  const m = s.match(/\b(3[3-8]\.\d{3,})\s*,\s*(12[4-9]\.\d{3,}|13[0-2]\.\d{3,})\b/);
  if (!m) return undefined;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  return { lat, lng };
}

function shortPlaceName(raw: string): string {
  let t = stripMarkdownNoise(raw)
    .replace(/\b\d{2}\.\d{3,}\s*,\s*\d{2,3}\.\d{3,}\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  t = (t.split(/[.。]/)[0] ?? t).trim();
  t = t.replace(/^바로 근처\s+/, '');
  t = t.replace(/\s+에서\s+(점심|저녁|식사).*$/, '');
  t = t.replace(/\s*(점심|저녁|산책|탑승|바다 구경)\s*$/g, '');
  t = (t.split(/\s+또는\s+/)[0] ?? t).trim();
  if (t.length > 42) t = (t.split(/[,，]/)[0] ?? t).trim();
  return t;
}

function restAsPoint(raw: string, place: string, extra?: string): string {
  let rest = stripMarkdownNoise(raw);
  if (place && rest.startsWith(place)) rest = rest.slice(place.length).replace(/^[\s.。,，]+/, '');
  rest = rest.replace(/\b\d{2}\.\d{3,}\s*,\s*\d{2,3}\.\d{3,}\b/g, '').replace(/\s*\.\s*\./g, '.').replace(/\s+/g, ' ').trim();
  const extraClean = extra ? stripMarkdownNoise(extra) : '';
  if (extraClean && extraClean !== '—') {
    rest = rest ? `${rest} ${extraClean}` : extraClean;
  }
  return rest.slice(0, 180);
}

function scheduleFromCell(time: string, rawPlace: string, rawPoint = ''): ScheduleRow | null {
  const coords = parseEmbeddedCoords(`${rawPlace} ${rawPoint}`);
  const place = shortPlaceName(rawPlace);
  if (!isValidPlace(place)) return null;
  return {
    time: cleanCell(time.replace(/\*+/g, '')),
    place,
    point: restAsPoint(rawPlace, place, rawPoint),
    ...coords,
  };
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

function isValidPlace(place: string): boolean {
  const p = place.trim();
  if (p.length < 2) return false;
  if (/^[,.·|—\-]+/.test(p)) return false;
  if (/https?:\/\//i.test(p)) return false;
  if (/utm_source=/i.test(p)) return false;
  if (/^입장마감|^운영시간|^참고/.test(p)) return false;
  return true;
}

function parseScheduleLine(line: string): ScheduleRow | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;

  const pipe = splitPipeRow(trimmed);
  if (pipe && pipe.length >= 2) {
    const timeMatch = pipe[0].match(TIME_RE);
    if (timeMatch) {
      return scheduleFromCell(pipe[0], pipe[1] ?? '', pipe[2] ?? '');
    }
  }

  const timeMatch = trimmed.match(TIME_RE);
  if (!timeMatch) return null;
  let rest = trimmed.slice(timeMatch.index! + timeMatch[0].length).trim();
  rest = rest.replace(/^[\s|·•\-:]+/, '');

  const parts = rest.includes('|')
    ? rest.split('|').map(cleanCell)
    : rest.includes('\t')
      ? rest.split('\t').map(cleanCell)
      : [rest];

  return scheduleFromCell(timeMatch[0], parts[0] ?? '', parts[1] ?? '');
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
  return inferCourseTaxonomyTags(
    [text, ...rows.map((r) => `${r.place} ${r.point}`)],
    8
  );
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
    const cleaned = rewriteChatGptCites(
      b
        .split('\n')
        .filter((l) => !parseScheduleLine(l))
        .join('\n')
        .trim()
    );
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
  if (/^(저녁|점심|아침|식사|야식|이동|출발|도착|체크인|체크아웃|귀가)$/.test(p)) return true;
  if (/^귀가/.test(p)) return true;
  if (/(으로|방향으로)이동/.test(p)) return true;
  if (/드라이브/.test(p) && !/해변|항구|케이블|역/.test(p)) return true;
  if (/숙박$/.test(p)) return true;
  return false;
}

/** 검색용 장소명 정리 (점심/저녁 접미 제거) */
function searchQueryForPlace(place: string, hint: string): string {
  let q = place
    .replace(/\s*(점심|저녁|산책|바다 구경|·바다 구경)\s*$/g, '')
    .replace(/\s*→\s*/g, ' ')
    .trim();
  if (hint && !q.includes(hint)) q = `${hint} ${q}`;
  return q;
}

function parseStartMinutes(time: string | undefined): number | null {
  if (!time) return null;
  const m = time.match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** 시간대가 전일보다 일찍이면 다음날로 간주 */
function inferDayLabels(rows: { time?: string }[]): string[] {
  let day = 1;
  let prevMins: number | null = null;
  return rows.map((row) => {
    const mins = parseStartMinutes(row.time);
    if (prevMins != null && mins != null && mins + 90 < prevMins) {
      day += 1;
    }
    if (mins != null) prevMins = mins;
    return `${day}일차`;
  });
}

function reviewHighlightsFromDetail(
  reviews: { text?: string }[]
): string[] | undefined {
  const out: string[] = [];
  for (const r of reviews) {
    const t = (r.text ?? '').replace(/\s+/g, ' ').trim();
    if (t.length < 12) continue;
    out.push(t.length > 90 ? `${t.slice(0, 88)}…` : t);
    if (out.length >= 3) break;
  }
  return out.length > 0 ? out : undefined;
}

/**
 * Google Places로 일정 장소를 좌표화·상세 보강한다. (브라우저 SDK 필요)
 * AI 토큰 없음. 가이드 코스 매크로·상세 지도용.
 */
export async function resolveCoursePins(
  rows: ScheduleRow[],
  options?: { regionHint?: string; topicTags?: string[] }
): Promise<{ pins: import('../types/guides').GuideCoursePin[]; missed: string[] }> {
  const { loadGoogleMapsSdk, resolvePlaceQueryWithGoogle, getGoogleMapsApiKey } = await import(
    './googleMaps'
  );
  const { fetchGooglePlaceDetail } = await import('./googlePlaceDetail');
  const key = getGoogleMapsApiKey();
  if (!key?.trim()) {
    throw new Error('VITE_GOOGLE_MAPS_API_KEY가 없어 지도 핀을 만들 수 없습니다.');
  }
  await loadGoogleMapsSdk(key.trim());

  const hint =
    options?.regionHint?.trim() ||
    inferRegionHint(options?.topicTags ?? [], rows.map((r) => r.place).join(' '));

  type Candidate = {
    row: ScheduleRow;
    lat: number;
    lng: number;
    label: string;
    placeId?: string;
  };
  const candidates: Candidate[] = [];
  const missed: string[] = [];

  for (const row of rows) {
    if (isSkipPlace(row.place)) continue;
    const query = searchQueryForPlace(row.place, hint);
    const near = row.lat != null && row.lng != null ? { lat: row.lat, lng: row.lng } : undefined;
    const hit = await resolvePlaceQueryWithGoogle(query, near);
    if (near) {
      candidates.push({
        row,
        lat: near.lat,
        lng: near.lng,
        label: hit?.label || row.place,
        placeId: hit?.placeId,
      });
    } else if (hit) {
      candidates.push({
        row,
        lat: hit.lat,
        lng: hit.lng,
        label: hit.label,
        placeId: hit.placeId,
      });
    } else {
      missed.push(row.place);
      continue;
    }
    await new Promise((r) => setTimeout(r, 120));
  }

  const dayLabels = inferDayLabels(candidates.map((c) => c.row));
  const pins: import('../types/guides').GuideCoursePin[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const pin: import('../types/guides').GuideCoursePin = {
      order: i + 1,
      name: c.row.place,
      time: c.row.time || undefined,
      lat: c.lat,
      lng: c.lng,
      label: c.label,
      googlePlaceId: c.placeId,
      dayLabel: dayLabels[i],
    };

    if (c.placeId) {
      try {
        const detail = await Promise.race([
          fetchGooglePlaceDetail({
            id: `g:${c.placeId}`,
            name: c.label || c.row.place,
            category: 'other',
            categoryCode: 'OTHER',
            categoryLabel: '장소',
            address: '',
            lat: c.lat,
            lng: c.lng,
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('place detail timeout')), 9000)
          ),
        ]);
        pin.rating = detail.summary.rating;
        pin.reviewCount = detail.summary.reviewCount;
        pin.categoryLabel = detail.summary.categoryLabel;
        pin.priceLevelLabel = detail.summary.priceLevelLabel;
        pin.photoUrls = detail.photos.slice(0, 6);
        pin.address = detail.summary.address;
        pin.phone = detail.summary.phone;
        pin.openingText = detail.summary.todayHours ?? detail.summary.openingText;
        pin.editorialSummary = detail.summary.editorialSummary;
        pin.reviewHighlights = reviewHighlightsFromDetail(detail.reviews);
        if (detail.summary.openingNow === true && !pin.openingText) {
          pin.openingText = '영업 중';
        } else if (detail.summary.openingNow === false && pin.openingText) {
          /* keep hours text */
        }
      } catch (e) {
        console.warn('[resolveCoursePins] place detail failed', c.row.place, e);
      }
      await new Promise((r) => setTimeout(r, 180));
    }

    pins.push(pin);
  }

  return { pins, missed };
}
