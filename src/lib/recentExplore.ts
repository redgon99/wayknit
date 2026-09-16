/**
 * 탐색 이어보기 — N07(모바일 UX 리포트 2026-09-13).
 *
 * 검색창이 비어 있을 때 "아까 뭘 찾았더라 / 어떤 곳을 봤더라"를 되살려 준다.
 * 추천 엔진이 아니라 **사용자가 직접 남긴 흔적**만 기억한다:
 *   - 최근 검색어: 결과가 나온 키워드 검색만(빈 결과·카테고리 브라우징은 제외)
 *   - 최근 본 장소: 상세(사진)를 열어 본 장소. 담은 곳은 핀 목록에 있으니 뺀다.
 *
 * 여행별이 아니라 기기별로 둔다 — "저번 여행에서 봤던 그 카페"를 이번 여행에
 * 담는 것도 이어보기의 일부다. 로그인 여부와 무관.
 */
import type { Place } from '../types';

const KEYWORDS_KEY = 'wayknit:recent-keywords-v1';
const PLACES_KEY = 'wayknit:recent-places-v1';
const MAX_KEYWORDS = 8;
const MAX_PLACES = 8;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as T;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 저장소 꽉 참·프라이빗 모드 — 이어보기는 부수 기능이라 조용히 넘긴다 */
  }
}

// ---------- 최근 검색어 ----------

export function readRecentKeywords(): string[] {
  const list = readJson<unknown>(KEYWORDS_KEY, []);
  return Array.isArray(list) ? list.filter((k): k is string => typeof k === 'string') : [];
}

/** 맨 앞에 넣고 중복은 하나로. 같은 말을 다시 검색하면 위로 올라온다. */
export function pushRecentKeyword(keyword: string): string[] {
  const k = keyword.trim();
  if (!k) return readRecentKeywords();
  const next = [k, ...readRecentKeywords().filter((x) => x !== k)].slice(0, MAX_KEYWORDS);
  writeJson(KEYWORDS_KEY, next);
  return next;
}

export function removeRecentKeyword(keyword: string): string[] {
  const next = readRecentKeywords().filter((x) => x !== keyword);
  writeJson(KEYWORDS_KEY, next);
  return next;
}

export function clearRecentKeywords(): string[] {
  writeJson(KEYWORDS_KEY, []);
  return [];
}

// ---------- 최근 본 장소 ----------

/**
 * 장소 전체를 그대로 저장한다 — 목록에서 바로 "담기"를 누르려면 Place가 통째로
 * 필요하다(좌표·카테고리·주소·썸네일). 8개 × 수 KB라 부담 없다.
 */
export function readRecentPlaces(): Place[] {
  const list = readJson<unknown>(PLACES_KEY, []);
  if (!Array.isArray(list)) return [];
  return list.filter(
    (p): p is Place =>
      !!p && typeof p === 'object' && typeof (p as Place).id === 'string' && typeof (p as Place).name === 'string'
  );
}

export function pushRecentPlace(place: Place): Place[] {
  // distance는 검색 당시 지도 중심 기준이라 다음에 열면 틀린 값이 된다 — 빼고 저장.
  const { distance: _drop, ...rest } = place as Place & { distance?: number };
  const next = [rest as Place, ...readRecentPlaces().filter((p) => p.id !== place.id)].slice(
    0,
    MAX_PLACES
  );
  writeJson(PLACES_KEY, next);
  return next;
}

export function removeRecentPlace(placeId: string): Place[] {
  const next = readRecentPlaces().filter((p) => p.id !== placeId);
  writeJson(PLACES_KEY, next);
  return next;
}
