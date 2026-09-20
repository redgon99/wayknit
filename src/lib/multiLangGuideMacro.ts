import { getSupabase, isSupabaseConfigured } from './supabase';
import type { AppLocale } from './locale';

/**
 * 다국어 가이드 붙여넣기(2026-09-20 사용자 요청) — "한국어/English/简体中文/
 * 日本語…" 순서로 같은 내용을 반복해 적은 원문을, 언어별 guide_articles
 * 행으로 나눠 만들기 위한 파싱.
 *
 * 무료 규칙 기반 분리를 먼저 시도하고, 실패할 때만(형식이 다르거나 헤더를
 * 못 찾을 때) AI(엣지함수 guide-multilang-split)로 넘어간다 — 매번 AI를
 * 쓰면 비용이 들고, 지금 형식(국기 이모지+언어명 헤더)은 규칙만으로
 * 충분히 안정적으로 나뉘기 때문.
 */

export interface MultiLangGuideSection {
  locale: AppLocale;
  title: string;
  bodyMd: string;
}

const LOCALE_NAME_PATTERNS: Array<{ locale: AppLocale; pattern: RegExp }> = [
  { locale: 'ko', pattern: /한국어/i },
  { locale: 'ja', pattern: /日本語/i },
  { locale: 'zh-CN', pattern: /简体中文|简体/i },
  { locale: 'zh-TW', pattern: /繁體中文|繁体中文|繁體/i },
  { locale: 'en', pattern: /\benglish\b/i },
  { locale: 'es', pattern: /español|espanol/i },
  { locale: 'fr', pattern: /français|francais/i },
  { locale: 'de', pattern: /deutsch/i },
  { locale: 'ru', pattern: /русский/i },
];

/** 마크다운 헤딩(#)이 아닌 "언어명만 덜렁 있는 줄"을 헤더로 볼 때만 적용하는
 * 길이 제한. `## 🇪🇸 Español | Historia...`처럼 `#`으로 시작하는 줄은
 * 제목이 같이 붙어 길어도 명확한 헤더 신호라 길이를 안 따진다. */
const MAX_HEADER_LINE_LENGTH = 40;
const HEADING_LINE_PATTERN = /^#{1,6}\s+/;
/** 언어 구간을 나누는 장식용 구분선(`---`/`***`/`___`)은 본문이 아니다 */
const DIVIDER_LINE_PATTERN = /^(-{3,}|\*{3,}|_{3,})$/;

