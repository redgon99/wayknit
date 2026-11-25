import { getSupabase } from './supabase';
import { fallbackLocales, guideRowToSearchItem } from './siteSearch';
import { getCourseTaxonomyTag } from './courseGuideTaxonomy';
import { courseTaxonomyOf } from './relatedGuides';

/**
 * 랜딩 "추천 코스" 카드(개편 3단계, 2026-11-21).
 * 카드에서 바로 "+ 내 일정에 담기"를 하므로 담을 장소(코스 핀)가 있는 코스 글만 보여 준다.
 * 코스 핀 전체는 무거워서(약 580KB) 첫 핀의 이름만 받아 핀이 있는지만 본다.
 */
export interface LandingCourse {
  slug: string;
  title: string;
  /** 지역 분류 id(seoul·busan…). 지역을 못 찾으면 null */
  regionId: string | null;
}

type Row = Record<string, unknown>;

/** 지역 칩으로 쓰지 않는 'region' 그룹 분류 — 장소 성격이라 지역 이름이 아니다 */
const NOT_A_PLACE = new Set(['landmark', 'hidden', 'airport-stay']);

export function regionIdOf(title: string, tags: string[]): string | null {
  return (
    courseTaxonomyOf(title, tags).find(
      (id) => getCourseTaxonomyTag(id)?.group === 'region' && !NOT_A_PLACE.has(id)
    ) ?? null
  );
}

/** 지역 이름: 한국어 화면은 한국어, 나머지 언어는 로마자(외국어 번역이 없어서) */
export function regionLabel(id: string, locale: string): string {
  const tag = getCourseTaxonomyTag(id);
  if (!tag) return id;
  return locale === 'ko' ? tag.labelKo : tag.labelEn;
}

export async function listLandingCourses(locale: string, limit = 6): Promise<LandingCourse[]> {
  const sb = getSupabase();
  if (!sb) return [];
  // 카드는 제목만 쓴다 — 요약은 받지 않고, 첫 핀도 객체 전체(80행이면 약 100 KB) 대신 이름만 받아 있는지 본다.
  // 예전 응답 72 KB → 수 KB(§70, 느린 모바일에서 코스 카드가 늦게 뜨던 원인).
  const extra = fallbackLocales(locale)
    .map((loc, i) => `t${i}:translations->"${loc}"->>title`)
    .join(',');
  const { data, error } = await sb
    .from('guide_articles')
    .select(`slug,locale,title,topic_tags,first_pin:course_pins->0->>name,${extra}`)
    .eq('status', 'published')
    .eq('kind', 'course')
    .order('published_at', { ascending: false })
    .limit(80);
  if (error || !data) return [];
  const rows = (data as unknown as Row[])
    .filter((row) => row.first_pin != null)
    .map((row) => {
      const item = guideRowToSearchItem(row as Record<string, string | string[] | null>, locale);
      const baseLocale = (row.locale as string) || 'ko';
      // 지금 언어로 읽을 수 있는 글을 앞에 — 영어로 대신 보여 주는 글은 뒤로
      const readable =
        baseLocale === locale || !!row.t0 || (locale.startsWith('zh') && !!row.t1);
      return {
        slug: item.slug,
        title: item.title,
        regionId: regionIdOf((row.title as string) ?? '', (row.topic_tags as string[] | null) ?? []),
        readable,
      };
    });
  // sort는 안정 정렬이라 같은 그룹 안에서는 최신순이 유지된다
  rows.sort((a, b) => Number(b.readable) - Number(a.readable));
  return rows.slice(0, limit).map(({ slug, title, regionId }) => ({ slug, title, regionId }));
}
