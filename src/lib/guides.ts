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
    out.push({
      order: typeof o.order === 'number' ? o.order : out.length + 1,
      name,
      time: typeof o.time === 'string' ? o.time : undefined,
      lat,
      lng,
      label: typeof o.label === 'string' ? o.label : undefined,
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
    createdBy: (row.created_by as string | null) ?? null,
    publishedAt: (row.published_at as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
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

  // 1) 브라우저 → Jina Reader (Edge 데이터센터 IP는 ChatGPT/Jina에서 막히는 경우가 많음)
  try {
    const jina = await fetch(`https://r.jina.ai/${normalized}`, {
      headers: {
        Accept: 'text/plain',
        'X-Retain-Images': 'none',
      },
    });
    if (jina.ok) {
      const text = await jina.text();
      const { cleanedText, titleHint } = extractCourseTextFromShareHtml(text);
      return {
        sourceUrl: normalized,
        titleHint: titleHint ?? null,
        cleanedText,
      };
    }
  } catch {
    /* fall through to Edge */
  }

  // 2) Edge 폴백 (JINA_API_KEY 등이 있으면 서버에서도 가능)
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
    throw new Error(
      '공유 링크에서 일정 본문을 받지 못했습니다. 「본문 붙여넣기」 탭을 사용해 주세요.'
    );
  }
  return {
    sourceUrl: data.sourceUrl ?? normalized,
    titleHint: data.titleHint ?? null,
    cleanedText: data.cleanedText,
  };
}

export function isGuidesConfigured(): boolean {
  return isSupabaseConfigured;
}
