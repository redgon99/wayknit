/**
 * Odii(관광지 오디오 가이드) — 장소별 tid/tlid가 KorService2 contentId와 무관한 자체 ID
 * 공간이라 GoCamping과 동일하게 핀업 불가, /info 열람 전용 콘텐츠로 다룬다.
 * themeSearchList/themeBasedList로 오디오 가이드가 있는 장소를 찾고, storyBasedList로
 * 해당 장소(tid/tlid)에 딸린 이야기(오디오+대본) 목록을 가져온다.
 */

function keyParam(serviceKey: string): string {
  return serviceKey.includes('%')
    ? `serviceKey=${serviceKey}`
    : `serviceKey=${encodeURIComponent(serviceKey)}`;
}

const BASE = 'https://apis.data.go.kr/B551011/Odii';

export function buildOdiiSitesUrl(
  serviceKey: string,
  options: { keyword?: string; pageNo?: number; numOfRows?: number }
): string {
  const params = new URLSearchParams({
    MobileOS: 'ETC',
    MobileApp: 'Wayknit',
    _type: 'json',
    langCode: 'ko',
    numOfRows: String(options.numOfRows ?? 24),
    pageNo: String(options.pageNo ?? 1),
  });
  const keyword = options.keyword?.trim();
  if (keyword) {
    params.set('keyword', keyword);
    return `${BASE}/themeSearchList?${keyParam(serviceKey)}&${params.toString()}`;
  }
  return `${BASE}/themeBasedList?${keyParam(serviceKey)}&${params.toString()}`;
}

export function buildOdiiStoriesUrl(serviceKey: string, tid: string, tlid: string): string {
  const params = new URLSearchParams({
    MobileOS: 'ETC',
    MobileApp: 'Wayknit',
    _type: 'json',
    langCode: 'ko',
    numOfRows: '50',
    tid,
    tlid,
  });
  return `${BASE}/storyBasedList?${keyParam(serviceKey)}&${params.toString()}`;
}

interface RawOdiiSite {
  tid: string;
  tlid: string;
  themeCategory?: string;
  addr1?: string;
  addr2?: string;
  title: string;
  mapX: string;
  mapY: string;
  imageUrl?: string;
}

export interface OdiiSite {
  tid: string;
  tlid: string;
  title: string;
  region: string;
  themeCategory?: string;
  lat: number;
  lng: number;
  imageUrl?: string;
}

export async function fetchOdiiSites(url: string): Promise<{ items: OdiiSite[]; totalCount: number }> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) return { items: [], totalCount: 0 };
  const json = (await res.json()) as {
    response?: { body?: { items?: { item?: RawOdiiSite | RawOdiiSite[] }; totalCount?: number } };
  };
  const raw = json.response?.body?.items?.item;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return {
    totalCount: json.response?.body?.totalCount ?? list.length,
    items: list
      .map((it) => {
        const lat = parseFloat(it.mapY);
        const lng = parseFloat(it.mapX);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return {
          tid: it.tid,
          tlid: it.tlid,
          title: it.title.replace(/<[^>]+>/g, ''),
          region: [it.addr1, it.addr2].filter(Boolean).join(' '),
          themeCategory: it.themeCategory?.trim() || undefined,
          lat,
          lng,
          imageUrl: it.imageUrl?.trim() || undefined,
        };
      })
      .filter((s): s is OdiiSite => s !== null),
  };
}

interface RawOdiiStory {
  stid: string;
  stlid: string;
  title: string;
  audioTitle?: string;
  script?: string;
  playTime?: number | string;
  audioUrl?: string;
  imageUrl?: string;
}

export interface OdiiStory {
  stid: string;
  stlid: string;
  title: string;
  audioTitle?: string;
  script?: string;
  playTimeSec?: number;
  audioUrl?: string;
  imageUrl?: string;
}

export async function fetchOdiiStories(url: string): Promise<{ items: OdiiStory[]; totalCount: number }> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) return { items: [], totalCount: 0 };
  const json = (await res.json()) as {
    response?: { body?: { items?: { item?: RawOdiiStory | RawOdiiStory[] }; totalCount?: number } };
  };
  const raw = json.response?.body?.items?.item;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return {
    totalCount: json.response?.body?.totalCount ?? list.length,
    items: list.map((it) => ({
      stid: it.stid,
      stlid: it.stlid,
      title: it.title.replace(/<[^>]+>/g, ''),
      audioTitle: it.audioTitle?.trim() || undefined,
      script: it.script?.trim() || undefined,
      playTimeSec: it.playTime !== undefined ? Number(it.playTime) || undefined : undefined,
      audioUrl: it.audioUrl?.trim() || undefined,
      imageUrl: it.imageUrl?.trim() || undefined,
    })),
  };
}
