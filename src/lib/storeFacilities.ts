import type { IconName } from '../icons/wayknit-icons';

export interface StoreFacilityChip {
  key: string;
  label: string;
  icon: IconName;
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
  pattern: RegExp;
  icon: IconName;
  label: string;
};

const FACILITY_RULES: FacilityRule[] = [
  { pattern: /단체석/, icon: 'facilityGroup', label: '단체석' },
  { pattern: /유아의자|아기의자/, icon: 'facilityBabyChair', label: '유아의자' },
  { pattern: /키즈\s*메뉴|어린이\s*메뉴/, icon: 'facilityKidsMenu', label: '키즈메뉴' },
  { pattern: /테라스/, icon: 'facilityTerrace', label: '테라스' },
  { pattern: /포장/, icon: 'facilityTakeout', label: '포장가능' },
  { pattern: /주차가능|주차\s*가능/, icon: 'catParking', label: '주차가능' },
  { pattern: /반려|애견|펫/, icon: 'facilityPet', label: '반려동물' },
  { pattern: /예약가능|예약\s*가능/, icon: 'facilityReservation', label: '예약가능' },
  { pattern: /남녀분리\s*화장실/, icon: 'facilityRestroom', label: '남녀분리 화장실' },
  { pattern: /매장\s*내\s*화장실/, icon: 'facilityRestroom', label: '매장 내 화장실' },
  { pattern: /화장실/, icon: 'facilityRestroom', label: '화장실' },
  { pattern: /바테이블|바\s*테이블/, icon: 'facilityBarTable', label: '바테이블' },
  { pattern: /아침식사|아침\s*식사/, icon: 'facilityBreakfast', label: '아침식사' },
  { pattern: /와이파이|wi-?fi/i, icon: 'facilityWifi', label: '와이파이' },
  { pattern: /흡연/, icon: 'facilitySmoking', label: '흡연실' },
  { pattern: /결제|카드|페이|지원금/, icon: 'facilityPayment', label: '결제' },
  { pattern: /무료\s*주차/, icon: 'catParking', label: '무료 주차' },
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
      return { key: `chip:${rule.label}`, label: rule.label, icon: rule.icon };
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
