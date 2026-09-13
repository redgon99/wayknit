import type { PinnedPlace, SimpleCategory } from '../types';
import { applySimpleCategory, DEFAULT_CODE_BY_SIMPLE_CATEGORY, getCategoryMeta } from './categories';
import { arrayMove } from '@dnd-kit/sortable';

const GROUP_ORDER: SimpleCategory[] = [
  'food',
  'cafe',
  'tour',
  'culture',
  'shop',
  'beauty',
  'market',
  'transport',
  'road',
  'stay',
  'other',
];

export interface PinCategoryGroup {
  category: SimpleCategory;
  label: string;
  items: PinnedPlace[];
}

/** 방문 순서를 유지한 채 카테고리별로 묶어 표시 (빈 카테고리 포함) */
export function groupPinnedByCategory(
  pinned: PinnedPlace[],
  includeEmpty = false,
): PinCategoryGroup[] {
  const buckets = new Map<SimpleCategory, PinnedPlace[]>();
  for (const p of pinned) {
    const cat = p.category ?? getCategoryMeta(p.categoryCode).category;
    const list = buckets.get(cat) ?? [];
    list.push(p);
    buckets.set(cat, list);
  }
  const categories = includeEmpty
    ? GROUP_ORDER
    : GROUP_ORDER.filter((cat) => buckets.has(cat));
  return categories.map((cat) => {
    const items = buckets.get(cat) ?? [];
    const sample = items[0];
    const meta = sample
      ? getCategoryMeta(sample.categoryCode)
      : getCategoryMeta(DEFAULT_CODE_BY_SIMPLE_CATEGORY[cat]);
    return {
      category: cat,
      label: meta.label,
      items,
    };
  });
}

/**
 * U07(모바일 UX 리포트 2026-09-13) — "목록으로 보기"의 기본 정렬이
 * 카테고리별(음식점 2·3·4, 마트 1처럼)이라 번호가 방문 순서처럼 보이지만
 * 아니었다. 방문순서 모드를 새로 추가하면서, 이 모드에서 드래그로 순서를
 * 바꿀 때 `movePinnedPlace`(카테고리 경계에 놓으면 카테고리까지 바뀌는
 * 로직)를 그대로 쓰면 방문순서만 바꾸려던 조작이 조용히 분류까지
 * 바꿔버린다. 그래서 순서만 바꾸는 전용 함수를 따로 둔다.
 */
export function reorderPinnedPlaces(
  pinned: PinnedPlace[],
  activeId: string,
  overId: string,
): PinnedPlace[] {
  const ids = pinned.map((p) => p.id);
  const oldIdx = ids.indexOf(activeId);
  const newIdx = ids.indexOf(overId);
  if (oldIdx === -1 || newIdx === -1) return pinned;
  const newIds = arrayMove(ids, oldIdx, newIdx);
  const pinnedMap = new Map(pinned.map((p) => [p.id, p]));
  return newIds.map((id, i) => ({ ...pinnedMap.get(id)!, order: i + 1 }));
}

/** 핀 칩 제목: 5자 이상이면 4자 + … */
export function truncatePinTitle(name: string): string {
  if (name.length >= 5) return `${name.slice(0, 4)}…`;
  return name;
}

export function formatPinDistance(meters: number | undefined): string {
  if (meters === undefined) return '';
  if (meters < 1000) return `${meters}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

function findInsertIndexForCategory(
  ids: string[],
  pinnedMap: Map<string, PinnedPlace>,
  category: SimpleCategory,
): number {
  let lastIdx = -1;
  for (let i = 0; i < ids.length; i++) {
    const p = pinnedMap.get(ids[i]);
    if (p && getCategoryMeta(p.categoryCode).category === category) {
      lastIdx = i;
    }
  }
  if (lastIdx >= 0) return lastIdx + 1;

  const targetIdx = GROUP_ORDER.indexOf(category);
  for (let i = 0; i < ids.length; i++) {
    const p = pinnedMap.get(ids[i]);
    if (!p) continue;
    const cat = p.category ?? getCategoryMeta(p.categoryCode).category;
    if (GROUP_ORDER.indexOf(cat) > targetIdx) return i;
  }
  return ids.length;
}

/** 드래그앤드롭으로 순서·카테고리 변경 */
export function movePinnedPlace(
  pinned: PinnedPlace[],
  activeId: string,
  overId: string,
): PinnedPlace[] {
  const ids = pinned.map((p) => p.id);
  const oldIdx = ids.indexOf(activeId);
  if (oldIdx === -1) return pinned;

  const pinnedMap = new Map(pinned.map((p) => [p.id, p]));
  const active = pinnedMap.get(activeId)!;
  let targetCategory: SimpleCategory | null = null;
  let newIds: string[];

  if (overId.startsWith('group-')) {
    targetCategory = overId.slice(6) as SimpleCategory;
    const withoutActive = ids.filter((id) => id !== activeId);
    const insertAt = findInsertIndexForCategory(withoutActive, pinnedMap, targetCategory);
    newIds = [
      ...withoutActive.slice(0, insertAt),
      activeId,
      ...withoutActive.slice(insertAt),
    ];
  } else {
    const newIdx = ids.indexOf(overId);
    if (newIdx === -1) return pinned;
    newIds = arrayMove(ids, oldIdx, newIdx);
    const overPlace = pinnedMap.get(overId);
    if (overPlace) {
      targetCategory = getCategoryMeta(overPlace.categoryCode).category;
    }
  }

  const currentCategory = getCategoryMeta(active.categoryCode).category;
  const next = newIds.map((id) => {
    const place = pinnedMap.get(id)!;
    if (id === activeId && targetCategory && targetCategory !== currentCategory) {
      return applySimpleCategory(place, targetCategory);
    }
    return place;
  });

  return next.map((p, i) => ({ ...p, order: i + 1 }));
}
