import { getSupabase, isSupabaseConfigured } from './supabase';
import {
  normalizeYoutubePlaces,
  type YoutubePlaceCandidate,
} from './youtubePlaceCategory';
import type { DetectedLink, LinkPlatform } from './linkPlatform';

export type { YoutubePlaceCandidate as LinkPlaceCandidate } from './youtubePlaceCategory';

/**
 * 링크 추출 결과 화면 상태 — 원래 `SearchPanel`의 로컬 `useState` 10개였다.
 * 모바일 하단시트가 탭을 바꾸면(`동선`·`핀` 등) `SearchPanel`이 통째로
 * unmount돼 로컬 state가 날아가고, 다시 검색 탭으로 돌아오면 추출 결과가
 * 사라져 있었다(사용자 신고, 2026-09-20). `query`/`searchScope`처럼 이미
 * 상위(`PlannerPage`)로 끌어올려 둔 다른 검색 상태와 같은 패턴으로 맞춘다
 * — PlannerPage는 탭을 바꿔도 계속 떠 있으니 여기 두면 살아남는다.
 */
export interface LinkExtractUiState {
  extracting: boolean;
  places: YoutubePlaceCandidate[];
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  error: string | null;
  snsMessage: string | null;
  previewKey: string | null;
  previewPlatform: DetectedLink['platform'] | null;
  previewHref: string | null;
  pasteHint: string | null;
}

export const EMPTY_LINK_EXTRACT_STATE: LinkExtractUiState = {
  extracting: false,
  places: [],
  title: null,
  description: null,
  imageUrl: null,
  error: null,
  snsMessage: null,
  previewKey: null,
  previewPlatform: null,
  previewHref: null,
  pasteHint: null,
};

export interface LinkPlacesExtractResult {
  platform: LinkPlatform;
  sourceKey: string;
  sourceUrl: string;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  places: YoutubePlaceCandidate[];
  sourcesUsed: string[];
  extractable: boolean;
  message?: string | null;
}

export function isLinkPlacesExtractConfigured(): boolean {
  return isSupabaseConfigured;
}

export async function extractPlacesFromLink(
  url: string
): Promise<LinkPlacesExtractResult> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase가 설정되어야 링크 장소 추출을 사용할 수 있습니다.');
  }
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase 클라이언트를 초기화할 수 없습니다.');

  const { data, error } = await sb.functions.invoke<
    LinkPlacesExtractResult | { error?: string }
  >('link-places-extract', { body: { url: url.trim() } });

  if (error) {
    throw new Error(error.message || '장소 추출에 실패했습니다.');
  }
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    throw new Error(String(data.error));
  }
  if (!data || !('places' in data) || !Array.isArray((data as LinkPlacesExtractResult).places)) {
    throw new Error('장소 추출 응답이 올바르지 않습니다.');
  }

  const result = data as LinkPlacesExtractResult;
  return {
    platform: result.platform,
    sourceKey: String(result.sourceKey ?? ''),
    sourceUrl: String(result.sourceUrl ?? url.trim()),
    title: result.title ?? null,
    description: result.description ?? null,
    imageUrl: result.imageUrl ?? null,
    places: normalizeYoutubePlaces(result.places as unknown[]),
    sourcesUsed: Array.isArray(result.sourcesUsed)
      ? result.sourcesUsed.map(String)
      : [],
    extractable: Boolean(result.extractable),
    message: result.message ?? null,
  };
}
