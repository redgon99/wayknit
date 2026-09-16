/**
 * 관리자 콘텐츠 초안/버전 — 묶음 2(L1·A2 나머지·C4·L4).
 *
 * `data`/`snapshot`는 이 모듈에겐 불투명한 JSON이다 — 어떤 컬럼 모양인지는
 * 호출자(랜딩은 landingPromo.ts의 buildLandingPromoRow, 가이드는 guides.ts의
 * buildGuideRow)가 이미 DB 컬럼 이름(snake_case)으로 맞춰서 넘긴다. 게시
 * RPC(admin_publish_draft)가 이 모양 그대로 라이브 테이블에 반영하기 때문에,
 * 여기서 모양을 바꾸면 안 된다.
 */
import { getSupabase, isSupabaseConfigured } from './supabase';

export type DraftTable = 'landing_promo' | 'guide_articles';

export interface ContentVersion {
  id: number;
  version: number;
  publishedBy: string | null;
  publishedAt: string;
  note: string | null;
  snapshot: Record<string, unknown>;
}

function requireSupabase() {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase가 설정되어야 초안 기능을 사용할 수 있습니다.');
  }
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase 클라이언트를 초기화할 수 없습니다.');
  return sb;
}

export async function loadDraft(
  table: DraftTable,
  key: string
): Promise<Record<string, unknown> | null> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('admin_content_drafts')
    .select('data')
    .eq('table_name', table)
    .eq('row_key', key)
    .maybeSingle();
  if (error) throw error;
  return (data?.data as Record<string, unknown> | undefined) ?? null;
}

export async function saveDraft(
  table: DraftTable,
  key: string,
  data: Record<string, unknown>
): Promise<void> {
  const sb = requireSupabase();
  const { data: userData, error: userError } = await sb.auth.getUser();
  if (userError) throw userError;
  const updatedBy = userData.user?.id;
  if (!updatedBy) throw new Error('로그인이 필요합니다.');

  const { error } = await sb
    .from('admin_content_drafts')
    .upsert(
      { table_name: table, row_key: key, data, updated_by: updatedBy, updated_at: new Date().toISOString() },
      { onConflict: 'table_name,row_key' }
    );
  if (error) throw error;
}

/** 이 테이블에 초안이 있는 행의 키 목록 — 가이드 목록에 "수정 초안 있음" 배지를 달 때 씀 */
export async function listDraftKeys(table: DraftTable): Promise<string[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('admin_content_drafts')
    .select('row_key')
    .eq('table_name', table);
  if (error) throw error;
  return (data ?? []).map((row) => row.row_key as string);
}

export async function discardDraft(table: DraftTable, key: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb
    .from('admin_content_drafts')
    .delete()
    .eq('table_name', table)
    .eq('row_key', key);
  if (error) throw error;
}

/** 초안을 라이브에 반영한다. 반영 직전 라이브 행이 새 버전으로 자동 저장된다. */
export async function publishDraft(table: DraftTable, key: string): Promise<number> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc('admin_publish_draft', { p_table: table, p_key: key });
  if (error) throw error;
  return data as number;
}

export async function listVersions(table: DraftTable, key: string): Promise<ContentVersion[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('admin_content_versions')
    .select('id, version, published_by, published_at, note, snapshot')
    .eq('table_name', table)
    .eq('row_key', key)
    .order('version', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id as number,
    version: row.version as number,
    publishedBy: (row.published_by as string | null) ?? null,
    publishedAt: row.published_at as string,
    note: (row.note as string | null) ?? null,
    snapshot: row.snapshot as Record<string, unknown>,
  }));
}

/** 스냅샷을 초안으로만 복사한다 — 라이브는 그대로다. "게시"를 눌러야 실제 반영된다. */
export async function restoreVersion(versionId: number): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc('admin_restore_version', { p_version_id: versionId });
  if (error) throw error;
}
