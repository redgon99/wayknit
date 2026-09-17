import { getSupabase, isSupabaseConfigured } from './supabase';
import type {
  DistributionAccount,
  DistributionAccountInput,
  DistributionPlatform,
  DistributionPost,
  DistributionPostStatus,
} from '../types/distribution';

function requireSupabase() {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase가 설정되어야 배포관리 기능을 사용할 수 있습니다.');
  }
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase 클라이언트를 초기화할 수 없습니다.');
  return sb;
}

function mapAccountRow(row: Record<string, unknown>): DistributionAccount {
  return {
    id: row.id as string,
    platform: row.platform as DistributionPlatform,
    country: row.country as string,
    label: row.label as string,
    handle: (row.handle as string | null) ?? null,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at as string,
  };
}

function mapPostRow(row: Record<string, unknown>): DistributionPost {
  return {
    id: row.id as string,
    platform: row.platform as DistributionPlatform,
    country: row.country as string,
    locale: (row.locale as string) ?? 'ko',
    accountId: (row.account_id as string | null) ?? null,
    sourceGuideId: (row.source_guide_id as string | null) ?? null,
    title: (row.title as string | null) ?? null,
    body: (row.body as string) ?? '',
    mediaUrls: (row.media_urls as string[] | null) ?? [],
    status: row.status as DistributionPostStatus,
    scheduledAt: (row.scheduled_at as string | null) ?? null,
    postedAt: (row.posted_at as string | null) ?? null,
    externalPostId: (row.external_post_id as string | null) ?? null,
    externalUrl: (row.external_url as string | null) ?? null,
    errorMessage: (row.error_message as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function listDistributionAccounts(): Promise<DistributionAccount[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('distribution_accounts')
    .select('id, platform, country, label, handle, is_active, created_at')
    .order('platform', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => mapAccountRow(row as Record<string, unknown>));
}

export async function addDistributionAccount(input: DistributionAccountInput): Promise<void> {
  const sb = requireSupabase();
  const label = input.label.trim();
  if (!label) throw new Error('계정 이름을 입력해 주세요.');
  const { error } = await sb.from('distribution_accounts').insert({
    platform: input.platform,
    country: input.country.trim().toUpperCase(),
    label,
    handle: input.handle?.trim() || null,
    credentials: input.credentials ?? {},
  });
  if (error) throw error;
}

export async function setDistributionAccountActive(id: string, isActive: boolean): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb
    .from('distribution_accounts')
    .update({ is_active: isActive })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteDistributionAccount(id: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from('distribution_accounts').delete().eq('id', id);
  if (error) throw error;
}

export interface DistributionPostPage {
  rows: DistributionPost[];
  /** 필터 적용 후 실제 전체 건수 — S1(관리자 검토 2026-09-16): 100건 상한 뒤엔
   *  더 볼 방법이 없었다. 화면에서 "총 N건 중 M건 표시"를 보여줄 수 있게 준다. */
  totalCount: number;
}

export async function listDistributionPosts(filter: {
  platform?: DistributionPlatform;
  status?: DistributionPostStatus;
  country?: string;
  limit?: number;
} = {}): Promise<DistributionPostPage> {
  const sb = requireSupabase();
  let query = sb
    .from('distribution_posts')
    .select(
      'id, platform, country, locale, account_id, source_guide_id, title, body, media_urls, status, scheduled_at, posted_at, external_post_id, external_url, error_message, created_at, updated_at',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .limit(filter.limit ?? 100);
  if (filter.platform) query = query.eq('platform', filter.platform);
  if (filter.status) query = query.eq('status', filter.status);
  if (filter.country) query = query.eq('country', filter.country);
  const { data, error, count } = await query;
  if (error) throw error;
  return {
    rows: (data ?? []).map((row) => mapPostRow(row as Record<string, unknown>)),
    totalCount: count ?? (data ?? []).length,
  };
}

export async function updateDistributionPost(
  id: string,
  patch: Partial<{
    title: string | null;
    body: string;
    mediaUrls: string[];
    accountId: string | null;
    status: DistributionPostStatus;
    scheduledAt: string | null;
  }>
): Promise<void> {
  const sb = requireSupabase();
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.body !== undefined) row.body = patch.body;
  if (patch.mediaUrls !== undefined) row.media_urls = patch.mediaUrls;
  if (patch.accountId !== undefined) row.account_id = patch.accountId;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.scheduledAt !== undefined) row.scheduled_at = patch.scheduledAt;
  const { error } = await sb.from('distribution_posts').update(row).eq('id', id);
  if (error) throw error;
}

/** D2 — "게시" 클릭 한 번이 승인+게시를 같이 하던 것을 분리한 첫 단계 */
export async function approveDistributionPost(id: string): Promise<void> {
  await updateDistributionPost(id, { status: 'approved' });
}

/**
 * D2 — 예약. 실제로 그 시각에 자동 게시하는 크론은 아직 없다(별도 작업).
 * 지금은 "이 시각에 게시할 예정"이라는 기록 + status='scheduled' 필터링
 * 용도다 — 예약 시각이 지나도 관리자가 직접 "게시"를 눌러야 나간다.
 */
export async function scheduleDistributionPost(id: string, scheduledAtIso: string): Promise<void> {
  await updateDistributionPost(id, { status: 'scheduled', scheduledAt: scheduledAtIso });
}

export async function unscheduleDistributionPost(id: string): Promise<void> {
  await updateDistributionPost(id, { status: 'approved', scheduledAt: null });
}

/**
 * D2 — 중복 게시 방지(생성 전). 고른 가이드가 이미 그 플랫폼×국가 조합으로
 * 진행 중(실패 제외)인지 미리 안다. 어떤 가이드가 실제로 쓰일지는 AI가
 * 골라 정확히 맞힐 수 없지만, "이미 있다"는 신호만으로 충분하다.
 */
export async function listActiveCombos(
  guideIds: string[],
  platforms: DistributionPlatform[],
  countries: string[]
): Promise<Set<string>> {
  if (guideIds.length === 0 || platforms.length === 0 || countries.length === 0) return new Set();
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('distribution_posts')
    .select('source_guide_id, platform, country')
    .in('source_guide_id', guideIds)
    .in('platform', platforms)
    .in('country', countries)
    .neq('status', 'failed');
  if (error) throw error;
  return new Set(
    (data ?? []).map((r) => `${r.source_guide_id as string}|${r.platform as string}|${r.country as string}`)
  );
}

/**
 * D2 — 중복 게시 방지(게시 직전 마지막 확인). 같은 가이드×플랫폼×국가로
 * 이미 게시된(posted) 다른 행이 있으면 진짜 중복이다 — 하드 차단.
 */
export async function hasPostedDuplicate(post: DistributionPost): Promise<boolean> {
  if (!post.sourceGuideId) return false;
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('distribution_posts')
    .select('id')
    .eq('source_guide_id', post.sourceGuideId)
    .eq('platform', post.platform)
    .eq('country', post.country)
    .eq('status', 'posted')
    .neq('id', post.id)
    .limit(1);
  if (error) throw error;
  return (data ?? []).length > 0;
}

export async function deleteDistributionPost(id: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from('distribution_posts').delete().eq('id', id);
  if (error) throw error;
}

export async function triggerDistributionDraft(options: {
  guideIds?: string[];
  platforms: DistributionPlatform[];
  countries: string[];
}): Promise<{ created: number; ids: string[] }> {
  const sb = requireSupabase();
  const { data, error } = await sb.functions.invoke<{
    created?: number;
    ids?: string[];
    error?: string;
  }>('distribution-draft', { body: options });
  if (error) throw error;
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    throw new Error(String(data.error));
  }
  return { created: (data?.created as number) ?? 0, ids: (data?.ids as string[]) ?? [] };
}

export async function triggerDistributionPublish(
  postId: string
): Promise<{ externalUrl?: string }> {
  const sb = requireSupabase();
  const { data, error } = await sb.functions.invoke<{
    externalUrl?: string;
    error?: string;
  }>('distribution-publish', { body: { postId } });
  if (error) throw error;
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    throw new Error(String(data.error));
  }
  return { externalUrl: data?.externalUrl };
}

export function isDistributionConfigured(): boolean {
  return isSupabaseConfigured;
}
