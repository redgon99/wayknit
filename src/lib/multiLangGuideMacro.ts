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
 *
 * **가장 안정적인 형식**: 원문을 만들 때(예: ChatGPT 프롬프트) 각 언어
 * 헤더에 우리 서비스 locale 코드를 `[ko]`처럼 대괄호로 명시하게 하면
 * 언어명 추측(오탐 가능)보다 훨씬 확실하게 구분된다 — 예:
 * `## [ko] 대한민국 역사, 여행자를 위한 쉬운 이야기`. 지원 코드 9개:
 * ko/en/ja/zh-CN/zh-TW/es/fr/de/ru (lib/locale.ts SUPPORTED_LOCALES와 동일).
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

/**
 * 언어 자기이름 추측(위 LOCALE_NAME_PATTERNS)은 AI가 표현을 조금만 바꿔도
 * (예: "Español"을 "Spanish"로) 놓친다는 게 실사용에서 드러남(2026-09-20).
 * 그래서 원문 생성 시 `[ko]`처럼 우리 서비스 locale 코드를 헤더에 직접
 * 박아 넣게 지시하는 방식을 지원 — 있으면 무조건 이걸 최우선으로 믿는다
 * (언어명 추측보다 훨씬 결정적).
 */
const LOCALE_CODE_CANON: Record<string, AppLocale> = {
  ko: 'ko',
  en: 'en',
  ja: 'ja',
  'zh-cn': 'zh-CN',
  'zh-tw': 'zh-TW',
  es: 'es',
  fr: 'fr',
  de: 'de',
  ru: 'ru',
};
const LOCALE_CODE_TAG_PATTERN = /\[(ko|en|ja|zh-cn|zh-tw|es|fr|de|ru)\]/i;

/** `[ko]`/`[zh-CN]`처럼 대괄호로 감싼 명시적 코드를 줄에서 찾는다.
 * 찾으면 그 태그를 뺀 나머지 텍스트(헤딩 기호·`|` 구분자도 정리)를
 * 함께 돌려준다 — 그게 비어있지 않으면 그대로 제목으로 쓸 수 있다. */
function extractLocaleCodeTag(line: string): { locale: AppLocale; rest: string } | null {
  const match = line.match(LOCALE_CODE_TAG_PATTERN);
  if (!match) return null;
  const locale = LOCALE_CODE_CANON[match[1].toLowerCase()];
  if (!locale) return null;
  const rest = (line.slice(0, match.index) + line.slice((match.index ?? 0) + match[0].length))
    .replace(/^#+\s*/, '')
    .replace(/^[|｜:\-]\s*/, '')
    .trim();
  return { locale, rest };
}

/** `ko | 한국어`처럼 줄 맨 앞에 코드 + "|" 구분자만 있고, "|" 뒤는 그
 * 언어의 자기이름(제목이 아님)인 형식 — 실제 제목은 다음 줄에 온다.
 * 대괄호 없이도 코드를 결정적으로 잡아내되(언어명 추측에 안 기댐),
 * 본문 중간의 우연한 매치를 막기 위해 반드시 줄 맨 앞 + "|" 구분자가
 * 있을 때만 인정한다("es | Español"처럼 흔한 짧은 단어 "es"가 스페인어
 * 본문 문장 앞부분에 우연히 오는 경우까지 헤더로 오인하지 않도록). */
const LEADING_LOCALE_CODE_PATTERN = /^(ko|en|ja|zh-cn|zh-tw|es|fr|de|ru)\s*[|｜]/i;

function extractLeadingLocaleCode(line: string): AppLocale | null {
  const match = line.match(LEADING_LOCALE_CODE_PATTERN);
  if (!match) return null;
  return LOCALE_CODE_CANON[match[1].toLowerCase()] ?? null;
}

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

    // 명시적 [코드] 태그가 있으면 언어명 추측보다 무조건 우선(줄 길이·헤딩
    // 여부와 무관하게 신뢰) — 태그 하나가 언어당 딱 한 번만 매칭되도록
    // 이미 찾은 언어면 건너뛴다.
    const tagMatch = extractLocaleCodeTag(trimmed);
    if (tagMatch) {
      if (seenLocales.has(tagMatch.locale)) return;
      markers.push({ lineIndex: i, locale: tagMatch.locale, inlineTitle: tagMatch.rest || null });
      seenLocales.add(tagMatch.locale);
      return;
    }

    // `ko | 한국어`처럼 코드 + 구분자로 시작하는 줄도 마찬가지로 결정적으로
    // 신뢰한다. "|" 뒤는 언어 자기이름일 뿐 제목이 아니므로(제목은 다음
    // 줄) inlineTitle 없이 옛 형식 경로로 넘긴다. `### ko | 한국어`처럼
    // 마크다운 헤딩(#) 뒤에 코드가 오는 경우도 있어 헤딩 기호를 먼저
    // 떼어내고 검사한다 — 안 그러면 "^코드" 앵커가 "#"에 막혀 못 잡고,
    // 아래 언어명 추측 경로로 새서 "|" 뒤 언어명을 엉뚱하게 제목으로
    // 오인하게 된다(2026-09-20 실사용에서 재현됨).
    const leadingCode = extractLeadingLocaleCode(trimmed.replace(/^#{1,6}\s*/, ''));
    if (leadingCode) {
      if (seenLocales.has(leadingCode)) return;
      markers.push({ lineIndex: i, locale: leadingCode, inlineTitle: null });
      seenLocales.add(leadingCode);
      return;
    }

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
