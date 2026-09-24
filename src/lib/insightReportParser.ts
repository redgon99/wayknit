/**
 * 리서치 리포트 — 붙여넣은 원문을 규칙 기반으로 표/그래프용 데이터로 뽑는다.
 * LLM 호출 없음(사용자 요청) — `multiLangGuideMacro.ts`의
 * `parseMultiLangGuideHeuristic`와 같은 철학: 정해진 형식만 결정적으로
 * 인식하고, 못 찾으면 조용히 빈 값을 돌려준다(호출부가 원문 보기로 대체).
 *
 * §37 — 리포트마다 서술 스타일이 달라지는 걸 확인(2026-09-24, 092324.md
 * 샘플): 지역 표 대신 순위(①②③④)만 있고, 긍정/부정이 문단 하나가 아니라
 * 번호 매긴 여러 항목이고, "음식" 카테고리가 새로 등장. 서술 구조를 계속
 * 쫓아다니는 대신, 리포트 맨 아래 **"핵심 키워드"** 트레일러
 * (`**라벨:**` 다음 줄에 `·`로 구분된 목록)를 2차 소스로 신뢰한다 —
 * 서술 스타일이 달라져도 이 트레일러는 상대적으로 안정적일 가능성이 높다.
 */

export interface ParsedReportRegion {
  name: string;
  /** null = 표/카운트 없이 "핵심 키워드" 트레일러에서만 나온 순위형 언급
   *  — 대시보드에서 막대 없이 태그로만 보여준다(없는 정밀도를 지어내지 않음) */
  mentionCount: number | null;
  notablePlaces: string;
}

export interface ParsedReportInterest {
  title: string;
  description: string;
}

export interface ParsedReportSignals {
  positive: string[];
  negative: string[];
}

export interface ParsedInsightReport {
  regions: ParsedReportRegion[];
  interests: ParsedReportInterest[];
  signals: ParsedReportSignals;
  foods: string[];
}

/** 파이프(마크다운 표)·탭·2칸 이상 공백 중 무엇으로 구분됐든 한 줄을 칸으로 나눈다 */
function splitRow(line: string): string[] {
  const trimmed = line.trim();
  if (trimmed.includes('|')) {
    return trimmed
      .split('|')
      .map((c) => c.trim())
      .filter((c) => c.length > 0 && !/^-+$/.test(c));
  }
  if (trimmed.includes('\t')) {
    return trimmed.split('\t').map((c) => c.trim()).filter(Boolean);
  }
  return trimmed.split(/\s{2,}/).map((c) => c.trim()).filter(Boolean);
}

/** "12"·"12건"·"12개"처럼 숫자 앞뒤에 단위가 붙어도 뽑는다. 없으면 null. */
function parseCount(cell: string | undefined): number | null {
  if (!cell) return null;
  const match = cell.match(/\d+/);
  if (!match) return null;
  return Number(match[0]);
}

/** "지역"과 "수"/"언급" 둘 다 포함한 칸이 있으면 표 헤더로 본다 */
function isRegionTableHeader(cells: string[]): boolean {
  if (cells.length < 2) return false;
  const joined = cells.join(' ');
  return joined.includes('지역') && (joined.includes('수') || joined.includes('언급'));
}

function parseRegionsTable(lines: string[]): ParsedReportRegion[] {
  const headerIdx = lines.findIndex((l) => isRegionTableHeader(splitRow(l)));
  if (headerIdx < 0) return [];

  const regions: ParsedReportRegion[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) break;
    const cells = splitRow(line);
    if (cells.length < 2) break;
    const count = parseCount(cells[1]);
    if (count === null) break;
    regions.push({
      name: cells[0],
      mentionCount: count,
      notablePlaces: cells.slice(2).join(', '),
    });
  }
  return regions;
}

const DIVIDER_LINE_PATTERN = /^(-{3,}|\*{3,}|_{3,})$/;

const POSITIVE_SECTION_HEADING_PATTERN = /^#{0,6}\s*좋은\s*점/;
const NEGATIVE_SECTION_HEADING_PATTERN = /^#{0,6}\s*(나쁜\s*점|불편한?\s*점)/;
const KEYWORD_TRAILER_HEADING_PATTERN = /핵심\s*키워드/;
const NUMBERED_TOP_HEADING_PATTERN = /^#{0,6}\s*\d+\.\s/;
/** "관심사"/긍정·부정 섹션 등이 다음 큰 섹션 전까지만 이어지도록 잡는 공통 경계 —
 * 리포트마다 헤딩 깊이(#/##/###)가 달라져 깊이 기반 경계는 못 믿는다, 알려진
 * 섹션 헤딩 패턴만 경계로 인정한다. */
