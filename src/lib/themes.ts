import type { SimpleCategory, TripTheme } from '../types';
import type { IconName } from '../icons/wayknit-icons';

export const TRIP_THEMES: Array<{
  id: TripTheme;
  labelKey: string;
  icon: IconName;
  categories: SimpleCategory[];
}> = [
  { id: 'kfood', labelKey: 'themes.kfood', icon: 'catFood', categories: ['food', 'market'] },
  { id: 'kpop', labelKey: 'themes.kpop', icon: 'catCulture', categories: ['culture', 'shop'] },
  { id: 'shopping', labelKey: 'themes.shopping', icon: 'catShop', categories: ['shop', 'beauty', 'market'] },
  { id: 'nature', labelKey: 'themes.nature', icon: 'catTour', categories: ['tour', 'road'] },
  { id: 'history', labelKey: 'themes.history', icon: 'catCulture', categories: ['tour', 'culture'] },
  { id: 'nightlife', labelKey: 'themes.nightlife', icon: 'catCafe', categories: ['food', 'cafe', 'road'] },
  { id: 'family', labelKey: 'themes.family', icon: 'catTour', categories: ['tour', 'culture', 'food'] },
];

export function themeBoostScore(
  preferences: TripTheme[] | undefined,
  category: SimpleCategory
): number {
  if (!preferences?.length) return 0;
  let boost = 0;
  for (const pref of preferences) {
    const theme = TRIP_THEMES.find((t) => t.id === pref);
    if (theme?.categories.includes(category)) boost += 1;
  }
  return boost;
}
