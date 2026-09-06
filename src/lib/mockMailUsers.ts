import { getSupabase, isSupabaseConfigured } from './supabase';

/** 시험용으로 넣은 user1@mail.com ~ user30@mail.com 만 해당합니다. */
export const MOCK_MAIL_RE = /^user([1-9]|[12][0-9]|30)@mail\.com$/i;

export function isMockMailUser(email: string): boolean {
  return MOCK_MAIL_RE.test(email.trim());
}

function requireSupabase() {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase가 설정되어야 합니다.');
  }
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase 클라이언트를 초기화할 수 없습니다.');
  return sb;
}

/**
 * 매직 링크 없이 목업 계정 세션을 만듭니다.
 * 서버가 user1~30@mail.com + mock 메타데이터인 경우에만 토큰을 줍니다.
 */
export async function signInMockMailUser(email: string): Promise<void> {
  const trimmed = email.trim().toLowerCase();
  if (!isMockMailUser(trimmed)) {
    throw new Error('목업 계정이 아닙니다.');
  }
  const sb = requireSupabase();
  const { data, error } = await sb.functions.invoke('mock-email-login', {
    body: { email: trimmed },
  });
  const payload = (data ?? {}) as { token_hash?: string; error?: string };
  if (error) {
    throw new Error(payload.error || error.message || '목업 로그인에 실패했습니다.');
  }
  const tokenHash = payload.token_hash;
  if (!tokenHash) {
    throw new Error('목업 로그인 토큰을 받지 못했습니다.');
  }
  const { error: verifyError } = await sb.auth.verifyOtp({
    type: 'email',
    token_hash: tokenHash,
  });
  if (verifyError) throw verifyError;
}

export async function deleteWayknitMockMailUsers(): Promise<{
  deletedUsers: number;
  deletedTrips: number;
}> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc('delete_wayknit_mock_mail_users');
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  const rec = (row ?? {}) as Record<string, unknown>;
  return {
    deletedUsers: Number(rec.deleted_users ?? rec.deletedUsers ?? 0),
    deletedTrips: Number(rec.deleted_trips ?? rec.deletedTrips ?? 0),
  };
}