const MAJOR_SECTION_BOUNDARY_PATTERNS = [
  POSITIVE_SECTION_HEADING_PATTERN,
  NEGATIVE_SECTION_HEADING_PATTERN,
  NUMBERED_TOP_HEADING_PATTERN,
  /종합\s*분석/,
  KEYWORD_TRAILER_HEADING_PATTERN,
];

const INTEREST_HEADING_PATTERN = /관심사/;
/** "**소제목**: 설명" 또는 그냥 "소제목: 설명" 둘 다 인정(사용자가 붙여넣는 원문엔
 * 마크다운 볼드 기호가 없는 경우가 많아서 — 실사용 샘플 기준) */
const INTEREST_ITEM_PATTERN = /^\*{0,2}([^:：*]{2,24})\*{0,2}[:：]\s*(.+)$/;

function findBoundary(lines: string[], fromIdx: number, extraPatterns: RegExp[] = []): number {
  const patterns = [...MAJOR_SECTION_BOUNDARY_PATTERNS, ...extraPatterns];
  for (let i = fromIdx; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t) continue;
    if (patterns.some((p) => p.test(t))) return i;
  }
  return lines.length;
}

function parseInterests(lines: string[]): ParsedReportInterest[] {
  const headingIdx = lines.findIndex((l) => INTEREST_HEADING_PATTERN.test(l));
  if (headingIdx < 0) return [];
  const end = findBoundary(lines, headingIdx + 1, [POSITIVE_PARAGRAPH_PATTERN]);

  const interests: ParsedReportInterest[] = [];
  for (let i = headingIdx + 1; i < end; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const match = line.match(INTEREST_ITEM_PATTERN);
    if (!match) continue;
    const title = match[1].trim();
    const description = match[2].trim();
    if (title && description) interests.push({ title, description });
  }
  return interests;
}

const POSITIVE_PARAGRAPH_PATTERN = /^긍정[^:：]*[:：]\s*([\s\S]+)$/;
const NEGATIVE_PARAGRAPH_PATTERN = /^부정[^:：]*[:：]\s*([\s\S]+)$/;
/** ①~⑳ (U+2460~U+2473) 동그라미 숫자로 시작하는 소제목 줄 — "### ① 제목" 형태 */
const CIRCLED_NUMBER_HEADING_PATTERN = /^#{0,6}\s*([①-⑳])\s*(.+)$/;

/** startIdx부터 빈 줄이 나오기 전까지 이어지는 줄을 한 문단으로 합친다
 * ("3. 긍정·부정 신호"처럼 헤딩 바로 다음 줄에 "긍정:"이 붙어도, 헤딩이 아니라
 * "긍정:"이 시작되는 줄부터 찾으므로 헤딩은 섞이지 않는다 — 실사용 샘플에서
 * 헤딩과 "긍정:" 사이에 빈 줄이 없는 경우가 흔해 줄 단위로 찾는다) */
function captureBlock(lines: string[], startIdx: number): string {
  const collected: string[] = [];
  for (let i = startIdx; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) break;
    collected.push(trimmed);
  }
  return collected.join(' ');
}

/** 헤딩 하나(예: "## 좋은 점") 다음부터, 다음 큰 섹션 경계 전까지의 [start,end) 범위.
 * 헤딩을 못 찾으면 null. */
function findSectionRange(lines: string[], headingPattern: RegExp): [number, number] | null {
  const startIdx = lines.findIndex((l) => headingPattern.test(l.trim()));
  if (startIdx < 0) return null;
  const endIdx = findBoundary(lines, startIdx + 1);
  return [startIdx + 1, endIdx];
}

/** "### ① 제목" + 이어지는 설명 줄들을 "제목 — 설명" 문자열 배열로 뽑는다.
 * 좋은 점/나쁜 점 섹션처럼 번호 매긴 여러 항목이 있는 형식용. */
function parseNumberedSections(lines: string[], start: number, end: number): string[] {
  const items: string[] = [];
  let currentTitle: string | null = null;
  let currentBody: string[] = [];
  const flush = () => {
    if (currentTitle) {
      const body = currentBody.join(' ').trim();
      items.push(body ? `${currentTitle} — ${body}` : currentTitle);
    }
    currentTitle = null;
    currentBody = [];
  };
  for (let i = start; i < end; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed || DIVIDER_LINE_PATTERN.test(trimmed)) continue;
    const m = trimmed.match(CIRCLED_NUMBER_HEADING_PATTERN);
    if (m) {
      flush();
      currentTitle = m[2].trim();
      continue;
    }
    if (currentTitle) currentBody.push(trimmed);
  }
  flush();
  return items;
}

interface KeywordTrailerGroups {
  regions: string[];
  foods: string[];
  positive: string[];
  negative: string[];
}

