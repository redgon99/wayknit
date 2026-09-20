import type { GuideArticle, GuideArticleInput, GuideCoursePin, GuideKind, GuideStatus } from '../types/guides';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured } from './supabase';
import { normalizeGuideKind } from './guideKinds';

function requireSupabase() {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase가 설정되어야 가이드 기능을 사용할 수 있습니다.');
  }
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase 클라이언트를 초기화할 수 없습니다.');
  return sb;
}

async function describeFunctionError(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = (await error.context.json()) as { error?: string };
      if (body?.error) return body.error;
    } catch {
      /* ignore */
    }
    const status = error.context?.status;
    if (status === 504 || status === 546) {
      return '공유 페이지 조회가 시간 초과되었습니다. 잠시 후 다시 시도하거나 「본문 붙여넣기」 탭을 사용하세요.';
    }
  }
  return error instanceof Error ? error.message : String(error);
}

function mapStringArray(raw: unknown, max = 8): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out = raw
    .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    .map((s) => s.trim())
    .slice(0, max);
  return out.length > 0 ? out : undefined;
}

function mapCoursePins(raw: unknown): GuideCoursePin[] {
  if (!Array.isArray(raw)) return [];
  const out: GuideCoursePin[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const lat = Number(o.lat);
    const lng = Number(o.lng);
    const name = typeof o.name === 'string' ? o.name.trim() : '';
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const rating = typeof o.rating === 'number' ? o.rating : Number(o.rating);
    const reviewCount =
      typeof o.reviewCount === 'number'
        ? o.reviewCount
        : typeof o.review_count === 'number'
          ? o.review_count
          : Number(o.reviewCount ?? o.review_count);
    out.push({
      order: typeof o.order === 'number' ? o.order : out.length + 1,
      name,
      time: typeof o.time === 'string' ? o.time : undefined,
      lat,
      lng,
      label: typeof o.label === 'string' ? o.label : undefined,
      googlePlaceId:
        typeof o.googlePlaceId === 'string'
          ? o.googlePlaceId
          : typeof o.google_place_id === 'string'
            ? o.google_place_id
            : undefined,
      rating: Number.isFinite(rating) ? rating : undefined,
      reviewCount: Number.isFinite(reviewCount) ? reviewCount : undefined,
      categoryLabel:
        typeof o.categoryLabel === 'string'
          ? o.categoryLabel
          : typeof o.category_label === 'string'
            ? o.category_label
            : undefined,
      priceLevelLabel:
        typeof o.priceLevelLabel === 'string'
          ? o.priceLevelLabel
          : typeof o.price_level_label === 'string'
            ? o.price_level_label
            : undefined,
      photoUrls: mapStringArray(o.photoUrls ?? o.photo_urls, 6),
      address: typeof o.address === 'string' ? o.address : undefined,
      phone: typeof o.phone === 'string' ? o.phone : undefined,
      openingText:
        typeof o.openingText === 'string'
          ? o.openingText
          : typeof o.opening_text === 'string'
            ? o.opening_text
            : undefined,
      editorialSummary:
        typeof o.editorialSummary === 'string'
          ? o.editorialSummary
          : typeof o.editorial_summary === 'string'
            ? o.editorial_summary
            : undefined,
      reviewHighlights: mapStringArray(o.reviewHighlights ?? o.review_highlights, 5),
      dayLabel:
        typeof o.dayLabel === 'string'
          ? o.dayLabel
          : typeof o.day_label === 'string'
            ? o.day_label
            : undefined,
    });
  }
  return out;
}

