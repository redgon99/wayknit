import { Icon } from '../components/Icon';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type {
  Place,
  PinnedPlace,
  RouteOptions,
  RouteStop,
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
import {
  generateRoute,
  refineRouteWithRealLegs,
  haversineMeters,
  diffRoutes,
} from '../lib/planner';
import { trackEvent } from '../lib/analytics';
import { isHoursProblem } from '../lib/openingHours';
import { EMPTY_LINK_EXTRACT_STATE, type LinkExtractUiState, type LinkPlacesExtractResult } from '../lib/linkPlaces';
import { consumeShareHandoff } from '../lib/shareTarget';
import { getPublishedGuideBySlug, isGuidesConfigured } from '../lib/guides';
import { importGuideCoursePins } from '../lib/guideCourseImport';
import { isValidHHMM } from '../lib/timeOfDay';
import { fetchLegs } from '../lib/mobility';
import { resolveOriginForRoute } from '../lib/resolveOrigin';
import {
  suggestStayMinutes,
  CATEGORY_MAP,
  DEFAULT_CODE_BY_SIMPLE_CATEGORY,
} from '../lib/categories';
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
  subscribeTripRealtime,
  hasCollaborators,
  getPinAuthors,
  getMaterialAuthors,
  pinAuthorKey,
  type Trip,
  type TripSummary,
} from '../lib/trips';
import { logTripActivity } from '../lib/tripActivity';
import type { ShareTripModalSubmit } from '../components/ShareTripModal';
import { ShareTripModal } from '../components/ShareTripModal';
import { CollaboratorsModal } from '../components/CollaboratorsModal';
import { MobileDaySelectMenu } from '../components/mobile/MobileDaySelectMenu';
import { MobileAccountSheet } from '../components/mobile/MobileAccountSheet';
import { PwaInstallButton } from '../components/PwaInstallButton';
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
import { MapPinPickHint } from '../components/MapPinPickHint';
import { ManualPinModal } from '../components/ManualPinModal';
import type { LongPressPoint } from '../hooks/useLongPress';
import { TripMaterialsPanel } from '../components/TripMaterialsPanel';
import { MobileMoreMenu } from '../components/mobile/MobileMoreMenu';
import { PresenceStack } from '../components/PresenceStack';
import { useTripPresence } from '../hooks/useTripPresence';
import { useIsMobile } from '../hooks/useIsMobile';
import { createManualPlace } from '../lib/manualPlace';
import type { PinImportResult } from '../lib/importPins';
import { SaveStatusBadge, type SaveStatus } from '../components/SaveStatusBadge';
import { OnboardingCoach } from '../components/OnboardingCoach';
import { ThemePreferenceChips } from '../components/ThemePreferenceChips';
import { TaxiDriverCardModal } from '../components/TaxiDriverCardModal';
import { ThemeScenarioPanel } from '../components/ThemeScenarioPanel';
import { AppSheetModal } from '../components/AppSheetModal';
import { isTourScenarioConfigured } from '../lib/tourScenario';
import {
  shouldShowOnboarding,
  shouldShowFirstItineraryGuide,
  isPlazaNavUnlocked,
  unlockPlazaNav,
} from '../lib/onboarding';
import { FirstItineraryGuide } from '../components/FirstItineraryGuide';
import { TRIP_THEMES } from '../lib/themes';
import { splitSearchQueries } from '../lib/searchQueries';
import { filterPlacesBySubFilters, type SearchSubFilterId } from '../lib/searchSubFilters';
import { isTourApiConfigured, searchTourPlaces, searchTourPlacesNearby } from '../lib/tourApi';
import {
  readRecentKeywords,
  pushRecentKeyword,
  removeRecentKeyword,
  clearRecentKeywords,
  readRecentPlaces,
  pushRecentPlace,
  removeRecentPlace,
} from '../lib/recentExplore';
import {
  listTripVotes,
  setTripVote,
  subscribeTripVotes,
  type PinVote,
  type VotesByPlace,
} from '../lib/tripVotes';
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
  /**
   * 표로보기 공유 아이콘에서 공유를 시작했을 때만 세운다 — 아직 비공개 여행이면
   * 기존 공유 모달(ShareTripModal)로 우회시키되, 그 결과로 만들어지는 링크에
   * "?view=table"을 붙여야 하는지 여기 기억해 둔다. 일반 "공유" 버튼에서 들어오면
   * 계속 빈 문자열이라 기존 동작(지도 링크)은 그대로다.
   */
  const [shareLinkSuffix, setShareLinkSuffix] = useState('');
  const [collabModalOpen, setCollabModalOpen] = useState(false);
  /**
   * U11(모바일 UX 리포트 2026-09-13) — "공유"와 "협업자 관리"가 각자
   * 별도 아이콘/메뉴 항목이라, 친구에게 "보기만" 보내려는 사람과 함께
   * 편집하려는 사람이 어디로 가야 할지 스스로 구분해야 했다. "공유" 진입을
   * 이 선택 시트로 한 단계 앞세워 "링크로 보기 / 함께 편집"을 먼저
   * 고르게 한다 — 기존 "협업자" 아이콘/메뉴는 빠른 경로로 그대로 둔다.
   */
  const [shareChooserOpen, setShareChooserOpen] = useState(false);
  // §26-7 — 관심 테마 편집. 예전엔 핀 탭 위에 상시 칩으로 얹혀 있어 핀 목록
  // 필터처럼 보였다. 검색·동선·공유마당 셋 다에 쓰이는 탭 무관 설정이라
  // 더보기 메뉴 뒤 시트로 옮겼다.
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  // 모바일 "계정" 항목이 예전엔 로그인 여부와 무관하게 UpgradeModal만 열었다
  // (2026-09-10 사용자 지적) — 실제 계정 정보·로그아웃·로그인 진입로가
  // 모바일 어디에도 없었다. MobileAccountSheet가 그 세 갈래(미설정/로그인/게스트)를 맡는다.
  const [accountOpen, setAccountOpen] = useState(false);
  /*
   * 공유받은 여행 알림은 모바일에서 잠깐만 보인다.
   *
   * 이 알약은 z-index 40 으로 상단 바(.mobile-planner-top, 25) 위에 떠서
   * 검색·여행자료·더보기 버튼을 통째로 덮어 누를 수 없게 만들고 있었다.
   * 390px 폭에 170px 알약이 상시로 앉을 자리가 없다 — 데스크톱처럼 지도
   * 여백에 두는 방법이 폰에는 없다. 그래서 알리고 사라지게 한다.
   * 사라진 뒤에도 상태는 ⋯ > 함께 편집 중인 사람에서 확인한다.
   */
  const [collabBannerFaded, setCollabBannerFaded] = useState(false);
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
  /** N03 — 마지막 클라우드 저장이 실패했는지(오프라인 등). 저장 상태 표시를 사실대로 낮추는 데 쓴다. */
  const [cloudSaveFailed, setCloudSaveFailed] = useState(false);
  /**
   * N05(모바일 UX 리포트 2026-09-13) — 도착 시각에 문 닫는 장소의 대체 후보.
   * `target`은 바꿀 대상 핀, `places`는 근처 같은 종류 후보다.
   */
  const [altTarget, setAltTarget] = useState<(PinnedPlace & Partial<RouteStop>) | null>(null);
  const [altPlaces, setAltPlaces] = useState<Place[]>([]);
  const [altLoading, setAltLoading] = useState(false);
  const [altError, setAltError] = useState<string | null>(null);
  /** N07 — 검색창이 빌 때 되살려 주는 탐색 흔적. 저장은 lib/recentExplore가 맡는다. */
  const [recentKeywords, setRecentKeywords] = useState<string[]>(() => readRecentKeywords());
  const [recentPlaces, setRecentPlaces] = useState<Place[]>(() => readRecentPlaces());
  /** N06 — 동행자 투표 집계(placeId → 가고싶음/보류 user id 목록). 협업 중일 때만 채운다. */
  const [pinVotes, setPinVotes] = useState<VotesByPlace>({});
  const [toast, setToast] = useState<string | null>(null);
  /** N02(모바일 UX 리포트 2026-09-13) — "되돌리기" 같은 실행 가능한 토스트용. 없으면 평소처럼 텍스트만. */
  const [toastAction, setToastAction] = useState<{ label: string; onClick: () => void } | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  // /share 에서 넘어온 링크 추출 결과 — 검색 패널이 붙여넣기 흐름처럼 이어받는다
  const [sharedExtract, setSharedExtract] = useState<LinkPlacesExtractResult | null>(null);
  /**
   * 링크 추출 결과 화면 상태 — 원래 SearchPanel의 로컬 useState였다. 모바일
   * 하단시트가 탭을 바꾸면(동선·핀 등) SearchPanel이 통째로 unmount돼
   * 로컬 state가 사라지고, 검색 탭으로 돌아오면 추출 결과가 사라져 있었다
   * (사용자 신고, 2026-09-20). query/searchScope처럼 여기(PlannerPage,
   * 탭을 바꿔도 안 사라짐)로 끌어올려 SearchPanel에 컨트롤드로 넘긴다.
   */
  const [linkExtractState, setLinkExtractState] =
    useState<LinkExtractUiState>(EMPTY_LINK_EXTRACT_STATE);

  useEffect(() => {
    setSharedExtract(consumeShareHandoff());
  }, []);

  function dismissToast() {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setToast(null);
    setToastAction(null);
  }

  function showToast(msg: string, action?: { label: string; onClick: () => void }) {
    setToast(msg);
    // 실행 후에도 토스트가 남아 있으면 "안 눌렸나?" 싶어 또 누르게 된다 — 실행하고 바로 닫는다.
    setToastAction(
      action
        ? {
            label: action.label,
            onClick: () => {
              action.onClick();
              dismissToast();
            },
          }
        : null
    );
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    // 되돌리기처럼 읽고 판단해야 하는 토스트는 더 오래 띄운다.
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      setToastAction(null);
    }, action ? 6000 : 2800);
  }

  // 경로 옵션 패널
  const [routeOptionsOpen, setRouteOptionsOpen] = useState(false);
  const [materialsPanelOpen, setMaterialsPanelOpen] = useState(false);
  // U14(모바일 UX 리포트 2026-09-13) — 핀 카드에서 특정 장소의 자료로 바로 필터링해서 연다.
  const [materialsPlaceFilter, setMaterialsPlaceFilter] = useState<string | null>(null);
  const [presentationMode, setPresentationMode] = useState(false);
  const [tableViewMode, setTableViewMode] = useState(false);
  const [tableViewInitialDay, setTableViewInitialDay] = useState<number | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [panelTab, setPanelTab] = useState<PlannerPanelTab>('search');
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [pickingOriginFromMap, setPickingOriginFromMap] = useState(false);
  const [pickingPinFromMap, setPickingPinFromMap] = useState(false);
  /** 롱프레스로 지도 핀업에 들어간 지점(뷰포트 픽셀) — 있으면 말풍선이 그 자리를, 없으면(데스크톱 버튼) 가운데 안내를 보여준다 */
  const [pinPickPoint, setPinPickPoint] = useState<LongPressPoint | null>(null);
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

  // 가이드「추천 여행코스」→ 코스 핀을 담은 뒤 자동 동선 패널
  const guideImportKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('autoRoute') !== '1') return;
    if (!hydrated) return;
    const guideTitle = params.get('guideTitle')?.trim() ?? '';
    const fromGuide = params.get('fromGuide')?.trim() ?? '';
    const importKey = `${fromGuide}::${guideTitle}`;
    if (guideImportKeyRef.current === importKey) return;

    let cancelled = false;
    (async () => {
      let imported = 0;
      let title = guideTitle;
      if (fromGuide && isGuidesConfigured()) {
        try {
          const guide = await getPublishedGuideBySlug(fromGuide);
          if (cancelled) return;
          title = (guideTitle || guide?.title || '').trim();
          if (guide?.coursePins?.length) {
            const result = importGuideCoursePins(guide.coursePins, {
              currentDay: 1,
              totalDays: trip.totalDays,
              existingByDay: trip.pinnedByDay,
              scope: 'all',
              mode: 'merge',
            });
            imported = result.importedCount;
            const next = normalizeTrip({
              ...patchRouteOptionsForDay(
                {
                  ...trip,
                  title: (title || trip.title).slice(0, 80),
                  pinnedByDay: result.pinnedByDay,
                  totalDays: result.totalDays,
                  currentDay: 1,
                  updatedAt: Date.now(),
                },
                1,
                { ...getRouteOptionsForDay(trip, 1), autoOrder: true }
              ),
            });
            setTrip(next);
            focusMapOnTrip(next);
          } else {
            setTrip((prev) => {
              const withOpts = patchRouteOptionsForDay(prev, prev.currentDay ?? 1, {
                ...getRouteOptionsForDay(prev, prev.currentDay ?? 1),
                autoOrder: true,
              });
              if (!title) return withOpts;
              return { ...withOpts, title: title.slice(0, 80), updatedAt: Date.now() };
            });
          }
        } catch (e) {
          console.warn('[planner] guide pin import failed', e);
          if (!cancelled) {
            showToast(i18n.t('toast.guideRouteFailed', { ns: 'planner' }));
          }
        }
      } else {
        setTrip((prev) => {
          const withOpts = patchRouteOptionsForDay(prev, prev.currentDay ?? 1, {
            ...getRouteOptionsForDay(prev, prev.currentDay ?? 1),
            autoOrder: true,
          });
          if (!title) return withOpts;
          return { ...withOpts, title: title.slice(0, 80), updatedAt: Date.now() };
        });
      }
      if (cancelled) return;
      guideImportKeyRef.current = importKey;
      navigate({ pathname: location.pathname, search: '', hash: location.hash }, { replace: true });
      setMaterialsPanelOpen(false);
      setRouteOptionsOpen(true);
      setPanelTab(imported > 0 ? 'pins' : 'route');
      setPanelOpen(true);
      if (imported > 0) {
        showToast(
          i18n.t('toast.guideRouteImported', {
            ns: 'planner',
            title: title || guideTitle,
            count: imported,
          })
        );
      } else if (fromGuide) {
        showToast(
          i18n.t('toast.guideRouteEmpty', { ns: 'planner', title: title || guideTitle })
        );
      } else {
        showToast(
          title
            ? i18n.t('toast.guideRouteHint', { ns: 'planner', title })
            : i18n.t('toast.autoRouteHint', { ns: 'planner' })
        );
      }
    })();

    return () => {
      cancelled = true;
    };
    // trip is the hydrated snapshot; do not re-run on later pin edits
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, location.search]);

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
        /*
         * Free 캡(여행 3개)이 "+ 새 여행" 버튼(handleNewTrip)에만 걸려 있고
         * 여기(세션 복구 시 "저장된 여행을 못 찾음" 폴백)는 뚫려 있었다 —
         * 2026-09-15 사용자가 "무료인데 왜 여행이 24개나 있냐" 제보로 발견.
         *
         * `tripsRepo.load(userId)`(tripId 없이 호출)가 null을 돌려주는 건
         * "진짜 여행이 0개"뿐 아니라 **원격 조회가 실패·타임아웃했을 때도**
         * 똑같이 null이다(§29-31, 오프라인 대응을 위해 일부러 그렇게 설계함).
         * 즉 이 계정에 여행이 이미 여러 개 있어도, 이 기기의 로컬 캐시가
         * 비어 있고 하필 그 순간 네트워크가 불안정하면 "0개"로 오판해
         * 매번 새 여행을 만들고 클라우드에 저장해버린다 — Playwright처럼
         * 매번 빈 브라우저 컨텍스트로 테스트하면 이 경합이 거의 확실히
         * 걸린다(이번에 발견된 24개가 그 증거).
         *
         * 완벽한 해결(원격 실패와 "진짜 0개"를 구분)은 이번 범위를 넘는다.
         * 대신 **저장 직전에 한 번 더** 방금 읽은 `tripSummaries`로 캡을
         * 확인한다 — 이러면 "정말 0개인 신규 계정"은 평소처럼 만들어지고,
         * "이미 여러 개 있는 계정"에서 이 폴백이 잘못 걸려도 최소한 클라우드에
         * 새 행을 추가하진 않는다(화면엔 빈 여행이 보이지만 저장은 안 됨 —
         * 사용자가 핀을 담으면 그때 자동저장이 같은 캡 검사를 통과 못 해
         * 업그레이드 안내를 보게 된다).
         */
        if (canCreateTrip(plan, tripSummaries.length, isAdmin)) {
          try {
            await tripsRepo.save({ ...fresh, ownerId: userId ?? undefined });
          } catch (e) {
            /* 클라우드 저장이 실패해도 로컬에는 이미 저장됐다(tripsRepo.save 내부 순서상
             * writeLocal이 writeRemote보다 먼저 실행됨). 여기서 그대로 던지면 hydrated가
             * true로 세팅되지 못해, 다음 리렌더/새로고침마다 이 분기가 다시 실행되며
             * 매번 새로운 "새 여행"을 만들어내는 문제가 생긴다. */
            console.warn('새 여행 클라우드 저장 실패(로컬에는 저장됨)', e);
          }
        } else {
          console.warn('Free 캡 초과로 새 여행을 클라우드에 저장하지 않음(화면엔만 표시)');
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
      try {
        await tripsRepo.save({
          ...trip,
          // 협업자가 저장해도 원래 소유자를 절대 덮어쓰지 않는다 —
          // trip에 이미 ownerId가 있으면 그대로 두고, 없을 때(새 여행)만 나로 채운다.
          ownerId: trip.ownerId ?? userId ?? undefined,
          updatedAt: Date.now(),
        });
        setCloudSaveFailed(false);
      } catch (e) {
        /* N03 — 오프라인이면 클라우드 쓰기만 실패한다(로컬은 tripsRepo.save 안에서
         * writeLocal이 먼저 끝났다). 예전엔 여기서 그대로 튕겨 아래 setSavePending(false)가
         * 실행되지 않아 저장 배지가 "저장 중…"에 영영 멈춰 있었다. 흐름은 이어가되
         * 상태만 '로컬'로 낮춘다. */
        console.warn('클라우드 저장 실패 — 기기에는 저장됨', e);
        setCloudSaveFailed(true);
      }
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
  // 병합 시점에는 항상 최신 상태를 봐야 한다.
  const tripRef = useRef(trip);
  tripRef.current = trip;
  useEffect(() => {
    if (!hydrated || !trip.id || !trip.ownerId) return;
    return subscribeTripRealtime(
      trip.id,
      () => tripRef.current,
      (patch) => {
        // 실제로 달라진 것만 담겨 온다(아무것도 안 바뀌면 애초에 안 불린다).
        // updatedAt은 건드리지 않는다 — 여기서 갱신하면 자동저장 이펙트가
        // 깨어나 두 클라이언트가 저장을 끝없이 주고받는다.
        setTrip((prev) => {
          const next = { ...prev, ...patch };
          // 일차가 줄었는데 그 날을 보고 있으면 빈 화면이 된다.
          if (patch.totalDays !== undefined && next.currentDay > patch.totalDays) {
            next.currentDay = patch.totalDays;
          }
          return next;
        });
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

  /** 자료 작성자 — 같은 이유로 자료 목록이 갱신될 때마다 다시 읽는다(§22). */
  const [materialAuthors, setMaterialAuthors] = useState<Record<string, string | null>>({});
  useEffect(() => {
    setMaterialAuthors(getMaterialAuthors(trip.id));
  }, [trip.id, trip.materials]);

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

      if (mapProvider === 'google' && !(await canRunGoogleSearch(plan, isAdmin, user?.id))) {
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
          if (mapProvider === 'google') void recordGoogleSearch(plan, isAdmin, user?.id);
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
          if (mapProvider === 'google') void recordGoogleSearch(plan, isAdmin, user?.id);
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
        // N07 — 결과가 실제로 나온 키워드만 기억한다(빈 결과·카테고리 브라우징 제외)
        if (!append && keyword && withDistance.length > 0) {
          setRecentKeywords(pushRecentKeyword(keyword));
        }
        if (mapProvider === 'google') void recordGoogleSearch(plan, isAdmin, user?.id);
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

  /**
   * 모바일에서 검색 결과 칩·핀 마커를 선택하면 지도 중심을 그 좌표로 옮기는데,
   * 화면 전체를 기준으로 중앙에 놓다 보니 하단 시트(그리고 상단바)에 가려진
   * 영역까지 포함해 계산돼 실제로 "보이는" 지도 영역에서는 중앙이 아니라
   * 시트 위쪽 가장자리 근처에 표시됐다. occludedCenterShiftPx(데스크톱, 좌우)와
   * 같은 원리를 세로 축에 적용한다 — CSS 퍼센트/상수를 다시 계산하는 대신
   * 실제 렌더된 상단바·시트 요소의 위치를 그대로 잰다(시트 레벨이 peek/half/full
   * 로 바뀌어도 항상 맞는다).
   */
  const mobileOccludedCenterShiftPy = useCallback(() => {
    if (typeof window === 'undefined') return 0;
    if (!document.querySelector('.wayknit-root.mobile-layout')) return 0;
    const topBar = document.querySelector('.mobile-planner-top');
    const sheet = document.querySelector('.mobile-planner-sheet');
    const topOccluded = topBar ? topBar.getBoundingClientRect().bottom : 0;
    const sheetTop = sheet ? sheet.getBoundingClientRect().top : window.innerHeight;
    const bottomOccluded = Math.max(0, window.innerHeight - sheetTop);
    const visibleCenter = (topOccluded + (window.innerHeight - bottomOccluded)) / 2;
    return visibleCenter - window.innerHeight / 2;
  }, []);

  const handleOpenPlacePhotos = useCallback((place: Place) => {
    setPhotosTarget(place);
    /* N07 — 담지 않은 장소만 "최근 본 장소"로. 담은 건 핀 목록에 이미 있다.
     * 의존성에 핀 목록을 넣으면 핀이 바뀔 때마다 이 콜백이 새로 만들어져
     * 지도 쪽 memo가 흔들리므로 ref로 읽는다. */
    const pinnedNow = tripRef.current.pinnedByDay[tripRef.current.currentDay] ?? [];
    if (!pinnedNow.some((p) => p.id === place.id)) setRecentPlaces(pushRecentPlace(place));
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

  /**
   * 링크 추출 결과 일괄 핀업(2026-09-20 사용자 요청) — SearchPanel이 이름을
   * 실제 장소로 찾아 넘겨주면, 여기서 한 번에 담는다. `handleTogglePin`을
   * 후보 개수만큼 반복 호출하면 안 된다 — 그 함수는 렌더 시점의
   * `trip.pinnedByDay`를 클로저로 들고 있어서, 같은 틱에서 여러 번 부르면
   * 매번 "그 전 호출 결과가 반영 안 된" 오래된 배열에 이어붙이게 되고,
   * 마지막 호출의 `setPinnedForDay`만 남아 앞선 것들이 사라진다. 여기서는
   * 배열을 한 번만 만들어 `setPinnedForDay`를 한 번만 부른다.
   * 반환값은 실제로 새로 추가된 개수(이미 핀된 것은 건너뜀 — 토글이
   * 아니라 순수 추가라서 중복 클릭으로 빼지는 일이 없다).
   */
  const handleBulkAddPlaces = useCallback(
    (places: Place[]) => {
      if (trip.collaboratorRole === 'viewer') {
        showToast(ts('collab.readOnlyBanner'));
        return 0;
      }
      const current = trip.pinnedByDay[currentDay] ?? [];
      const existingIds = new Set(current.map((p) => p.id));
      const toAdd: Place[] = [];
      const seen = new Set<string>();
      for (const place of places) {
        if (existingIds.has(place.id) || seen.has(place.id)) continue;
        seen.add(place.id);
        toAdd.push(place);
      }
      if (toAdd.length === 0) return 0;
      const next = [
        ...current,
        ...toAdd.map((place, i) => ({
          ...place,
          nameKo: place.nameKo ?? place.name,
          pinnedAt: Date.now(),
          order: current.length + i + 1,
          stayMinutes: suggestStayMinutes(place.category).minutes,
          day: currentDay,
        })),
      ];
      setPinnedForDay(currentDay, next);
      showToast(tp('toast.bulkPinned', { n: toAdd.length }));
      return toAdd.length;
    },
    [trip.pinnedByDay, trip.collaboratorRole, currentDay, tp, ts]
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
    setMaterialsPlaceFilter(null);
    setMaterialsPanelOpen(true);
  }, []);

  /**
   * U14(모바일 UX 리포트 2026-09-13) — "장소 카드에서 연결 자료를 바로
   * 연다"는 요청. 핀 카드에 자료 개수 배지를 붙이고, 누르면 자료 패널을
   * 그 장소로 필터링해서 연다.
   */
  const handleOpenPlaceMaterials = useCallback((placeId: string) => {
    setRouteOptionsOpen(false);
    setMaterialsPlaceFilter(placeId);
    setMaterialsPanelOpen(true);
  }, []);

  const materialCountByPlace = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const m of trip.materials ?? []) {
      if (!m.pinnedPlaceId) continue;
      counts[m.pinnedPlaceId] = (counts[m.pinnedPlaceId] ?? 0) + 1;
    }
    return counts;
  }, [trip.materials]);

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

  /**
   * N04(모바일 UX 리포트 2026-09-13) — 자료(메모)에서 찾은 예약 시각을 핀에 고정한다.
   *
   * `handleUpdateFixedArrival`은 **현재 일차만** 훑는다. 자료는 다른 일차의 장소에도
   * 연결되므로 여기서는 전체 일차를 훑는다. 예약은 시간이 움직이면 안 되는 약속이라
   * `itemKind: 'reserved'`까지 같이 세워 동선 재계산의 하드 앵커가 되게 한다.
   */
  const handleApplyReservationToPin = useCallback((placeId: string, time: string) => {
    if (!isValidHHMM(time)) return;
    setTrip((prev) => {
      const nextByDay: typeof prev.pinnedByDay = {};
      let changed = false;
      for (const [dayKey, list] of Object.entries(prev.pinnedByDay)) {
        nextByDay[Number(dayKey)] = list.map((p) => {
          if (p.id !== placeId) return p;
          changed = true;
          return { ...p, fixedArrival: time, itemKind: 'reserved' as const };
        });
      }
      if (!changed) return prev;
      return { ...prev, pinnedByDay: nextByDay, updatedAt: Date.now() };
    });
  }, []);

  /**
   * N05 — 도착 시각에 영업이 안 하는 장소의 **근처 같은 종류** 후보를 찾는다.
   *
   * 리포트는 "비·휴무·지연 시 실내/유사 장소"를 말하지만 이 앱엔 **날씨 연동이
   * 없다** — 날씨로 트리거하려면 외부 API를 새로 붙여야 하고, 그건 별도 결정이다.
   * 대신 **이미 판정하고 있는 영업시간 문제**(`hoursStatus`)에 붙였다. 경고만
   * 띄우고 아무 대안도 주지 않던 자리라 효과가 가장 직접적이다.
   */
  const handleFindAlternatives = useCallback(
    async (stop: PinnedPlace & Partial<RouteStop>) => {
      setAltTarget(stop);
      setAltPlaces([]);
      setAltError(null);
      setAltLoading(true);
      try {
        // 'OTHER'면 카테고리 검색이 안 되므로 단순 분류로 한 번 더 내려본다
        const code =
          stop.categoryCode && stop.categoryCode !== 'OTHER'
            ? stop.categoryCode
            : DEFAULT_CODE_BY_SIMPLE_CATEGORY[stop.category];
        if (!code || code === 'OTHER') {
          setAltError(tp('alt.noCategory'));
          return;
        }
        const center = { lat: stop.lat, lng: stop.lng };
        const result =
          mapProvider === 'google'
            ? await searchPlacesUnifiedWithGoogle({
                categoryGroupCode: code,
                center,
                radiusMeters: 1500,
                scope: 'nearby',
                size: 15,
                page: 1,
              })
            : await searchPlacesUnified({
                categoryGroupCode: code,
                center,
                radiusMeters: 1500,
                scope: 'nearby',
                size: 15,
                page: 1,
              });
        /*
         * 이미 담은 장소를 후보로 다시 내밀면 안 된다. 그런데 **id만으로는 못 거른다** —
         * 지도 제공자가 구글이면 검색 결과 id가 구글 것(`g:ChIJ…`)이라, 카카오로 담아 둔
         * 같은 가게(`10306183`)와 값이 다르다. 실제로 "도미노피자 원주점"이 두 번 담기는
         * 것을 검증에서 확인했다. 그래서 id·이름·좌표(약 50m) 셋 중 하나라도 겹치면 뺀다.
         */
        const pinned = trip.pinnedByDay[currentDay] ?? [];
        const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '');
        const isAlreadyPinned = (p: Place) =>
          pinned.some(
            (q) =>
              q.id === p.id ||
              norm(q.nameKo ?? q.name) === norm(p.nameKo ?? p.name) ||
              haversineMeters({ lat: q.lat, lng: q.lng }, { lat: p.lat, lng: p.lng }) < 50
          );
        const candidates = result.places
          .filter((p) => p.id !== stop.id && !isAlreadyPinned(p))
          .slice(0, 3);
        setAltPlaces(candidates);
        if (candidates.length === 0) setAltError(tp('alt.empty'));
      } catch (e) {
        console.warn('대체 장소 검색 실패', e);
        setAltError(tp('alt.failed'));
      } finally {
        setAltLoading(false);
      }
    },
    [mapProvider, trip.pinnedByDay, currentDay, tp]
  );

  /** N05 — 같은 자리(순서·체류시간·필수여부 유지)에 다른 장소를 끼워 넣는다 */
  const handleReplacePin = useCallback(
    (oldPlaceId: string, next: Place) => {
      if (trip.collaboratorRole === 'viewer') {
        showToast(ts('collab.readOnlyBanner'));
        return;
      }
      setTrip((prev) => {
        const list = prev.pinnedByDay[currentDay] ?? [];
        const idx = list.findIndex((p) => p.id === oldPlaceId);
        if (idx < 0) return prev;
        const old = list[idx];
        const replaced: PinnedPlace = {
          ...next,
          day: currentDay,
          pinnedAt: Date.now(),
          order: old.order,
          // 같은 종류라 머무는 시간은 대체로 비슷하다 — 사용자가 맞춰 둔 값을 살린다.
          stayMinutes: old.stayMinutes,
          required: old.required,
        };
        const nextList = [...list];
        nextList[idx] = replaced;
        return {
          ...prev,
          pinnedByDay: { ...prev.pinnedByDay, [currentDay]: nextList },
          updatedAt: Date.now(),
        };
      });
      setAltTarget(null);
      setAltPlaces([]);
      showToast(tp('alt.replaced', { name: next.name }));
    },
    [currentDay, trip.collaboratorRole, ts, tp]
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
    setTableViewInitialDay(null);
    setTableViewMode((prev) => !prev);
  }, []);

  const handleCloseTableView = useCallback(() => {
    setTableViewMode(false);
    setTableViewInitialDay(null);
  }, []);

  /**
   * U05(모바일 UX 리포트 2026-09-13) — 모바일 "동선짜기" 탭이 항상
   * RouteOptionsPanel(출발시각·이동수단·최적화 설정 폼)부터 보여줘서,
   * 이미 만든 일정의 시간표를 보려는 재방문 사용자가 메뉴 → 표로보기를
   * 따로 찾아야 했다. 오늘 동선이 이미 있으면 설정 폼 대신 이 일차로
   * 필터된 표로보기를 먼저 연다 — 설정은 표 헤더의 편집 아이콘
   * (onEditRoute)으로 명시적으로 들어가야 열리게 분리한다.
   */
  const handleOpenRouteTable = useCallback(() => {
    setTableViewInitialDay(currentDay);
    setTableViewMode(true);
  }, [currentDay]);

  const handleEditRouteFromTable = useCallback(() => {
    setTableViewMode(false);
    setTableViewInitialDay(null);
    setMobileSheetTab('route');
    setRouteOptionsOpen(true);
  }, []);

  const handlePickOriginFromMap = useCallback(() => {
    setPickingPinFromMap(false);
    setPinPickPoint(null);
    setPendingManualPin(null);
    setPickingOriginFromMap(true);
  }, []);

  /** 데스크톱의 지도 핀업 버튼 — 롱프레스와 달리 누른 지점이 없어 가운데 안내로 보여준다 */
  const handleTogglePinFromMap = useCallback(() => {
    setPickingOriginFromMap(false);
    setPendingManualPin(null);
    setPinPickPoint(null);
    setPickingPinFromMap((v) => !v);
  }, []);

  /**
   * 모바일 지도 롱프레스 — 지도 핀업의 유일한 입구라 토글로 켜고 끈다.
   * 출발지 픽 모드 중에는 무시(그 모드는 롱프레스가 아니라 동선 패널에서 켠다).
   * 누른 지점을 함께 저장해 말풍선(`MapPinPickHint`)이 그 자리를 가리키게 한다.
   */
  const handleLongPressPin = useCallback(
    (point: LongPressPoint) => {
      if (pickingOriginFromMap) return;
      if (pickingPinFromMap) {
        setPickingPinFromMap(false);
        setPinPickPoint(null);
        return;
      }
      setPendingManualPin(null);
      setPickingPinFromMap(true);
      setPinPickPoint(point);
    },
    [pickingOriginFromMap, pickingPinFromMap]
  );

  const handlePinLocationPicked = useCallback((lat: number, lng: number, address: string) => {
    setPickingPinFromMap(false);
    setPinPickPoint(null);
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
      // N02(모바일 UX 리포트 2026-09-13) — 재계획 직전 상태를 남겨둔다.
      // "되돌리기"는 이 값으로 되돌아가는 것뿐이다(핀 추가·삭제 자체를
      // 취소하진 않는다 — 그건 핀 목록에서 따로 할 일이다. 여기서 되돌리는
      // 건 "동선"이라는 계산 결과 하나뿐).
      const previousRoute = generatedRoute;
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
      let finalRoute = base;
      try {
        const refined = await refineRouteWithRealLegs(base, fetchLegs);
        setRouteForDay(currentDay, refined);
        finalRoute = refined;
      } catch (e) {
        console.warn('경로 보강 실패', e);
      } finally {
        setRefining(false);
      }

      // N02 — 재계획 전후 비교 + 되돌리기. 첫 생성(previousRoute 없음)이면
      // 비교할 대상이 없으니 기존처럼 "실제 경로 정보 반영" 안내만 한다.
      if (previousRoute) {
        const diff = diffRoutes(previousRoute, finalRoute);
        const parts: string[] = [];
        if (diff.addedCount > 0) parts.push(tp('toast.routeDiffAdded', { count: diff.addedCount }));
        if (diff.removedCount > 0) parts.push(tp('toast.routeDiffRemoved', { count: diff.removedCount }));
        if (diff.travelDeltaMinutes !== 0) {
          parts.push(
            tp('toast.routeDiffTravel', {
              sign: diff.travelDeltaMinutes > 0 ? '+' : '',
              minutes: diff.travelDeltaMinutes,
            })
          );
        }
        if (parts.length > 0) {
          showToast(parts.join(' · '), {
            label: tp('toast.routeChangeUndo'),
            onClick: () => setRouteForDay(currentDay, previousRoute),
          });
        }
      } else if (finalRoute.legs.some((l) => l.source === 'api')) {
        showToast(tp('toast.routeRefined'));
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

      const url = `${window.location.origin}/trip/${trip.slug}${shareLinkSuffix}`;
      setShareLinkSuffix('');
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
    [trip, user, showToast, shareLinkSuffix]
  );

  /**
   * 표로보기 모달의 공유 아이콘. 이미 공개 여행이면 그 자리에서 바로
   * "?view=table" 링크를 만들어 복사하고, 아직 비공개면 기존 공유 모달
   * (ShareTripModal)을 그대로 띄운다 — 표시이름·공유마당 등록 여부를 다시
   * 묻는 절차를 중복으로 만들지 않기 위해서다. 모달 확인 후 handleShareConfirm이
   * shareLinkSuffix를 읽어 붙인다.
   */
  const handleShareFromTable = useCallback(() => {
    if (trip.isPublic) {
      const url = `${window.location.origin}/trip/${trip.slug}?view=table`;
      const copied = () => showToast(tp('toast.tableViewLinkCopied'));
      if (navigator.share) {
        navigator.share({ title: trip.title, url }).catch(() => {
          navigator.clipboard?.writeText(url).then(copied);
        });
      } else {
        navigator.clipboard?.writeText(url).then(copied);
      }
      return;
    }
    setShareLinkSuffix('?view=table');
    openShareModal();
  }, [trip, showToast, openShareModal]);

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
  /** N08 — 목표는 "핀 3곳 + 동선 1개"(리포트가 명시한 완료 기준) */
  const FIRST_ITINERARY_PIN_GOAL = 3;
  const hasAnyRoute = useMemo(
    () => Object.values(trip.generatedRouteByDay).some(Boolean),
    [trip.generatedRouteByDay]
  );
  const showFirstItineraryGuide = shouldShowFirstItineraryGuide(
    showOnboarding,
    hydrated,
    totalPinCount,
    FIRST_ITINERARY_PIN_GOAL,
    hasAnyRoute
  );

  const saveStatus: SaveStatus = useMemo(() => {
    if (savePending) return 'syncing';
    // N03 — 로그인해 있어도 클라우드 쓰기가 실패했으면(오프라인 등) "저장됨"이라고
    // 하면 거짓말이 된다. 기기에는 저장됐으므로 '로컬'로 낮춰 사실대로 보여준다.
    if (authConfigured && user) return cloudSaveFailed ? 'local' : 'cloud';
    if (authConfigured && !user) return 'guest';
    return 'local';
  }, [savePending, authConfigured, user, cloudSaveFailed]);

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
   * presence 채널을 여기서 연다 — 이전에는 `PlannerAppBar` 안에서 열었다.
   *
   * 앱바는 데스크톱에서만 렌더되므로(`desktop-only-overlay`) **모바일에는 아바타가
   * 아예 없었다.** 폰으로 공동편집을 하면 상대가 접속 중인지 알 수 없다.
   *
   * 모바일 상단바에서 훅을 한 번 더 부르면 안 된다 — 같은 여행에 채널이 두 개
   * 열려 자기 자신이 두 명으로 세어지고, `presence_multi_viewer` 이벤트도
   * 두 번 나간다. 그래서 한 곳에서 열어 아바타 목록만 내려보낸다.
   */
  const presenceViewers = useTripPresence(trip.id, presenceEnabled);

  /**
   * 핀 작성자 배지를 볼 수 있는 사람 — 소유자와 협업자뿐이다.
   *
   * presenceEnabled 를 그대로 쓰면 안 된다. 거기엔 isPublic 이 들어 있어서,
   * 공개 여행을 구경하는 아무나에게 협업자 이메일이 보인다. §5-2-3 에서
   * 활동 로그를 공개 여행에서도 감춘 것과 같은 판단이다 — 누가 무엇을
   * 넣었는지는 열람자에게 줄 정보가 아니다.
   */
  const canSeePinAuthors = isTripOwner || Boolean(trip.collaboratorRole);

  /**
   * N06 — 투표는 **정말 동행자가 있을 때만** 켠다. 소유자 혼자인 여행에서
   * 나 혼자 표를 던지는 건 의미가 없고 카드만 복잡해진다. 협업자로 들어온
   * 사람은 그 자체로 동행자가 있다는 뜻이다.
   */
  const votesEnabled =
    Boolean(user?.id) && ((isTripOwner && ownerHasCollaborators) || Boolean(trip.collaboratorRole));

  useEffect(() => {
    if (!votesEnabled || !trip.id) {
      setPinVotes({});
      return;
    }
    let alive = true;
    void listTripVotes(trip.id).then((v) => {
      if (alive) setPinVotes(v);
    });
    const unsubscribe = subscribeTripVotes(trip.id, (v) => {
      if (alive) setPinVotes(v);
    });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [votesEnabled, trip.id]);

  /** N06 — 같은 표를 다시 누르면 거둔다(토글). 낙관적으로 먼저 그리고 서버에 쓴다. */
  const handleVote = useCallback(
    (placeId: string, vote: PinVote) => {
      const uid = user?.id;
      if (!uid || !trip.id) return;
      const cur = pinVotes[placeId];
      const mine: PinVote | null = cur?.want.includes(uid)
        ? 'want'
        : cur?.hold.includes(uid)
          ? 'hold'
          : null;
      const next: PinVote | null = mine === vote ? null : vote;
      setPinVotes((prev) => {
        const t = { want: [...(prev[placeId]?.want ?? [])], hold: [...(prev[placeId]?.hold ?? [])] };
        t.want = t.want.filter((u) => u !== uid);
        t.hold = t.hold.filter((u) => u !== uid);
        if (next) t[next].push(uid);
        return { ...prev, [placeId]: t };
      });
      void setTripVote(trip.id, placeId, uid, next).catch((e) => {
        console.warn('투표 저장 실패', e);
        showToast(tp('vote.failed'));
        void listTripVotes(trip.id).then(setPinVotes);
      });
    },
    [user?.id, trip.id, pinVotes, tp]
  );

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
    if (!useMobileChrome || !trip.collaboratorRole) {
      setCollabBannerFaded(false);
      return;
    }
    setCollabBannerFaded(false);
    const id = window.setTimeout(() => setCollabBannerFaded(true), 4500);
    return () => window.clearTimeout(id);
  }, [useMobileChrome, trip.collaboratorRole, trip.id]);

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
          centerOffsetY={infoWindowPlace ? mobileOccludedCenterShiftPy() : 0}
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

      {!useMobileChrome && (
        <button
          type="button"
          className={`map-type-toggle ${mapType === 'satellite' ? 'active' : ''}`}
          onClick={() => setMapType((prev) => (prev === 'satellite' ? 'roadmap' : 'satellite'))}
          title={tp(mapType === 'satellite' ? 'view.mapTypeRoadmap' : 'view.mapTypeSatellite')}
          aria-label={tp(mapType === 'satellite' ? 'view.mapTypeRoadmap' : 'view.mapTypeSatellite')}
        >
          <Icon name="layers" size={18} />
        </button>
      )}

      <InviteBanner />

      {trip.collaboratorRole && (
        <div className={`trip-readonly-banner ${collabBannerFaded ? 'faded' : ''}`}>
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
            onShare={() => setShareChooserOpen(true)}
            onManageCollaborators={
              isTripOwner || trip.collaboratorRole ? () => setCollabModalOpen(true) : undefined
            }
            collabEntryLabel={isTripOwner ? undefined : 'shared'}
            onOpenPreferences={() => setPreferencesOpen(true)}
            presenceViewers={presenceViewers}
            presentationMode={presentationMode}
            onTogglePresentation={handleTogglePresentation}
            tableViewMode={tableViewMode}
            onToggleTableView={handleToggleTableView}
            plazaNavVisible={plazaNavVisible}
            onOpenAccount={() => setAccountOpen(true)}
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
                recentKeywords={recentKeywords}
                onRemoveRecentKeyword={(k) => setRecentKeywords(removeRecentKeyword(k))}
                onClearRecentKeywords={() => setRecentKeywords(clearRecentKeywords())}
                recentPlaces={recentPlaces}
                onRemoveRecentPlace={(id) => setRecentPlaces(removeRecentPlace(id))}
                initialExtract={sharedExtract}
                linkExtractState={linkExtractState}
                onLinkExtractStateChange={setLinkExtractState}
                onBulkAddPlaces={handleBulkAddPlaces}
                foodRestrictions={trip.foodRestrictions ?? []}
                onFoodRestrictionsChange={handleFoodRestrictionsChange}
                categorySubFilters={categorySubFilters}
                onCategorySubFiltersChange={setCategorySubFilters}
                preferences={trip.preferences}
              />
            }
            pinsSlot={
              <>
                <PinupBar
                  variant="panel"
                  hideHeader
                  pinAuthors={canSeePinAuthors ? pinAuthors : undefined}
                  pinVotes={votesEnabled ? pinVotes : undefined}
                  myUserId={user?.id ?? null}
                  onVote={votesEnabled ? handleVote : undefined}
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
                  onGoToSearch={() => openPlannerTab('search')}
                  materialCountByPlace={materialCountByPlace}
                  onOpenPlaceMaterials={handleOpenPlaceMaterials}
                />
              </>
            }
            routeSlot={
              <RouteOptionsPanel
                embedded
                open
                onCompareRoutesChange={setCompareRoutes}
                onFindAlternatives={isReadOnlyViewer ? undefined : handleFindAlternatives}
                pinned={routePins}
                currentDay={currentDay}
                totalDays={trip.totalDays}
                options={routeOptions}
                hasExistingRoute={!!generatedRoute}
                existingRoute={generatedRoute}
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
                  onGoToSearch={() => setPanelTab('search')}
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
        onShare={handleShareFromTable}
        initialDayFilter={tableViewInitialDay}
        onEditRoute={tableViewInitialDay != null ? handleEditRouteFromTable : undefined}
      />

      {useMobileChrome && (
        <>
          {/*
            예전엔 여행 칩(제목+전환) 행과 일차+도구 행이 세로로 나뉘어 있었다.
            한 줄로 합쳤다 — 제목 텍스트는 뺐다. 시트 헤더가 바로 아래에서
            같은 제목을 이미 보여주고 있어(mobile-sheet-head-title) 한 화면에
            두 번 나오는 중복이었다. 전환 버튼(chevron)만 남기고 다른 도구
            버튼들과 같은 36px 아이콘 버튼 한 뭉치로 묶는다.
          */}
          <div className="mobile-planner-top">
            <div className="mobile-planner-trip-trigger">
              <TripSelectMenu
                summaries={tripSummaries}
                currentTripId={trip.id}
                onSelect={handleSelectTrip}
                onNewTrip={handleNewTrip}
                onDeleteTrip={() => void handleDeleteTrip()}
                compact
              />
            </div>
            {/*
              일차가 늘수록 필(pill)이 한 줄을 다 먹던 걸 버튼 하나로 접었다
              (사용자 요청, 2026-09-10). 생긴 공간엔 §27에서 뺐던 여행 제목을
              일부만이라도 다시 보여준다 — 배지가 아니라 truncate되는 텍스트라
              공간이 없으면 자동으로 줄어든다.
            */}
            <span className="mobile-planner-trip-title">{trip.title}</span>
            <MobileDaySelectMenu
              totalDays={trip.totalDays}
              currentDay={currentDay}
              countsByDay={countsByDay}
              onSelectDay={selectDay}
              onAddDay={addDay}
            />
            {/*
              혼자 편집할 때는 PresenceStack이 null을 돌려주므로 이 자리가
              비어 있다 — 좁은 폰 화면을 상시로 잡아먹지 않는다.
            */}
            <PresenceStack viewers={presenceViewers} max={3} />
            {/*
              U06(모바일 UX 리포트 2026-09-13) — saveStatus는 이미 계산돼
              있었지만 데스크톱 PlannerAppBar에만 전달되고 모바일 상단에는
              저장 상태를 보여줄 곳이 없었다. 이 줄은 이미 빠듯해(U02) 텍스트
              라벨을 넣을 폭이 없으므로 compact(아이콘만)로 붙이고, 탭하면
              토스트로 전체 문구+마지막 저장 시각을 보여준다.
            */}
            <div className="mobile-save-status">
              <SaveStatusBadge
                status={saveStatus}
                lastSavedAt={lastSavedAt ?? trip.updatedAt}
                compact
                onGuestClick={() => navigate('/login')}
                onTap={(msg) => showToast(msg)}
              />
            </div>
            <div className="mobile-planner-tools">
              <button
                type="button"
                className="mobile-tool-btn"
                onClick={openMobileSearchTab}
                title={tp('search.ariaLabel')}
                aria-label={tp('search.ariaLabel')}
              >
                <Icon name="search" size={17} />
              </button>
              <button
                type="button"
                className={`mobile-tool-btn ${mapType === 'satellite' ? 'active' : ''}`}
                onClick={() => setMapType((prev) => (prev === 'satellite' ? 'roadmap' : 'satellite'))}
                title={tp(mapType === 'satellite' ? 'view.mapTypeRoadmap' : 'view.mapTypeSatellite')}
                aria-label={tp(mapType === 'satellite' ? 'view.mapTypeRoadmap' : 'view.mapTypeSatellite')}
              >
                <Icon name="layers" size={17} />
              </button>
            </div>
          </div>

          {/*
            PWA 설치 플로팅 아이콘. 상단바 바로 아래 우측 — 시트가 'full'이어도
            지도 상단 18%는 항상 남으므로(.mobile-planner-sheet.sheet-full) 시트
            레벨과 무관하게 계속 보인다. 2026-09-10까지 컴포넌트 자체는 완성돼
            있었지만 어디에도 렌더된 적이 없었다(고아 컴포넌트) — 사용자가
            "확실하게 표시되게" 요청해 여기 처음 연결한다.
          */}
          <PwaInstallButton className="mobile-pwa-install-fab" showDismiss />

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
              aria-label={tp('chrome.sheetHandleAria', {
                current: tp(
                  `chrome.sheetLevel${
                    mobileSheetLevel === 'peek' ? 'Peek' : mobileSheetLevel === 'half' ? 'Half' : 'Full'
                  }`
                ),
                next: tp(
                  `chrome.sheetLevel${
                    mobileSheetLevel === 'peek' ? 'Half' : mobileSheetLevel === 'half' ? 'Full' : 'Peek'
                  }`
                ),
              })}
              aria-expanded={mobileSheetLevel !== 'peek'}
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
            {/*
              예전엔 검색/일정 2탭 + 일정 안에 목록/동선 2단 토글, 이렇게
              2단으로 나뉘어 있었다. 사용자 요청으로 한 줄 3탭(검색/목록보기/
              동선짜기)으로 합쳤다 — 안쪽 토글 한 줄만큼 시트 높이가
              그대로 남는다(F02와 같은 방향의 공간 확보).
            */}
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
                {tp('chrome.viewList')}
              </button>
              <button
                type="button"
                className={`mobile-sheet-tab ${mobileSheetTab === 'route' ? 'active' : ''}`}
                onClick={() => {
                  if (generatedRoute) {
                    handleOpenRouteTable();
                  } else {
                    setMobileSheetTab('route');
                    setRouteOptionsOpen(true);
                  }
                }}
              >
                {tp('chrome.viewRoute')}
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
                  recentKeywords={recentKeywords}
                  onRemoveRecentKeyword={(k) => setRecentKeywords(removeRecentKeyword(k))}
                  onClearRecentKeywords={() => setRecentKeywords(clearRecentKeywords())}
                  recentPlaces={recentPlaces}
                  onRemoveRecentPlace={(id) => setRecentPlaces(removeRecentPlace(id))}
                  initialExtract={sharedExtract}
                  linkExtractState={linkExtractState}
                  onLinkExtractStateChange={setLinkExtractState}
                  onBulkAddPlaces={handleBulkAddPlaces}
                  foodRestrictions={trip.foodRestrictions ?? []}
                  onFoodRestrictionsChange={handleFoodRestrictionsChange}
                  categorySubFilters={categorySubFilters}
                  onCategorySubFiltersChange={setCategorySubFilters}
                  preferences={trip.preferences}
                />
              ) : mobileSheetTab === 'pins' ? (
                <div className="mobile-itinerary-view">
                  {generatedRoute && (
                    <div className="mobile-route-summary-card">
                      <Icon name="route" size={18} />
                      <span className="mobile-route-summary-text">
                        {tp('chrome.routeSummary', {
                          km: generatedRoute.totalDistanceKm,
                          min: generatedRoute.totalTravelMinutes,
                        })}
                      </span>
                      <button
                        type="button"
                        className="mobile-route-replan-btn"
                        onClick={handleOpenRouteOptions}
                      >
                        {tp('chrome.replanCta')}
                      </button>
                    </div>
                  )}
                  <PinupBar
                    variant="panel"
                    hideHeader
                    compactToolbar
                    pinAuthors={canSeePinAuthors ? pinAuthors : undefined}
                    pinVotes={votesEnabled ? pinVotes : undefined}
                    myUserId={user?.id ?? null}
                    onVote={votesEnabled ? handleVote : undefined}
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
                    onGoToSearch={openMobileSearchTab}
                    hideRouteCta={!!generatedRoute}
                    materialCountByPlace={materialCountByPlace}
                    onOpenPlaceMaterials={handleOpenPlaceMaterials}
                  />
                </div>
              ) : (
                <div className="mobile-itinerary-view">
                  <RouteOptionsPanel
                    embedded
                    open
                    onCompareRoutesChange={setCompareRoutes}
                    onFindAlternatives={isReadOnlyViewer ? undefined : handleFindAlternatives}
                    pinned={routePins}
                    currentDay={currentDay}
                    totalDays={trip.totalDays}
                    options={routeOptions}
                    hasExistingRoute={!!generatedRoute}
                    existingRoute={generatedRoute}
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
                </div>
              )}
            </div>
          </div>

          <div className="mobile-planner-tabbar">
            <button
              type="button"
              className={`mobile-tabbar-btn ${!materialsPanelOpen && !scenarioOpen ? 'active' : ''}`}
              onClick={() => {
                setMaterialsPanelOpen(false);
                setScenarioOpen(false);
              }}
            >
              <Icon name="mapPin" size={20} />
              {tp('chrome.tabMap')}
            </button>
            <button
              type="button"
              className={`mobile-tabbar-btn ${materialsPanelOpen ? 'active' : ''}`}
              onClick={() => {
                if (materialsPanelOpen) {
                  setMaterialsPanelOpen(false);
                  return;
                }
                setScenarioOpen(false);
                handleOpenMaterialsPanel();
              }}
            >
              <Icon name="folder" size={20} />
              {tp('trip.materials')}
            </button>
            {isTourScenarioConfigured() && (
              <button
                type="button"
                className={`mobile-tabbar-btn ${scenarioOpen ? 'active' : ''}`}
                onClick={() =>
                  setScenarioOpen((prev) => {
                    const next = !prev;
                    if (next) setMaterialsPanelOpen(false);
                    return next;
                  })
                }
              >
                <Icon name="sparkles" size={20} />
                {tp('chrome.tabScenario')}
              </button>
            )}
            <MobileMoreMenu
              onShare={() => setShareChooserOpen(true)}
              plazaNavVisible={plazaNavVisible}
              onOpenTableView={handleToggleTableView}
              onOpenCollaborators={
                isTripOwner || trip.collaboratorRole ? () => setCollabModalOpen(true) : undefined
              }
              collabEntryLabel={isTripOwner ? undefined : 'shared'}
              onOpenPreferences={() => setPreferencesOpen(true)}
              plan={plan}
              onOpenAccount={() => setAccountOpen(true)}
            />
          </div>
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
        plan={plan}
        isAdmin={isAdmin}
        onUpgradeRequest={() => setUpgradeOpen(true)}
        /* 핀 작성자 배지와 같은 게이트 — 공개 여행 열람자에게 협업자 이메일이
           보이면 안 된다(§14-2). presenceEnabled 를 쓰면 안 되는 이유도 같다. */
        materialAuthors={canSeePinAuthors ? materialAuthors : undefined}
        currentUserEmail={user?.email ?? null}
        initialPlaceFilter={materialsPlaceFilter}
        /* 열람 전용(viewer)에게는 제안 자체를 띄우지 않는다 — 적용하면 핀을 고치게 된다 */
        onApplyReservation={isReadOnlyViewer ? undefined : handleApplyReservationToPin}
      />

      {/* N05 — 도착 시각에 문 닫는 장소의 대체 후보 */}
      <AppSheetModal
        open={!!altTarget}
        title={tp('alt.title')}
        onClose={() => {
          setAltTarget(null);
          setAltPlaces([]);
          setAltError(null);
        }}
      >
        {altTarget && (
          <div className="alt-sheet">
            <p className="alt-reason">
              {tp(`route.hours.${altTarget.hoursStatus ?? 'closed'}`, {
                opens: altTarget.hoursOpensAt ?? '',
                closes: altTarget.hoursClosesAt ?? '',
              })}
            </p>
            <p className="alt-target">{tp('alt.replacing', { name: altTarget.name })}</p>
            {altLoading && (
              <p className="alt-status">
                <Icon name="loader" spin size={14} /> {tp('alt.searching')}
              </p>
            )}
            {altError && <p className="alt-status alt-status-error">{altError}</p>}
            <ul className="alt-list">
              {altPlaces.map((p) => (
                <li key={p.id} className="alt-item">
                  <div className="alt-item-text">
                    <strong>{p.name}</strong>
                    <span>
                      {[p.categoryLabel, p.roadAddress || p.address].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="alt-item-btn"
                    onClick={() => handleReplacePin(altTarget.id, p)}
                  >
                    {tp('alt.replace')}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </AppSheetModal>

      {pickingOriginFromMap && (
        <div className="picking-toast">
          <Icon name="pinSelect" />
          {tp('toast.pickOriginHint')}
        </div>
      )}

      {pickingPinFromMap &&
        (pinPickPoint ? (
          <MapPinPickHint point={pinPickPoint} label={tp('trip.pickingPin')} />
        ) : (
          <div className="picking-toast">
            <Icon name="pinPlus" />
            {tp('trip.pickingPin')}
          </div>
        ))}

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
          onGoToSearch={() => {
            setScenarioOpen(false);
            openMobileSearchTab();
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
      {/*
        N08 — 탭 투어(위)가 끝난 뒤를 이어받는 진행 상태 기반 안내. 동시에 안 뜬다.
        모바일 기본값이 sheet-half라(§414) RouteTimelineDock처럼 peek로만
        제한하면 새 여행을 만드는 흔한 상황에서 거의 안 보이게 된다. 대신
        시트의 현재 top(peek/half/full)에 맞춰 **시트 바로 위**에 뜨도록
        bottom을 시트 높이만큼 띄운다 — 화면에 항상 남는 지도 영역 안에만
        있어 어느 레벨에서도 시트 콘텐츠(검색 결과의 핀업 버튼 등)를
        가리지 않는다. 실제로 고정 24px이었을 때 half 시트의 검색 결과를
        가려 핀업 버튼 클릭이 막히는 게 브라우저 검증에서 재현됐다.
      */}
      {showFirstItineraryGuide && (
        <FirstItineraryGuide
          mobile={useMobileChrome}
          sheetLevel={useMobileChrome ? mobileSheetLevel : undefined}
          pinCount={totalPinCount}
          pinGoal={FIRST_ITINERARY_PIN_GOAL}
          routeReady={hasAnyRoute}
          onOpenSearch={
            useMobileChrome ? openMobileSearchTab : () => openPlannerTab('search')
          }
          onOpenRoute={handleOpenRouteOptions}
        />
      )}

      {/*
        U11(모바일 UX 리포트 2026-09-13) — "공유" 진입을 바로 ShareTripModal
        (공개 링크+공유마당 등록)로 보내지 않고, 이 선택 시트를 한 단계
        앞세운다. 링크로 보기(보기 전용 공개 링크)와 함께 편집(협업자
        초대)의 차이를 실행 전에 알려준다.
      */}
      <AppSheetModal
        open={shareChooserOpen}
        title={ts('modal.chooseTitle')}
        onClose={() => setShareChooserOpen(false)}
      >
        <div className="share-choose-list">
          <button
            type="button"
            className="share-choose-option"
            onClick={() => {
              setShareChooserOpen(false);
              openShareModal();
            }}
          >
            <span className="share-choose-icon">
              <Icon name="globe" size={18} />
            </span>
            <span className="share-choose-text">
              <strong>{ts('modal.chooseLinkTitle')}</strong>
              <span>{ts('modal.chooseLinkDesc')}</span>
            </span>
          </button>
          {(isTripOwner || trip.collaboratorRole) && (
            <button
              type="button"
              className="share-choose-option"
              onClick={() => {
                setShareChooserOpen(false);
                setCollabModalOpen(true);
              }}
            >
              <span className="share-choose-icon">
                <Icon name="facilityGroup" size={18} />
              </span>
              <span className="share-choose-text">
                <strong>{ts('modal.chooseCollabTitle')}</strong>
                <span>{ts('modal.chooseCollabDesc')}</span>
              </span>
            </button>
          )}
        </div>
      </AppSheetModal>

      <ShareTripModal
        open={shareModalOpen}
        tripTitle={trip.title}
        userEmail={user?.email ?? null}
        authConfigured={authConfigured}
        saving={shareSaving}
        onClose={() => {
          if (shareSaving) return;
          setShareModalOpen(false);
          setShareLinkSuffix('');
        }}
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

      <AppSheetModal
        open={preferencesOpen}
        title={tp('themes.label')}
        subtitle={tp('themes.editLead')}
        onClose={() => setPreferencesOpen(false)}
      >
        <ThemePreferenceChips
          selected={trip.preferences ?? []}
          onChange={handlePreferencesChange}
        />
      </AppSheetModal>

      <MobileAccountSheet
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
        onOpenUpgrade={() => setUpgradeOpen(true)}
      />

      <Toast message={toast} action={toastAction} />
    </div>
  );
}
