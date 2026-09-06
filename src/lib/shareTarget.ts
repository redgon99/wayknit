import type { LinkPlacesExtractResult } from './linkPlaces';

/**
 * PWA 공유 대상(share_target) 수신 처리.
 *
 * 안드로이드 공유 시트에서 인스타·유튜브 링크를 여로담으로 보내면 /share 로 들어온다.
 * /share 가 장소를 추출하고, 그 결과를 플래너 검색 패널이 그대로 이어받는다.
 */

const HANDOFF_KEY = 'wayknit:share-handoff-v1';

export interface SharedPayload {
  title: string | null;
  text: string | null;
  url: string | null;
}

/** 공유 시트가 링크를 url 대신 text에 넣어 보내는 경우가 많다 */
export function readSharedPayload(params: URLSearchParams): SharedPayload {
  return {
    title: params.get('title')?.trim() || null,
    text: params.get('text')?.trim() || null,
    url: params.get('url')?.trim() || null,
  };
}

export function firstUrlInPayload(payload: SharedPayload): string | null {
  const candidates = [payload.url, payload.text, payload.title].filter(
    (v): v is string => Boolean(v),
  );
  for (const candidate of candidates) {
    const match = candidate.match(/https?:\/\/[^\s]+/i);
    if (match) return match[0].replace(/[.,;:!?]+$/, '');
  }
  return null;
}

export function saveShareHandoff(result: LinkPlacesExtractResult): void {
  try {
    sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(result));
  } catch {
    /* 세션 저장소가 막혀 있으면 인계를 포기한다 (플래너는 그냥 빈 화면으로 열림) */
  }
}

/** 한 번만 읽히도록 즉시 비운다 — 새로고침 때 옛 결과가 다시 뜨지 않게 */
export function consumeShareHandoff(): LinkPlacesExtractResult | null {
  try {
    const raw = sessionStorage.getItem(HANDOFF_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(HANDOFF_KEY);
    const parsed = JSON.parse(raw) as LinkPlacesExtractResult;
    return Array.isArray(parsed?.places) ? parsed : null;
  } catch {
    return null;
  }
}
