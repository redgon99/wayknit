import { Icon } from '../components/Icon';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type {
  Place,
  PinnedPlace,
  RouteOptions,
  GeneratedRoute,
  Origin,
  SearchScope,
  SearchCategoryFilter,
  SearchRadiusMeters,
  SimpleCategory,
  TripMaterial,
  TripTheme,
  FoodRestriction,
} from '../types';
import { coordsToAddress, loadKakaoSdk, searchPlacesUnified } from '../lib/kakao';
import { loadGoogleMapsSdk, searchPlacesUnifiedWithGoogle } from '../lib/googleMaps';
import {
  inferMapProviderFromLocation,
  resolveMapProvider,
  type MapProvider,
} from '../lib/mapProvider';
import {
  hasSavedMapProviderChoice,
  readMapProviderChoice,
  writeMapProviderChoice,
} from '../lib/mapProviderPreference';
import { getApproximateLocation } from '../lib/geolocation';
import { KAKAO_LEVEL_DEFAULT, KAKAO_LEVEL_PLACE_FOCUS } from '../lib/mapZoom';
import {
  DEFAULT_MAP_CENTER,
  readMapViewport,
  writeMapViewport,
} from '../lib/mapViewport';
import { computeTripCenter } from '../lib/tripGeo';
import { googleMapsLanguage, normalizeLocale, SUPPORTED_LOCALES } from '../lib/locale';
import i18n from '../lib/i18n';
import {
  canCreateTrip,
  canRunGoogleSearch,
  recordGoogleSearch,
  FREE_MAX_TRIPS,
} from '../lib/subscription';
import { UpgradeModal } from '../components/UpgradeModal';
import { enrichPlacesWithStats } from '../lib/placeStats';
import { generateRoute, refineRouteWithRealLegs, haversineMeters } from '../lib/planner';
import { trackEvent } from '../lib/analytics';
import { isHoursProblem } from '../lib/openingHours';
import type { LinkPlacesExtractResult } from '../lib/linkPlaces';
import { consumeShareHandoff } from '../lib/shareTarget';
import { isValidHHMM } from '../lib/timeOfDay';
import { fetchLegs } from '../lib/mobility';
import { resolveOriginForRoute } from '../lib/resolveOrigin';
import { suggestStayMinutes, CATEGORY_MAP } from '../lib/categories';
import { currentBubblePinRect, flyPinToTab } from '../lib/pinFlyAnimation';
import { COMPARE_COLORS, type RouteComparison } from '../lib/routeCompare';
import {
  normalizeTrip,
  DEFAULT_ROUTE_OPTIONS,
  getRouteOptionsForDay,
  patchRouteOptionsForDay,
  copyRouteOptionsFromDay,
} from '../lib/tripRouteOptions';
import {
  tripsRepo,
  createSlug,
  createTripId,
  applyPlazaPublish,
  subscribeTripPins,
  hasCollaborators,
  getPinAuthors,
  pinAuthorKey,
  type Trip,
  type TripSummary,
} from '../lib/trips';
import { logTripActivity } from '../lib/tripActivity';
import type { ShareTripModalSubmit } from '../components/ShareTripModal';
import { ShareTripModal } from '../components/ShareTripModal';
import { CollaboratorsModal } from '../components/CollaboratorsModal';
import { InviteBanner } from '../components/InviteBanner';
import { PlannerAppBar } from '../components/PlannerAppBar';
import { TripSelectMenu } from '../components/TripSelectMenu';
import { ItineraryTableView } from '../components/ItineraryTableView';
import { PlannerSidePanel, type PlannerPanelTab } from '../components/PlannerSidePanel';
import { PanelIconRail } from '../components/PanelIconRail';
import { RouteTimelineDock } from '../components/RouteTimelineDock';
import { useAuth } from '../hooks/useAuth';
import { SearchPanel } from '../components/SearchPanel';
import { PinupBar } from '../components/PinupBar';
import { RouteOptionsPanel } from '../components/RouteOptionsPanel';
import { MapView } from '../components/MapView';
import { Toast } from '../components/Toast';
import { RoadviewModal } from '../components/RoadviewModal';
import { PlacePhotosModal } from '../components/PlacePhotosModal';
import { MapContextMenu } from '../components/MapContextMenu';
import { ManualPinModal } from '../components/ManualPinModal';
import { TripMaterialsPanel } from '../components/TripMaterialsPanel';
import { MobileMoreMenu } from '../components/mobile/MobileMoreMenu';
import { useIsMobile } from '../hooks/useIsMobile';
import { createManualPlace } from '../lib/manualPlace';
import type { PinImportResult } from '../lib/importPins';
import type { SaveStatus } from '../components/SaveStatusBadge';
import { OnboardingCoach } from '../components/OnboardingCoach';
import { ThemePreferenceChips } from '../components/ThemePreferenceChips';
import { TaxiDriverCardModal } from '../components/TaxiDriverCardModal';
import { ThemeScenarioPanel } from '../components/ThemeScenarioPanel';
import { AppSheetModal } from '../components/AppSheetModal';
import { isTourScenarioConfigured } from '../lib/tourScenario';
import { shouldShowOnboarding, isPlazaNavUnlocked, unlockPlazaNav } from '../lib/onboarding';
import { TRIP_THEMES } from '../lib/themes';
import { splitSearchQueries } from '../lib/searchQueries';
import { filterPlacesBySubFilters, type SearchSubFilterId } from '../lib/searchSubFilters';
import { isTourApiConfigured, searchTourPlaces, searchTourPlacesNearby } from '../lib/tourApi';
import { isTourFestivalConfigured, searchTourFestivals } from '../lib/tourFestival';
import { regionPrefixOf } from '../lib/koreaAreaCodes';
import '../styles/app.css';

type MobileSheetLevel = 'peek' | 'half' | 'full';
type MobileSheetTab = 'pins' | 'route' | 'search';

interface PendingManualPin {
  lat: number;
  lng: number;
  address: string;
}

const DEFAULT_CENTER = DEFAULT_MAP_CENTER;

/**
 * 모바일 "이 지역 검색" 버튼이 나타나는 지도 이동 거리(m).
 * 손가락이 살짝 스친 정도로는 뜨지 않을 만큼, 동네를 옮긴 건 잡아낼 만큼.
 */
const SEARCH_AGAIN_MIN_SHIFT_M = 250;

function centerFromTrip(trip: Pick<Trip, 'pinnedByDay' | 'currentDay' | 'plazaCenterLat' | 'plazaCenterLng'>): {
  lat: number;
  lng: number;
} | null {
  const dayPins = trip.pinnedByDay?.[trip.currentDay] ?? [];
  if (dayPins.length > 0) {
    let sumLat = 0;
    let sumLng = 0;
    let n = 0;
    for (const p of dayPins) {
      if (typeof p.lat === 'number' && typeof p.lng === 'number') {
        sumLat += p.lat;
        sumLng += p.lng;
        n++;
      }
    }
    if (n > 0) return { lat: sumLat / n, lng: sumLng / n };
  }
  const all = computeTripCenter(trip);
  if (all) return all;
  if (
    typeof trip.plazaCenterLat === 'number' &&
    typeof trip.plazaCenterLng === 'number'
  ) {
    return { lat: trip.plazaCenterLat, lng: trip.plazaCenterLng };
  }
  return null;
}

function defaultNewTripTitles(): Set<string> {
  return new Set(
    SUPPORTED_LOCALES.map((lng) => i18n.t('trip.newTrip', { ns: 'planner', lng }))
  );
}

