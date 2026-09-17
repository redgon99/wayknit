import { getSupabase, isSupabaseConfigured } from './supabase';
import { normalizeGuideKind } from './guideKinds';
import type { GuideArticle, GuideArticleInput, GuideKind, GuideStatus } from '../types/guides';

function requireSupabase() {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase가 설정되어야 가이드 기능을 사용할 수 있습니다.');
  }
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase 클라이언트를 초기화할 수 없습니다.');
  return sb;
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

export function isGuidesConfigured(): boolean {
  return isSupabaseConfigured;
}
