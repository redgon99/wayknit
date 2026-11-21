import { getSupabase } from './supabase';
import { listPlazaEntries, type PlazaListing } from './trips';
import type { GuideKind } from './guideKinds';

/**
 * 공개 페이지 상단 통합검색(2026-11-18) — 여행 팁(가이드)·공유마당 코스를 한 번에 찾는다.
 *
 * 가이드는 본문·번역 전체(`select('*')`, 약 2.4MB)가 아니라 제목·요약·태그만
 * 현재 언어로 받는다(약 50KB). 검색창을 처음 누를 때 한 번 받고 페이지를 옮겨도 재사용한다.
 * 장소 검색은 플래너 검색(`?searchKeyword=`)으로 넘긴다 — 여기서 Tour API를 부르면
 * 글자를 칠 때마다 일일 호출 한도를 쓴다.
 */

export interface GuideSearchItem {
  slug: string;
  kind: GuideKind | string;
  title: string;
  summary: string;
  /** 검색 대상 — 표시 언어 + 한국어 원문 + 태그 */
  haystack: string;
  titleKey: string;
}

export interface PlazaSearchItem {
  slug: string;
  title: string;
  totalDays: number;
  pinSummary: string;
  haystack: string;
  titleKey: string;
}

export interface SiteSearchIndex {
  guides: GuideSearchItem[];
  plaza: PlazaSearchItem[];
}

/** 대소문자·전각·공백 차이를 없앤 비교용 문자열("경주 맛집" = "경주맛집") */
export function searchKey(text: string): string {
  return text.normalize('NFKC').toLowerCase().replace(/[\s·・,，、/()（）[\]「」『』"'“”‘’!?.:;~-]+/g, '');
}

function queryTokens(query: string): string[] {
  return query
    .normalize('NFKC')
    .toLowerCase()
    .split(/\s+/)
    .map(searchKey)
    .filter(Boolean);
}

/** 모든 낱말이 들어 있으면 점수(제목에서 맞을수록 높음), 하나라도 없으면 0 */
export function matchScore(query: string, titleKey: string, haystack: string): number {
  const tokens = queryTokens(query);
  if (tokens.length === 0) return 0;
  let score = 0;
  for (const token of tokens) {
    if (titleKey.includes(token)) score += titleKey.startsWith(token) ? 3 : 2;
    else if (haystack.includes(token)) score += 1;
    else return 0;
  }
  return score;
}

function rank<T extends { titleKey: string; haystack: string }>(items: T[], query: string, limit: number): T[] {
  return items
    .map((item, order) => ({ item, order, score: matchScore(query, item.titleKey, item.haystack) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, limit)
    .map((r) => r.item);
}

export function searchSiteIndex(
  index: SiteSearchIndex,
  query: string,
  limits = { guides: 5, plaza: 3 }
): SiteSearchIndex {
  if (!query.trim()) return { guides: [], plaza: [] };
  return { guides: rank(index.guides, query, limits.guides), plaza: rank(index.plaza, query, limits.plaza) };
}

/** pickGuideContent와 같은 폴백 순서: 요청 언어 → 번체/간체 서로 → 영어 → 대표 언어 */
export function fallbackLocales(locale: string): string[] {
  const order = [locale];
  if (locale === 'zh-CN') order.push('zh-TW');
  if (locale === 'zh-TW') order.push('zh-CN');
  if (locale !== 'ko') order.push('en');
  return [...new Set(order)];
}

type GuideRow = Record<string, string | string[] | null>;

export function guideRowToSearchItem(row: GuideRow, locale: string): GuideSearchItem {
  const baseLocale = (row.locale as string) || 'ko';
  const baseTitle = (row.title as string) ?? '';
  const baseSummary = (row.summary as string) ?? '';
  let title = baseTitle;
  let summary = baseSummary;
  if (locale !== baseLocale) {
    for (const [i, loc] of fallbackLocales(locale).entries()) {
      if (loc === baseLocale) break;
      const t = row[`t${i}`] as string | null;
      if (t) {
        title = t;
        summary = (row[`s${i}`] as string | null) ?? '';
        break;
      }
    }
  }
  const tags = (row.topic_tags as string[] | null) ?? [];
  return {
    slug: row.slug as string,
    kind: (row.kind as string) ?? 'tip',
    title,
    summary,
    titleKey: searchKey(`${title} ${baseTitle}`),
    haystack: searchKey([title, summary, baseTitle, baseSummary, ...tags].join(' ')),
  };
}

async function loadGuides(locale: string): Promise<GuideSearchItem[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const extra = fallbackLocales(locale)
    .map((loc, i) => `t${i}:translations->"${loc}"->>title,s${i}:translations->"${loc}"->>summary`)
    .join(',');
  const { data, error } = await sb
    .from('guide_articles')
    .select(`slug,kind,locale,title,summary,topic_tags,${extra}`)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(500);
  if (error || !data) return [];
  return (data as unknown as GuideRow[]).map((row) => guideRowToSearchItem(row, locale));
}

export function plazaToSearchItem(entry: PlazaListing): PlazaSearchItem {
  return {
    slug: entry.slug,
    title: entry.title,
    totalDays: entry.totalDays,
    pinSummary: entry.pinSummary,
    titleKey: searchKey(entry.title),
    haystack: searchKey(`${entry.title} ${entry.pinSummary}`),
  };
}

async function loadPlaza(): Promise<PlazaSearchItem[]> {
  try {
    const entries = await listPlazaEntries(null);
    return entries.map(plazaToSearchItem);
  } catch {
    return [];
  }
}

const cache = new Map<string, Promise<SiteSearchIndex>>();

export function loadSiteSearchIndex(locale: string): Promise<SiteSearchIndex> {
  let pending = cache.get(locale);
  if (!pending) {
    pending = Promise.all([loadGuides(locale).catch(() => []), loadPlaza()]).then(([guides, plaza]) => ({
      guides,
      plaza,
    }));
    // 실패(빈 결과)는 다음에 다시 시도하도록 캐시하지 않는다
    pending.then((idx) => {
      if (idx.guides.length === 0 && idx.plaza.length === 0) cache.delete(locale);
    });
    cache.set(locale, pending);
  }
  return pending;
}
