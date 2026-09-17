/**
 * 관리자 전역 검색.
 *
 * ③에서 각 목록 화면에 검색을 붙였지만 그 화면 안에서만 찾을 수 있다.
 * "이 이메일이 누구지", "이 제목이 어느 화면에 있지"를 알려면 여전히 화면을
 * 하나씩 돌아야 해서, 한 번의 호출로 전 영역을 훑는 RPC를 붙였다.
 */
import { getSupabase, isSupabaseConfigured } from './supabase';

export type SearchKind = 'user' | 'trip' | 'guide' | 'scenario' | 'notice';

export interface SearchHit {
  kind: SearchKind;
  id: string;
  title: string;
  subtitle: string | null;
  status: string | null;
  /** 이동할 곳. 마땅한 화면이 없으면 null */
  url: string | null;
}

export const SEARCH_KIND_LABEL: Record<SearchKind, string> = {
  user: '사용자',
  trip: '여행',
  guide: '가이드',
  scenario: '시나리오',
  notice: '공지',
};

/** 결과를 묶어서 보여줄 순서 */
export const SEARCH_KIND_ORDER: SearchKind[] = ['user', 'trip', 'scenario', 'guide', 'notice'];

/** S2(관리자 검토 2026-09-16) — guide/scenario 모두 draft/published/archived만 쓴다
 *  (admin_global_search가 status를 넘기는 건 이 둘뿐). 원본 영문이 그대로 보이던 것을 한글로 */
export const SEARCH_STATUS_LABEL: Record<string, string> = {
  draft: '초안',
  published: '게시됨',
  archived: '보관됨',
};

export async function searchAdmin(query: string, perKind = 10): Promise<SearchHit[]> {
  if (!isSupabaseConfigured) throw new Error('Supabase가 설정되어야 검색할 수 있습니다.');
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase 클라이언트를 초기화할 수 없습니다.');
  if (!query.trim()) return [];

  const { data, error } = await sb.rpc('admin_global_search', {
    p_query: query.trim(),
    p_limit: perKind,
  });
  if (error) throw error;

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    kind: row.kind as SearchKind,
    id: row.id as string,
    title: (row.title as string) ?? '(제목 없음)',
    subtitle: (row.subtitle as string | null) ?? null,
    status: (row.status as string | null) ?? null,
    url: (row.url as string | null) ?? null,
  }));
}

export function groupByKind(hits: SearchHit[]): Array<{ kind: SearchKind; hits: SearchHit[] }> {
  return SEARCH_KIND_ORDER.map((kind) => ({
    kind,
    hits: hits.filter((h) => h.kind === kind),
  })).filter((g) => g.hits.length > 0);
}
