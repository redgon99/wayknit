import type { IconName } from '../icons/wayknit-icons';

export interface StoreFacilityChip {
  key: string;
  /** 카카오 원문(한국어) 또는 규칙의 한국어 라벨 — 번역이 없을 때 그대로 보여준다 */
  label: string;
  icon: IconName;
  /**
   * 아는 항목이면 번역 키 `place.detail.facility.<id>`. 규칙에 없는 카카오 원문 칩은
   * 비어 있어 원문 그대로 보인다(데이터라 번역할 수 없다).
   */
  id?: string;
}

export interface StoreFacilityDetail {
  key: string;
  text: string;
}

export interface StoreFacilitySection {
  chips: StoreFacilityChip[];
  details: StoreFacilityDetail[];
}

type FacilityRule = {
  /** 번역 키 `place.detail.facility.<id>` */
  id: string;
  pattern: RegExp;
  icon: IconName;
  label: string;
};

/*
 * 위에서부터 처음 맞는 규칙 하나를 쓴다 — 구체적인 것을 일반적인 것보다 앞에 둔다
 * (예: 남녀분리 화장실 → 화장실, 유료·무료 주차 → 주차가능).
 * 관광지 항목(입장료·예매·편의시설)은 2026-10-27 경복궁 상세에서 원문 그대로 나오던
 * 칩들을 보고 추가했다.
 */
const FACILITY_RULES: FacilityRule[] = [
  { id: 'groupSeating', pattern: /단체석/, icon: 'facilityGroup', label: '단체석' },
  { id: 'babyChair', pattern: /유아의자|아기의자/, icon: 'facilityBabyChair', label: '유아의자' },
  { id: 'kidsMenu', pattern: /키즈\s*메뉴|어린이\s*메뉴/, icon: 'facilityKidsMenu', label: '키즈메뉴' },
  { id: 'terrace', pattern: /테라스/, icon: 'facilityTerrace', label: '테라스' },
  { id: 'takeout', pattern: /포장/, icon: 'facilityTakeout', label: '포장가능' },
  { id: 'paidParking', pattern: /유료\s*주차/, icon: 'catParking', label: '유료 주차' },
  { id: 'freeParking', pattern: /무료\s*주차/, icon: 'catParking', label: '무료 주차' },
  { id: 'parking', pattern: /주차가능|주차\s*가능/, icon: 'catParking', label: '주차가능' },
  { id: 'pet', pattern: /반려|애견|펫/, icon: 'facilityPet', label: '반려동물' },
  { id: 'advanceBooking', pattern: /사전\s*예약/, icon: 'facilityReservation', label: '사전예약' },
  { id: 'onlineTicket', pattern: /온라인\s*예매/, icon: 'facilityReservation', label: '온라인예매' },
  { id: 'reservation', pattern: /예약가능|예약\s*가능/, icon: 'facilityReservation', label: '예약가능' },
  { id: 'genderRestroom', pattern: /남녀분리\s*화장실/, icon: 'facilityRestroom', label: '남녀분리 화장실' },
  { id: 'inStoreRestroom', pattern: /매장\s*내\s*화장실/, icon: 'facilityRestroom', label: '매장 내 화장실' },
  { id: 'restroom', pattern: /화장실/, icon: 'facilityRestroom', label: '화장실' },
  { id: 'barTable', pattern: /바테이블|바\s*테이블/, icon: 'facilityBarTable', label: '바테이블' },
  { id: 'breakfast', pattern: /아침식사|아침\s*식사/, icon: 'facilityBreakfast', label: '아침식사' },
  { id: 'wifi', pattern: /와이파이|wi-?fi/i, icon: 'facilityWifi', label: '와이파이' },
  { id: 'smoking', pattern: /흡연/, icon: 'facilitySmoking', label: '흡연실' },
  { id: 'paidAdmission', pattern: /유료\s*입장/, icon: 'facilityInfo', label: '유료입장' },
  { id: 'freeAdmission', pattern: /무료\s*입장/, icon: 'facilityInfo', label: '무료입장' },
  { id: 'souvenirShop', pattern: /기념품/, icon: 'facilityInfo', label: '기념품샵' },
  { id: 'restArea', pattern: /휴게\s*(공간|실|소)/, icon: 'facilityInfo', label: '휴게공간' },
  { id: 'cafeRestaurant', pattern: /^(카페|식당|카페\s*\/\s*식당)$/, icon: 'facilityInfo', label: '카페/식당' },
  { id: 'payment', pattern: /결제|카드|페이|지원금/, icon: 'facilityPayment', label: '결제' },
];

