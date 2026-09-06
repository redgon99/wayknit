import { getSupabase, isSupabaseConfigured } from './supabase';

const ADMIN_EMAILS_FROM_ENV = String(import.meta.env.VITE_ADMIN_EMAILS ?? '')
  .split(',')
  .map((v) => v.trim().toLowerCase())
  .filter(Boolean);

export interface AdminUserRow {
  userId: string;
  /** auth.users에서 조회 — 탈퇴 등으로 계정이 없으면 null */
  email: string | null;
  tripCount: number;
  firstTripAt: string | null;
  lastUpdatedAt: string | null;
  isVerified: boolean;
  memo: string | null;
  verifiedAt: string | null;
}

/** 목록 조회 결과 — 페이지네이션을 위해 필터 적용 후 전체 건수를 함께 준다 */
export interface AdminPage<T> {
  rows: T[];
  totalCount: number;
}

export interface AdminListQuery {
  search?: string;
  limit?: number;
  offset?: number;
}

export const ADMIN_PAGE_SIZE = 25;

export interface AdminPlazaListing {
  id: string;
  title: string;
  ownerId: string | null;
  ownerEmail: string | null;
  listedAt: string | null;
  materialsCount: number;
}

export interface AdminShareStats {
  totalTrips: number;
  publicTrips: number;
  listedTrips: number;
  totalMaterials: number;
  totalImports: number;
}

export interface AdminNotice {
  id: string;
  title: string;
  body: string;
  isPublished: boolean;
  pinned: boolean;
  updatedAt: string;
}

export interface AdminUserAccount {
  id: string;
  email: string;
  createdAt: string;
}

export function getEnvAdminEmails(): string[] {
  return [...ADMIN_EMAILS_FROM_ENV];
}

function requireSupabase() {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase가 설정되어야 관리자 기능을 사용할 수 있습니다.');
  }
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase 클라이언트를 초기화할 수 없습니다.');
  return sb;
}

export async function isCurrentUserAdmin(): Promise<boolean> {
  const sb = requireSupabase();
  const { data: userData } = await sb.auth.getUser();
  const email = userData.user?.email?.trim().toLowerCase();
  if (!email) return false;
  if (ADMIN_EMAILS_FROM_ENV.includes(email)) return true;
  const { data, error } = await sb
    .from('admin_users')
    .select('email')
    .eq('email', email)
    .maybeSingle();
  if (error) return false;
  return Boolean(data?.email);
}

/**
 * 사용자 목록. 집계·검색·페이지네이션을 전부 DB(admin_user_rows RPC)에서 한다.
 * 예전에는 wayknit_trips 전량을 받아 JS에서 owner_id별로 묶었는데, 여행이
 * 늘수록 매 조회마다 전체를 내려받아야 했다.
 */
export async function listAdminUserRows(
  query: AdminListQuery = {}
): Promise<AdminPage<AdminUserRow>> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc('admin_user_rows', {
    p_search: query.search?.trim() || null,
    p_limit: query.limit ?? ADMIN_PAGE_SIZE,
    p_offset: query.offset ?? 0,
  });
  if (error) throw error;

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  return {
    rows: rows.map((row) => ({
      userId: row.user_id as string,
      email: (row.email as string | null) ?? null,
      tripCount: Number(row.trip_count ?? 0),
      firstTripAt: (row.first_trip_at as string | null) ?? null,
      lastUpdatedAt: (row.last_updated_at as string | null) ?? null,
      isVerified: Boolean(row.is_verified),
      memo: (row.memo as string | null) ?? null,
      verifiedAt: (row.verified_at as string | null) ?? null,
    })),
    totalCount: Number(rows[0]?.total_count ?? 0),
  };
}