/** 줄 전체가 "**라벨:**" 형태(볼드 0~2개 + 라벨 + 콜론 + 볼드 0~2개)인지 */
const LABEL_LINE_PATTERN = /^\*{0,2}([^*:：]{1,12})\*{0,2}[:：]\*{0,2}$/;

function splitKeywordItems(line: string): string[] {
  return line
    .split(/[·,|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** "핵심 키워드" 트레일러(라벨 줄 다음 줄에 `·` 구분 목록)를 라벨별로 분류해 뽑는다.
 * 서술 스타일이 리포트마다 달라져도 이 트레일러는 비교적 안정적이라는 게
 * §37에서 확인한 전제 — "여행스타일"처럼 매핑할 자리가 없는 라벨은 무시한다. */
function parseKeywordTrailer(lines: string[]): KeywordTrailerGroups {
  const groups: KeywordTrailerGroups = { regions: [], foods: [], positive: [], negative: [] };
  const headingIdx = lines.findIndex((l) => KEYWORD_TRAILER_HEADING_PATTERN.test(l));
  if (headingIdx < 0) return groups;

  for (let i = headingIdx + 1; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    const labelMatch = trimmed.match(LABEL_LINE_PATTERN);
    if (!labelMatch) continue;
    const label = labelMatch[1].trim();

    let j = i + 1;
    while (j < lines.length && !lines[j].trim()) j++;
    if (j >= lines.length) break;
    const items = splitKeywordItems(lines[j]);
    if (items.length === 0) continue;

    if (/여행지/.test(label)) groups.regions.push(...items);
    else if (/음식/.test(label)) groups.foods.push(...items);
    else if (/좋은\s*점/.test(label)) groups.positive.push(...items);
    else if (/나쁜\s*점|불편한?\s*점/.test(label)) groups.negative.push(...items);
    // "여행스타일" 등 매핑 안 되는 라벨은 무시

    i = j;
  }
  return groups;
}

function parseSignals(lines: string[], trailer: KeywordTrailerGroups): ParsedReportSignals {
  let positive: string[] = [];
  let negative: string[] = [];

  const posRange = findSectionRange(lines, POSITIVE_SECTION_HEADING_PATTERN);
  if (posRange) positive = parseNumberedSections(lines, posRange[0], posRange[1]);

  const negRange = findSectionRange(lines, NEGATIVE_SECTION_HEADING_PATTERN);
  if (negRange) negative = parseNumberedSections(lines, negRange[0], negRange[1]);

  // 번호 섹션이 없으면(옛 형식) "긍정:"/"부정:" 단일 문단으로 폴백
  if (positive.length === 0) {
    const idx = lines.findIndex((l) => POSITIVE_PARAGRAPH_PATTERN.test(l.trim()));
    if (idx >= 0) {
      const m = captureBlock(lines, idx).match(POSITIVE_PARAGRAPH_PATTERN);
      if (m) positive = [m[1].trim()];
    }
  }
  if (negative.length === 0) {
    const idx = lines.findIndex((l) => NEGATIVE_PARAGRAPH_PATTERN.test(l.trim()));
    if (idx >= 0) {
      const m = captureBlock(lines, idx).match(NEGATIVE_PARAGRAPH_PATTERN);
      if (m) negative = [m[1].trim()];
    }
  }

  for (const item of trailer.positive) if (!positive.includes(item)) positive.push(item);
  for (const item of trailer.negative) if (!negative.includes(item)) negative.push(item);

  return { positive, negative };
}

export function parseInsightReportBody(md: string): ParsedInsightReport {
  const lines = md.replace(/\r\n/g, '\n').split('\n');

  const regions = parseRegionsTable(lines);
  const trailer = parseKeywordTrailer(lines);
  const interests = parseInterests(lines);
  const signals = parseSignals(lines, trailer);
  const foods = [...new Set(trailer.foods)];

  const regionNames = new Set(regions.map((r) => r.name));
  for (const name of new Set(trailer.regions)) {
    if (!regionNames.has(name)) {
      regions.push({ name, mentionCount: null, notablePlaces: '' });
      regionNames.add(name);
    }
  }

  return { regions, interests, signals, foods };
}

/** 다 비어 있으면 대시보드로 보여줄 게 없다는 뜻 — 호출부가 원문 보기로 대체 */
export function hasParsedContent(parsed: ParsedInsightReport | null | undefined): boolean {
  if (!parsed) return false;
  return (
    parsed.regions.length > 0 ||
    parsed.interests.length > 0 ||
    parsed.signals.positive.length > 0 ||
    parsed.signals.negative.length > 0 ||
    parsed.foods.length > 0
  );
}
