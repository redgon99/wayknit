import type { PinnedPlace } from '../types';

/**
 * 공유마당 지역 필터용 — Trip.region 필드는 실제로 채워지는 코드 경로가 없는
 * 죽은 값이라(HANDOFF 참고) 쓸 수 없다. 대신 핀(PinnedPlace.address)은 카카오
 * 검색 결과 그대로라 실제 주소 문자열이 있다 — 앞 토큰(시/도명)을 잘라 쓴다.
 */
export interface KoreaRegion {
  code: string;
  labelKey: string;
  /** 주소 문자열이 이 중 하나로 시작하면 이 지역으로 인식 (구법/신법 명칭 둘 다) */
  prefixes: string[];
}

export const KOREA_REGIONS: KoreaRegion[] = [
  { code: 'seoul', labelKey: 'plaza.region.seoul', prefixes: ['서울'] },
  { code: 'busan', labelKey: 'plaza.region.busan', prefixes: ['부산'] },
  { code: 'daegu', labelKey: 'plaza.region.daegu', prefixes: ['대구'] },
  { code: 'incheon', labelKey: 'plaza.region.incheon', prefixes: ['인천'] },
  { code: 'gwangju', labelKey: 'plaza.region.gwangju', prefixes: ['광주'] },
  { code: 'daejeon', labelKey: 'plaza.region.daejeon', prefixes: ['대전'] },
  { code: 'ulsan', labelKey: 'plaza.region.ulsan', prefixes: ['울산'] },
  { code: 'sejong', labelKey: 'plaza.region.sejong', prefixes: ['세종'] },
  { code: 'gyeonggi', labelKey: 'plaza.region.gyeonggi', prefixes: ['경기'] },
  { code: 'gangwon', labelKey: 'plaza.region.gangwon', prefixes: ['강원'] },
  { code: 'chungbuk', labelKey: 'plaza.region.chungbuk', prefixes: ['충청북도', '충북'] },
  { code: 'chungnam', labelKey: 'plaza.region.chungnam', prefixes: ['충청남도', '충남'] },
  {
    code: 'jeonbuk',
    labelKey: 'plaza.region.jeonbuk',
    prefixes: ['전북특별자치도', '전라북도', '전북'],
  },
  { code: 'jeonnam', labelKey: 'plaza.region.jeonnam', prefixes: ['전라남도', '전남'] },
  { code: 'gyeongbuk', labelKey: 'plaza.region.gyeongbuk', prefixes: ['경상북도', '경북'] },
  { code: 'gyeongnam', labelKey: 'plaza.region.gyeongnam', prefixes: ['경상남도', '경남'] },
  { code: 'jeju', labelKey: 'plaza.region.jeju', prefixes: ['제주'] },
];

const REGION_BY_CODE = new Map(KOREA_REGIONS.map((r) => [r.code, r]));

export function regionLabelKey(code: string): string | undefined {
  return REGION_BY_CODE.get(code)?.labelKey;
}

export function regionCodeFromAddress(address: string | undefined | null): string | null {
  if (!address) return null;
  const trimmed = address.trim();
  for (const region of KOREA_REGIONS) {
    if (region.prefixes.some((p) => trimmed.startsWith(p))) return region.code;
  }
  return null;
}

/** 다일차 핀 전체에서 등장하는 지역 코드를 중복 없이 뽑는다 */
export function regionCodesFromPins(pinnedByDay: Record<number, PinnedPlace[]>): string[] {
  const set = new Set<string>();
  for (const pins of Object.values(pinnedByDay)) {
    for (const p of pins) {
      const code = regionCodeFromAddress(p.address);
      if (code) set.add(code);
    }
  }
  return [...set];
}
