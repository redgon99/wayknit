import { Icon } from './Icon';
import { useEffect, useMemo, useRef, useState, type ClipboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  Place,
  SortKey,
  SearchScope,
  SearchCategoryFilter,
  SearchRadiusMeters,
  FoodRestriction,
  TripTheme,
} from '../types';
import { useSearchCategoryFilters, useSortLabels } from '../lib/i18nCategories';
import { getSearchCategoryAccent } from '../lib/categories';
import { TRIP_THEMES } from '../lib/themes';
import { formatNumber } from '../lib/format';
import { normalizeLocale } from '../lib/locale';
import i18n from '../lib/i18n';
import {
  extractPlacesFromLink,
  isLinkPlacesExtractConfigured,
  type LinkPlaceCandidate,
  type LinkPlacesExtractResult,
} from '../lib/linkPlaces';
import { detectLinkInput, type DetectedLink } from '../lib/linkPlatform';
import {
  getPlaceReaction,
  isPlaceReactionsConfigured,
  loadPlaceReactions,
} from '../lib/placeReactions';
import { looksLikePastedPlaceList, splitSearchQueries } from '../lib/searchQueries';
import {
  getSearchSubFilterGroup,
  type SearchSubFilterId,
} from '../lib/searchSubFilters';
import { PlaceThumb } from './PlaceThumb';
import { OpenStatusBadge } from './OpenStatusBadge';
import { PlaceReactionBadge } from './PlaceReactionBadge';
import { MapProviderPicker } from './MapProviderPicker';
import { LinkExtractResults } from './LinkExtractResults';
import type { MapProvider } from '../lib/mapProvider';
import type { IconName } from '../icons/wayknit-icons';

/** 검색 결과 정렬 — 거리·별점 */
const SEARCH_SORT_KEYS = ['distance', 'rating'] as const satisfies readonly SortKey[];
const SORT_ICONS: Record<(typeof SEARCH_SORT_KEYS)[number], IconName> = {
  distance: 'mapPin',
  rating: 'star',
};

/** 자동 검색: 입력이 멈춘 뒤 기다리는 시간.
 *  한글은 한 글자를 조합하는 데도 시간이 걸려 짧게 잡으면 글자마다 검색이 나간다. */
const AUTO_SEARCH_DELAY_MS = 1000;
/** 한 글자만으로는 결과가 무의미해 두 글자부터 자동 검색한다("카페" 같은 두 글자 질의 고려). */
const AUTO_SEARCH_MIN_LENGTH = 2;
/** 끝이 낱자(ㄱ, ㅏ 같은 호환 자모)로 끝나면 아직 글자를 만드는 중이라 보고 검색하지 않는다. */
const INCOMPLETE_JAMO_RE = /[\u3131-\u3163]$/;

interface Props {
  results: Place[];
  pinnedIds: Set<string>;
  selectedId?: string | null;
  loading?: boolean;
  enrichingStats?: boolean;
  searchEmpty?: boolean;
  searchScope: SearchScope;
  onSearchScopeChange: (scope: SearchScope) => void;
  categoryFilter: SearchCategoryFilter;
  onCategoryFilterChange: (code: SearchCategoryFilter) => void;
  searchRadius: SearchRadiusMeters;
  onSearchRadiusChange: (radius: SearchRadiusMeters) => void;
  onUseMyLocation?: () => void;
  onSearchFestivals?: () => void;
  searchingFestivals?: boolean;
  query: string;
  onQueryChange: (q: string) => void;
  onSearch: () => void;
  onClear: () => void;
  onResetResults: () => void;
  onTogglePin: (place: Place) => void;
  onSelectResult?: (place: Place) => void;
  onOpenRoadview?: (place: Place) => void;
  onOpenPlacePhotos?: (place: Place) => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  searchError?: string | null;
  mapProvider: MapProvider;
  onMapProviderChange: (provider: MapProvider) => void;
  onSearchCandidate?: (query: string) => void;
  /** 맛집(FD6) 음식 제약 — trip에 저장 */
  foodRestrictions?: FoodRestriction[];
  onFoodRestrictionsChange?: (next: FoodRestriction[]) => void;
  /** 숙소·관광·마트 등 카테고리 하부 필터 */
  categorySubFilters?: SearchSubFilterId[];
  onCategorySubFiltersChange?: (next: SearchSubFilterId[]) => void;
  /** 선택한 여행 테마 (K-food, K-pop 등) — 일치하는 카테고리를 우선 노출 */
  preferences?: TripTheme[];
  /** PWA 공유 시트에서 넘어온 링크 추출 결과 (없으면 평소대로 빈 상태) */
  initialExtract?: LinkPlacesExtractResult | null;
  variant?: 'default' | 'compact';
  /** 입력을 잠깐 멈추면 자동으로 검색한다. 돋보기 버튼을 따로 누르기 번거로운 모바일에서만 켠다. */
  autoSearch?: boolean;
}

