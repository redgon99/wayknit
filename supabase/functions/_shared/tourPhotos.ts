/** PhotoGalleryService1 — 한국관광공사 관광사진갤러리 (핀업 불가, 열람 전용 정보 콘텐츠) */

function keyParam(serviceKey: string): string {
  return serviceKey.includes('%')
    ? `serviceKey=${serviceKey}`
    : `serviceKey=${encodeURIComponent(serviceKey)}`;
}

const BASE = 'https://apis.data.go.kr/B551011/PhotoGalleryService1';

export function buildPhotoGalleryUrl(
  serviceKey: string,
  options: { keyword?: string; pageNo?: number; numOfRows?: number }
): string {
  const params = new URLSearchParams({
    MobileOS: 'ETC',
    MobileApp: 'Wayknit',
    _type: 'json',
    arrange: 'C',
    numOfRows: String(options.numOfRows ?? 24),
    pageNo: String(options.pageNo ?? 1),
  });
  const keyword = options.keyword?.trim();
  if (keyword) {
    params.set('keyword', keyword);
    return `${BASE}/gallerySearchList1?${keyParam(serviceKey)}&${params.toString()}`;
  }
  return `${BASE}/galleryList1?${keyParam(serviceKey)}&${params.toString()}`;
}

interface RawPhotoItem {
  galContentId: string;
  galContentTypeId?: string;
  galTitle: string;
  galWebImageUrl: string;
  galPhotographyMonth?: string;
  galPhotographyLocation?: string;
  galPhotographer?: string;
  galSearchKeyword?: string;
}

export interface TourPhoto {
  contentId: string;
  title: string;
  imageUrl: string;
  month?: string;
  location?: string;
  photographer?: string;
  keywords: string[];
}

export async function fetchTourPhotos(
  url: string
): Promise<{ items: TourPhoto[]; totalCount: number }> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) return { items: [], totalCount: 0 };
  const json = (await res.json()) as {
    response?: {
      body?: { items?: { item?: RawPhotoItem | RawPhotoItem[] }; totalCount?: number };
    };
  };
  const raw = json.response?.body?.items?.item;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return {
    totalCount: json.response?.body?.totalCount ?? list.length,
    items: list
      .filter((it) => it.galWebImageUrl)
      .map((it) => ({
        contentId: it.galContentId,
        title: it.galTitle.replace(/<[^>]+>/g, ''),
        imageUrl: it.galWebImageUrl,
        month: it.galPhotographyMonth,
        location: it.galPhotographyLocation,
        photographer: it.galPhotographer,
        keywords: (it.galSearchKeyword ?? '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      })),
  };
}
