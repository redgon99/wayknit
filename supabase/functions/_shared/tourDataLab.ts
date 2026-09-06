/**
 * DataLabService(관광 빅데이터) — 광역/기초 지자체별 일일 방문자수 집계.
 * 장소 목록이 아니라 지역 단위 통계라 핀업 대상이 아니고, /info 페이지의
 * 열람 전용 통계 탭으로 다룬다. 집계 특성상 최신 데이터까지 약 한 달의
 * 시차가 있다(라이브 확인: 2026-08-17 기준 2026-07-18까지만 데이터 존재).
 */

export type DataLabLevel = 'metco' | 'locgo';

function keyParam(serviceKey: string): string {
  return serviceKey.includes('%')
    ? `serviceKey=${serviceKey}`
    : `serviceKey=${encodeURIComponent(serviceKey)}`;
}

const BASE = 'https://apis.data.go.kr/B551011/DataLabService';
const OP_BY_LEVEL: Record<DataLabLevel, string> = {
  metco: 'metcoRegnVisitrDDList',
  locgo: 'locgoRegnVisitrDDList',
};

export function buildDataLabUrl(level: DataLabLevel, serviceKey: string, ymd: string): string {
  const params = new URLSearchParams({
    MobileOS: 'ETC',
    MobileApp: 'Wayknit',
    _type: 'json',
    numOfRows: level === 'metco' ? '100' : '1000',
    pageNo: '1',
    startYmd: ymd,
    endYmd: ymd,
  });
  return `${BASE}/${OP_BY_LEVEL[level]}?${keyParam(serviceKey)}&${params.toString()}`;
}

interface RawDataLabRow {
  areaCode?: string;
  areaNm?: string;
  signguCode?: string;
  signguNm?: string;
  touDivCd: string;
  touNum: string;
  baseYmd?: string;
}

export interface DataLabRegion {
  code: string;
  name: string;
  local: number;
  domestic: number;
  foreign: number;
  total: number;
}

export async function fetchDataLabRegions(
  url: string
): Promise<{ regions: DataLabRegion[]; baseYmd: string | null }> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) return { regions: [], baseYmd: null };
  const json = (await res.json()) as {
    response?: { body?: { items?: { item?: RawDataLabRow | RawDataLabRow[] } } };
  };
  const raw = json.response?.body?.items?.item;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];

  const byCode = new Map<string, DataLabRegion>();
  let baseYmd: string | null = null;
  for (const row of list) {
    const code = row.areaCode ?? row.signguCode ?? '';
    const name = row.areaNm ?? row.signguNm ?? '';
    if (!code || !name) continue;
    baseYmd = row.baseYmd ?? baseYmd;
    const num = Number(row.touNum) || 0;
    let entry = byCode.get(code);
    if (!entry) {
      entry = { code, name, local: 0, domestic: 0, foreign: 0, total: 0 };
      byCode.set(code, entry);
    }
    if (row.touDivCd === '1') entry.local += num;
    else if (row.touDivCd === '2') entry.domestic += num;
    else if (row.touDivCd === '3') entry.foreign += num;
    entry.total = entry.local + entry.domestic + entry.foreign;
  }

  const regions = Array.from(byCode.values()).sort((a, b) => b.total - a.total);
  return { regions, baseYmd };
}