function pickStr(obj: Record<string, unknown> | undefined, key: string): string | undefined {
  if (!obj) return undefined;
  const v = obj[key];
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function classifyRawText(raw: string): StoreFacilityChip | StoreFacilityDetail | null {
  const text = raw.trim();
  if (!text) return null;

  const colonDetail = text.match(/^([^:]{1,12}):\s*(.+)$/);
  if (colonDetail && colonDetail[2].length >= 8) {
    return { key: `detail:${text}`, text };
  }

  for (const rule of FACILITY_RULES) {
    if (rule.pattern.test(text)) {
      return { key: `chip:${rule.label}`, label: rule.label, icon: rule.icon, id: rule.id };
    }
  }

  if (text.length <= 14 && !text.includes(':')) {
    return { key: `chip:${text}`, label: text, icon: 'facilityInfo' };
  }

  return { key: `detail:${text}`, text };
}

function isChip(
  item: StoreFacilityChip | StoreFacilityDetail
): item is StoreFacilityChip {
  return 'icon' in item;
}

/** panel3.place_add_info → 아이콘 칩 + 상세 문장 */
export function parseStoreFacilities(
  panel: Record<string, unknown> | null
): StoreFacilitySection {
  const addInfo = panel?.place_add_info as Record<string, unknown> | undefined;
  if (!addInfo) return { chips: [], details: [] };

  const chipMap = new Map<string, StoreFacilityChip>();
  const detailMap = new Map<string, StoreFacilityDetail>();

  const absorb = (raw: string | undefined, forceDetail = false) => {
    if (!raw?.trim()) return;
    if (forceDetail) {
      const t = raw.trim();
      detailMap.set(`detail:${t}`, { key: `detail:${t}`, text: t });
      return;
    }
    const item = classifyRawText(raw);
    if (!item) return;
    if (isChip(item)) chipMap.set(item.key, item);
    else detailMap.set(item.key, item);
  };

  const ai = addInfo.ai_mate as Record<string, unknown> | undefined;
  for (const icon of (ai?.store_facility_icons as Array<Record<string, unknown>>) ?? []) {
    absorb(pickStr(icon, 'text'));
  }
  for (const info of (ai?.store_infos as Array<Record<string, unknown>>) ?? []) {
    const title = pickStr(info, 'title');
    const summaryText = pickStr(info, 'summary');
    if (title && summaryText) absorb(`${title}: ${summaryText}`, true);
    else absorb(title ?? summaryText);
  }

  for (const item of (addInfo.simple_detail_infos as Array<Record<string, unknown>>) ?? []) {
    absorb(pickStr(item, 'text'));
  }

  const parking = addInfo.simple_parking_infos as Record<string, unknown> | undefined;
  for (const t of (parking?.texts as string[]) ?? []) {
    const text = t.includes('주차') ? t : `주차 ${t}`;
    absorb(text);
  }

  const facilities = addInfo.facilities as Record<string, unknown> | undefined;
  if (facilities?.is_pet === true) absorb('반려동물 동반');
  if (facilities?.is_parking === true) absorb('주차가능');

  for (const block of (addInfo.full_detail_infos as Array<Record<string, unknown>>) ?? []) {
    for (const item of (block.items as Array<Record<string, unknown>>) ?? []) {
      const iconText = pickStr(item.icon as Record<string, unknown> | undefined, 'text');
      for (const c of (item.contents as Array<Record<string, unknown>>) ?? []) {
        const label = pickStr(c, 'label');
        if (label) absorb(label);
      }
      if (iconText) absorb(iconText);
    }
  }

  for (const tag of (addInfo.tags as string[]) ?? []) {
    absorb(tag);
  }

  return {
    chips: [...chipMap.values()],
    details: [...detailMap.values()],
  };
}
