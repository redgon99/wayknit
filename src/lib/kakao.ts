import type { KakaoPlace, Place, CategoryCode } from '../types';
import type { SearchScope } from '../types';
import { getCategoryMeta } from './categories';
import { buildKakaoPhotosUrl } from './kakaoPlaceUrls';

declare global {
  interface Window {
    kakao: any;
  }
}

// =============================================
// Kakao SDK 로더 (싱글톤)
// =============================================

let sdkPromise: Promise<typeof window.kakao> | null = null;

export function loadKakaoSdk(appkey: string): Promise<typeof window.kakao> {
  if (typeof window === 'undefined') return Promise.reject(new Error('SSR'));
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise((resolve, reject) => {
    if (window.kakao && window.kakao.maps && window.kakao.maps.services) {
      resolve(window.kakao);
      return;
    }
    const script = document.createElement('script');
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appkey}&libraries=services,clusterer&autoload=false`;
    script.async = true;
    script.onload = () => window.kakao.maps.load(() => resolve(window.kakao));
    script.onerror = (e) => reject(e);
    document.head.appendChild(script);
  });

  return sdkPromise;
}

// =============================================
// KakaoPlace → Place 정규화
// =============================================

export function normalizePlace(kp: KakaoPlace): Place {
  const code = (kp.category_group_code || 'OTHER') as CategoryCode | 'OTHER';
  const meta = getCategoryMeta(code);

  return {
    id: kp.id,
    name: kp.place_name,
    category: meta.category,
    categoryCode: code,
    categoryLabel: meta.label,
    categoryDetail: kp.category_name || undefined,
    address: kp.address_name,
    roadAddress: kp.road_address_name,
    phone: kp.phone || undefined,
    lat: parseFloat(kp.y),
    lng: parseFloat(kp.x),
    distance: kp.distance ? parseInt(kp.distance, 10) : undefined,
    placeUrl: kp.place_url || undefined,
    photosUrl: buildKakaoPhotosUrl(kp.id, kp.place_url || undefined),
    openingStatus: 'unknown',
  };
}

/** 주소·장소명 → 좌표 (출발지 입력용) */
export function resolveAddressToCoords(query: string): Promise<{ lat: number; lng: number; label: string } | null> {
  return new Promise((resolve) => {
    if (!window.kakao?.maps?.services || !query.trim()) {
      resolve(null);
      return;
    }
    const ps = new window.kakao.maps.services.Places();
    ps.keywordSearch(
      query.trim(),
      (data: KakaoPlace[], status: string) => {
        if (status !== window.kakao.maps.services.Status.OK || !data[0]) {
          resolve(null);
          return;
        }
        const p = data[0];
        resolve({
          lat: parseFloat(p.y),
          lng: parseFloat(p.x),
          label: p.place_name || query.trim(),
        });
      },
      { size: 1, sort: window.kakao.maps.services.SortBy.ACCURACY }
    );
  });
}

// =============================================
// 장소 검색
// =============================================

export type KakaoSearchSort = 'accuracy' | 'distance';

export interface SearchOptions {
  keyword: string;
  categoryGroupCode?: CategoryCode;
  center?: { lat: number; lng: number };
  radiusMeters?: number;
  sort?: KakaoSearchSort;
  size?: number;
  page?: number;
}

export interface CategorySearchOptions {
  categoryGroupCode: CategoryCode;
  center: { lat: number; lng: number };
  radiusMeters?: number;
  size?: number;
  page?: number;
}

export interface PlacesSearchResult {
  places: Place[];
  page: number;
  hasMore: boolean;
}

export interface UnifiedSearchParams {
  keyword?: string;
  categoryGroupCode?: CategoryCode | null;
  scope: SearchScope;
  center?: { lat: number; lng: number };
  radiusMeters?: number;
  size?: number;
  page?: number;
}

function handlePlacesCallback(
  data: KakaoPlace[],
  status: string,
  pagination: { current: number; hasNextPage: boolean } | undefined,
  page: number,
  resolve: (r: PlacesSearchResult) => void,
  reject: (e: Error) => void
) {
  if (status === window.kakao.maps.services.Status.OK) {
    resolve({
      places: data.map((d) => normalizePlace(d)),
      page: pagination?.current ?? page,
      hasMore: pagination?.hasNextPage ?? false,
    });
  } else if (status === window.kakao.maps.services.Status.ZERO_RESULT) {
    resolve({ places: [], page, hasMore: false });
  } else {
    reject(new Error(`Kakao search failed: ${status}`));
  }
}

/** 키워드 장소 검색 (category_group_code 선택) */
export function searchPlaces(opts: SearchOptions): Promise<PlacesSearchResult> {
  return new Promise((resolve, reject) => {
    if (!window.kakao?.maps?.services) {
      reject(new Error('Kakao SDK not loaded'));
      return;
    }
    const ps = new window.kakao.maps.services.Places();
    const page = opts.page ?? 1;
    const searchOpts: Record<string, unknown> = {
      size: opts.size ?? 15,
      page,
    };
    if (opts.categoryGroupCode) {
      searchOpts.category_group_code = opts.categoryGroupCode;
    }
    if (opts.center) {
      searchOpts.location = new window.kakao.maps.LatLng(opts.center.lat, opts.center.lng);
      searchOpts.radius = opts.radiusMeters ?? 20_000;
      searchOpts.sort =
        opts.sort === 'accuracy'
          ? window.kakao.maps.services.SortBy.ACCURACY
          : window.kakao.maps.services.SortBy.DISTANCE;
    } else {
      searchOpts.sort =
        opts.sort === 'distance'
          ? window.kakao.maps.services.SortBy.DISTANCE
          : window.kakao.maps.services.SortBy.ACCURACY;
    }
    ps.keywordSearch(
      opts.keyword,
      (data: KakaoPlace[], status: string, pagination: { current: number; hasNextPage: boolean }) => {
        handlePlacesCallback(data, status, pagination, page, resolve, reject);
      },
      searchOpts
    );
  });
}

/** 카테고리 장소 검색 (지도 주변, 키워드 없이) */
export function searchPlacesByCategory(opts: CategorySearchOptions): Promise<PlacesSearchResult> {
  return new Promise((resolve, reject) => {
    if (!window.kakao?.maps?.services) {
      reject(new Error('Kakao SDK not loaded'));
      return;
    }
    const ps = new window.kakao.maps.services.Places();
    const page = opts.page ?? 1;
    const searchOpts: Record<string, unknown> = {
      location: new window.kakao.maps.LatLng(opts.center.lat, opts.center.lng),
      radius: opts.radiusMeters ?? 5000,
      size: opts.size ?? 15,
      page,
      sort: window.kakao.maps.services.SortBy.DISTANCE,
    };
    ps.categorySearch(
      opts.categoryGroupCode,
      (data: KakaoPlace[], status: string, pagination: { current: number; hasNextPage: boolean }) => {
        handlePlacesCallback(data, status, pagination, page, resolve, reject);
      },
      searchOpts
    );
  });
}

/** 키워드·카테고리·범위 통합 검색 */
/**
 * 키워드 검색은 항상 관련도(accuracy) 기준으로 가져온다 — 화면 표시 순서(거리순/평점순)는
 * 어차피 SearchPanel이 매 place의 distance 필드로 자체 재정렬하므로, API를 거리순으로
 * 받으면 "경복궁"과 이름만 약하게 겹치는 근처 상점이 진짜 관련 결과를 밀어내는
 * 부작용만 남는다(§27-10, F10).
 */
export async function searchPlacesUnified(params: UnifiedSearchParams): Promise<PlacesSearchResult> {
  const keyword = params.keyword?.trim() ?? '';
  const category = params.categoryGroupCode ?? undefined;
  const nearby = params.scope === 'nearby';

  if (!keyword && !category) {
    return { places: [], page: 1, hasMore: false };
  }

  /** 마트 칩 = 대형마트(MT1) + 편의점(CS2) */
  const shopBundle = category === 'MT1';

  if (!keyword && shopBundle && nearby && params.center) {
    const [marts, cvs] = await Promise.all([
      searchPlacesByCategory({
        categoryGroupCode: 'MT1',
        center: params.center,
        radiusMeters: params.radiusMeters,
        size: params.size,
        page: params.page,
      }),
      searchPlacesByCategory({
        categoryGroupCode: 'CS2',
        center: params.center,
        radiusMeters: params.radiusMeters,
        size: params.size,
        page: params.page,
      }),
    ]);
    return mergePlaceResults(marts, cvs, params.size);
  }

  if (!keyword && category && nearby && params.center) {
    return searchPlacesByCategory({
      categoryGroupCode: category,
      center: params.center,
      radiusMeters: params.radiusMeters,
      size: params.size,
      page: params.page,
    });
  }

  if (!keyword) {
    return { places: [], page: 1, hasMore: false };
  }

  if (shopBundle) {
    const [marts, cvs] = await Promise.all([
      searchPlaces({
        keyword,
        categoryGroupCode: 'MT1',
        center: nearby ? params.center : undefined,
        radiusMeters: nearby ? params.radiusMeters : undefined,
        sort: 'accuracy',
        size: params.size,
        page: params.page,
      }),
      searchPlaces({
        keyword,
        categoryGroupCode: 'CS2',
        center: nearby ? params.center : undefined,
        radiusMeters: nearby ? params.radiusMeters : undefined,
        sort: 'accuracy',
        size: params.size,
        page: params.page,
      }),
    ]);
    return mergePlaceResults(marts, cvs, params.size);
  }

  return searchPlaces({
    keyword,
    categoryGroupCode: category,
    center: nearby ? params.center : undefined,
    radiusMeters: nearby ? params.radiusMeters : undefined,
    sort: 'accuracy',
    size: params.size,
    page: params.page,
  });
}

function mergePlaceResults(
  a: PlacesSearchResult,
  b: PlacesSearchResult,
  size?: number
): PlacesSearchResult {
  const seen = new Set<string>();
  const places = [];
  for (const p of [...a.places, ...b.places]) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    places.push(p);
  }
  places.sort((x, y) => (x.distance ?? Number.POSITIVE_INFINITY) - (y.distance ?? Number.POSITIVE_INFINITY));
  const limit = size ?? 15;
  return {
    places: places.slice(0, limit),
    page: a.page,
    hasMore: a.hasMore || b.hasMore || places.length > limit,
  };
}

/** 지도 기본 POI 클릭 근사 — Web API는 POI 이벤트가 없어 클릭 좌표 주변 장소 검색 */
const BASE_MAP_POI_CODES: CategoryCode[] = [
  'FD6',
  'CE7',
  'AT4',
  'AD5',
  'CT1',
  'MT1',
  'CS2',
  'PK6',
];

export async function findNearestPlaceNear(
  lat: number,
  lng: number,
  opts?: { radiusMeters?: number; maxDistanceMeters?: number }
): Promise<Place | null> {
  const radius = opts?.radiusMeters ?? 80;
  const maxDist = opts?.maxDistanceMeters ?? 80;
  if (!window.kakao?.maps?.services) return null;

  const batches = await Promise.all(
    BASE_MAP_POI_CODES.map((code) =>
      searchPlacesByCategory({
        categoryGroupCode: code,
        center: { lat, lng },
        radiusMeters: radius,
        size: 5,
        page: 1,
      }).catch(() => ({ places: [] as Place[], page: 1, hasMore: false }))
    )
  );

  const seen = new Set<string>();
  const merged: Place[] = [];
  for (const batch of batches) {
    for (const p of batch.places) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      merged.push(p);
    }
  }
  if (!merged.length) return null;

  merged.sort(
    (a, b) =>
      (a.distance ?? Number.POSITIVE_INFINITY) -
      (b.distance ?? Number.POSITIVE_INFINITY)
  );
  const nearest = merged[0];
  if ((nearest.distance ?? Number.POSITIVE_INFINITY) > maxDist) return null;
  return nearest;
}

// =============================================
// 좌표 → 주소 변환 (출발지 지도 클릭용)
// =============================================

export function coordsToAddress(lat: number, lng: number): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!window.kakao?.maps?.services) {
      reject(new Error('Kakao SDK not loaded'));
      return;
    }
    const geocoder = new window.kakao.maps.services.Geocoder();
    geocoder.coord2Address(lng, lat, (result: any[], status: string) => {
      if (status === window.kakao.maps.services.Status.OK && result[0]) {
        const r = result[0];
        resolve(r.road_address?.address_name || r.address?.address_name || '');
      } else {
        reject(new Error(`Reverse geocode failed: ${status}`));
      }
    });
  });
}
