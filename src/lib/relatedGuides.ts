import { getSupabase } from './supabase';
import { fallbackLocales, guideRowToSearchItem } from './siteSearch';
import { getCourseTaxonomyTag, inferCourseTaxonomyTags } from './courseGuideTaxonomy';

/**
 * 가이드 상세 맨 아래 "이어서 볼 코스"(개편 1단계, 2026-11-21).
 * 방문의 80%가 가이드라, 다 읽은 사람을 다음 코스·담기로 잇는다.
 *
 * 코스 핀 전체(`course_pins`, 코스 글 전부 합쳐 약 580KB)는 받지 않고
 * 첫 핀 하나만 받아 "담을 장소가 있는지"만 본다.
 */
export interface RelatedCourse {
  slug: string;
  title: string;
  summary: string;
  tags: string[];
  hasPins: boolean;
  /** 제목(원문)·태그에서 뽑은 분류 id — 지역(region)·테마 등. 표시하지 않고 고르는 데만 쓴다 */
  taxonomy: string[];
}

type Row = Record<string, unknown>;

/** 원문 제목·태그 → 분류 id. 태그가 영어(busan)든 한국어(부산·해운대)든 같은 id로 모인다 */
export function courseTaxonomyOf(title: string, tags: string[]): string[] {
  return inferCourseTaxonomyTags([title, ...tags], 16);
}

/** 같은 지역이면 3점, 그 밖의 분류(테마·동행 등)가 겹치면 1점. 동점이면 담을 장소가 있는 것, 그다음 최신순 */
export function pickRelatedCourses(
  rows: RelatedCourse[],
  currentSlug: string,
  currentTaxonomy: string[],
  limit = 3
): RelatedCourse[] {
  const mine = new Set(currentTaxonomy);
  return rows
    .filter((r) => r.slug !== currentSlug)
    .map((r, order) => ({
      r,
      order,
      score: r.taxonomy.reduce((n, id) => {
        if (!mine.has(id)) return n;
        return n + (getCourseTaxonomyTag(id)?.group === 'region' ? 3 : 1);
      }, 0),
    }))
    .sort((a, b) => b.score - a.score || Number(b.r.hasPins) - Number(a.r.hasPins) || a.order - b.order)
    .slice(0, limit)
    .map((x) => x.r);
}

export async function listRelatedCourses(
  current: { slug: string; title: string; topicTags: string[] },
  locale: string
): Promise<RelatedCourse[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const extra = fallbackLocales(locale)
    .map((loc, i) => `t${i}:translations->"${loc}"->>title,s${i}:translations->"${loc}"->>summary`)
    .join(',');
  const { data, error } = await sb
    .from('guide_articles')
    .select(`slug,kind,locale,title,summary,topic_tags,first_pin:course_pins->0,${extra}`)
    .eq('status', 'published')
    .eq('kind', 'course')
    .order('published_at', { ascending: false })
    .limit(200);
  if (error || !data) return [];
  const rows = (data as unknown as Row[]).map((row) => {
    const item = guideRowToSearchItem(row as Record<string, string | string[] | null>, locale);
    const tags = (row.topic_tags as string[] | null) ?? [];
    return {
      slug: item.slug,
      title: item.title,
      // 요약에 남은 마크다운 굵게(**)는 카드에서 그대로 보이므로 뺀다
      summary: item.summary.replace(/\*\*/g, ''),
      tags,
      hasPins: row.first_pin != null,
      taxonomy: courseTaxonomyOf((row.title as string) ?? '', tags),
    };
  });
  return pickRelatedCourses(rows, current.slug, courseTaxonomyOf(current.title, current.topicTags));
}