export async function upsertUserVerification(input: {
  userId: string;
  isVerified: boolean;
  memo?: string;
}): Promise<void> {
  const sb = requireSupabase();
  const { data: userData, error: userError } = await sb.auth.getUser();
  if (userError) throw userError;
  const adminId = userData.user?.id;
  if (!adminId) throw new Error('로그인이 필요합니다.');

  const { error } = await sb.from('admin_user_verifications').upsert(
    {
      user_id: input.userId,
      is_verified: input.isVerified,
      memo: input.memo?.trim() || null,
      verified_at: input.isVerified ? new Date().toISOString() : null,
      updated_by: adminId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );
  if (error) throw error;
}

/**
 * 공유자료 현황. 예전에는 자료 개수를 세려고 payload(여행 1건이 최대 150KB)를
 * 전부 내려받았다 — 이제 DB에서 jsonb_array_length로 세어 숫자만 받는다.
 */
export async function fetchAdminShareStats(): Promise<AdminShareStats> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc('admin_share_stats');
  if (error) throw error;
  const row = ((data ?? []) as Array<Record<string, unknown>>)[0];
  return {
    totalTrips: Number(row?.total_trips ?? 0),
    publicTrips: Number(row?.public_trips ?? 0),
    listedTrips: Number(row?.listed_trips ?? 0),
    totalMaterials: Number(row?.total_materials ?? 0),
    totalImports: Number(row?.total_imports ?? 0),
  };
}

/** 공유마당 등록 목록. 예전에는 최근 12건만 고정 노출됐고 검색이 없었다. */
export async function listPlazaListings(
  query: AdminListQuery = {}
): Promise<AdminPage<AdminPlazaListing>> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc('admin_plaza_listings', {
    p_search: query.search?.trim() || null,
    p_limit: query.limit ?? ADMIN_PAGE_SIZE,
    p_offset: query.offset ?? 0,
  });
  if (error) throw error;

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  return {
    rows: rows.map((row) => ({
      id: row.id as string,
      title: (row.title as string) || '제목 없음',
      ownerId: (row.owner_id as string | null) ?? null,
      ownerEmail: (row.owner_email as string | null) ?? null,
      listedAt: (row.listed_at as string | null) ?? null,
      materialsCount: Number(row.materials_count ?? 0),
    })),
    totalCount: Number(rows[0]?.total_count ?? 0),
  };
}

export async function listAdminNotices(): Promise<AdminNotice[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('admin_notices')
    .select('id, title, body, is_published, pinned, updated_at')
    .order('pinned', { ascending: false })
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id as string,
    title: (row.title as string) || '',
    body: (row.body as string) || '',
    isPublished: Boolean(row.is_published),
    pinned: Boolean(row.pinned),
    updatedAt: (row.updated_at as string) || new Date(0).toISOString(),
  }));
}

export async function createAdminNotice(input: {
  title: string;
  body: string;
  isPublished: boolean;
  pinned: boolean;
}): Promise<void> {
  const sb = requireSupabase();
  const { data: userData, error: userError } = await sb.auth.getUser();
  if (userError) throw userError;
  const createdBy = userData.user?.id;
  if (!createdBy) throw new Error('로그인이 필요합니다.');

  const { error } = await sb.from('admin_notices').insert({
    title: input.title.trim(),
    body: input.body.trim(),
    is_published: input.isPublished,
    pinned: input.pinned,
    created_by: createdBy,
  });
  if (error) throw error;
}

export async function updateAdminNotice(
  id: string,
  patch: Partial<{
    title: string;
    body: string;
    isPublished: boolean;
    pinned: boolean;
  }>
): Promise<void> {
  const sb = requireSupabase();
  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (patch.title !== undefined) updatePayload.title = patch.title.trim();
  if (patch.body !== undefined) updatePayload.body = patch.body.trim();
  if (patch.isPublished !== undefined) updatePayload.is_published = patch.isPublished;
  if (patch.pinned !== undefined) updatePayload.pinned = patch.pinned;
  const { error } = await sb.from('admin_notices').update(updatePayload).eq('id', id);
  if (error) throw error;
}

export async function deleteAdminNotice(id: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from('admin_notices').delete().eq('id', id);
  if (error) throw error;
}

export async function listAdminUserAccounts(): Promise<AdminUserAccount[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('admin_users')
    .select('id, email, created_at')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id as string,
    email: row.email as string,
    createdAt: row.created_at as string,
  }));
}

export async function addAdminUserAccount(email: string): Promise<void> {
  const sb = requireSupabase();
  const normalized = email.trim().toLowerCase();
  if (!normalized) throw new Error('이메일을 입력해 주세요.');
  const { error } = await sb.from('admin_users').insert({ email: normalized });
  if (error) throw error;
}

export async function removeAdminUserAccount(id: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from('admin_users').delete().eq('id', id);
  if (error) throw error;
}