function makeEmptyTrip(): Trip {
  return normalizeTrip({
    id: createTripId(),
    slug: createSlug(),
    title: i18n.t('trip.newTrip', { ns: 'planner' }),
    totalDays: 1,
    currentDay: 1,
    pinnedByDay: { 1: [] },
    routeOptionsByDay: { 1: { ...DEFAULT_ROUTE_OPTIONS } },
    generatedRouteByDay: {},
    materials: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}

/** 착수 게이트용 — 만들어진 일정이 시간 제약을 지키는지 남긴다 */
function reportRouteMetrics(route: GeneratedRoute) {
  const anchorConflicts = route.stops.filter((s) => s.timingConflict).length;
  const hoursConflicts = route.stops.filter((s) => isHoursProblem(s.hoursStatus)).length;
  trackEvent('route_generated', {
    stops: route.stops.length,
    travelMode: route.options.travelMode,
    autoOrder: route.options.autoOrder,
  });
  if (anchorConflicts + hoursConflicts > 0) {
    trackEvent('route_conflict', { anchorConflicts, hoursConflicts });
  }
}

export default function PlannerPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    user,
    configured: authConfigured,
    plan,
    isAdmin,
    refreshProfile,
    loading: authLoading,
  } = useAuth();
  const { t: tc } = useTranslation('common');
  const { t: tp, i18n: plannerI18n } = useTranslation('planner');
  const { t: tb } = useTranslation('billing');
  const { t: ts } = useTranslation('share');

  useEffect(() => {
    document.title = tp('chrome.appTitle');
  }, [tp, plannerI18n.language]);

  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [scenarioOpen, setScenarioOpen] = useState(false);
  const [kakaoReady, setKakaoReady] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const [trip, setTrip] = useState<Trip>(() => makeEmptyTrip());
  const [tripSummaries, setTripSummaries] = useState<TripSummary[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    const localized = tp('trip.newTrip');
    setTrip((prev) =>
      defaultNewTripTitles().has(prev.title) && prev.title !== localized
        ? { ...prev, title: localized }
        : prev
    );
  }, [hydrated, tp, plannerI18n.language]);

  const [savePending, setSavePending] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [collabModalOpen, setCollabModalOpen] = useState(false);
  const [shareSaving, setShareSaving] = useState(false);
  const [plazaNavVisible, setPlazaNavVisible] = useState(() => isPlazaNavUnlocked());

  // 검색 상태
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchingFestivals, setSearchingFestivals] = useState(false);
  const [searchEmpty, setSearchEmpty] = useState(false);
  const [searchScope, setSearchScope] = useState<SearchScope>('nationwide');
  const [categoryFilter, setCategoryFilter] = useState<SearchCategoryFilter>(null);
  const [categorySubFilters, setCategorySubFilters] = useState<SearchSubFilterId[]>([]);
  const [searchRadius, setSearchRadius] = useState<SearchRadiusMeters>(5000);
  const [fitSearchBounds, setFitSearchBounds] = useState(false);
  const [searchPage, setSearchPage] = useState(1);
  const [searchHasMore, setSearchHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [enrichingStats, setEnrichingStats] = useState(false);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [roadviewTarget, setRoadviewTarget] = useState<Place | null>(null);
  const [photosTarget, setPhotosTarget] = useState<Place | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  // /share 에서 넘어온 링크 추출 결과 — 검색 패널이 붙여넣기 흐름처럼 이어받는다
  const [sharedExtract, setSharedExtract] = useState<LinkPlacesExtractResult | null>(null);

  useEffect(() => {
    setSharedExtract(consumeShareHandoff());
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2800);
  }

  // 경로 옵션 패널
  const [routeOptionsOpen, setRouteOptionsOpen] = useState(false);
  const [materialsPanelOpen, setMaterialsPanelOpen] = useState(false);
  const [presentationMode, setPresentationMode] = useState(false);
  const [tableViewMode, setTableViewMode] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [panelTab, setPanelTab] = useState<PlannerPanelTab>('search');
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [pickingOriginFromMap, setPickingOriginFromMap] = useState(false);
  const [pickingPinFromMap, setPickingPinFromMap] = useState(false);
  const [pendingManualPin, setPendingManualPin] = useState<PendingManualPin | null>(null);
  const [refining, setRefining] = useState(false);
  // 최적화 3종 비교 경로 — 동선 패널이 받아와 지도에 겹쳐 그린다
  const [compareRoutes, setCompareRoutes] = useState<RouteComparison[]>([]);
  const isMobile = useIsMobile();
  const [mobileSheetLevel, setMobileSheetLevel] = useState<MobileSheetLevel>('half');
  const [mobileSheetTab, setMobileSheetTab] = useState<MobileSheetTab>('pins');
  const [selectedPinIds, setSelectedPinIds] = useState<Set<string>>(() => new Set());
  const [mustVisitOnly, setMustVisitOnly] = useState(false);
  const [taxiCardPlace, setTaxiCardPlace] = useState<Place | null>(null);

  // 지도 중심 · 지도/검색 앱
  const [mapCenter, setMapCenter] = useState(
    () => readMapViewport()?.center ?? DEFAULT_CENTER
  );
  const [mapLevel, setMapLevel] = useState(
    () => readMapViewport()?.level ?? KAKAO_LEVEL_DEFAULT
  );
  // 같은 레벨을 다시 지정해도 지도에 반영되도록 하는 신호
  const [mapLevelTick, setMapLevelTick] = useState(0);
  const [mapType, setMapType] = useState<'roadmap' | 'satellite'>('roadmap');
  const [mapProviderBooting, setMapProviderBooting] = useState(
    () => !hasSavedMapProviderChoice()
  );
  const [mapProviderChoice, setMapProviderChoice] = useState<MapProvider>(() =>
    readMapProviderChoice()
  );
  const mapProvider = useMemo(
    () => resolveMapProvider(mapCenter, mapProviderChoice),
    [mapCenter, mapProviderChoice]
  );
  const searchReady = mapProvider === 'google' ? googleReady : kakaoReady;
  const mapCenterRef = useRef(mapCenter);
  mapCenterRef.current = mapCenter;
  const mapLevelRef = useRef(mapLevel);
  mapLevelRef.current = mapLevel;

  const focusMapOnTrip = useCallback(
    (nextTrip: Trip, persist = true) => {
      const center = centerFromTrip(nextTrip);
      if (!center) return;
      mapCenterRef.current = center;
      setMapCenter(center);
      if (persist) writeMapViewport(center, mapLevelRef.current);
    },
    []
  );
  const [nearbySearchCenter, setNearbySearchCenter] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const nearbySearchCenterRef = useRef(nearbySearchCenter);
  nearbySearchCenterRef.current = nearbySearchCenter;
  /**
   * 모바일 "이 지역 검색" 노출 여부.
   *
   * 기준점은 마지막으로 검색한 중심이고, 아직 주변 검색을 한 적이 없으면
   * 지도를 처음 본 위치가 기준이 된다. 그만큼 벗어나야 버튼이 나타난다 —
   * 상시 노출은 좁은 화면에서 지도를 계속 가린다.
   */
  const searchAnchorRef = useRef<{ lat: number; lng: number } | null>(null);
  const [mapMovedFromAnchor, setMapMovedFromAnchor] = useState(false);
  const [mapPinCategoryFilter, setMapPinCategoryFilter] = useState<SimpleCategory | null>(
    null
  );
  const [infoWindowPlace, setInfoWindowPlace] = useState<Place | null>(null);
  const [mapContextMenu, setMapContextMenu] = useState<{
    x: number;
    y: number;
    lat: number;
    lng: number;
  } | null>(null);

  // 현재 일차의 핀업/경로
  const currentDay = trip.currentDay;
  const pinned = useMemo(
    () => trip.pinnedByDay[currentDay] ?? [],
    [trip.pinnedByDay, currentDay]
  );

  const mapPins = useMemo(
    () => (mustVisitOnly ? pinned.filter((p) => p.required) : pinned),
    [pinned, mustVisitOnly]
  );

  const routePins = useMemo(() => {
    if (selectedPinIds.size === 0) return pinned;
    return pinned.filter((p) => selectedPinIds.has(p.id));
  }, [pinned, selectedPinIds]);

  useEffect(() => {
    setSelectedPinIds((prev) => {
      const valid = new Set(pinned.map((p) => p.id));
      const next = new Set([...prev].filter((id) => valid.has(id)));
      if (next.size === prev.size) return prev;
      return next;
    });
  }, [pinned]);

  const pinSelectionActive = selectedPinIds.size > 0;

  useEffect(() => {
    if (!pinSelectionActive) return;
    setInfoWindowPlace((prev) => {
      if (!prev || selectedPinIds.has(prev.id)) return prev;
      /* 핀 선택에서 빠진 "핀"의 말풍선만 닫는다. 검색 결과 말풍선까지 닫으면
       * 핀 탭 체크가 남아 있는 동안 검색 결과를 눌러도 아무 반응이 없다. */
      if (!pinned.some((p) => p.id === prev.id)) return prev;
      return null;
    });
  }, [pinSelectionActive, selectedPinIds, pinned]);
  const generatedRoute = trip.generatedRouteByDay[currentDay] ?? null;
  const routeOptions = useMemo(
    () => getRouteOptionsForDay(trip, currentDay),
    [trip, currentDay]
  );

  // ============== SDK 로드 ==============
  useEffect(() => {
    const key = import.meta.env.VITE_KAKAO_JS_KEY;
    if (!key) {
      console.error('VITE_KAKAO_JS_KEY 환경 변수가 필요합니다');
      return;
    }
    loadKakaoSdk(key)
      .then(() => setKakaoReady(true))
      .catch((e) => console.error('Kakao SDK load failed', e));
  }, []);

  useEffect(() => {
    if (mapProvider !== 'google') return;
    const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!key) return;
    const lang = googleMapsLanguage(normalizeLocale(i18n.language));
    setGoogleReady(false);
    loadGoogleMapsSdk(key, lang)
      .then(() => setGoogleReady(true))
      .catch((e) => console.error('Google Maps SDK load failed', e));
  }, [mapProvider, i18n.language]);

  // 저장된 지도 선택이 없으면 시작 시 위치로 카카오/구글 자동 선택
  // 이미 저장된 뷰포트가 있으면 지도 중심은 덮어쓰지 않음
  useEffect(() => {
    if (!mapProviderBooting) return;
    let cancelled = false;
    void (async () => {
      const pos = await getApproximateLocation();
      if (cancelled) return;
      if (pos) {
        if (!readMapViewport()) {
          setMapCenter(pos);
          writeMapViewport(pos, mapLevelRef.current);
        }
        setMapProviderChoice(inferMapProviderFromLocation(pos));
      }
      setMapProviderBooting(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [mapProviderBooting]);

  useEffect(() => {
    const theme = new URLSearchParams(location.search).get('theme');
    if (!theme) return;
    if (!TRIP_THEMES.some((t) => t.id === theme)) return;
    setTrip((prev) => ({
      ...prev,
      preferences: [theme as TripTheme],
      updatedAt: Date.now(),
    }));
  }, [location.search]);

  // 가이드「추천 여행코스」→ 자동 동선 옵션 패널 연동
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('autoRoute') !== '1') return;
    const guideTitle = params.get('guideTitle')?.trim();
    setMaterialsPanelOpen(false);
    setTrip((prev) => {
      const opts = {
        ...getRouteOptionsForDay(prev, prev.currentDay ?? 1),
        autoOrder: true,
      };
      const withOpts = patchRouteOptionsForDay(prev, prev.currentDay ?? 1, opts);
      if (!guideTitle) return withOpts;
      return {
        ...withOpts,
        title: guideTitle.slice(0, 80),
        updatedAt: Date.now(),
      };
    });
    setRouteOptionsOpen(true);
    setPanelTab('route');
    setPanelOpen(true);
    showToast(
      guideTitle
        ? i18n.t('toast.guideRouteHint', { ns: 'planner', title: guideTitle })
        : i18n.t('toast.autoRouteHint', { ns: 'planner' })
    );
  }, [location.search]);

  // 랜딩페이지「AI 시나리오」소개 → 시나리오 탭 자동 오픈
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('openScenario') !== '1') return;
    setPanelTab('scenario');
    setPanelOpen(true);
  }, [location.search]);

  const refreshTripList = useCallback(async (userId: string | null) => {
    const list = await tripsRepo.list(userId);
    setTripSummaries(list);
  }, []);

  // ============== 저장된 Trip 로드 ==============
  useEffect(() => {
    /* authLoading이 끝나기 전엔 user가 아직 null일 수 있다(세션 복구가 비동기라서).
     * 이 시점에 로그인 사용자를 게스트로 오판해 로컬에 "새 여행"을 만들어버리면,
     * hydrated가 true로 고정돼 이후 user.id가 확정돼도 다시 로드하지 않고,
     * 새로고침마다 같은 경쟁 조건이 반복되며 "새 여행"이 매번 쌓이는 문제가 생긴다. */
    if (hydrated || authLoading) return;
    (async () => {
      const userId = user?.id ?? null;
      await refreshTripList(userId);
      const loaded = await tripsRepo.load(userId);
      if (loaded) {
        const next = normalizeTrip({
          ...makeEmptyTrip(),
          ...loaded,
          pinnedByDay: loaded.pinnedByDay ?? { 1: [] },
          generatedRouteByDay: loaded.generatedRouteByDay ?? {},
        });
        setTrip(next);
        focusMapOnTrip(next);
      } else {
        const fresh = makeEmptyTrip();
        setTrip(fresh);
        try {
          await tripsRepo.save({ ...fresh, ownerId: userId ?? undefined });
        } catch (e) {
          /* 클라우드 저장이 실패해도 로컬에는 이미 저장됐다(tripsRepo.save 내부 순서상
           * writeLocal이 writeRemote보다 먼저 실행됨). 여기서 그대로 던지면 hydrated가
           * true로 세팅되지 못해, 다음 리렌더/새로고침마다 이 분기가 다시 실행되며
           * 매번 새로운 "새 여행"을 만들어내는 문제가 생긴다. */
          console.warn('새 여행 클라우드 저장 실패(로컬에는 저장됨)', e);
        }
        await refreshTripList(userId);
      }
      setLastSavedAt(loaded?.updatedAt ?? Date.now());
      setHydrated(true);
    })();
  }, [user?.id, hydrated, authLoading, refreshTripList, focusMapOnTrip]);

  const pendingOpenTripId = (location.state as { openTripId?: string } | null)?.openTripId;

  useEffect(() => {
    if (!hydrated || !pendingOpenTripId) return;
    const tripId = pendingOpenTripId;
    navigate(location.pathname, { replace: true, state: {} });

    (async () => {
      const userId = user?.id ?? null;
      const loaded = await tripsRepo.load(userId, tripId);
      if (loaded) {
        const next = normalizeTrip({
          ...makeEmptyTrip(),
          ...loaded,
          pinnedByDay: loaded.pinnedByDay ?? { 1: [] },
          generatedRouteByDay: loaded.generatedRouteByDay ?? {},
        });
        setTrip(next);
        focusMapOnTrip(next);
        setLastSavedAt(loaded.updatedAt);
        await refreshTripList(userId);
        showToast(i18n.t('toast.importedTrip', { ns: 'planner', title: loaded.title }));
      }
    })();
  }, [hydrated, pendingOpenTripId, user?.id, navigate, location.pathname, refreshTripList, focusMapOnTrip]);

  const prevUserIdRef = useRef<string | null>(null);
  const authInitializedRef = useRef(false);
  useEffect(() => {
    if (!hydrated) return;
    const userId = user?.id ?? null;

    if (!authInitializedRef.current) {
      authInitializedRef.current = true;
      prevUserIdRef.current = userId;
      return;
    }
    if (prevUserIdRef.current === userId) return;
    const prev = prevUserIdRef.current;
    prevUserIdRef.current = userId;

    (async () => {
      await refreshTripList(userId);
      const loaded = await tripsRepo.load(userId);
      if (loaded) {
        const next = normalizeTrip({
          ...makeEmptyTrip(),
          ...loaded,
          pinnedByDay: loaded.pinnedByDay ?? { 1: [] },
          generatedRouteByDay: loaded.generatedRouteByDay ?? {},
        });
        setTrip(next);
        focusMapOnTrip(next);
        setLastSavedAt(loaded.updatedAt);
      } else if (userId && !prev) {
        setTrip((prevTrip) => ({
          ...prevTrip,
          ownerId: prevTrip.ownerId ?? userId,
          updatedAt: Date.now(),
        }));
      }
      if (userId && !prev) {
        showToast(i18n.t('toast.cloudSynced', { ns: 'planner' }));
      }
    })();
  }, [user?.id, hydrated, refreshTripList, focusMapOnTrip]);

  // ============== Trip 변경 자동 저장 (디바운스) ==============
  const saveTimerRef = useRef<number | null>(null);
  useEffect(() => {
    if (!hydrated) return;
    setSavePending(true);
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(async () => {
      if (trip.collaboratorRole === 'viewer') {
        setSavePending(false);
        return;
      }
      const userId = user?.id ?? null;
      await tripsRepo.save({
        ...trip,
        // 협업자가 저장해도 원래 소유자를 절대 덮어쓰지 않는다 —
        // trip에 이미 ownerId가 있으면 그대로 두고, 없을 때(새 여행)만 나로 채운다.
        ownerId: trip.ownerId ?? userId ?? undefined,
        updatedAt: Date.now(),
      });
      await refreshTripList(userId);
      setLastSavedAt(Date.now());
      setSavePending(false);
    }, 700);
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [trip, user?.id, hydrated, refreshTripList]);

  // ============== 협업자 변경 실시간 반영 ==============
  // 화면 상태를 ref로 넘긴다 — 구독을 매 렌더 다시 걸지 않으면서도
  // 병합 시점에는 항상 최신 핀 목록을 봐야 한다.
  const pinnedRef = useRef(trip.pinnedByDay);
  pinnedRef.current = trip.pinnedByDay;
  useEffect(() => {
    if (!hydrated || !trip.id || !trip.ownerId) return;
    return subscribeTripPins(
      trip.id,
      () => pinnedRef.current,
      (merged) => {
        // 병합 결과만 갈아끼운다. updatedAt은 건드리지 않는다 —
        // 여기서 갱신하면 자동저장 이펙트가 깨어나 저장 루프가 돈다.
        setTrip((prev) => ({ ...prev, pinnedByDay: merged }));
      }
    );
  }, [trip.id, trip.ownerId, hydrated]);

  /**
   * 핀 작성자 — 핀 목록이 갱신되는 시점마다 다시 읽는다.
   * readPinsRemote 가 핀과 같은 응답에서 채우므로 두 값이 어긋나지 않는다.
   */
  const [pinAuthors, setPinAuthors] = useState<Record<string, string | null>>({});
  useEffect(() => {
    setPinAuthors(getPinAuthors(trip.id));
  }, [trip.id, trip.pinnedByDay]);

  // ============== Trip 업데이트 헬퍼 ==============
  function patchTrip(next: Partial<Trip>) {
    setTrip((prev) => ({ ...prev, ...next, updatedAt: Date.now() }));
  }
  function setPinnedForDay(day: number, list: PinnedPlace[]) {
    setTrip((prev) => ({
      ...prev,
      pinnedByDay: { ...prev.pinnedByDay, [day]: list },
      updatedAt: Date.now(),
    }));
  }
  function setRouteForDay(day: number, route: GeneratedRoute | null) {
    setTrip((prev) => ({
      ...prev,
      generatedRouteByDay: { ...prev.generatedRouteByDay, [day]: route },
      updatedAt: Date.now(),
    }));
  }

  type SearchRunOverrides = {
    scope?: SearchScope;
    category?: SearchCategoryFilter;
    radius?: SearchRadiusMeters;
    center?: { lat: number; lng: number };
    query?: string;
    /** true면 검색 후 지도 중심·bounds를 바꾸지 않음 (지정 지점 주변 검색용) */
    keepMapCenter?: boolean;
  };

  /** 지도 주변 검색 중심 — 한 번 정해지면 수동·옵션 변경 전까지 유지 */
  const ensureNearbySearchCenter = useCallback((): { lat: number; lng: number } => {
    if (nearbySearchCenterRef.current) return nearbySearchCenterRef.current;
    const init = mapCenterRef.current;
    nearbySearchCenterRef.current = init;
    setNearbySearchCenter(init);
    return init;
  }, []);

  const getSearchCenter = useCallback(
    (scope: SearchScope, override?: { lat: number; lng: number }) => {
      if (scope !== 'nearby') return mapCenter;
      if (override) return override;
      if (nearbySearchCenter) return nearbySearchCenter;
      return ensureNearbySearchCenter();
    },
    [mapCenter, nearbySearchCenter, ensureNearbySearchCenter]
  );

  const openSearchPanel = useCallback(() => {
    setPanelOpen(true);
    setPanelTab('search');
    // 모바일: 결과를 보여줄 때는 지도가 같이 보여야 하므로 half로 연다.
    // 이미 full로 펼쳐 놓고 검색한 경우라면 그 높이를 존중한다.
    setMobileSheetTab('search');
    setMobileSheetLevel((prev) => (prev === 'full' ? 'full' : 'half'));
  }, []);

  const runSearch = useCallback(
    async (page: number, append: boolean, overrides?: SearchRunOverrides) => {
      const scope = overrides?.scope ?? searchScope;
      const category =
        overrides?.category !== undefined ? overrides.category : categoryFilter;
      const radius = overrides?.radius ?? searchRadius;
      const searchCenter = getSearchCenter(scope, overrides?.center);
      const keyword = (overrides?.query ?? query).trim();
      const keepMapCenter = overrides?.keepMapCenter === true;
      const batchQueries = keyword ? splitSearchQueries(keyword) : [];
      const isBatchSearch = batchQueries.length > 1 && !append && page === 1;
      /** 키워드·카테고리 없이 지도 주변만 볼 때: 주요 카테고리 병합 검색 */
      const browseNearby =
        scope === 'nearby' && !keyword && !category && !append && page === 1;
      const canSearch =
        Boolean(keyword) ||
        (scope === 'nearby' && Boolean(category)) ||
        browseNearby;
      const providerReady =
        mapProvider === 'google' ? googleReady : kakaoReady;
      if (!providerReady || !canSearch) return;

      if (mapProvider === 'google' && !canRunGoogleSearch(plan, isAdmin)) {
        showToast(tb('limits.searchCap'));
        setUpgradeOpen(true);
        return;
      }

      if (append) setLoadingMore(true);
      else {
        setSearching(true);
        setSearchEmpty(false);
        setSearchError(null);
        setFitSearchBounds(false);
        setSelectedPlaceId(null);
      }
      try {
        if (browseNearby) {
          const browseCodes = ['FD6', 'AT4', 'AD5', 'MT1'] as const;
          const merged: Place[] = [];
          const seen = new Set<string>();
          for (const code of browseCodes) {
            const { places } =
              mapProvider === 'google'
                ? await searchPlacesUnifiedWithGoogle({
                    categoryGroupCode: code,
                    scope: 'nearby',
                    center: searchCenter,
                    radiusMeters: radius,
                    size: 8,
                    page: 1,
                  })
                : await searchPlacesUnified({
                    categoryGroupCode: code,
                    scope: 'nearby',
                    center: searchCenter,
                    radiusMeters: radius,
                    size: 8,
                    page: 1,
                  });
            for (const place of places) {
              if (seen.has(place.id)) continue;
              seen.add(place.id);
              merged.push({
                ...place,
                distance: Math.round(haversineMeters(searchCenter, place)),
              });
            }
          }
          if (mapProvider === 'google') recordGoogleSearch(plan, isAdmin);
          if (isTourApiConfigured()) {
            const tourNearby = await searchTourPlacesNearby(searchCenter, radius);
            for (const place of tourNearby) {
              if (seen.has(place.id)) continue;
              seen.add(place.id);
              merged.push({
                ...place,
                distance: Math.round(haversineMeters(searchCenter, place)),
              });
            }
          }
          merged.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
          const clipped = merged.slice(0, 24);
          setResults(clipped);
          setSearchPage(1);
          setSearchHasMore(false);
          setSearchEmpty(clipped.length === 0);
          if (!keepMapCenter) {
            /* 지도 주변 둘러보기는 반경 내 흩어진 결과 전체를 bounds-fit하면
             * 실제 기준점(현재위치·지도중심)에서 먼 결과 하나 때문에 지도가
             * 엉뚱하게 축소·이동해 보일 수 있다. 기준점 중심을 유지하고,
             * 축척이 너무 축소돼 있을 때만 기본 레벨로 확대한다. */
            setMapCenter(searchCenter);
            if (mapLevelRef.current > KAKAO_LEVEL_DEFAULT) {
              setMapLevel(KAKAO_LEVEL_DEFAULT);
            }
          }
          if (clipped.length > 0 && mapProvider === 'kakao') {
            setEnrichingStats(true);
            void enrichPlacesWithStats(clipped)
              .then(setResults)
              .finally(() => setEnrichingStats(false));
          }
          return;
        }

        if (isBatchSearch) {
          const merged: Place[] = [];
          const seen = new Set<string>();
          for (const q of batchQueries) {
            const { places } =
              mapProvider === 'google'
                ? await searchPlacesUnifiedWithGoogle({
                    keyword: q,
                    categoryGroupCode: category,
                    scope,
                    center: scope === 'nearby' ? searchCenter : undefined,
                    radiusMeters: scope === 'nearby' ? radius : undefined,
                    size: 10,
                    page: 1,
                  })
                : await searchPlacesUnified({
                    keyword: q,
                    categoryGroupCode: category,
                    scope,
                    center: scope === 'nearby' ? searchCenter : undefined,
                    radiusMeters: scope === 'nearby' ? radius : undefined,
                    size: 10,
                    page: 1,
                  });
            for (const place of places) {
              if (seen.has(place.id)) continue;
              seen.add(place.id);
              merged.push({
                ...place,
                distance: Math.round(haversineMeters(searchCenter, place)),
              });
            }
          }
          if (mapProvider === 'google') recordGoogleSearch(plan, isAdmin);
          setResults(merged);
          setSearchPage(1);
          setSearchHasMore(false);
          setSearchEmpty(merged.length === 0);
          if (!keepMapCenter) {
            if (merged.length === 1) {
              setMapCenter({ lat: merged[0].lat, lng: merged[0].lng });
            } else if (merged.length > 1) {
              setFitSearchBounds(true);
            }
          }
          if (merged.length > 0) {
            showToast(tp('search.batchDone', { count: batchQueries.length, results: merged.length }));
          }
          if (merged.length > 0 && mapProvider === 'kakao') {
            setEnrichingStats(true);
            void enrichPlacesWithStats(merged)
              .then(setResults)
              .finally(() => setEnrichingStats(false));
          }
          return;
        }

        const { places, hasMore } =
          mapProvider === 'google'
            ? await searchPlacesUnifiedWithGoogle({
                keyword: keyword || undefined,
                categoryGroupCode: category,
                scope,
                center: scope === 'nearby' ? searchCenter : undefined,
                radiusMeters: scope === 'nearby' ? radius : undefined,
                size: 15,
                page,
              })
            : await searchPlacesUnified({
                keyword: keyword || undefined,
                categoryGroupCode: category,
                scope,
                center: scope === 'nearby' ? searchCenter : undefined,
                radiusMeters: scope === 'nearby' ? radius : undefined,
                size: 15,
                page,
              });
        const withDistance = places.map((place) => ({
          ...place,
          distance: Math.round(haversineMeters(searchCenter, place)),
        }));
        setResults((prev) => (append ? [...prev, ...withDistance] : withDistance));
        if (mapProvider === 'google') recordGoogleSearch(plan, isAdmin);
        setSearchPage(page);
        setSearchHasMore(hasMore);
        if (!append) {
          setSearchEmpty(withDistance.length === 0);
          if (!keepMapCenter) {
            if (withDistance.length === 1) {
              setMapCenter({ lat: withDistance[0].lat, lng: withDistance[0].lng });
            } else if (withDistance.length > 1) {
              setFitSearchBounds(true);
            }
          }
        }
        if (withDistance.length > 0 && mapProvider === 'kakao') {
          setEnrichingStats(true);
          void enrichPlacesWithStats(withDistance).then((enriched) => {
            setResults((prev) => {
              if (append) {
                const byId = new Map(enriched.map((p) => [p.id, p]));
                return prev.map((p) => byId.get(p.id) ?? p);
              }
              return enriched;
            });
          }).finally(() => setEnrichingStats(false));
        }
        if (keyword && isTourApiConfigured()) {
          const tourPlaces = await searchTourPlaces(keyword);
          if (tourPlaces.length > 0) {
            setResults((prev) => {
              const seen = new Set(prev.map((p) => p.id));
              const extra = tourPlaces
                .filter((p) => !seen.has(p.id))
                .map((p) => ({
                  ...p,
                  distance: Math.round(haversineMeters(searchCenter, p)),
                }));
              return extra.length ? [...prev, ...extra] : prev;
            });
            if (!keepMapCenter) setFitSearchBounds(true);
          }
        }
      } catch (e) {
        console.error(e);
        if (!append) {
          setResults([]);
          setSearchEmpty(true);
        }
        setSearchError(i18n.t('toast.searchError', { ns: 'planner' }));
      } finally {
        setSearching(false);
        setLoadingMore(false);
      }
    },
    [
      mapProvider,
      googleReady,
      kakaoReady,
      query,
      getSearchCenter,
      searchScope,
      categoryFilter,
      searchRadius,
      plan,
      isAdmin,
      tb,
      showToast,
      tp,
    ]
  );

  const handleSearch = useCallback(() => {
    if (query.trim()) {
      setCategoryFilter(null);
      setSearchScope('nationwide');
      void runSearch(1, false, { category: null, scope: 'nationwide' });
      return;
    }
    void runSearch(1, false);
  }, [runSearch, query]);

  const handleSearchCandidate = useCallback((candidate: string) => {
    setQuery(candidate);
    setCategoryFilter(null);
    setSearchScope('nationwide');
    void runSearch(1, false, {
      category: null,
      query: candidate,
      scope: 'nationwide',
    });
  }, [runSearch]);

  // 한국여행정보(관광사진 등)「이 장소 검색하기」→ 동선짜기 검색창에 자동 입력·실행
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const keyword = params.get('searchKeyword')?.trim();
    if (!keyword || !searchReady) return;
    navigate(location.pathname, { replace: true, state: location.state ?? {} });
    openSearchPanel();
    handleSearchCandidate(keyword);
  }, [
    location.search,
    location.pathname,
    location.state,
    searchReady,
    navigate,
    openSearchPanel,
    handleSearchCandidate,
  ]);

  const handleLoadMore = useCallback(() => {
    if (!searchHasMore || loadingMore) return;
    void runSearch(searchPage + 1, true);
  }, [searchHasMore, loadingMore, searchPage, runSearch]);

  const handleSearchScopeChange = useCallback(
    (scope: SearchScope) => {
      setSearchScope(scope);
      const canSearch =
        query.trim() || (scope === 'nearby' && categoryFilter);
      if (canSearch && searchReady) {
        const center = scope === 'nearby' ? ensureNearbySearchCenter() : undefined;
        void runSearch(1, false, {
          scope,
          ...(center ? { center } : {}),
        });
      }
    },
    [query, searchReady, runSearch, categoryFilter, ensureNearbySearchCenter]
  );

  const handleMapProviderChange = useCallback(
    (provider: MapProvider) => {
      if (provider === mapProviderChoice) return;
      setMapProviderChoice(provider);
      writeMapProviderChoice(provider);
      setResults([]);
      setSearchEmpty(false);
      setSearchError(null);
      setSelectedPlaceId(null);
      setSearchPage(1);
      setSearchHasMore(false);
      showToast(
        provider === 'google'
          ? tc('mapProvider.switchedGoogle')
          : tc('mapProvider.switchedKakao')
      );
    },
    [mapProviderChoice, tc]
  );

  const handleMapCenterChange = useCallback((lat: number, lng: number) => {
    const next = { lat, lng };
    mapCenterRef.current = next;
    setMapCenter(next);
    writeMapViewport(next, mapLevelRef.current);
    // 첫 보고는 기준점 등록으로만 쓴다 — 아직 아무것도 안 움직였다
    if (!searchAnchorRef.current) {
      searchAnchorRef.current = next;
      return;
    }
    setMapMovedFromAnchor(
      haversineMeters(searchAnchorRef.current, next) > SEARCH_AGAIN_MIN_SHIFT_M
    );
  }, []);

  const handleMapLevelChange = useCallback((level: number) => {
    mapLevelRef.current = level;
    setMapLevel(level);
    writeMapViewport(mapCenterRef.current, level);
  }, []);

  const handleCategoryFilterChange = useCallback(
    (code: SearchCategoryFilter) => {
      setCategoryFilter(code);
      setCategorySubFilters([]);

      if (code !== null) {
        setSearchScope('nearby');
        const center = ensureNearbySearchCenter();
        if (searchReady) {
          void runSearch(1, false, {
            scope: 'nearby',
            category: code,
            center,
          });
        }
        return;
      }

      const canSearch = Boolean(query.trim());
      if (canSearch && searchReady) {
        void runSearch(1, false, { category: null });
      }
    },
    [query, searchReady, runSearch, ensureNearbySearchCenter]
  );

  const handleSearchRadiusChange = useCallback(
    (radius: SearchRadiusMeters) => {
      setSearchRadius(radius);
      const canSearch =
        query.trim() || (searchScope === 'nearby' && categoryFilter);
      if (canSearch && searchReady && searchScope === 'nearby') {
        void runSearch(1, false, { radius });
      }
    },
    [query, searchScope, categoryFilter, searchReady, runSearch]
  );

  const handleResetSearch = useCallback(() => {
    setQuery('');
    setResults([]);
    setSearchEmpty(false);
    setSearchError(null);
    setSearchHasMore(false);
    setFitSearchBounds(false);
    setSelectedPlaceId(null);
    setCategoryFilter(null);
    setSearchRadius(5000);
    setEnrichingStats(false);
  }, []);

  /* 다른 장소를 고르면 앞서 열어둔 상세는 닫는다. 목록에서 고른 곳과 옆에
   * 붙은 상세가 서로 다른 장소를 가리키면 지금 보는 곳이 어디인지 알 수 없다. */
  const closeStalePlaceDetail = useCallback((nextId: string) => {
    setPhotosTarget((prev) => (prev && prev.id !== nextId ? null : prev));
  }, []);

  const handleSelectPlace = useCallback(
    (place: Place) => {
      setSelectedPlaceId(place.id);
      setFitSearchBounds(false);
      setMapCenter({ lat: place.lat, lng: place.lng });
      setInfoWindowPlace(place);
      closeStalePlaceDetail(place.id);
    },
    [closeStalePlaceDetail]
  );

  /** 지도 검색 핀 호버 — 결과 칩만 선택 (지도 이동·말풍선 없음) */
  const handleHoverSearchPlace = useCallback((place: Place) => {
    setSelectedPlaceId((prev) => (prev === place.id ? prev : place.id));
  }, []);

  const handlePinnedMarkerClick = useCallback(
    (place: Place) => {
      setSelectedPlaceId(place.id);
      setMapCenter({ lat: place.lat, lng: place.lng });
      setInfoWindowPlace(place);
      closeStalePlaceDetail(place.id);
    },
    [closeStalePlaceDetail]
  );

  const handleCloseInfoWindow = useCallback(() => {
    setInfoWindowPlace(null);
  }, []);

  const handleToggleMapCategoryFilter = useCallback((category: SimpleCategory) => {
    setMapPinCategoryFilter((prev) => (prev === category ? null : category));
  }, []);

  const handleMapRightClick = useCallback(
    (lat: number, lng: number, clientX: number, clientY: number) => {
      setMapContextMenu({ lat, lng, x: clientX, y: clientY });
    },
    []
  );

  /**
   * 주어진 좌표를 검색 중심으로 삼아 주변 검색을 실행한다.
   *
   * 데스크톱은 우클릭 메뉴에서, 모바일은 "이 지역 검색" 버튼에서 부른다 —
   * 진입 제스처만 다르고 이후 동작은 같아야 하므로 한 곳에 모아둔다.
   */
  const runSearchAtCenter = useCallback(
    (center: { lat: number; lng: number }) => {
      nearbySearchCenterRef.current = center;
      setNearbySearchCenter(center);
      setMapCenter(center);
      // 여기가 새 기준점 — 검색 직후엔 버튼이 사라져야 한다
      searchAnchorRef.current = center;
      setMapMovedFromAnchor(false);
      // 축척이 큰(많이 축소된) 상태로 이 위치 검색을 하면 결과 마커가 한 점에
      // 뭉쳐 보이므로, 기본 개요 레벨보다 더 축소돼 있을 때만 살짝 확대해준다.
      if (mapLevelRef.current > KAKAO_LEVEL_DEFAULT) {
        setMapLevel(KAKAO_LEVEL_DEFAULT);
      }
      setSearchScope('nearby');
      setFitSearchBounds(false);
      openSearchPanel();
      showToast(tp('toast.searchAtCenter'));
      void runSearch(1, false, {
        scope: 'nearby',
        center,
        keepMapCenter: true,
      });
    },
    [runSearch, openSearchPanel]
  );

  const handleSetSearchCenterFromMap = useCallback(() => {
    if (!mapContextMenu) return;
    runSearchAtCenter({ lat: mapContextMenu.lat, lng: mapContextMenu.lng });
  }, [mapContextMenu, runSearchAtCenter]);

  /** 모바일 "이 지역 검색" — 지금 보고 있는 지도 중심으로 다시 찾는다 */
  const handleSearchThisArea = useCallback(() => {
    runSearchAtCenter(mapCenterRef.current);
  }, [runSearchAtCenter]);

  /**
   * 좌측 패널 + 장소 상세 패널이 지도 왼쪽을 가린다.
   * 남는 지도 영역의 한가운데가 화면 중심에서 얼마나 오른쪽인지 계산해,
   * 그만큼 지도 중심을 밀어 대상이 가려지지 않게 한다.
   * (모바일은 패널이 지도 위를 덮는 구조라 보정하지 않는다)
   */
  const occludedCenterShiftPx = useCallback(() => {
    if (typeof window === 'undefined') return 0;
    // 도킹 여부는 CSS와 같은 기준(.mobile-layout)으로 판단한다
    if (document.querySelector('.wayknit-root.mobile-layout')) return 0;
    const styles = getComputedStyle(document.documentElement);
    const px = (name: string, fallback: number) =>
      parseFloat(styles.getPropertyValue(name)) || fallback;
    const gutter = px('--chrome-gutter', 16);
    const sidePanel = px('--side-panel-w', 360);
    const detailPanel =
      // 아직 렌더 전이면 기본 모달 폭(680)으로 어림한다
      document.querySelector('.photos-panel')?.getBoundingClientRect().width ?? 680;

    const occludedRight = gutter * 2 + sidePanel + detailPanel;
    const visibleCenter = (occludedRight + window.innerWidth) / 2;
    return Math.max(0, visibleCenter - window.innerWidth / 2);
  }, []);

  const handleOpenPlacePhotos = useCallback((place: Place) => {
    setPhotosTarget(place);
    /* 상세를 지도 옆에 띄우므로(가리지 않으므로) 그 장소를 지도에서도 바로
     * 짚어준다. 이미 충분히 확대돼 있으면 축척을 건드리지 않는다 — 사용자가
     * 맞춰둔 화면을 상세를 열 때마다 되돌리면 성가시다. levelTick은 같은
     * 레벨로 다시 지정할 때도 지도에 반영되게 하는 신호다. */
    setSelectedPlaceId(place.id);
    setFitSearchBounds(false);

    if (mapLevelRef.current > KAKAO_LEVEL_PLACE_FOCUS) {
      setMapLevel(KAKAO_LEVEL_PLACE_FOCUS);
      setMapLevelTick((t) => t + 1);
    }
    setMapCenter({ lat: place.lat, lng: place.lng });
  }, []);

  const handleUseMyLocationForSearch = useCallback(() => {
    void getApproximateLocation().then((center) => {
      if (!center) {
        showToast(tp('search.locationFailed'));
        return;
      }
      nearbySearchCenterRef.current = center;
      setMapCenter(center);
      // 축척이 큰(많이 축소된) 상태로 현재위치 검색을 하면 결과 마커가 한 점에
      // 뭉쳐 보이므로, 기본 개요 레벨보다 더 축소돼 있을 때만 살짝 확대해준다.
      if (mapLevelRef.current > KAKAO_LEVEL_DEFAULT) {
        setMapLevel(KAKAO_LEVEL_DEFAULT);
      }
      setNearbySearchCenter(center);
      setSearchScope('nearby');
      setFitSearchBounds(false);
      openSearchPanel();
      showToast(tp('toast.searchAtMyLocation'));
      void runSearch(1, false, {
        scope: 'nearby',
        center,
        keepMapCenter: true,
      });
    });
  }, [runSearch, openSearchPanel]);

  const handleSearchFestivals = useCallback(() => {
    if (!isTourFestivalConfigured()) return;
    setSearchingFestivals(true);
    const regionLookup = kakaoReady
      ? coordsToAddress(mapCenter.lat, mapCenter.lng).catch(() => '')
      : Promise.resolve('');
    void regionLookup
      .then((address) => {
        const regionPrefix = regionPrefixOf(address);
        return searchTourFestivals({ regionPrefix });
      })
      .then((festivals) => {
        if (festivals.length === 0) {
          showToast(tp('search.festivalsEmpty'));
          return;
        }
        setResults((prev) => {
          const seen = new Set(prev.map((p) => p.id));
          const extra = festivals
            .filter((p) => !seen.has(p.id))
            .map((p) => ({
              ...p,
              distance: Math.round(haversineMeters(mapCenter, p)),
            }))
            .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
          return extra.length ? [...prev, ...extra] : prev;
        });
        if (festivals.length === 1) {
          setMapCenter({ lat: festivals[0].lat, lng: festivals[0].lng });
        } else if (festivals.length > 1) {
          setFitSearchBounds(true);
        }
        openSearchPanel();
        showToast(tp('search.festivalsFound', { count: festivals.length }));
      })
      .finally(() => setSearchingFestivals(false));
  }, [mapCenter, kakaoReady, openSearchPanel, tp]);

  // ============== 핀업 ==============
  const addPinFromPlace = useCallback(
    (place: Place) => {
      const current = trip.pinnedByDay[currentDay] ?? [];
      const pinnedPlace: PinnedPlace = {
        ...place,
        nameKo: place.nameKo ?? place.name,
        pinnedAt: Date.now(),
        order: current.length + 1,
        stayMinutes: suggestStayMinutes(place.category).minutes,
        day: currentDay,
      };
      setPinnedForDay(currentDay, [...current, pinnedPlace]);
      setRouteForDay(currentDay, null);
      showToast(tp('toast.pinned', { name: place.name, n: current.length + 1 }));
      return pinnedPlace;
    },
    [trip.pinnedByDay, currentDay, tp]
  );

  const handleTogglePin = useCallback(
    (place: Place) => {
      if (trip.collaboratorRole === 'viewer') {
        showToast(ts('collab.readOnlyBanner'));
        return;
      }
      const current = trip.pinnedByDay[currentDay] ?? [];
      const exists = current.find((p) => p.id === place.id);
      if (exists) {
        const next = current
          .filter((p) => p.id !== place.id)
          .map((p, i) => ({ ...p, order: i + 1 }));
        setPinnedForDay(currentDay, next);
        setInfoWindowPlace((prev) => (prev?.id === place.id ? null : prev));
        showToast(tp('toast.unpinned', { name: place.name }));
      } else {
        const pinnedPlace: PinnedPlace = {
          ...place,
          nameKo: place.nameKo ?? place.name,
          pinnedAt: Date.now(),
          order: current.length + 1,
          stayMinutes: suggestStayMinutes(place.category).minutes,
          day: currentDay,
        };
        setPinnedForDay(currentDay, [...current, pinnedPlace]);
        showToast(tp('toast.pinned', { name: place.name, n: current.length + 1 }));
      }
    },
    [trip.pinnedByDay, currentDay, tp]
  );

  const handleTogglePinFromInfo = useCallback(
    (place: Place) => {
      // 추가일 때만 날린다. 해제는 연출할 것이 없고, 말풍선이 닫히기 전에
      // 버튼 위치를 읽어야 하므로 handleTogglePin보다 먼저 잰다.
      const isAdding = !(trip.pinnedByDay[currentDay] ?? []).some((p) => p.id === place.id);
      const from = isAdding ? currentBubblePinRect() : null;

      handleTogglePin(place);

      if (from) {
        flyPinToTab({
          from,
          label: place.name,
          iconName: CATEGORY_MAP[place.categoryCode]?.icon ?? 'mapPin',
        });
      }
    },
    [handleTogglePin, trip.pinnedByDay, currentDay]
  );

  const handleToggleRequired = useCallback((id: string) => {
    const current = trip.pinnedByDay[currentDay] ?? [];
    const next = current.map((p) =>
      p.id === id ? { ...p, required: !p.required } : p
    );
    setPinnedForDay(currentDay, next);
  }, [trip.pinnedByDay, currentDay]);

  const handlePreferencesChange = useCallback((preferences: TripTheme[]) => {
    setTrip((prev) => ({ ...prev, preferences, updatedAt: Date.now() }));
  }, []);

  const handleFoodRestrictionsChange = useCallback((foodRestrictions: FoodRestriction[]) => {
    setTrip((prev) => ({ ...prev, foodRestrictions, updatedAt: Date.now() }));
  }, []);

  const handleTogglePinSelection = useCallback((id: string) => {
    setSelectedPinIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleClearAllPins = useCallback(() => {
    const count = (trip.pinnedByDay[currentDay] ?? []).length;
    if (count === 0) return;
    if (
      !confirm(tp('confirm.clearPins', { day: currentDay, count }))
    ) {
      return;
    }
    setPinnedForDay(currentDay, []);
    setRouteForDay(currentDay, null);
    setSelectedPinIds(new Set());
    showToast(tp('toast.clearedPins', { day: currentDay }));
  }, [trip.pinnedByDay, currentDay, tp]);

  const handleRemovePin = useCallback(
    (id: string) => {
      const current = trip.pinnedByDay[currentDay] ?? [];
      const next = current
        .filter((p) => p.id !== id)
        .map((p, i) => ({ ...p, order: i + 1 }));
      setPinnedForDay(currentDay, next);
      setInfoWindowPlace((prev) => (prev?.id === id ? null : prev));
      setSelectedPinIds((prev) => {
        if (!prev.has(id)) return prev;
        const nextSel = new Set(prev);
        nextSel.delete(id);
        return nextSel;
      });
    },
    [trip.pinnedByDay, currentDay]
  );

  const handleReorderPinned = useCallback(
    (next: PinnedPlace[]) => {
      setPinnedForDay(currentDay, next);
    },
    [currentDay]
  );

  /**
   * 동선 패널에서 드래그 재정렬. `next`는 동선 패널에 실제로 보이던 핀 목록
   * (핀 탭에서 일부만 선택했다면 그 부분집합)이 재정렬된 것 — 나머지 핀은
   * 원래 자리에 그대로 두고, 보였던 핀들 자리에만 새 순서를 되꽂는다.
   */
  const handleReorderRoutePins = useCallback(
    (next: PinnedPlace[]) => {
      const visibleIds = new Set(next.map((p) => p.id));
      let i = 0;
      const merged = pinned.map((p) => (visibleIds.has(p.id) ? next[i++] : p));
      setPinnedForDay(currentDay, merged);
    },
    [pinned, currentDay]
  );

  const handleImportPins = useCallback((result: PinImportResult) => {
    setTrip((prev) => {
      const nextTotal = Math.max(prev.totalDays, result.totalDays);
      const pinnedByDay = { ...prev.pinnedByDay };
      const generatedRouteByDay = { ...prev.generatedRouteByDay };
      for (let d = 1; d <= nextTotal; d++) {
        if (!(d in pinnedByDay)) pinnedByDay[d] = [];
      }
      for (const [dayKey, list] of Object.entries(result.pinnedByDay)) {
        const day = Number(dayKey);
        pinnedByDay[day] = list;
        generatedRouteByDay[day] = null;
      }
      return {
        ...prev,
        totalDays: nextTotal,
        pinnedByDay,
        generatedRouteByDay,
        updatedAt: Date.now(),
      };
    });
  }, []);

  const handleMaterialsChange = useCallback((materials: TripMaterial[]) => {
    setTrip((prev) => ({ ...prev, materials, updatedAt: Date.now() }));
  }, []);

  const handleOpenMaterialsPanel = useCallback(() => {
    setRouteOptionsOpen(false);
    setMaterialsPanelOpen(true);
  }, []);

  // ============== 경로 옵션 ==============
  function setRouteOptions(next: RouteOptions) {
    setTrip((prev) => patchRouteOptionsForDay(prev, currentDay, next));
  }

  const handleOpenRouteOptions = useCallback(() => {
    const targetCount = selectedPinIds.size > 0 ? selectedPinIds.size : pinned.length;
    if (targetCount < 2) {
      showToast(tp('toast.needTwoPins'));
      return;
    }
    setMaterialsPanelOpen(false);
    setPanelTab('route');
    setPanelOpen(true);
    setMobileSheetTab('route');
    setMobileSheetLevel('half');
    setRouteOptionsOpen(true);
  }, [pinned.length, selectedPinIds.size]);

  const handleClearRoute = useCallback(() => {
    if (!trip.generatedRouteByDay[currentDay]) return;
    if (!confirm(tp('dock.clearRouteConfirm', { day: currentDay }))) return;
    setRouteForDay(currentDay, null);
    setDockCollapsed(false);
    showToast(tp('dock.clearRouteDone', { day: currentDay }));
  }, [trip.generatedRouteByDay, currentDay, tp]);

  const openPlannerTab = useCallback((tab: PlannerPanelTab) => {
    setPanelTab(tab);
    setPanelOpen(true);
    if (tab === 'route') setRouteOptionsOpen(true);
  }, []);

  const cycleMobileSheet = useCallback(() => {
    setMobileSheetLevel((prev) =>
      prev === 'peek' ? 'half' : prev === 'half' ? 'full' : 'peek'
    );
  }, []);

  const handleUpdateStayMinutes = useCallback(
    (placeId: string, minutes: number) => {
      const clamped = Math.max(0, Math.min(480, Math.round(minutes)));
      setTrip((prev) => {
        const list = prev.pinnedByDay[currentDay] ?? [];
        const nextPinned = list.map((p) =>
          p.id === placeId ? { ...p, stayMinutes: clamped } : p
        );
        const opts = {
          ...getRouteOptionsForDay(prev, currentDay),
          autoStayTime: false,
        };
        return patchRouteOptionsForDay(
          {
            ...prev,
            pinnedByDay: { ...prev.pinnedByDay, [currentDay]: nextPinned },
            updatedAt: Date.now(),
          },
          currentDay,
          opts
        );
      });
    },
    [currentDay]
  );

  const handleUpdateFixedArrival = useCallback(
    (placeId: string, time: string | null) => {
      const next = isValidHHMM(time) ? time : undefined;
      if (next) trackEvent('fixed_arrival_set', { day: currentDay });
      setTrip((prev) => {
        const list = prev.pinnedByDay[currentDay] ?? [];
        const nextPinned = list.map((p) =>
          p.id === placeId ? { ...p, fixedArrival: next } : p
        );
        return {
          ...prev,
          pinnedByDay: { ...prev.pinnedByDay, [currentDay]: nextPinned },
          updatedAt: Date.now(),
        };
      });
    },
    [currentDay]
  );

  /** 상세를 열어 확인한 영업시간을 핀에 저장 — 일정 검증에 쓰인다 */
  const handleHoursResolved = useCallback(
    (placeId: string, hours: { hours?: string; restDate?: string }) => {
      setTrip((prev) => {
        let changed = false;
        const nextByDay: typeof prev.pinnedByDay = {};
        for (const [dayKey, list] of Object.entries(prev.pinnedByDay)) {
          nextByDay[Number(dayKey)] = list.map((p) => {
            if (p.id !== placeId) return p;
            const openingHours = hours.hours ?? p.openingHours;
            const closedDays = hours.restDate ?? p.closedDays;
            if (openingHours === p.openingHours && closedDays === p.closedDays) return p;
            changed = true;
            return { ...p, openingHours, closedDays };
          });
        }
        if (!changed) return prev;
        return { ...prev, pinnedByDay: nextByDay, updatedAt: Date.now() };
      });
    },
    []
  );

  const handleUpdateItemKind = useCallback(
    (placeId: string, kind: PinnedPlace['itemKind']) => {
      setTrip((prev) => {
        const list = prev.pinnedByDay[currentDay] ?? [];
        const nextPinned = list.map((p) =>
          p.id === placeId ? { ...p, itemKind: kind === 'reserved' ? kind : undefined } : p
        );
        return {
          ...prev,
          pinnedByDay: { ...prev.pinnedByDay, [currentDay]: nextPinned },
          updatedAt: Date.now(),
        };
      });
    },
    [currentDay]
  );

  const handleUpdateNote = useCallback(
    (placeId: string, note: string) => {
      setTrip((prev) => {
        const list = prev.pinnedByDay[currentDay] ?? [];
        const nextPinned = list.map((p) =>
          p.id === placeId ? { ...p, note: note.trim() ? note : undefined } : p
        );
        return {
          ...prev,
          pinnedByDay: { ...prev.pinnedByDay, [currentDay]: nextPinned },
          updatedAt: Date.now(),
        };
      });
    },
    [currentDay]
  );

  const handleTogglePresentation = useCallback(() => {
    setPresentationMode((prev) => {
      const next = !prev;
      // 조감 모드로 들어갈 때 검색결과 클릭으로 열려 있던 정보 카드도 같이 닫는다.
      if (next) setInfoWindowPlace(null);
      return next;
    });
  }, []);

  const handleToggleTableView = useCallback(() => {
    setTableViewMode((prev) => !prev);
  }, []);

  const handleCloseTableView = useCallback(() => {
    setTableViewMode(false);
  }, []);

  const handlePickOriginFromMap = useCallback(() => {
    setPickingPinFromMap(false);
    setPendingManualPin(null);
    setPickingOriginFromMap(true);
  }, []);

  const handleTogglePinFromMap = useCallback(() => {
    setPickingOriginFromMap(false);
    setPendingManualPin(null);
    setPickingPinFromMap((v) => !v);
  }, []);

  /** 모바일 지도 롱프레스 — 토글이 아니라 항상 켜기(이미 픽 모드면 무시) */
  const handleLongPressPin = useCallback(() => {
    if (pickingOriginFromMap || pickingPinFromMap) return;
    setPendingManualPin(null);
    setPickingPinFromMap(true);
  }, [pickingOriginFromMap, pickingPinFromMap]);

  const handlePinLocationPicked = useCallback((lat: number, lng: number, address: string) => {
    setPickingPinFromMap(false);
    setPendingManualPin({
      lat,
      lng,
      address: address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    });
    setMapCenter({ lat, lng });
  }, []);

  const handleConfirmManualPin = useCallback(
    (name: string) => {
      if (!pendingManualPin) return;
      const place = createManualPlace({
        lat: pendingManualPin.lat,
        lng: pendingManualPin.lng,
        name,
        address: pendingManualPin.address,
      });
      addPinFromPlace(place);
      setSelectedPlaceId(place.id);
      setPendingManualPin(null);
    },
    [pendingManualPin, addPinFromPlace]
  );

  const handleCancelManualPin = useCallback(() => {
    setPendingManualPin(null);
  }, []);

  const handleOriginPicked = useCallback(
    (lat: number, lng: number, address: string) => {
      setRouteOptions({
        ...routeOptions,
        origin: {
          type: 'map-click',
          label: address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
          lat,
          lng,
          address,
        },
      });
      setPickingOriginFromMap(false);
    },
    [routeOptions]
  );

  // ============== 경로 생성 (실제 API 보강) ==============
  const handleGenerate = useCallback(async () => {
    if (routePins.length < 2) return;

    async function buildAndGenerate(resolvedOrigin: Origin) {
      const opts = {
        ...routeOptions,
        origin: resolvedOrigin,
        preferences: trip.preferences,
      };
      const base = generateRoute(routePins, opts);
      reportRouteMetrics(base);
      setRouteForDay(currentDay, base);
      if (trip.ownerId) {
        void logTripActivity(trip.id, 'route_generate', null, { day: currentDay });
      }
      setRouteOptionsOpen(false);
      setPanelOpen(false);
      setDockCollapsed(false);
      setMobileSheetTab('route');
      setMobileSheetLevel('half');

      if (opts.autoOrder) {
        const syncedPins: PinnedPlace[] = base.stops.map((s, i) => ({
          ...(s as PinnedPlace),
          order: i + 1,
        }));
        if (selectedPinIds.size > 0) {
          const routedIds = new Set(syncedPins.map((p) => p.id));
          const rest = pinned
            .filter((p) => !routedIds.has(p.id))
            .map((p, i) => ({ ...p, order: syncedPins.length + i + 1 }));
          setPinnedForDay(currentDay, [...syncedPins, ...rest]);
        } else {
          setPinnedForDay(currentDay, syncedPins);
        }
      }

      setRefining(true);
      try {
        const refined = await refineRouteWithRealLegs(base, fetchLegs);
        setRouteForDay(currentDay, refined);
        if (refined.legs.some((l) => l.source === 'api')) {
          showToast(tp('toast.routeRefined'));
        }
      } catch (e) {
        console.warn('경로 보강 실패', e);
      } finally {
        setRefining(false);
      }
    }

    let origin: Origin;
    try {
      origin = await resolveOriginForRoute(routeOptions.origin);
    } catch (err) {
      const code = (err as Error).message;
      if (code === 'ADDRESS_NOT_FOUND') {
        showToast(tp('toast.originNotFound'));
      } else if (code === 'GPS_UNAVAILABLE') {
        showToast(tp('toast.gpsUnavailable'));
        await buildAndGenerate({
          ...routeOptions.origin,
          lat: routePins[0].lat,
          lng: routePins[0].lng,
          label: routePins[0].name,
        });
        return;
      } else if (code === 'MAP_ORIGIN_REQUIRED') {
        showToast(tp('toast.pickOriginOnMap'));
      } else {
        showToast(tp('toast.originUnknown'));
      }
      return;
    }

    setRouteOptions({ ...routeOptions, origin });
    await buildAndGenerate(origin);
  }, [routePins, pinned, selectedPinIds, routeOptions, currentDay]);

  // ============== 다일정 ==============
  function selectDay(day: number) {
    setTrip((prev) => normalizeTrip({ ...prev, currentDay: day }));
    setMapPinCategoryFilter(null);
    setInfoWindowPlace(null);
    setSelectedPinIds(new Set());
  }
  function addDay() {
    const newDay = trip.totalDays + 1;
    const prevOpts = getRouteOptionsForDay(trip, trip.totalDays);
    setTrip((prev) =>
      normalizeTrip({
        ...prev,
        totalDays: newDay,
        currentDay: newDay,
        pinnedByDay: { ...prev.pinnedByDay, [newDay]: [] },
        routeOptionsByDay: {
          ...prev.routeOptionsByDay,
          [newDay]: { ...prevOpts, origin: { ...prevOpts.origin } },
        },
      })
    );
    // 핀 밖의 행동이라 트리거가 못 잡는다 — 여기서 직접 기록한다.
    if (trip.ownerId) void logTripActivity(trip.id, 'day_add', String(newDay), { day: newDay });
  }
  function removeDay(day: number) {
    if (trip.totalDays <= 1) return;
    if (!confirm(tp('confirm.removeDay', { day }))) return;
    // 일차를 뒤에서부터 압축
    const remainingDays = Array.from({ length: trip.totalDays }, (_, i) => i + 1).filter(
      (d) => d !== day
    );
    const newPinned: Record<number, PinnedPlace[]> = {};
    const newRoutes: Record<number, GeneratedRoute | null> = {};
    remainingDays.forEach((oldD, idx) => {
      const newD = idx + 1;
      newPinned[newD] = (trip.pinnedByDay[oldD] ?? []).map((p) => ({ ...p, day: newD }));
      newRoutes[newD] = trip.generatedRouteByDay[oldD] ?? null;
    });
    patchTrip({
      totalDays: trip.totalDays - 1,
      currentDay: Math.min(trip.currentDay, trip.totalDays - 1),
      pinnedByDay: newPinned,
      generatedRouteByDay: newRoutes,
    });
    // day_add와 같은 이유로 여기서 직접 기록한다. 상대가 갑자기 일차가
    // 사라진 걸 발견했을 때 누가 지웠는지 남아 있어야 한다.
    if (trip.ownerId) void logTripActivity(trip.id, 'day_remove', String(day), { day });
  }

  const handleTitleChange = useCallback((title: string) => {
    setTrip((prev) =>
      prev.collaboratorRole === 'viewer' ? prev : { ...prev, title, updatedAt: Date.now() }
    );
  }, []);

  /**
   * 여행 이름 변경 기록.
   *
   * handleTitleChange는 타이핑 한 글자마다 불린다 — 거기서 기록하면 활동 로그가
   * 한 글자씩 도배된다. 입력이 멎은 뒤 한 번만 남긴다.
   *
   * 여행을 바꿔 실었을 때는 기준만 새로 잡고 기록하지 않는다. 그러지 않으면
   * 다른 여행의 제목과 비교해 "이름 변경"이 거짓으로 찍힌다.
   */
  const loggedTitleRef = useRef<{ tripId: string; title: string } | null>(null);
  useEffect(() => {
    if (!hydrated || !trip.id || !trip.ownerId) return;
    const seen = loggedTitleRef.current;
    if (!seen || seen.tripId !== trip.id) {
      loggedTitleRef.current = { tripId: trip.id, title: trip.title };
      return;
    }
    if (seen.title === trip.title) return;
    const timer = window.setTimeout(() => {
      loggedTitleRef.current = { tripId: trip.id, title: trip.title };
      void logTripActivity(trip.id, 'trip_rename', trip.title);
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [trip.title, trip.id, trip.ownerId, hydrated]);

  const handleSelectTrip = useCallback(
    async (tripId: string) => {
      if (tripId === trip.id) return;
      const userId = user?.id ?? null;
      if (trip.collaboratorRole !== 'viewer') {
        await tripsRepo.save({ ...trip, ownerId: trip.ownerId ?? userId ?? undefined, updatedAt: Date.now() });
      }
      const loaded = await tripsRepo.load(userId, tripId);
      if (loaded) {
        const next = normalizeTrip({
          ...makeEmptyTrip(),
          ...loaded,
          pinnedByDay: loaded.pinnedByDay ?? { 1: [] },
          generatedRouteByDay: loaded.generatedRouteByDay ?? {},
        });
        setTrip(next);
        focusMapOnTrip(next);
        setResults([]);
        setQuery('');
        setSearchEmpty(false);
        setRouteOptionsOpen(false);
      }
      await refreshTripList(userId);
    },
    [trip, user?.id, refreshTripList, focusMapOnTrip]
  );

  const handleNewTrip = useCallback(async () => {
    if (!canCreateTrip(plan, tripSummaries.length, isAdmin)) {
      showToast(tb('limits.tripCount', { max: FREE_MAX_TRIPS }));
      setUpgradeOpen(true);
      return;
    }
    if (
      !confirm(tp('confirm.newTrip', { title: trip.title }))
    ) {
      return;
    }
    const userId = user?.id ?? null;
    if (trip.collaboratorRole !== 'viewer') {
      await tripsRepo.save({ ...trip, ownerId: trip.ownerId ?? userId ?? undefined, updatedAt: Date.now() });
    }
    const fresh = makeEmptyTrip();
    setTrip(fresh);
    await tripsRepo.save({ ...fresh, ownerId: userId ?? undefined });
    setResults([]);
    setQuery('');
    setSearchEmpty(false);
    setRouteOptionsOpen(false);
    setMapCenter(DEFAULT_CENTER);
    writeMapViewport(DEFAULT_CENTER, mapLevelRef.current);
    await refreshTripList(userId);
  }, [trip, user?.id, refreshTripList, plan, isAdmin, tripSummaries.length, tb]);

  const handleDeleteTrip = useCallback(async () => {
    // 삭제는 협업자(editor 포함)가 아니라 소유자만 — 실수로 상대방 여행이 지워지는 사고 방지
    if (trip.collaboratorRole) {
      showToast(ts('collab.readOnlyBanner'));
      return;
    }
    const userId = user?.id ?? null;
    const others = tripSummaries.filter((s) => s.id !== trip.id);
    const msg =
      others.length > 0
        ? tp('confirm.deleteTrip', { title: trip.title })
        : tp('confirm.deleteLastTrip', { title: trip.title });
    if (!confirm(msg)) return;

    try {
      await tripsRepo.delete(userId, trip.id);
    } catch (e) {
      console.error(e);
      showToast(tp('toast.deleteTripFailed'));
      return;
    }

    await refreshTripList(userId);
    const list = await tripsRepo.list(userId);
    const nextSummary = list.find((s) => s.id !== trip.id) ?? list[0];

    if (nextSummary && nextSummary.id !== trip.id) {
      const loaded = await tripsRepo.load(userId, nextSummary.id);
      if (loaded) {
        const next = normalizeTrip({
          ...makeEmptyTrip(),
          ...loaded,
          pinnedByDay: loaded.pinnedByDay ?? { 1: [] },
          generatedRouteByDay: loaded.generatedRouteByDay ?? {},
        });
        setTrip(next);
        focusMapOnTrip(next);
      }
    } else {
      const fresh = makeEmptyTrip();
      setTrip(fresh);
      await tripsRepo.save({ ...fresh, ownerId: userId ?? undefined });
      await refreshTripList(userId);
      setMapCenter(DEFAULT_CENTER);
      writeMapViewport(DEFAULT_CENTER, mapLevelRef.current);
    }

    setResults([]);
    setQuery('');
    setSearchEmpty(false);
    setRouteOptionsOpen(false);
    setMaterialsPanelOpen(false);
    setSelectedPinIds(new Set());
    setInfoWindowPlace(null);
    setMapPinCategoryFilter(null);
    showToast(tp('toast.deletedTrip', { title: trip.title }));
  }, [trip, tripSummaries, user?.id, refreshTripList, focusMapOnTrip]);

  // ============== 공유 / 저장 ==============
  const openShareModal = useCallback(() => {
    if (authConfigured && !user) {
      if (
        !confirm(tp('confirm.shareWithoutLogin'))
      ) {
        return;
      }
    } else if (!authConfigured) {
      if (
        !confirm(tp('confirm.shareLocalMode'))
      ) {
        return;
      }
    }
    setShareModalOpen(true);
  }, [authConfigured, user]);

  const handleShareConfirm = useCallback(
    async (opts: ShareTripModalSubmit) => {
      setShareSaving(true);
      const userId = user?.id ?? null;
      let publicTrip = applyPlazaPublish(
        { ...trip, ownerId: trip.ownerId ?? userId ?? undefined },
        {
          listInPlaza: opts.listInPlaza,
          displayName: opts.displayName,
          email: opts.email,
        }
      );
      setTrip(publicTrip);
      try {
        await tripsRepo.save(publicTrip);
      } catch (e) {
        console.error(e);
        showToast(tp('toast.shareSaveFailed'));
        setShareSaving(false);
        return;
      }

      unlockPlazaNav();
      setPlazaNavVisible(true);
      setShareModalOpen(false);
      setShareSaving(false);
      trackEvent('trip_share_created', { listInPlaza: opts.listInPlaza });

      const url = `${window.location.origin}/trip/${trip.slug}`;
      const copied = () => {
        showToast(opts.listInPlaza ? tp('toast.shareCopiedPlaza') : tp('toast.shareCopied'));
      };
      if (navigator.share) {
        navigator.share({ title: trip.title, url }).catch(() => {
          navigator.clipboard?.writeText(url).then(copied);
        });
      } else {
        navigator.clipboard?.writeText(url).then(copied);
      }
    },
    [trip, user, showToast]
  );

  const countsByDay = useMemo(() => {
    const counts: Record<number, number> = {};
    for (let d = 1; d <= trip.totalDays; d++) {
      counts[d] = (trip.pinnedByDay[d] ?? []).length;
    }
    return counts;
  }, [trip.pinnedByDay, trip.totalDays]);

  const displayResults = useMemo(() => {
    // 조감 모드는 저장된 핀만 보여주는 게 목적 — 검색결과 마커·클러스터는 숨긴다.
    if (presentationMode) return [];
    const selected =
      categoryFilter === 'FD6'
        ? (trip.foodRestrictions ?? [])
        : categorySubFilters;
    return filterPlacesBySubFilters(results, categoryFilter, selected);
  }, [results, categoryFilter, categorySubFilters, trip.foodRestrictions, presentationMode]);

  const pinnedIds = new Set(pinned.map((p) => p.id));
  const totalPinCount = useMemo(
    () =>
      Object.values(trip.pinnedByDay).reduce(
        (sum, list) => sum + (list?.length ?? 0),
        0
      ),
    [trip.pinnedByDay]
  );
  const showOnboarding = shouldShowOnboarding(totalPinCount, hydrated);

  const saveStatus: SaveStatus = useMemo(() => {
    if (savePending) return 'syncing';
    if (authConfigured && user) return 'cloud';
    if (authConfigured && !user) return 'guest';
    return 'local';
  }, [savePending, authConfigured, user]);

  const isTripOwner = Boolean(user?.id) && Boolean(trip.ownerId) && trip.ownerId === user?.id;
  const isReadOnlyViewer = trip.collaboratorRole === 'viewer';

  // presence 게이트 — 소유자 시점에서만 협업자 유무를 물어본다.
  // 협업자 본인은 collaboratorRole만 봐도 공유 중임을 알아 조회가 필요 없다.
  const [ownerHasCollaborators, setOwnerHasCollaborators] = useState(false);
  useEffect(() => {
    if (!isTripOwner || !trip.id) {
      setOwnerHasCollaborators(false);
      return;
    }
    // 초대 직후에도 아바타가 켜지도록 협업자 모달이 닫힐 때 다시 묻는다
    if (collabModalOpen) return;
    let alive = true;
    void hasCollaborators(trip.id).then((has) => {
      if (alive) setOwnerHasCollaborators(has);
    });
    return () => {
      alive = false;
    };
  }, [isTripOwner, trip.id, collabModalOpen]);

  const presenceEnabled =
    Boolean(trip.isPublic) || Boolean(trip.collaboratorRole) || ownerHasCollaborators;

  /**
   * 핀 작성자 배지를 볼 수 있는 사람 — 소유자와 협업자뿐이다.
   *
   * presenceEnabled 를 그대로 쓰면 안 된다. 거기엔 isPublic 이 들어 있어서,
   * 공개 여행을 구경하는 아무나에게 협업자 이메일이 보인다. §5-2-3 에서
   * 활동 로그를 공개 여행에서도 감춘 것과 같은 판단이다 — 누가 무엇을
   * 넣었는지는 열람자에게 줄 정보가 아니다.
   */
  const canSeePinAuthors = isTripOwner || Boolean(trip.collaboratorRole);

  const useMobileChrome = isMobile && !presentationMode;
  const searchExpanded =
    !useMobileChrome &&
    (query.trim().length > 0 || searching || results.length > 0);

  const toggleMobileSheet = useCallback((sheet: 'search' | 'pins') => {
    setMobileSheetTab(sheet === 'search' ? 'search' : 'pins');
    setMobileSheetLevel((prev) => (prev === 'peek' ? 'half' : prev));
  }, []);

  /** 상단 검색 pill — 입력하러 들어가는 것이므로 시트를 끝까지 펼친다 */
  const openMobileSearchTab = useCallback(() => {
    setMobileSheetTab('search');
    setMobileSheetLevel('full');
  }, []);

  useEffect(() => {
    if (!presentationMode || tableViewMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPresentationMode(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [presentationMode, tableViewMode]);

  const rootClass = [
    'wayknit-root',
    panelOpen && !useMobileChrome ? 'panel-open' : '',
    !panelOpen && !useMobileChrome ? 'panel-collapsed' : '',
    materialsPanelOpen ? 'materials-open' : '',
    generatedRoute ? 'dock-open' : '',
    presentationMode ? 'presentation-mode' : '',
    searchExpanded ? 'search-expanded' : '',
    useMobileChrome ? 'mobile-layout' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rootClass}>
      {(mapProviderBooting ||
        !((mapProvider === 'kakao' && kakaoReady) ||
          (mapProvider === 'google' && googleReady))) && (
        <div className="map-canvas map-loading" aria-live="polite">
          {tc('loadingMap')}
        </div>
      )}
      <UpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        plan={plan}
        userId={user?.id}
        onPlanChanged={refreshProfile}
      />
      {!mapProviderBooting &&
        ((mapProvider === 'kakao' && kakaoReady) ||
          (mapProvider === 'google' && googleReady)) && (
        <MapView
          key={mapProvider}
          provider={mapProvider}
          mapsReady={kakaoReady}
          googleMapsReady={googleReady}
          center={mapCenter}
          level={mapLevel}
          levelTick={mapLevelTick}
          centerOffsetX={photosTarget ? occludedCenterShiftPx() : 0}
          mapType={mapType}
          searchResults={displayResults}
          pinned={mapPins}
          pinCategoryFilter={mapPinCategoryFilter}
          origin={routeOptions.origin}
          generatedRoute={generatedRoute}
          compareRoutes={compareRoutes.map((c) => ({
            optimizeBy: c.optimizeBy,
            color: COMPARE_COLORS[c.optimizeBy],
            path: c.path,
          }))}
          selectedOptimizeBy={routeOptions.optimizeBy}
          nearbySearchCenter={searchScope === 'nearby' ? nearbySearchCenter : null}
          fitSearchBounds={fitSearchBounds}
          fitPinsBounds={presentationMode}
          pickingOriginFromMap={pickingOriginFromMap}
          pickingPinFromMap={pickingPinFromMap}
          onOriginPicked={handleOriginPicked}
          onPinLocationPicked={handlePinLocationPicked}
          onMapLongPress={handleLongPressPin}
          draftPinLocation={pendingManualPin}
          highlightPlaceId={selectedPlaceId}
          pinSelectionFilter={pinSelectionActive ? selectedPinIds : undefined}
          onSelectPlace={handleSelectPlace}
          onHoverSearchPlace={handleHoverSearchPlace}
          onPinnedMarkerClick={handlePinnedMarkerClick}
          infoWindowPlace={infoWindowPlace}
          pinnedIds={pinnedIds}
          onCloseInfoWindow={handleCloseInfoWindow}
          onTogglePinFromInfo={handleTogglePinFromInfo}
          onOpenRoadviewFromInfo={(p) => setRoadviewTarget(p)}
          onOpenPlacePhotosFromInfo={handleOpenPlacePhotos}
          onShowTaxiCardFromInfo={(p) => setTaxiCardPlace(p)}
          onMapRightClick={handleMapRightClick}
          onMapCenterChange={handleMapCenterChange}
          onMapLevelChange={handleMapLevelChange}
        />
      )}

      <button
        type="button"
        className={`map-type-toggle ${mapType === 'satellite' ? 'active' : ''}`}
        onClick={() => setMapType((prev) => (prev === 'satellite' ? 'roadmap' : 'satellite'))}
        title={tp(mapType === 'satellite' ? 'view.mapTypeRoadmap' : 'view.mapTypeSatellite')}
        aria-label={tp(mapType === 'satellite' ? 'view.mapTypeRoadmap' : 'view.mapTypeSatellite')}
      >
        <Icon name="layers" size={18} />
      </button>

      <InviteBanner />

      {trip.collaboratorRole && (
        <div className="trip-readonly-banner">
          <Icon name={isReadOnlyViewer ? 'lock' : 'pushpin'} size={14} />
          {ts(isReadOnlyViewer ? 'collab.readOnlyBanner' : 'collab.editorBanner')}
        </div>
      )}

      {!useMobileChrome && (
        <>
          <PlannerAppBar
            trip={trip}
            summaries={tripSummaries}
            countsByDay={countsByDay}
            saveStatus={saveStatus}
            lastSavedAt={lastSavedAt ?? trip.updatedAt}
            onGuestSaveClick={() => navigate('/login')}
            onTitleChange={handleTitleChange}
            onSelectTrip={handleSelectTrip}
            onSelectDay={selectDay}
            onAddDay={addDay}
            onRemoveDay={removeDay}
            onOpenMaterials={handleOpenMaterialsPanel}
            onNewTrip={handleNewTrip}
            onDeleteTrip={() => void handleDeleteTrip()}
            onShare={openShareModal}
            onManageCollaborators={
              isTripOwner || trip.collaboratorRole ? () => setCollabModalOpen(true) : undefined
            }
            collabEntryLabel={isTripOwner ? undefined : 'shared'}
            presenceEnabled={presenceEnabled}
            presentationMode={presentationMode}
            onTogglePresentation={handleTogglePresentation}
            tableViewMode={tableViewMode}
            onToggleTableView={handleToggleTableView}
            plazaNavVisible={plazaNavVisible}
          />

          <PlannerSidePanel
            open={panelOpen && !presentationMode}
            tab={panelTab}
            pinCount={pinned.length}
            onTabChange={openPlannerTab}
            onCollapse={() => setPanelOpen(false)}
            searchSlot={
              <SearchPanel
                results={displayResults}
                pinnedIds={pinnedIds}
                selectedId={selectedPlaceId}
                loading={searching}
                enrichingStats={enrichingStats}
                searchEmpty={searchEmpty}
                searchScope={searchScope}
                onSearchScopeChange={handleSearchScopeChange}
                categoryFilter={categoryFilter}
                onCategoryFilterChange={handleCategoryFilterChange}
                searchRadius={searchRadius}
                onSearchRadiusChange={handleSearchRadiusChange}
                onUseMyLocation={handleUseMyLocationForSearch}
                onSearchFestivals={isTourFestivalConfigured() ? handleSearchFestivals : undefined}
                searchingFestivals={searchingFestivals}
                query={query}
                onQueryChange={setQuery}
                onSearch={handleSearch}
                onClear={handleResetSearch}
                onResetResults={handleResetSearch}
                onTogglePin={handleTogglePin}
                onSelectResult={handleSelectPlace}
                onOpenRoadview={(p) => setRoadviewTarget(p)}
                onOpenPlacePhotos={handleOpenPlacePhotos}
                hasMore={searchHasMore}
                loadingMore={loadingMore}
                onLoadMore={handleLoadMore}
                searchError={searchError}
                mapProvider={mapProvider}
                onMapProviderChange={handleMapProviderChange}
                onSearchCandidate={handleSearchCandidate}
                initialExtract={sharedExtract}
                foodRestrictions={trip.foodRestrictions ?? []}
                onFoodRestrictionsChange={handleFoodRestrictionsChange}
                categorySubFilters={categorySubFilters}
                onCategorySubFiltersChange={setCategorySubFilters}
                preferences={trip.preferences}
              />
            }
            pinsSlot={
              <>
                <div className="trip-preferences-bar planner-prefs-inline">
                  <ThemePreferenceChips
                    selected={trip.preferences ?? []}
                    onChange={handlePreferencesChange}
                    compact
                  />
                </div>
                <PinupBar
                  variant="panel"
                  hideHeader
                  pinAuthors={canSeePinAuthors ? pinAuthors : undefined}
                  currentUserEmail={user?.email ?? null}
                  pinned={pinned}
                  tripTitle={trip.title}
                  currentDay={currentDay}
                  totalDays={trip.totalDays}
                  pinnedByDay={trip.pinnedByDay}
                  generatedRouteByDay={trip.generatedRouteByDay}
                  onExportNotify={showToast}
                  onUpgradeRequest={() => setUpgradeOpen(true)}
                  onImportPins={handleImportPins}
                  mapCategoryFilter={mapPinCategoryFilter}
                  onToggleMapCategoryFilter={handleToggleMapCategoryFilter}
                  onRemove={handleRemovePin}
                  onReorder={handleReorderPinned}
                  onSelectPin={handleSelectPlace}
                  selectedPinIds={selectedPinIds}
                  onTogglePinSelection={handleTogglePinSelection}
                  onClearAll={handleClearAllPins}
                  onOpenRouteOptions={handleOpenRouteOptions}
                  routeOptionsOpen={routeOptionsOpen}
                  mustVisitOnly={mustVisitOnly}
                  onToggleMustVisitOnly={() => setMustVisitOnly((v) => !v)}
                  onToggleRequired={handleToggleRequired}
                  onShowTaxiCard={(p) => setTaxiCardPlace(p)}
                />
              </>
            }
            routeSlot={
              <RouteOptionsPanel
                embedded
                open
                onCompareRoutesChange={setCompareRoutes}
                pinned={routePins}
                currentDay={currentDay}
                totalDays={trip.totalDays}
                options={routeOptions}
                hasExistingRoute={!!generatedRoute}
                onChange={setRouteOptions}
                onUpdateStayMinutes={handleUpdateStayMinutes}
                onUpdateFixedArrival={handleUpdateFixedArrival}
                onUpdateItemKind={handleUpdateItemKind}
                onUpdateNote={handleUpdateNote}
                onReorderPins={handleReorderRoutePins}
                onCopyFromPreviousDay={() => {
                  setTrip((prev) => copyRouteOptionsFromDay(prev, currentDay - 1, currentDay));
                  showToast(tp('toast.copiedDepart', { day: currentDay - 1 }));
                }}
                onClose={() => setPanelOpen(false)}
                onGenerate={() => void handleGenerate()}
                onPickOriginFromMap={handlePickOriginFromMap}
                pickingOriginFromMap={pickingOriginFromMap}
              />
            }
            scenarioSlot={
              isTourScenarioConfigured() ? (
                <ThemeScenarioPanel
                  currentDay={currentDay}
                  totalDays={trip.totalDays}
                  pinnedByDay={trip.pinnedByDay}
                  onApply={(result) => {
                    handleImportPins(result);
                    showToast(tp('scenario.applied', { count: result.importedCount }));
                  }}
                  onSelectPlace={handleSelectPlace}
                />
              ) : undefined
            }
          />

          <PanelIconRail
            visible={!panelOpen && !presentationMode}
            pinCount={pinned.length}
            activeTab={null}
            onOpen={openPlannerTab}
          />

          {generatedRoute && !presentationMode && (
            <RouteTimelineDock
              route={generatedRoute}
              currentDay={currentDay}
              panelOpen={panelOpen}
              collapsed={dockCollapsed}
              onToggleCollapsed={() => setDockCollapsed((v) => !v)}
              onReoptimize={handleOpenRouteOptions}
              onClearRoute={handleClearRoute}
              selectedStopId={selectedPlaceId}
              onSelectStop={(id) => {
                const p = pinned.find((x) => x.id === id);
                if (p) handleSelectPlace(p);
              }}
              onShowTaxiCard={(p) => setTaxiCardPlace(p)}
              refining={refining}
            />
          )}

          <div className="overview-chrome">
            <span style={{ fontWeight: 700, fontSize: 13 }}>{tp('view.overviewTitle')}</span>
            <button
              type="button"
              className={`overview-chrome-btn ${!mapPinCategoryFilter ? 'active' : ''}`}
              onClick={() => setMapPinCategoryFilter(null)}
            >
              {tp('view.overviewAll')}
            </button>
            <button
              type="button"
              className="overview-chrome-exit"
              onClick={handleTogglePresentation}
            >
              {tp('view.overviewExit')}
            </button>
          </div>
          <div className="overview-legend">
            {(
              [
                ['food', '#c2410c'] as const,
                ['tour', '#0e7490'] as const,
                ['stay', '#475569'] as const,
                ['shop', '#4d7c0f'] as const,
              ]
            ).map(([cat, color]) => (
              <button
                key={cat}
                type="button"
                className={`overview-legend-chip ${
                  mapPinCategoryFilter === cat || !mapPinCategoryFilter ? 'on' : ''
                }`}
                style={{ background: color }}
                onClick={() =>
                  setMapPinCategoryFilter((prev) => (prev === cat ? null : cat))
                }
              >
                {tc(`category.${cat}`)}
              </button>
            ))}
          </div>

          <div className="overlay-map-tools desktop-only-overlay">
            <button
              type="button"
              className={`map-tool-btn ${pickingPinFromMap ? 'active' : ''}`}
              onClick={handleTogglePinFromMap}
              title={tp('trip.pinFromMap')}
            >
              <Icon name="pinPlus" />
              {tp('trip.pinFromMap')}
            </button>
          </div>
        </>
      )}

      <ItineraryTableView
        open={tableViewMode}
        trip={trip}
        selectedPlaceId={selectedPlaceId}
        onSelectPlaceId={setSelectedPlaceId}
        onOpenPlacePhotos={handleOpenPlacePhotos}
        onClose={handleCloseTableView}
      />

      {useMobileChrome && (
        <>
          <div className="mobile-planner-top">
            <div className="mobile-planner-search-row">
              <button
                type="button"
                className="mobile-planner-search-pill"
                onClick={openMobileSearchTab}
              >
                <Icon name="search" size={18} />
                {tp('search.ariaLabel')}
              </button>
              <button
                type="button"
                className="mobile-planner-menu-btn"
                onClick={handleOpenMaterialsPanel}
                aria-label={tp('trip.materials')}
              >
                <Icon name="folder" size={18} />
              </button>
              <MobileMoreMenu
                onShare={openShareModal}
                plazaNavVisible={plazaNavVisible}
                onOpenTableView={handleToggleTableView}
              />
            </div>
            <div className="mobile-planner-days">
              {Array.from({ length: trip.totalDays }, (_, i) => i + 1).map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`mobile-planner-day ${d === currentDay ? 'active' : ''}`}
                  onClick={() => selectDay(d)}
                >
                  {tp('day.tab', { n: d })}
                  {(countsByDay[d] ?? 0) > 0 ? ` · ${countsByDay[d]}` : ''}
                </button>
              ))}
              <button type="button" className="mobile-planner-day" onClick={addDay}>
                {tp('chrome.addDayShort')}
              </button>
            </div>
          </div>

          {/*
            지도를 옮긴 뒤에만 나타난다. 모바일에는 우클릭이 없어 검색 중심을
            지정할 방법이 아예 없었다 — 롱프레스는 핀업이 이미 쓰고 있다.
          */}
          {mapMovedFromAnchor && mobileSheetLevel !== 'full' && !pickingPinFromMap && (
            <button
              type="button"
              className="mobile-search-area-btn"
              onClick={handleSearchThisArea}
            >
              <Icon name="search" size={15} />
              {tp('map.searchThisArea')}
            </button>
          )}

          {generatedRoute && mobileSheetLevel === 'peek' && mobileSheetTab !== 'search' && (
            <RouteTimelineDock
              variant="mobile"
              route={generatedRoute}
              currentDay={currentDay}
              panelOpen={false}
              collapsed={dockCollapsed}
              onToggleCollapsed={() => setDockCollapsed((v) => !v)}
              onReoptimize={handleOpenRouteOptions}
              onClearRoute={handleClearRoute}
              selectedStopId={selectedPlaceId}
              onSelectStop={(id) => {
                const p = pinned.find((x) => x.id === id);
                if (p) handleSelectPlace(p);
              }}
              onShowTaxiCard={(p) => setTaxiCardPlace(p)}
              refining={refining}
            />
          )}

          <div
            className={`mobile-planner-sheet sheet-${mobileSheetLevel} ${
              mobileSheetLevel === 'peek' ? 'mobile-sheet-peek-only' : ''
            }`}
          >
            <button
              type="button"
              className="mobile-sheet-handle-btn"
              onClick={cycleMobileSheet}
            >
              <span className="mobile-sheet-handle-bar" />
            </button>
            <div className="mobile-sheet-head">
              <span className="mobile-sheet-head-title">
                {mobileSheetTab === 'search'
                  ? tp('search.ariaLabel')
                  : mobileSheetTab === 'route' && generatedRoute
                    ? tp('chrome.sheetRouteTitle', { n: currentDay })
                    : trip.title}
              </span>
              <span className="mobile-sheet-head-summary">
                {mobileSheetTab === 'search'
                  ? tp('chrome.sheetSearchSummary', {
                      count: displayResults.length,
                      defaultValue: '결과 {{count}}개',
                    })
                  : mobileSheetTab === 'route' && generatedRoute
                    ? `${generatedRoute.totalDistanceKm} km · ${generatedRoute.totalTravelMinutes}m`
                    : tp('chrome.sheetPinsSummary', { count: pinned.length, n: currentDay })}
              </span>
            </div>
            <div className="mobile-sheet-tabs">
              <button
                type="button"
                className={`mobile-sheet-tab ${mobileSheetTab === 'search' ? 'active' : ''}`}
                onClick={() => setMobileSheetTab('search')}
              >
                {tp('chrome.tabSearch')}
              </button>
              <button
                type="button"
                className={`mobile-sheet-tab ${mobileSheetTab === 'pins' ? 'active' : ''}`}
                onClick={() => setMobileSheetTab('pins')}
              >
                {tp('chrome.tabPins', { count: pinned.length })}
              </button>
              <button
                type="button"
                className={`mobile-sheet-tab ${mobileSheetTab === 'route' ? 'active' : ''}`}
                onClick={() => {
                  setMobileSheetTab('route');
                  setRouteOptionsOpen(true);
                }}
              >
                {tp('chrome.tabRoute')}
              </button>
            </div>
            <div className="mobile-sheet-content">
              {mobileSheetTab === 'search' ? (
                <SearchPanel
                  variant="compact"
                  autoSearch
                  collapsibleTools
                  results={displayResults}
                  pinnedIds={pinnedIds}
                  selectedId={selectedPlaceId}
                  loading={searching}
                  enrichingStats={enrichingStats}
                  searchEmpty={searchEmpty}
                  searchScope={searchScope}
                  onSearchScopeChange={handleSearchScopeChange}
                  categoryFilter={categoryFilter}
                  onCategoryFilterChange={handleCategoryFilterChange}
                  searchRadius={searchRadius}
                  onSearchRadiusChange={handleSearchRadiusChange}
                  onUseMyLocation={handleUseMyLocationForSearch}
                  onSearchFestivals={isTourFestivalConfigured() ? handleSearchFestivals : undefined}
                  searchingFestivals={searchingFestivals}
                  query={query}
                  onQueryChange={setQuery}
                  onSearch={handleSearch}
                  onClear={handleResetSearch}
                  onResetResults={handleResetSearch}
                  onTogglePin={handleTogglePin}
                  onSelectResult={handleSelectPlace}
                  onOpenRoadview={(p) => setRoadviewTarget(p)}
                  onOpenPlacePhotos={handleOpenPlacePhotos}
                  hasMore={searchHasMore}
                  loadingMore={loadingMore}
                  onLoadMore={handleLoadMore}
                  searchError={searchError}
                  mapProvider={mapProvider}
                  onMapProviderChange={handleMapProviderChange}
                  onSearchCandidate={handleSearchCandidate}
                  initialExtract={sharedExtract}
                  foodRestrictions={trip.foodRestrictions ?? []}
                  onFoodRestrictionsChange={handleFoodRestrictionsChange}
                  categorySubFilters={categorySubFilters}
                  onCategorySubFiltersChange={setCategorySubFilters}
                  preferences={trip.preferences}
                />
              ) : mobileSheetTab === 'pins' ? (
                <PinupBar
                  variant="panel"
                  hideHeader
                  pinAuthors={canSeePinAuthors ? pinAuthors : undefined}
                  currentUserEmail={user?.email ?? null}
                  pinned={pinned}
                  tripTitle={trip.title}
                  currentDay={currentDay}
                  totalDays={trip.totalDays}
                  pinnedByDay={trip.pinnedByDay}
                  generatedRouteByDay={trip.generatedRouteByDay}
                  onExportNotify={showToast}
                  onUpgradeRequest={() => setUpgradeOpen(true)}
                  onImportPins={handleImportPins}
                  mapCategoryFilter={mapPinCategoryFilter}
                  onToggleMapCategoryFilter={handleToggleMapCategoryFilter}
                  onRemove={handleRemovePin}
                  onReorder={handleReorderPinned}
                  onSelectPin={(p) => {
                    handleSelectPlace(p);
                    setMobileSheetLevel('peek');
                  }}
                  selectedPinIds={selectedPinIds}
                  onTogglePinSelection={handleTogglePinSelection}
                  onClearAll={handleClearAllPins}
                  onOpenRouteOptions={handleOpenRouteOptions}
                  routeOptionsOpen={routeOptionsOpen}
                  mustVisitOnly={mustVisitOnly}
                  onToggleMustVisitOnly={() => setMustVisitOnly((v) => !v)}
                  onToggleRequired={handleToggleRequired}
                  onShowTaxiCard={(p) => setTaxiCardPlace(p)}
                />
              ) : (
                <RouteOptionsPanel
                  embedded
                  open
                  onCompareRoutesChange={setCompareRoutes}
                  pinned={routePins}
                  currentDay={currentDay}
                  totalDays={trip.totalDays}
                  options={routeOptions}
                  hasExistingRoute={!!generatedRoute}
                  onChange={setRouteOptions}
                  onUpdateStayMinutes={handleUpdateStayMinutes}
                  onUpdateFixedArrival={handleUpdateFixedArrival}
                  onUpdateItemKind={handleUpdateItemKind}
                  onUpdateNote={handleUpdateNote}
                  onReorderPins={handleReorderRoutePins}
                  onClose={() => setMobileSheetLevel('peek')}
                  onGenerate={() => void handleGenerate()}
                  onPickOriginFromMap={handlePickOriginFromMap}
                  pickingOriginFromMap={pickingOriginFromMap}
                />
              )}
            </div>
          </div>


          {(
            <div className="mobile-planner-tabbar">
              <TripSelectMenu
                summaries={tripSummaries}
                currentTripId={trip.id}
                onSelect={handleSelectTrip}
                onNewTrip={handleNewTrip}
                onDeleteTrip={() => void handleDeleteTrip()}
                label={tp('chrome.tabTrips')}
                triggerClassName="mobile-tabbar-btn"
              />
              {isTourScenarioConfigured() && (
                <button
                  type="button"
                  className="mobile-tabbar-btn"
                  onClick={() => setScenarioOpen(true)}
                >
                  <Icon name="sparkles" size={20} />
                  {tp('chrome.tabScenario')}
                </button>
              )}
              <button
                type="button"
                className="mobile-tabbar-btn"
                onClick={() => setUpgradeOpen(true)}
              >
                <span className={`mobile-tabbar-plan-badge plan-${plan}`}>
                  {tb(`plan.${plan}`)}
                </span>
                {tp('chrome.tabAccount')}
              </button>
            </div>
          )}
        </>
      )}

      <MapContextMenu
        open={!!mapContextMenu}
        x={mapContextMenu?.x ?? 0}
        y={mapContextMenu?.y ?? 0}
        onSetSearchCenter={handleSetSearchCenterFromMap}
        onClose={() => setMapContextMenu(null)}
      />

      <TripMaterialsPanel
        open={materialsPanelOpen}
        onClose={() => setMaterialsPanelOpen(false)}
        materials={trip.materials ?? []}
        onChange={handleMaterialsChange}
        tripId={trip.id}
        tripTitle={trip.title}
        totalDays={trip.totalDays}
        currentDay={currentDay}
        pinnedByDay={trip.pinnedByDay}
        userId={user?.id ?? null}
        authConfigured={authConfigured}
        onNotify={showToast}
      />

      {pickingOriginFromMap && (
        <div className="picking-toast">
          <Icon name="pinSelect" />
          {tp('toast.pickOriginHint')}
        </div>
      )}

      {pickingPinFromMap && (
        <div className="picking-toast">
          <Icon name="pinPlus" />
          {tp('trip.pickingPin')}
        </div>
      )}

      <ManualPinModal
        open={!!pendingManualPin}
        lat={pendingManualPin?.lat ?? 0}
        lng={pendingManualPin?.lng ?? 0}
        address={pendingManualPin?.address ?? ''}
        onConfirm={handleConfirmManualPin}
        onClose={handleCancelManualPin}
      />

      <RoadviewModal
        key={roadviewTarget?.id ?? 'roadview-closed'}
        open={!!roadviewTarget}
        lat={roadviewTarget?.lat ?? 0}
        lng={roadviewTarget?.lng ?? 0}
        placeName={roadviewTarget?.name}
        provider={mapProvider}
        onClose={() => setRoadviewTarget(null)}
      />

      <PlacePhotosModal
        open={!!photosTarget}
        place={photosTarget}
        onClose={() => setPhotosTarget(null)}
        onShowTaxiCard={(p) => setTaxiCardPlace(p)}
        onHoursResolved={handleHoursResolved}
        pinned={photosTarget ? pinnedIds.has(photosTarget.id) : false}
        onTogglePin={handleTogglePin}
      />

      <TaxiDriverCardModal
        open={!!taxiCardPlace}
        place={taxiCardPlace}
        onClose={() => setTaxiCardPlace(null)}
      />

      <AppSheetModal
        open={scenarioOpen}
        title={tp('scenario.title')}
        onClose={() => setScenarioOpen(false)}
        wide
      >
        <ThemeScenarioPanel
          currentDay={currentDay}
          totalDays={trip.totalDays}
          pinnedByDay={trip.pinnedByDay}
          onApply={(result) => {
            handleImportPins(result);
            showToast(tp('scenario.applied', { count: result.importedCount }));
          }}
          onSelectPlace={(place) => {
            handleSelectPlace(place);
            setScenarioOpen(false);
          }}
        />
      </AppSheetModal>

      {showOnboarding && (
        <OnboardingCoach
          mobile={useMobileChrome}
          onOpenSearch={() => toggleMobileSheet('search')}
          onOpenPins={() => toggleMobileSheet('pins')}
          onOpenRoute={handleOpenRouteOptions}
        />
      )}

      <ShareTripModal
        open={shareModalOpen}
        tripTitle={trip.title}
        userEmail={user?.email ?? null}
        authConfigured={authConfigured}
        saving={shareSaving}
        onClose={() => !shareSaving && setShareModalOpen(false)}
        onConfirm={handleShareConfirm}
      />

      {/* 협업자에게도 연다 — 누구와 함께 편집하는지와 최근 변경 이력은
          공동편집에 필요한 정보다. 관리 조작은 모달 안에서 isOwner로 가린다. */}
      {(isTripOwner || trip.collaboratorRole) && user?.id && (
        <CollaboratorsModal
          open={collabModalOpen}
          tripId={trip.id}
          tripTitle={trip.title}
          currentUserId={user.id}
          isOwner={isTripOwner}
          onClose={() => setCollabModalOpen(false)}
        />
      )}

      <Toast message={toast} />
    </div>
  );
}
