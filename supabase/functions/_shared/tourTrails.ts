/** Durunubi(두루누비) — 걷기·자전거 코스 정보 (핀업 불가, 열람 전용 정보 콘텐츠) */

function keyParam(serviceKey: string): string {
  return serviceKey.includes('%')
    ? `serviceKey=${serviceKey}`
    : `serviceKey=${encodeURIComponent(serviceKey)}`;
}

const BASE = 'https://apis.data.go.kr/B551011/Durunubi';

export type TrailKind = 'DNWW' | 'DNBW'; // DNWW=걷기길, DNBW=자전거길

export function buildTrailCourseUrl(
  serviceKey: string,
  options: { keyword?: string; brdDiv?: TrailKind; level?: '1' | '2' | '3'; pageNo?: number; numOfRows?: number }
): string {
  const params = new URLSearchParams({
    MobileOS: 'ETC',
    MobileApp: 'Wayknit',
    _type: 'json',
    numOfRows: String(options.numOfRows ?? 30),
    pageNo: String(options.pageNo ?? 1),
  });
  const keyword = options.keyword?.trim();
  if (keyword) params.set('crsKorNm', keyword);
  if (options.brdDiv) params.set('brdDiv', options.brdDiv);
  if (options.level) params.set('crsLevel', options.level);
  return `${BASE}/courseList?${keyParam(serviceKey)}&${params.toString()}`;
}

interface RawCourseItem {
  routeIdx: string;
  crsIdx: string;
  crsKorNm: string;
  crsDstnc: string;
  crsTotlRqrmHour: string;
  crsLevel: string;
  crsCycle?: string;
  crsSummary?: string;
  crsTourInfo?: string;
  travelerinfo?: string;
  sigun?: string;
  brdDiv: TrailKind;
  gpxpath?: string;
}

export interface TourTrailCourse {
  courseId: string;
  routeId: string;
  name: string;
  distanceKm: number;
  totalMinutes: number;
  level: '1' | '2' | '3';
  cycle?: string;
  summary?: string;
  tourInfo?: string;
  travelerInfo?: string;
  region?: string;
  kind: TrailKind;
  gpxUrl?: string;
}

export async function fetchTourTrails(
  url: string
): Promise<{ items: TourTrailCourse[]; totalCount: number }> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) return { items: [], totalCount: 0 };
  const json = (await res.json()) as {
    response?: {
      body?: { items?: { item?: RawCourseItem | RawCourseItem[] }; totalCount?: number };
    };
  };
  const raw = json.response?.body?.items?.item;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const stripTags = (s: string | undefined) => (s ?? '').replace(/<[^>]+>/g, ' ').trim();
  return {
    totalCount: json.response?.body?.totalCount ?? list.length,
    items: list
      .filter((it) => it.crsIdx && it.crsKorNm)
      .map((it) => ({
        courseId: it.crsIdx,
        routeId: it.routeIdx,
        name: it.crsKorNm,
        distanceKm: Number(it.crsDstnc) || 0,
        totalMinutes: Number(it.crsTotlRqrmHour) || 0,
        level: (['1', '2', '3'] as const).includes(it.crsLevel as '1' | '2' | '3')
          ? (it.crsLevel as '1' | '2' | '3')
          : '2',
        cycle: it.crsCycle,
        summary: stripTags(it.crsSummary),
        tourInfo: stripTags(it.crsTourInfo),
        travelerInfo: stripTags(it.travelerinfo),
        region: it.sigun,
        kind: it.brdDiv,
        gpxUrl: it.gpxpath,
      })),
  };
}