/** 선택한 테마 중 이 장소의 카테고리와 일치하는 테마들 */
function matchedThemes(place: Place, preferences: TripTheme[]) {
  if (!preferences.length) return [];
  return TRIP_THEMES.filter(
    (theme) => preferences.includes(theme.id) && theme.categories.includes(place.category)
  );
}

/** 플랫폼 평점·리뷰수만으로 만드는 요약 배지 (수집·분석 인사이트와는 별개) */
function ratingBadge(
  place: Place,
  labels: { top: string; positive: string; wait: string }
): { kind: 'y' | 'g' | 'n'; label: string } | null {
  const rating = place.rating;
  const reviews = place.reviewCount ?? 0;
  if (rating != null && rating >= 4.5 && reviews >= 500) {
    return { kind: 'y', label: labels.top };
  }
  if (rating != null && rating >= 4.0 && reviews >= 50) {
    return { kind: 'g', label: labels.positive };
  }
  if (rating != null && rating < 3.5 && reviews >= 20) {
    return { kind: 'n', label: labels.wait };
  }
  return null;
}

export function SearchPanel({
  results,
  pinnedIds,
  selectedId = null,
  loading = false,
  enrichingStats = false,
  searchEmpty = false,
  searchScope,
  onSearchScopeChange,
  categoryFilter,
  onCategoryFilterChange,
  searchRadius,
  onSearchRadiusChange,
  onUseMyLocation,
  onSearchFestivals,
  searchingFestivals = false,
  query,
  onQueryChange,
  onSearch,
  onClear,
  onResetResults,
  onTogglePin,
  onSelectResult,
  onOpenRoadview,
  onOpenPlacePhotos,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  searchError = null,
  mapProvider,
  onMapProviderChange,
  onSearchCandidate,
  foodRestrictions = [],
  onFoodRestrictionsChange,
  categorySubFilters = [],
  onCategorySubFiltersChange,
  preferences = [],
  initialExtract = null,
  variant = 'default',
  autoSearch = false,
}: Props) {
  const { t } = useTranslation('planner');
  const { t: tc } = useTranslation('common');
  const categoryFilters = useSearchCategoryFilters();
  const sortLabels = useSortLabels();
  const appLocale = normalizeLocale(i18n.language);
  const compact = variant === 'compact';
  const [sortKey, setSortKey] = useState<SortKey>('distance');
  const subFilterGroup = getSearchSubFilterGroup(categoryFilter);
  const activeSubFilters =
    categoryFilter === 'FD6' ? foodRestrictions : categorySubFilters;
  const [linkExtracting, setLinkExtracting] = useState(false);
  const [linkPlaces, setLinkPlaces] = useState<LinkPlaceCandidate[]>([]);
  const [linkTitle, setLinkTitle] = useState<string | null>(null);
  const [linkDescription, setLinkDescription] = useState<string | null>(null);
  const [linkImageUrl, setLinkImageUrl] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkSnsMessage, setLinkSnsMessage] = useState<string | null>(null);
  const [linkPreviewKey, setLinkPreviewKey] = useState<string | null>(null);
  const [linkPreviewPlatform, setLinkPreviewPlatform] = useState<
    DetectedLink['platform'] | null
  >(null);
  const [linkPreviewHref, setLinkPreviewHref] = useState<string | null>(null);
  const [pasteHint, setPasteHint] = useState<string | null>(null);
  // 조회가 끝났을 때만 배지를 그리기 위한 리렌더 트리거
  const [reactionsLoaded, setReactionsLoaded] = useState(0);
  const resultListRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!isPlaceReactionsConfigured() || results.length === 0) return;
    let alive = true;
    void loadPlaceReactions(results).then(() => {
      if (alive) setReactionsLoaded((v) => v + 1);
    });
    return () => {
      alive = false;
    };
  }, [results]);

  const linkEnabled = isLinkPlacesExtractConfigured() && Boolean(onSearchCandidate);
  const detectedLink = useMemo(
    () => (linkEnabled ? detectLinkInput(query) : null),
    [query, linkEnabled]
  );
  const isExtractMode = Boolean(detectedLink?.extractable);
  const isSnsMode = Boolean(
    detectedLink &&
      !detectedLink.extractable &&
      (detectedLink.platform === 'instagram' ||
        detectedLink.platform === 'tiktok' ||
        detectedLink.platform === 'unsupported')
  );
  const isLinkMode = Boolean(detectedLink);

  useEffect(() => {
    if (detectedLink?.extractable) {
      if (linkPreviewKey && linkPreviewKey !== detectedLink.sourceKey) {
        setLinkPlaces([]);
        setLinkTitle(null);
        setLinkDescription(null);
        setLinkImageUrl(null);
        setLinkError(null);
        setLinkSnsMessage(null);
        setLinkPreviewKey(null);
        setLinkPreviewPlatform(null);
        setLinkPreviewHref(null);
      }
      setLinkSnsMessage(null);
      return;
    }
    if (detectedLink && !detectedLink.extractable) {
      setLinkPlaces([]);
      setLinkTitle(null);
      setLinkDescription(null);
      setLinkImageUrl(null);
      setLinkError(null);
      setLinkPreviewKey(detectedLink.sourceKey);
      setLinkPreviewPlatform(detectedLink.platform);
      setLinkPreviewHref(detectedLink.href);
      setLinkSnsMessage(
        detectedLink.platform === 'instagram'
          ? t('collect.linkSnsInstagram')
          : detectedLink.platform === 'tiktok'
            ? t('collect.linkSnsTiktok')
            : t('collect.linkSnsUnsupported')
      );
      return;
    }
    if (!query.trim()) {
      setLinkPlaces([]);
      setLinkTitle(null);
      setLinkDescription(null);
      setLinkImageUrl(null);
      setLinkError(null);
      setLinkSnsMessage(null);
      setLinkPreviewKey(null);
      setLinkPreviewPlatform(null);
      setLinkPreviewHref(null);
      setPasteHint(null);
    }
  }, [detectedLink, linkPreviewKey, query, t]);

  // 공유 시트(/share)에서 넘어온 추출 결과를 붙여넣기 흐름과 동일하게 되살린다.
  // 검색어를 원본 링크로 채워야 위 정리 effect가 미리보기를 지우지 않는다.
  const seededExtractUrl = useRef<string | null>(null);
  useEffect(() => {
    const url = initialExtract?.sourceUrl;
    if (!url || seededExtractUrl.current === url) return;
    seededExtractUrl.current = url;

    const detected = detectLinkInput(url);
    setLinkPlaces(initialExtract?.places ?? []);
    setLinkTitle(initialExtract?.title ?? null);
    setLinkDescription(initialExtract?.description ?? null);
    setLinkImageUrl(initialExtract?.imageUrl ?? null);
    setLinkError(null);
    setLinkSnsMessage(null);
    setLinkPreviewKey(detected?.sourceKey ?? url);
    setLinkPreviewPlatform(detected?.platform ?? 'web');
    setLinkPreviewHref(detected?.href ?? url);
    onQueryChange(url);
  }, [initialExtract, onQueryChange]);

  useEffect(() => {
    if (!selectedId || !resultListRef.current) return;
    const card = resultListRef.current.querySelector<HTMLElement>(
      `[data-place-id="${CSS.escape(selectedId)}"]`
    );
    card?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedId]);

  const hasRatings = useMemo(
    () => results.some((p) => p.rating != null),
    [results]
  );

  const sorted = useMemo(() => {
    const list = [...results];
    list.sort((a, b) => {
      const openRank = (p: Place) =>
        p.openingStatus === 'open' || p.isOpenNow
          ? 0
          : p.openingStatus === 'scheduled'
            ? 1
            : 2;
      const aOpen = openRank(a);
      const bOpen = openRank(b);
      if (aOpen !== bOpen) return aOpen - bOpen;
      if (preferences.length) {
        const aMatch = matchedThemes(a, preferences).length > 0 ? 0 : 1;
        const bMatch = matchedThemes(b, preferences).length > 0 ? 0 : 1;
        if (aMatch !== bMatch) return aMatch - bMatch;
      }
      switch (sortKey) {
        case 'rating':
          return (b.rating ?? -1) - (a.rating ?? -1);
        case 'review':
          return (b.reviewCount ?? -1) - (a.reviewCount ?? -1);
        case 'distance':
        default:
          return (a.distance ?? Infinity) - (b.distance ?? Infinity);
      }
    });
    return list;
  }, [results, sortKey, preferences]);

  const canSubmitSearch =
    Boolean(query.trim()) || (searchScope === 'nearby' && categoryFilter !== null);
  const canSubmit = isExtractMode
    ? !linkExtracting
    : isSnsMode
      ? true
      : canSubmitSearch;

  const handleLinkExtract = async () => {
    if (!detectedLink?.extractable || !onSearchCandidate || linkExtracting) return;
    setLinkExtracting(true);
    setLinkError(null);
    setLinkPlaces([]);
    setLinkTitle(null);
    setLinkDescription(null);
    setLinkImageUrl(null);
    setLinkSnsMessage(null);
    try {
      const result = await extractPlacesFromLink(detectedLink.href);
      if (!result.extractable) {
        setLinkSnsMessage(result.message ?? t('collect.linkSnsUnsupported'));
        setLinkPreviewKey(result.sourceKey);
        setLinkPreviewPlatform(result.platform);
        setLinkPreviewHref(result.sourceUrl);
        return;
      }
      setLinkPlaces(result.places);
      setLinkTitle(result.title);
      setLinkDescription(result.description);
      setLinkImageUrl(result.imageUrl);
      setLinkPreviewKey(result.sourceKey);
      setLinkPreviewPlatform(result.platform);
      setLinkPreviewHref(result.sourceUrl);
      if (result.places.length === 0) {
        setLinkError(t('collect.youtubeEmpty'));
      }
    } catch (e) {
      setLinkError(e instanceof Error ? e.message : t('collect.youtubeError'));
    } finally {
      setLinkExtracting(false);
    }
  };

  const normalizePasteIntoQuery = (raw: string) => {
    const parts = splitSearchQueries(raw);
    if (parts.length <= 1) return raw.trim();
    setPasteHint(t('search.pasteExtracted', { count: parts.length }));
    return parts.join(', ');
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData('text');
    if (!text || !looksLikePastedPlaceList(text)) return;
    if (detectLinkInput(text)?.extractable) return;
    e.preventDefault();
    const normalized = normalizePasteIntoQuery(text);
    onQueryChange(normalized);
  };

  // 자동 검색이 이미 처리한 질의. 같은 말을 두 번 검색하지 않기 위한 표시이며,
  // 첫 렌더의 질의(이전 검색어가 남아있는 경우)로 초기화해 열자마자 재검색하는 것을 막는다.
  const autoSearchedRef = useRef<string | null>(query.trim() || null);
  const onSearchRef = useRef(onSearch);
  useEffect(() => {
    onSearchRef.current = onSearch;
  });

  useEffect(() => {
    if (!autoSearch) return;
    // 앞선 검색이 아직 진행 중이면 기다렸다가(loading이 풀리면 이 effect가 다시 돈다) 보낸다.
    if (loading) return;
    // 링크 추출·SNS 모드는 버튼 동작이 검색이 아니고, 붙여넣은 장소 목록은
    // handleSubmit에서 쉼표 분리를 거쳐야 하므로 자동 검색 대상에서 뺀다.
    if (isExtractMode || isSnsMode) return;
    const q = query.trim();
    if (q.length < AUTO_SEARCH_MIN_LENGTH) return;
    if (autoSearchedRef.current === q) return;
    if (looksLikePastedPlaceList(q)) return;
    // "강남ㅋ"처럼 마지막 글자를 조합하다 만 상태로는 검색하지 않는다.
    if (INCOMPLETE_JAMO_RE.test(q)) return;
    const timer = setTimeout(() => {
      autoSearchedRef.current = q;
      onSearchRef.current();
    }, AUTO_SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [autoSearch, query, loading, isExtractMode, isSnsMode]);

  const handleSubmit = () => {
    autoSearchedRef.current = query.trim() || null;
    if (isExtractMode) {
      void handleLinkExtract();
      return;
    }
    if (isSnsMode && detectedLink) {
      window.open(detectedLink.href, '_blank', 'noopener,noreferrer');
      return;
    }
    if (looksLikePastedPlaceList(query)) {
      const normalized = normalizePasteIntoQuery(query);
      if (normalized !== query) onQueryChange(normalized);
    }
    if (canSubmitSearch) onSearch();
  };

  const handleClear = () => {
    setLinkPlaces([]);
    setLinkTitle(null);
    setLinkDescription(null);
    setLinkImageUrl(null);
    setLinkError(null);
    setLinkSnsMessage(null);
    setLinkPreviewKey(null);
    setLinkPreviewPlatform(null);
    setLinkPreviewHref(null);
    setPasteHint(null);
    onClear();
  };

  const handleSearchCandidate = (name: string) => {
    onSearchCandidate?.(name);
  };

  const toggleSubFilter = (id: SearchSubFilterId) => {
    if (categoryFilter === 'FD6') {
      if (!onFoodRestrictionsChange) return;
      const foodId = id as FoodRestriction;
      if (foodRestrictions.includes(foodId)) {
        onFoodRestrictionsChange(foodRestrictions.filter((s) => s !== foodId));
      } else {
        onFoodRestrictionsChange([...foodRestrictions, foodId]);
      }
      return;
    }
    if (!onCategorySubFiltersChange) return;
    if (categorySubFilters.includes(id)) {
      onCategorySubFiltersChange(categorySubFilters.filter((s) => s !== id));
    } else {
      onCategorySubFiltersChange([...categorySubFilters, id]);
    }
  };

  const metaLine =
    searchScope === 'nearby'
      ? t('search.metaNearby', {
          km: searchRadius / 1000,
          count: results.length,
          defaultValue: `Near map center · 지도 주변 ${searchRadius / 1000} km · ${results.length} results`,
        })
      : t('search.metaNationwide', {
          count: results.length,
          defaultValue: `Nationwide · 전국 · ${results.length} results`,
        });

  const categoryChipLabel = (code: SearchCategoryFilter, fallback: string) => {
    if (code === null) return tc('category.all');
    if (code === 'FD6') return tc('category.food');
    if (code === 'AT4') return tc('category.tour');
    if (code === 'AD5') return tc('category.stay');
    if (code === 'MT1') return tc('category.shop');
    return fallback;
  };

  return (
    <div className={`search-panel search-panel-v2 ${compact ? 'search-panel-compact' : ''}`}>
      <div className={`search-pill ${isLinkMode ? 'is-link' : ''}`}>
        <Icon name={isLinkMode ? 'attach' : 'search'} className="search-pill-icon" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setPasteHint(null);
            onQueryChange(e.target.value);
          }}
          onPaste={handlePaste}
          onKeyDown={(e) => e.key === 'Enter' && canSubmit && handleSubmit()}
          placeholder={t('search.placeholderDesign')}
          aria-label={t('search.ariaLabel')}
        />
        {query && (
          <button type="button" className="search-pill-clear" onClick={handleClear} aria-label={t('search.clearAria')}>
            <Icon name="close" size={16} />
          </button>
        )}
        <button
          type="button"
          className="search-pill-go"
          onClick={handleSubmit}
          disabled={!canSubmit || loading || linkExtracting}
          aria-label={tc('search')}
        >
          {linkExtracting ? <Icon name="loader" spin size={16} /> : <Icon name="search" size={16} />}
        </button>
      </div>

      <div className="search-pill-tools">
        <MapProviderPicker value={mapProvider} onChange={onMapProviderChange} />
        {onUseMyLocation && (
          <button type="button" className="search-tool-chip" onClick={onUseMyLocation}>
            <Icon name="location" size={14} /> {t('search.myLocation')}
          </button>
        )}
        {onSearchFestivals && (
          <button
            type="button"
            className="search-tool-chip"
            onClick={onSearchFestivals}
            disabled={searchingFestivals}
          >
            {searchingFestivals ? (
              <Icon name="loader" spin size={14} />
            ) : (
              <Icon name="sparkles" size={14} />
            )}
            {t('search.festivals', { defaultValue: '축제/행사' })}
          </button>
        )}
        <button
          type="button"
          className={`search-tool-chip ${searchScope === 'nearby' ? 'active' : ''}`}
          onClick={() => onSearchScopeChange(searchScope === 'nearby' ? 'nationwide' : 'nearby')}
        >
          {searchScope === 'nearby' ? t('search.scopeNearby') : t('search.scopeNationwide')}
        </button>
        {searchScope === 'nearby' && (
          <select
            className="search-tool-select"
            value={searchRadius}
            onChange={(e) =>
              onSearchRadiusChange(Number(e.target.value) as SearchRadiusMeters)
            }
            aria-label={t('search.radiusAria')}
          >
            {[1000, 3000, 5000, 10000, 20000].map((v) => (
              <option key={v} value={v}>
                {v / 1000} km
              </option>
            ))}
          </select>
        )}
      </div>

      {pasteHint && <p className="search-paste-hint">{pasteHint}</p>}

      {linkEnabled && (
        <LinkExtractResults
          detected={detectedLink}
          previewKey={linkPreviewKey}
          previewPlatform={linkPreviewPlatform}
          previewHref={linkPreviewHref}
          title={linkTitle}
          description={linkDescription}
          imageUrl={linkImageUrl}
          places={linkPlaces}
          error={linkError}
          extracting={linkExtracting}
          snsMessage={linkSnsMessage}
          onSearchCandidate={handleSearchCandidate}
          disabled={loading}
        />
      )}

      <div className="search-cat-pills" role="group" aria-label={t('search.ariaLabel')}>
        {categoryFilters.map((item) => {
          const accent = getSearchCategoryAccent(item.code);
          const active = categoryFilter === item.code;
          return (
            <button
              key={item.code ?? 'all'}
              type="button"
              className={`search-cat-pill ${active ? 'active' : ''}`}
              style={{
                borderColor: accent,
                ...(active
                  ? { background: accent, color: '#fff' }
                  : { color: accent }),
              }}
              onClick={() => onCategoryFilterChange(item.code)}
            >
              {categoryChipLabel(item.code, item.label)}
            </button>
          );
        })}
      </div>

      {subFilterGroup && (
        <div className="search-subfilters">
          <span className="search-subfilters-label">{subFilterGroup.label}</span>
          <div className="search-subfilters-row" role="group" aria-label={subFilterGroup.label}>
            {subFilterGroup.options.map((opt) => {
              const active = activeSubFilters.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  className={`search-subfilters-chip ${active ? 'active' : ''}`}
                  aria-pressed={active}
                  onClick={() => toggleSubFilter(opt.id)}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {(results.length > 0 || loading || enrichingStats) && (
        <p className="search-meta-line">
          {loading || enrichingStats
            ? loading
              ? t('search.loading')
              : t('search.enriching')
            : metaLine}
        </p>
      )}

      {results.length > 0 && !loading && (
        <div className="search-sort-row">
          <span className="search-sort-label">{t('search.sortLabel', { defaultValue: 'Sort 정렬' })}</span>
          <div className="search-sort-chips" role="group" aria-label={t('search.sortAria', { defaultValue: '검색 결과 정렬' })}>
            {SEARCH_SORT_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                className={`search-sort-chip ${sortKey === key ? 'active' : ''}`}
                aria-pressed={sortKey === key}
                onClick={() => setSortKey(key)}
              >
                <Icon name={SORT_ICONS[key]} size={12} />
                {sortLabels[key]}
              </button>
            ))}
          </div>
        </div>
      )}

      {sortKey === 'rating' && results.length > 0 && !hasRatings && !enrichingStats && (
        <p className="search-sort-hint">{t('search.ratingHint')}</p>
      )}

      {searchError && (
        <div className="search-error" role="alert">
          {searchError}
        </div>
      )}

      {searchEmpty && !loading && query.trim() && (
        <div className="search-empty-msg">
          {t('search.noResults')}
        </div>
      )}

      {!loading && results.length === 0 && !searchEmpty && !query.trim() && categoryFilter === null && (
        <div className="search-empty-msg muted">{t('search.emptyHint')}</div>
      )}

      {results.length > 0 && (
        <ul className="search-result-list" ref={resultListRef}>
          {sorted.map((place) => {
            const isPinned = pinnedIds.has(place.id);
            const badge = ratingBadge(place, {
              top: t('search.insightTop'),
              positive: t('search.insightPositive'),
              wait: t('search.insightWait'),
            });
            const reaction = reactionsLoaded ? getPlaceReaction(place) : null;
            const enHint = place.categoryDetail || place.categoryLabel || '';
            const themeMatches = matchedThemes(place, preferences);
            return (
              <li
                key={place.id}
                data-place-id={place.id}
                className={`search-result-card ${isPinned ? 'pinned' : ''} ${
                  selectedId === place.id ? 'selected' : ''
                } ${themeMatches.length ? 'theme-matched' : ''}`}
                onClick={() => onSelectResult?.(place)}
              >
                  <PlaceThumb
                    place={place}
                    variant="emoji"
                    onOpenPhotos={onOpenPlacePhotos ?? (() => {})}
                  />
                <div className="search-result-body">
                  <div className="search-result-title">
                    <span className="search-result-name">{place.name}</span>
                    {enHint && <span className="search-result-en">{enHint}</span>}
                    {(place.openingStatus === 'closed' || place.openingStatus === 'offday') && (
                      <OpenStatusBadge
                        status={place.openingStatus === 'offday' ? 'offday' : 'closed'}
                      />
                    )}
                  </div>
                  <div className="search-result-stats">
                    {place.rating != null && (
                      <span className="search-result-rating">
                        ★ {place.rating.toFixed(1)}
                        {place.reviewCount != null
                          ? ` · ${formatNumber(place.reviewCount, appLocale)} reviews`
                          : ''}
                      </span>
                    )}
                    {place.distance !== undefined && (
                      <span className="search-result-distance">
                        {place.rating != null ? ' · ' : ''}
                        {formatDistance(place.distance)}
                      </span>
                    )}
                  </div>
                  {themeMatches.length > 0 && (
                    <span className="theme-match-badge">
                      <Icon name={themeMatches[0].icon} size={11} />
                      {t(themeMatches[0].labelKey)}
                    </span>
                  )}
                  {badge && (
                    <span className={`rating-badge ${badge.kind}`}>{badge.label}</span>
                  )}
                  <PlaceReactionBadge reaction={reaction} />
                </div>
                <button
                  type="button"
                  className={`search-pin-btn ${isPinned ? 'pinned' : ''}`}
                  aria-label={isPinned ? t('search.unpin') : t('search.pin')}
                  title={isPinned ? t('search.unpin') : t('search.pin')}
                  onClick={(e) => {
                    e.stopPropagation();
                    onTogglePin(place);
                  }}
                >
                  <Icon name={isPinned ? 'check' : 'pinPlus'} size={28} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {hasMore && onLoadMore && results.length > 0 && (
        <button
          type="button"
          className="load-more-btn"
          disabled={loadingMore}
          onClick={onLoadMore}
        >
          {loadingMore ? t('search.loadingMore') : t('search.loadMore')}
        </button>
      )}

      {results.length > 0 && (
        <button
          type="button"
          className="search-reset-link"
          onClick={() => {
            setSortKey('distance');
            onResetResults();
          }}
          disabled={loading}
        >
          <Icon name="refresh" size={14} /> {t('search.resetResults')}
        </button>
      )}
    </div>
  );
}

function formatDistance(m: number): string {
  if (m < 1000) return `${m}m`;
  return `${(m / 1000).toFixed(1)}km`;
}
