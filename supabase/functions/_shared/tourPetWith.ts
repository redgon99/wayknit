/**
 * KorPetTourService2(반려동물 동반여행)/KorWithService2(무장애여행) 목록 브라우징.
 * KorService2와 같은 contentId 공간·필드 구조를 쓰는 "필터형" 큐레이션 목록이라
 * (참고: _shared/tourTags.ts는 같은 두 서비스를 스팟 배지 용도로 detailCommon2 단건
 * 조회하는 반대 방향 — 여기서는 목록/검색 브라우징용) 정규화 로직이 동일하다.
 */

export type PlaceListKind = 'pet' | 'with';

const BASE_BY_KIND: Record<PlaceListKind, string> = {
  pet: 'KorPetTourService2',
  with: 'KorWithService2',
};

function keyParam(serviceKey: string): string {
  return serviceKey.includes('%')
    ? `serviceKey=${serviceKey}`
    : `serviceKey=${encodeURIComponent(serviceKey)}`;
}

export function buildPlaceListUrl(
  kind: PlaceListKind,
  serviceKey: string,
  options: { keyword?: string; contentTypeId?: string; pageNo?: number; numOfRows?: number }
): string {
  const base = `https://apis.data.go.kr/B551011/${BASE_BY_KIND[kind]}`;
  const params = new URLSearchParams({
    MobileOS: 'ETC',
    MobileApp: 'Wayknit',
    _type: 'json',
    arrange: 'C',
    numOfRows: String(options.numOfRows ?? 30),
    pageNo: String(options.pageNo ?? 1),
  });
  const contentTypeId = options.contentTypeId?.trim();
  if (contentTypeId) params.set('contentTypeId', contentTypeId);
  const keyword = options.keyword?.trim();
  if (keyword) {
    params.set('keyword', keyword);
    return `${base}/searchKeyword2?${keyParam(serviceKey)}&${params.toString()}`;
  }
  return `${base}/areaBasedList2?${keyParam(serviceKey)}&${params.toString()}`;
}

interface RawItem {
  contentid: string;
  contenttypeid?: string;
  title: string;
  addr1?: string;
  mapx: string;
  mapy: string;
  firstimage?: string;
}

export interface TourFilteredPlace {
  contentId: string;
  contentTypeId: string;
  title: string;
  address: string;
  lat: number;
  lng: number;
  thumbnailUrl?: string;
}

export async function fetchFilteredPlaces(
  url: string
): Promise<{ items: TourFilteredPlace[]; totalCount: number }> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) return { items: [], totalCount: 0 };
  const json = (await res.json()) as {
    response?: { body?: { items?: { item?: RawItem | RawItem[] }; totalCount?: number } };
  };
  const raw = json.response?.body?.items?.item;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return {
    totalCount: json.response?.body?.totalCount ?? list.length,
    items: list
      .map((it) => {
        const lat = parseFloat(it.mapy);
        const lng = parseFloat(it.mapx);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return {
          contentId: it.contentid,
          contentTypeId: it.contenttypeid?.trim() || '0',
          title: it.title.replace(/<[^>]+>/g, ''),
          address: it.addr1 ?? '',
          lat,
          lng,
          thumbnailUrl: it.firstimage?.trim() || undefined,
        };
      })
      .filter((p): p is TourFilteredPlace => p !== null),
  };
}
