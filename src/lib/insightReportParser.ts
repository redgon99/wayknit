/**
 * 리서치 리포트 — 붙여넣은 원문을 규칙 기반으로 표/그래프용 데이터로 뽑는다.
 * LLM 호출 없음(사용자 요청) — `multiLangGuideMacro.ts`의
 * `parseMultiLangGuideHeuristic`와 같은 철학: 정해진 형식만 결정적으로
 * 인식하고, 못 찾으면 조용히 빈 값을 돌려준다(호출부가 원문 보기로 대체).
 */

export interface ParsedReportRegion {
  name: string;
  mentionCount: number;
  notablePlaces: string;
}

export interface ParsedReportInterest {
  title: string;
  description: string;
}

export interface ParsedReportSignals {
  positive: string | null;
  negative: string | null;
}

export interface ParsedInsightReport {
  regions: ParsedReportRegion[];
  interests: ParsedReportInterest[];
  signals: ParsedReportSignals;
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

function parseRegions(lines: string[]): ParsedReportRegion[] {
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

const INTEREST_HEADING_PATTERN = /관심사/;
/** "**소제목**: 설명" 또는 그냥 "소제목: 설명" 둘 다 인정(사용자가 붙여넣는 원문엔
 * 마크다운 볼드 기호가 없는 경우가 많아서 — 실사용 샘플 기준) */
const INTEREST_ITEM_PATTERN = /^\*{0,2}([^:：*]{2,24})\*{0,2}[:：]\s*(.+)$/;

function parseInterests(lines: string[], stopIdx: number): ParsedReportInterest[] {
  const headingIdx = lines.findIndex((l) => INTEREST_HEADING_PATTERN.test(l));
  if (headingIdx < 0) return [];
  const end = stopIdx >= 0 ? stopIdx : lines.length;

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

function parseSignals(lines: string[]): { signals: ParsedReportSignals; positiveLineIdx: number } {
  let positive: string | null = null;
  let negative: string | null = null;

  const positiveLineIdx = lines.findIndex((l) => POSITIVE_PARAGRAPH_PATTERN.test(l.trim()));
  if (positiveLineIdx >= 0) {
    const m = captureBlock(lines, positiveLineIdx).match(POSITIVE_PARAGRAPH_PATTERN);
    if (m) positive = m[1].trim();
  }
  const negativeLineIdx = lines.findIndex((l) => NEGATIVE_PARAGRAPH_PATTERN.test(l.trim()));
  if (negativeLineIdx >= 0) {
    const m = captureBlock(lines, negativeLineIdx).match(NEGATIVE_PARAGRAPH_PATTERN);
    if (m) negative = m[1].trim();
  }
  return { signals: { positive, negative }, positiveLineIdx };
}

export function parseInsightReportBody(md: string): ParsedInsightReport {
  const lines = md.replace(/\r\n/g, '\n').split('\n');

  const regions = parseRegions(lines);
  const { signals, positiveLineIdx } = parseSignals(lines);
  const interests = parseInterests(lines, positiveLineIdx);

  return { regions, interests, signals };
}

/** 셋 다 비어 있으면 대시보드로 보여줄 게 없다는 뜻 — 호출부가 원문 보기로 대체 */
export function hasParsedContent(parsed: ParsedInsightReport | null | undefined): boolean {
  if (!parsed) return false;
  return (
    parsed.regions.length > 0 ||
    parsed.interests.length > 0 ||
    Boolean(parsed.signals.positive) ||
    Boolean(parsed.signals.negative)
  );
}