function stripHeadingMarkup(line: string): string {
  return line
    .replace(/^#+\s*/, '')
    .replace(/^\*\*(.+)\*\*$/, '$1')
    .replace(/^__(.+)__$/, '$1')
    .trim();
}

/** `## 🇰🇷 한국어 | 대한민국 역사, ...`처럼 헤딩 줄에 구분자(|／｜)로 제목이
 * 함께 적혀 있으면 그 부분을 바로 제목으로 쓴다(없으면 null — 다음 줄이
 * 제목인 옛 형식으로 처리). */
function extractInlineTitle(headingLine: string): string | null {
  const match = headingLine.match(/[|｜]\s*(.+)$/);
  const title = match?.[1]?.trim();
  return title ? title : null;
}

/**
 * 규칙 기반 분리. 최소 2개 언어 헤더를 찾아야 성공으로 본다(1개뿐이면
 * "여러 언어를 붙여넣은 것"이라 보기 어려움 — 그냥 일반 텍스트일 수 있음).
 * 실패하면 null — 호출부가 AI 보조로 넘어갈 신호.
 */
export function parseMultiLangGuideHeuristic(raw: string): MultiLangGuideSection[] | null {
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const markers: Array<{ lineIndex: number; locale: AppLocale; inlineTitle: string | null }> = [];
  const seenLocales = new Set<AppLocale>();

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const isHeading = HEADING_LINE_PATTERN.test(trimmed);
    if (!isHeading && trimmed.length > MAX_HEADER_LINE_LENGTH) return;
    for (const { locale, pattern } of LOCALE_NAME_PATTERNS) {
      if (seenLocales.has(locale)) continue;
      if (pattern.test(trimmed)) {
        markers.push({ lineIndex: i, locale, inlineTitle: isHeading ? extractInlineTitle(trimmed) : null });
        seenLocales.add(locale);
        break;
      }
    }
  });

  if (markers.length < 2) return null;

  const sections: MultiLangGuideSection[] = [];
  for (let i = 0; i < markers.length; i++) {
    const marker = markers[i];
    const start = marker.lineIndex + 1;
    const end = i + 1 < markers.length ? markers[i + 1].lineIndex : lines.length;
    const bodyLines = lines
      .slice(start, end)
      .map((l) => l.trim())
      .filter((l) => l && !DIVIDER_LINE_PATTERN.test(l));

    let title: string;
    let bodyMd: string;
    if (marker.inlineTitle) {
      // 헤딩 줄에 제목이 이미 있었으니 이어지는 줄은 전부 본문
      if (bodyLines.length < 1) continue;
      title = marker.inlineTitle;
      bodyMd = bodyLines.join('\n\n').trim();
    } else {
      // 옛 형식: 언어명 줄 다음 줄이 제목, 그다음부터가 본문
      if (bodyLines.length < 2) continue;
      title = stripHeadingMarkup(bodyLines[0]);
      bodyMd = bodyLines.slice(1).join('\n\n').trim();
    }
    if (!title || !bodyMd) continue;
    sections.push({ locale: marker.locale, title, bodyMd });
  }

  return sections.length >= 2 ? sections : null;
}

function requireSupabase() {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase가 설정되어야 다국어 분리를 사용할 수 있습니다.');
  }
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase 클라이언트를 초기화할 수 없습니다.');
  return sb;
}

const SUPPORTED_LOCALE_SET = new Set<string>([
  'ko',
  'en',
  'ja',
  'zh-CN',
  'zh-TW',
  'es',
  'fr',
  'de',
  'ru',
]);

/** 규칙 기반이 실패했을 때만 부르는 AI 보조 경로 — 매번 AI를 쓰지 않는다. */
export async function splitMultiLangGuideWithAi(raw: string): Promise<MultiLangGuideSection[]> {
  const sb = requireSupabase();
  const { data, error } = await sb.functions.invoke<{
    sections?: Array<{ locale: string; title: string; bodyMd: string }>;
    error?: string;
  }>('guide-multilang-split', { body: { text: raw } });
  if (error) throw new Error(error.message || '다국어 분리에 실패했습니다.');
  if (data && 'error' in data && data.error) throw new Error(String(data.error));
  const sections = (data?.sections ?? []).filter(
    (s): s is { locale: AppLocale; title: string; bodyMd: string } =>
      SUPPORTED_LOCALE_SET.has(s.locale) && Boolean(s.title) && Boolean(s.bodyMd)
  );
  if (sections.length < 2) {
    throw new Error('AI도 언어 구간을 2개 이상 찾지 못했습니다. 형식을 확인해 주세요.');
  }
  return sections;
}

export interface MultiLangParseOutcome {
  sections: MultiLangGuideSection[];
  usedAi: boolean;
}

/** 규칙 기반 먼저 시도 → 실패하면(2개 미만) AI 보조로 넘어간다. */
export async function parseMultiLangGuide(raw: string): Promise<MultiLangParseOutcome> {
  const heuristic = parseMultiLangGuideHeuristic(raw);
  if (heuristic) return { sections: heuristic, usedAi: false };
  const aiSections = await splitMultiLangGuideWithAi(raw);
  return { sections: aiSections, usedAi: true };
}

/** guide_articles.summary는 필수 컬럼이라, 본문 앞부분으로 자동 채운다. */
export function deriveGuideSummary(bodyMd: string, maxLength = 120): string {
  const plain = bodyMd
    .replace(/^#+\s*/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > maxLength ? `${plain.slice(0, maxLength)}…` : plain;
}
