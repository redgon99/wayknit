import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { IconName } from '../icons/wayknit-icons';
import type { SearchCategoryFilter, SearchRadiusMeters, SortKey } from '../types';
import {
  SEARCH_CATEGORY_FILTERS,
  SEARCH_RADIUS_OPTIONS,
  SORT_FILTER_KEYS,
  TRAVEL_MODE_META,
} from './categories';

const CATEGORY_I18N_KEY: Record<string, string> = {
  '': 'all',
  FD6: 'food',
  CE7: 'cafe',
  AT4: 'tour',
  AD5: 'stay',
  CT1: 'culture',
  MT1: 'shop',
  PK6: 'parking',
};

export function useSearchCategoryFilters() {
  const { t } = useTranslation('common');
  return useMemo(
    () =>
      SEARCH_CATEGORY_FILTERS.map((item) => ({
        ...item,
        label: t(`category.${CATEGORY_I18N_KEY[item.code ?? ''] ?? 'other'}`),
      })),
    [t]
  );
}

export function useSearchRadiusOptions() {
  return SEARCH_RADIUS_OPTIONS;
}

export function useSortLabels(): Record<SortKey, string> {
  const { t } = useTranslation('common');
  return useMemo(
    () => ({
      distance: t('sort.distance'),
      rating: t('sort.rating'),
      review: t('sort.review'),
    }),
    [t]
  );
}

export function useTravelModeMeta() {
  const { t } = useTranslation('common');
  return useMemo(() => {
    const modes = ['car', 'walk', 'transit', 'bike'] as const;
    return modes.reduce(
      (acc, mode) => {
        const meta = TRAVEL_MODE_META[mode];
        acc[mode] = {
          ...meta,
          label: t(`travelMode.${mode}`),
        };
        return acc;
      },
      {} as Record<
        (typeof modes)[number],
        { label: string; icon: IconName; speedKmh: number }
      >
    );
  }, [t]);
}

export { SORT_FILTER_KEYS };
export type { SearchCategoryFilter, SearchRadiusMeters };