function mapRow(row: Record<string, unknown>): GuideArticle {
  return {
    id: row.id as string,
    slug: row.slug as string,
    title: row.title as string,
    summary: (row.summary as string) ?? '',
    bodyMd: (row.body_md as string) ?? '',
    summaryEn: (row.summary_en as string | null) ?? null,
    kind: normalizeGuideKind(row.kind),
    topicTags: (row.topic_tags as string[] | null) ?? [],
    status: row.status as GuideStatus,
    sourceAnalysisIds: (row.source_analysis_ids as string[] | null) ?? [],
    sourceUrls: (row.source_urls as string[] | null) ?? [],
    coursePins: mapCoursePins(row.course_pins),
    locale: (row.locale as string) ?? 'ko',
    translations: (row.translations as GuideArticle['translations'] | null) ?? {},
    createdBy: (row.created_by as string | null) ?? null,
    publishedAt: (row.published_at as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

/** 다국어 통합(2026-09-20) — 조회한 로케일로 뽑은 표시용 콘텐츠 */
export interface ResolvedGuideContent {
  /** 실제로 채택된 로케일(요청한 것과 다를 수 있음 — 폴백된 경우) */
  locale: string;
  title: string;
  summary: string;
  bodyMd: string;
}

/** 이 가이드가 실제로 갖고 있는 언어 목록(대표 언어 + translations 키) */
export function guideAvailableLocales(guide: GuideArticle): string[] {
  const seen = new Set<string>([guide.locale]);
  for (const loc of Object.keys(guide.translations)) seen.add(loc);
  return [...seen];
}

/**
 * scenarioCatalog.ts의 pickLocaleContent()와 같은 규칙 — 요청 로케일이
 * 없으면 중국어 번체/간체는 서로 폴백, 그 외엔 대표 언어로 돌아간다.
 */
export function pickGuideContent(guide: GuideArticle, locale: string): ResolvedGuideContent {
  if (locale === guide.locale) {
    return { locale: guide.locale, title: guide.title, summary: guide.summary, bodyMd: guide.bodyMd };
  }
  const exact = guide.translations[locale];
  if (exact) return { locale, ...exact };

  if (locale === 'zh-CN') {
    const alt = guide.translations['zh-TW'];
    if (alt) return { locale: 'zh-TW', ...alt };
  }
  if (locale === 'zh-TW') {
    const alt = guide.translations['zh-CN'];
    if (alt) return { locale: 'zh-CN', ...alt };
  }

  return { locale: guide.locale, title: guide.title, summary: guide.summary, bodyMd: guide.bodyMd };
}

export function slugifyGuideTitle(title: string): string {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${base || 'guide'}-${suffix}`;
}

export async function listPublishedGuides(
  limit = 24,
  kind?: GuideKind
): Promise<GuideArticle[]> {
  const sb = requireSupabase();
  let query = sb
    .from('guide_articles')
    .select('*')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(limit);
  if (kind) query = query.eq('kind', kind);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
}

export async function getPublishedGuideBySlug(slug: string): Promise<GuideArticle | null> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('guide_articles')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();
  if (error) throw error;
  return data ? mapRow(data as Record<string, unknown>) : null;
}

/*
 * S1(관리자 검토 2026-09-16) — 목록 화면은 제목·요약·상태 정도만
 * 보여주는데 `select('*')`로 본문(body_md, 글마다 수 KB)까지 매번
 * 전부 받아왔다. 목록엔 안 쓰는 컬럼은 빼고, 편집창을 열 때만
 * `getAdminGuide()`가 `select('*')`로 전체를 받는다.
 */
const GUIDE_LIST_SELECT =
  'id, slug, title, summary, kind, status, topic_tags, locale, created_by, published_at, created_at, updated_at';

export async function listAdminGuides(options?: {
  status?: GuideStatus;
  kind?: GuideKind;
}): Promise<GuideArticle[]> {
  const sb = requireSupabase();
  let query = sb
    .from('guide_articles')
    .select(GUIDE_LIST_SELECT)
    .order('updated_at', { ascending: false });
  if (options?.status) query = query.eq('status', options.status);
  if (options?.kind) query = query.eq('kind', options.kind);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
}

export async function getAdminGuide(id: string): Promise<GuideArticle | null> {
  const sb = requireSupabase();
  const { data, error } = await sb.from('guide_articles').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? mapRow(data as Record<string, unknown>) : null;
}

/**
 * patch(camelCase) → guide_articles 행 모양(snake_case) 부분 객체.
 * updateGuide와, 묶음 2의 초안 저장/게시(adminContentDrafts.ts,
 * admin_publish_draft RPC)가 같이 쓴다.
 */
export function buildGuideRow(
  patch: Partial<GuideArticleInput> & { status?: GuideStatus; publishedAt?: string | null }
): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.summary !== undefined) row.summary = patch.summary;
  if (patch.bodyMd !== undefined) row.body_md = patch.bodyMd;
  if (patch.summaryEn !== undefined) row.summary_en = patch.summaryEn;
  if (patch.kind !== undefined) row.kind = patch.kind;
  if (patch.topicTags !== undefined) row.topic_tags = patch.topicTags;
  if (patch.sourceUrls !== undefined) row.source_urls = patch.sourceUrls;
  if (patch.sourceAnalysisIds !== undefined) row.source_analysis_ids = patch.sourceAnalysisIds;
  if (patch.coursePins !== undefined) row.course_pins = patch.coursePins;
  if (patch.locale !== undefined) row.locale = patch.locale;
  if (patch.translations !== undefined) row.translations = patch.translations;
  if (patch.slug !== undefined) row.slug = patch.slug;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.publishedAt !== undefined) row.published_at = patch.publishedAt;
  return row;
}

export async function updateGuide(
  id: string,
  patch: Partial<GuideArticleInput> & { status?: GuideStatus; publishedAt?: string | null }
): Promise<void> {
  const sb = requireSupabase();
  const row = { ...buildGuideRow(patch), updated_at: new Date().toISOString() };

  const { error } = await sb.from('guide_articles').update(row).eq('id', id);
  if (error) throw error;
}

/** 관리자: 추천 코스 매크로 등으로 새 가이드 행 생성 */
export async function createGuide(
  input: GuideArticleInput & { status?: GuideStatus; publishedAt?: string | null }
): Promise<GuideArticle> {
  const sb = requireSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  const slug = input.slug?.trim() || slugifyGuideTitle(input.title);
  const status: GuideStatus = input.status ?? 'draft';
  const row = {
    ...buildGuideRow({
      ...input,
      slug,
      kind: input.kind ?? 'course',
      status,
      publishedAt:
        input.publishedAt !== undefined
          ? input.publishedAt
          : status === 'published'
            ? new Date().toISOString()
            : null,
    }),
    created_by: user?.id ?? null,
  };
  const { data, error } = await sb.from('guide_articles').insert(row).select('*').single();
  if (error) throw error;
  return mapRow(data as Record<string, unknown>);
}

export async function publishGuide(id: string): Promise<void> {
  await updateGuide(id, {
    status: 'published',
    publishedAt: new Date().toISOString(),
  });
}

export async function unpublishGuide(id: string): Promise<void> {
  await updateGuide(id, { status: 'draft', publishedAt: null });
}

export async function archiveGuide(id: string): Promise<void> {
  await updateGuide(id, { status: 'archived' });
}

export async function deleteGuide(id: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from('guide_articles').delete().eq('id', id);
  if (error) throw error;
  await Promise.all([
    sb.from('admin_content_drafts').delete().eq('table_name', 'guide_articles').eq('row_key', id),
    sb.from('admin_content_versions').delete().eq('table_name', 'guide_articles').eq('row_key', id),
  ]).catch(() => undefined);
}

export async function triggerGuideDraftFromTips(options?: {
  analysisIds?: string[];
}): Promise<{ created: number; ids: string[] }> {
  const sb = requireSupabase();
  const analysisIds = options?.analysisIds?.filter(Boolean) ?? [];
  const { data, error } = await sb.functions.invoke<{
    created?: number;
    ids?: string[];
    error?: string;
  }>('insight-guide-draft', {
    body: analysisIds.length > 0 ? { analysisIds } : {},
  });
  if (error) throw error;
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    throw new Error(String(data.error));
  }
  return {
    created: (data?.created as number) ?? 0,
    ids: (data?.ids as string[]) ?? [],
  };
}

/** ChatGPT 공개 공유 링크 → 일정 본문 추출 (AI 토큰 없음) */
export async function fetchCourseTextFromGptShare(url: string): Promise<{
  sourceUrl: string;
  titleHint: string | null;
  cleanedText: string;
}> {
  const { extractCourseTextFromShareHtml, isChatGptShareUrl } = await import('./chatgptShareParse');
  if (!isChatGptShareUrl(url)) {
    throw new Error('chatgpt.com/share/… 형식의 공개 공유 링크만 지원합니다.');
  }
  const normalized = (url.includes('://') ? url.trim() : `https://${url.trim()}`).split('?')[0];

  // 1) 브라우저 → Jina (커스텀 헤더 없이 GET → CORS preflight 회피)
  let jinaError: string | null = null;
  try {
    const jina = await fetch(`https://r.jina.ai/${normalized}`);
    if (jina.ok) {
      const text = await jina.text();
      if (!text.trim()) throw new Error('공유 본문이 비어 있습니다.');
      const { cleanedText, titleHint } = extractCourseTextFromShareHtml(text);
      return {
        sourceUrl: normalized,
        titleHint: titleHint ?? null,
        cleanedText,
      };
    }
    jinaError = `Jina 응답 ${jina.status}`;
  } catch (e) {
    jinaError = e instanceof Error ? e.message : String(e);
  }

  // 2) Edge 폴백
  try {
    const sb = requireSupabase();
    const { data, error } = await sb.functions.invoke<{
      sourceUrl?: string;
      titleHint?: string | null;
      cleanedText?: string;
      error?: string;
    }>('guide-course-from-share', { body: { url: normalized } });
    if (error) throw new Error(await describeFunctionError(error));
    if (data && typeof data === 'object' && data.error) {
      throw new Error(String(data.error));
    }
    if (!data?.cleanedText?.trim()) {
      throw new Error('공유 링크에서 일정 본문을 받지 못했습니다.');
    }
    return {
      sourceUrl: data.sourceUrl ?? normalized,
      titleHint: data.titleHint ?? null,
      cleanedText: data.cleanedText,
    };
  } catch (e) {
    const edgeMsg = e instanceof Error ? e.message : String(e);
    throw new Error(
      `링크 추출 실패 (${jinaError ?? 'jina'} / ${edgeMsg}). 「본문 붙여넣기」 탭을 사용하거나 잠시 후 다시 시도하세요.`
    );
  }
}

export function isGuidesConfigured(): boolean {
  return isSupabaseConfigured;
}
