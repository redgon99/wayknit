import { useEffect, useRef } from 'react';
import type { Place, PinnedPlace, GeneratedRoute, Origin, SimpleCategory } from '../types';
import { getCategoryMeta } from '../lib/categories';
import { coordsToAddress, findNearestPlaceNear } from '../lib/kakao';
import { createMapPlaceBubbleElement } from '../lib/mapPlaceBubble';
import { iconSvgMarkup } from '../icons/wayknit-icons';
import {
  renderPlaceMarkerHtml,
  renderSearchCenterMarkerHtml,
} from '../lib/mapMarkers';
import { GoogleMapView } from './GoogleMapView';
import type { MapProvider } from '../lib/mapProvider';
import { useLongPress } from '../hooks/useLongPress';
import { mapCentersNear, searchResultFitPadding, shouldAnimateMapCenter, validMapPoints, type MapLatLng } from '../lib/mapCenterMotion';
import i18n from '../lib/i18n';
import { COMPARE_LINE_WEIGHT } from '../lib/routeCompare';
import type { OptimizeBy } from '../types';

interface Props {
  provider?: MapProvider;
  mapsReady?: boolean;
  googleMapsReady?: boolean;
  center: { lat: number; lng: number };
  level?: number;
  /** level 적용을 강제할 때 증가 (같은 level로 재클릭해도 setLevel) */
  levelTick?: number;
  /** 일반 지도 vs 위성(하이브리드) 지도 */
  mapType?: 'roadmap' | 'satellite';
  searchResults: Place[];
  pinned: PinnedPlace[];
  pinCategoryFilter?: SimpleCategory | null;
  origin?: Origin;
  generatedRoute?: GeneratedRoute | null;
  /** 최적화 3종 비교 경로 — 확정 경로 아래에 겹쳐 그린다 */
  compareRoutes?: Array<{ optimizeBy: string; color: string; path: Array<{ lat: number; lng: number }> }>;
  selectedOptimizeBy?: string;
  /** 좌측 패널이 지도를 가릴 때, 대상이 남은 영역 한가운데 오도록 미는 픽셀 */
  centerOffsetX?: number;
  nearbySearchCenter?: { lat: number; lng: number } | null;
  pickingOriginFromMap?: boolean;
  pickingPinFromMap?: boolean;
  onOriginPicked?: (lat: number, lng: number, address: string) => void;
  onPinLocationPicked?: (lat: number, lng: number, address: string) => void;
  /** 모바일 지도 롱프레스 — 좌표 없이 "핀 찍기 모드 진입" 신호만 전달 */
  onMapLongPress?: () => void;
  draftPinLocation?: { lat: number; lng: number } | null;
  onSelectPlace?: (place: Place) => void;
  onPinnedMarkerClick?: (place: Place) => void;
  infoWindowPlace?: Place | null;
  pinnedIds?: Set<string>;
  onCloseInfoWindow?: () => void;
  onTogglePinFromInfo?: (place: Place) => void;
  onOpenRoadviewFromInfo?: (place: Place) => void;
  onOpenPlacePhotosFromInfo?: (place: Place) => void;
  onShowTaxiCardFromInfo?: (place: Place) => void;
  onMapRightClick?: (lat: number, lng: number, clientX: number, clientY: number) => void;
  onMapCenterChange?: (lat: number, lng: number) => void;
  /** 사용자 줌 변경 시 카카오 레벨로 동기화 */
  onMapLevelChange?: (level: number) => void;
  fitRouteBounds?: boolean;
  fitSearchBounds?: boolean;
  /** 조감(Overview) 등 — 보이는 핀(+출발지) 전체가 들어오도록 축척 맞춤 */
  fitPinsBounds?: boolean;
  highlightPlaceId?: string | null;
  /** 검색 결과 마커 호버 → 결과 칩 하이라이트 (지도 이동·말풍선 없음) */
  onHoverSearchPlace?: (place: Place) => void;
  /** 핀업 선택 모드: 지정 시 선택된 핀 마커만 표시(검색 마커 숨김) */
  pinSelectionFilter?: ReadonlySet<string>;
  /** 공유마당 전국 지도용 마커 */
  plazaMarkers?: ReadonlyArray<{ id: string; lat: number; lng: number; title: string }>;
  highlightPlazaId?: string | null;
  onPlazaMarkerClick?: (id: string) => void;
}

export function MapView({
  provider = 'kakao',
  mapsReady = false,
  googleMapsReady = false,
  ...rest
}: Props) {
  if (provider === 'google') {
    return (
      <GoogleMapView
        mapsReady={googleMapsReady}
        center={rest.center}
        level={rest.level}
        levelTick={rest.levelTick}
        mapType={rest.mapType}
        searchResults={rest.searchResults}
        pinned={rest.pinned}
        pinCategoryFilter={rest.pinCategoryFilter}
        origin={rest.origin}
        generatedRoute={rest.generatedRoute}
        compareRoutes={rest.compareRoutes}
        selectedOptimizeBy={rest.selectedOptimizeBy}
        centerOffsetX={rest.centerOffsetX}
        nearbySearchCenter={rest.nearbySearchCenter}
        pickingOriginFromMap={rest.pickingOriginFromMap}
        pickingPinFromMap={rest.pickingPinFromMap}
        onOriginPicked={rest.onOriginPicked}
        onPinLocationPicked={rest.onPinLocationPicked}
        onMapLongPress={rest.onMapLongPress}
        draftPinLocation={rest.draftPinLocation}
        onSelectPlace={rest.onSelectPlace}
        onPinnedMarkerClick={rest.onPinnedMarkerClick}
        onMapRightClick={rest.onMapRightClick}
        onMapCenterChange={rest.onMapCenterChange}
        onMapLevelChange={rest.onMapLevelChange}
        infoWindowPlace={rest.infoWindowPlace}
        onCloseInfoWindow={rest.onCloseInfoWindow}
        onTogglePinFromInfo={rest.onTogglePinFromInfo}
        onOpenPlacePhotosFromInfo={rest.onOpenPlacePhotosFromInfo}
        onOpenRoadviewFromInfo={rest.onOpenRoadviewFromInfo}
        fitRouteBounds={rest.fitRouteBounds}
        fitSearchBounds={rest.fitSearchBounds}
        fitPinsBounds={rest.fitPinsBounds}
        highlightPlaceId={rest.highlightPlaceId}
        onHoverSearchPlace={rest.onHoverSearchPlace}
        pinSelectionFilter={rest.pinSelectionFilter}
        plazaMarkers={rest.plazaMarkers}
        highlightPlazaId={rest.highlightPlazaId}
        onPlazaMarkerClick={rest.onPlazaMarkerClick}
      />
    );
  }

  return <KakaoMapView mapsReady={mapsReady} {...rest} />;
}

function KakaoMapView({
  mapsReady = false,
  center,
  level = 5,
  levelTick = 0,
  mapType = 'roadmap',
  searchResults,
  pinned,
  pinCategoryFilter = null,
  origin,
  generatedRoute,

  compareRoutes,

  selectedOptimizeBy,


  centerOffsetX = 0,
  nearbySearchCenter = null,
  pickingOriginFromMap = false,
  pickingPinFromMap = false,
  onOriginPicked,
  onPinLocationPicked,
  onMapLongPress,
  draftPinLocation = null,
  onSelectPlace,
  onPinnedMarkerClick,
  infoWindowPlace = null,
  pinnedIds = new Set(),
  onCloseInfoWindow,
  onTogglePinFromInfo,
  onOpenRoadviewFromInfo,
  onOpenPlacePhotosFromInfo,
  onShowTaxiCardFromInfo,
  onMapRightClick,
  onMapCenterChange,
  onMapLevelChange,
  fitRouteBounds = false,
  fitSearchBounds = false,
  fitPinsBounds = false,
  highlightPlaceId = null,
  onHoverSearchPlace,
  pinSelectionFilter,
  plazaMarkers = [],
  highlightPlazaId = null,
  onPlazaMarkerClick,
}: Omit<Props, 'provider' | 'googleMapsReady'>) {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const centerReadyRef = useRef(false);
  const suppressLevelSyncRef = useRef(false);
  const overlaysRef = useRef<any[]>([]);
  const placeMarkerContentsRef = useRef<HTMLElement[]>([]);
  const polylineRef = useRef<any>(null);
  const comparePolylinesRef = useRef<any[]>([]);
  const originMarkerRef = useRef<any>(null);
  const searchCenterMarkerRef = useRef<any>(null);
  const infoOverlayRef = useRef<any>(null);
  const clickListenerRef = useRef<any>(null);
  const rightClickListenerRef = useRef<any>(null);
  const mapClickCloseInfoRef = useRef<any>(null);
  const selectPlaceRef = useRef(onSelectPlace);
  const pinnedClickRef = useRef(onPinnedMarkerClick);
  const hoverSearchRef = useRef(onHoverSearchPlace);
  selectPlaceRef.current = onSelectPlace;
  pinnedClickRef.current = onPinnedMarkerClick;
  hoverSearchRef.current = onHoverSearchPlace;

  const infoHandlersRef = useRef({
    onCloseInfoWindow,
    onTogglePinFromInfo,
    onOpenRoadviewFromInfo,
    onOpenPlacePhotosFromInfo,
    onShowTaxiCardFromInfo,
    pinnedIds,
  });
  infoHandlersRef.current = {
    onCloseInfoWindow,
    onTogglePinFromInfo,
    onOpenRoadviewFromInfo,
    onOpenPlacePhotosFromInfo,
    onShowTaxiCardFromInfo,
    pinnedIds,
  };

  const pinSelectionActive =
    pinSelectionFilter != null && pinSelectionFilter.size > 0;

  let visiblePinned = pinCategoryFilter
    ? pinned.filter((p) => getCategoryMeta(p.categoryCode).category === pinCategoryFilter)
    : pinned;
  if (pinSelectionActive) {
    visiblePinned = visiblePinned.filter((p) => pinSelectionFilter!.has(p.id));
  }

  // 지도 초기화 (SDK 로드 완료 후에만 실행)
  useEffect(() => {
    if (!mapsReady || !mapEl.current || !window.kakao?.maps) return;
    if (mapRef.current) return;

    const map = new window.kakao.maps.Map(mapEl.current, {
      center: new window.kakao.maps.LatLng(center.lat, center.lng),
      level,
    });
    mapRef.current = map;
    const relayout = () => requestAnimationFrame(() => map.relayout());
    relayout();
    window.addEventListener('resize', relayout);
    window.addEventListener('orientationchange', relayout);
    const ro = new ResizeObserver(relayout);
    if (mapEl.current) ro.observe(mapEl.current);

    return () => {
      window.removeEventListener('resize', relayout);
      window.removeEventListener('orientationchange', relayout);
      ro.disconnect();
      overlaysRef.current.forEach((o) => {
        try {
          o.setMap(null);
        } catch {
          /* ignore */
        }
      });
      overlaysRef.current = [];
      for (const ref of [
        polylineRef,
        originMarkerRef,
        searchCenterMarkerRef,
        infoOverlayRef,
      ] as const) {
        if (ref.current) {
          try {
            ref.current.setMap(null);
          } catch {
            /* ignore */
          }
          ref.current = null;
        }
      }
      mapRef.current = null;
      // StrictMode 재마운트·provider 전환 시 같은 컨테이너에 Map이 중첩되지 않도록 비움
      if (mapEl.current) mapEl.current.innerHTML = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapsReady]);

  // 센터 변경 — 칩·검색 선택 시 panTo 애니메이션 (결과 전체 맞춤 중에는 생략)
  useEffect(() => {
    if (!mapRef.current || fitSearchBounds) return;
    const target: MapLatLng = { lat: center.lat, lng: center.lng };
    const latlng = new window.kakao.maps.LatLng(target.lat, target.lng);
    const isInitial = !centerReadyRef.current;

    if (isInitial) {
      mapRef.current.setCenter(latlng);
      centerReadyRef.current = true;
      return;
    }

    const c = mapRef.current.getCenter();
    const current: MapLatLng = { lat: c.getLat(), lng: c.getLng() };

    /* 좌측 패널이 지도를 가릴 때, 대상이 패널 뒤로 들어가지 않도록 남은
     * 영역 한가운데로 밀어준다.
     *
     * panBy는 쓰지 않는다 — 상대 이동인 데다 애니메이션이라 setCenter와 겹치면
     * 이동량이 누적된다(실제로 4배까지 밀려 화면 밖으로 나갔다). 대신 대상을
     * 중앙에 놓은 뒤 투영으로 "offset만큼 왼쪽 지점"의 좌표를 구해 그것을
     * 중심으로 삼는다. 동기 계산이라 몇 번을 실행해도 결과가 같다. */
    if (centerOffsetX) {
      mapRef.current.setCenter(latlng);
      const projection = mapRef.current.getProjection();
      if (projection) {
        const c = projection.containerPointFromCoords(latlng);
        const shifted = new window.kakao.maps.Point(c.x - centerOffsetX, c.y);
        mapRef.current.setCenter(projection.coordsFromContainerPoint(shifted));
      }
      return;
    }

    if (shouldAnimateMapCenter(current, target)) {
      mapRef.current.panTo(latlng);
    } else if (!mapCentersNear(current, target)) {
      mapRef.current.setCenter(latlng);
    }
  }, [center.lat, center.lng, fitSearchBounds, centerOffsetX, level]);

  useEffect(() => {
    if (!mapRef.current || fitSearchBounds) return;
    if (suppressLevelSyncRef.current) {
      suppressLevelSyncRef.current = false;
      return;
    }
    mapRef.current.setLevel(level);
  }, [level, levelTick, fitSearchBounds]);

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setMapTypeId(
      mapType === 'satellite'
        ? window.kakao.maps.MapTypeId.HYBRID
        : window.kakao.maps.MapTypeId.ROADMAP
    );
  }, [mapType]);

  // 사용자가 지도를 움직이면 중심 좌표 동기화 (카테고리·지도 주변 검색용)
  useEffect(() => {
    if (!mapRef.current || (!onMapCenterChange && !onMapLevelChange)) return;
    const map = mapRef.current;
    const emitCenter = () => {
      if (!onMapCenterChange) return;
      const c = map.getCenter();
      onMapCenterChange(c.getLat(), c.getLng());
    };
    const emitLevel = () => {
      onMapLevelChange?.(map.getLevel());
    };
    const dragEnd = window.kakao.maps.event.addListener(map, 'dragend', emitCenter);
    const zoomChanged = window.kakao.maps.event.addListener(map, 'zoom_changed', () => {
      emitCenter();
      emitLevel();
    });
    return () => {
      window.kakao.maps.event.removeListener(map, 'dragend', dragEnd);
      window.kakao.maps.event.removeListener(map, 'zoom_changed', zoomChanged);
    };
  }, [onMapCenterChange, onMapLevelChange]);

  // 클릭으로 출발지·수동 핀 위치 선택
  useEffect(() => {
    if (!mapRef.current) return;
    if (clickListenerRef.current) {
      window.kakao.maps.event.removeListener(
        mapRef.current,
        'click',
        clickListenerRef.current
      );
      clickListenerRef.current = null;
    }

    const pickMode = pickingOriginFromMap
      ? 'origin'
      : pickingPinFromMap
        ? 'pin'
        : null;
    if (!pickMode) return;

    const handler = async (e: any) => {
      const latlng = e.latLng;
      const lat = latlng.getLat();
      const lng = latlng.getLng();
      let addr = '';
      try {
        addr = await coordsToAddress(lat, lng);
      } catch {
        addr = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      }
      if (pickMode === 'origin') {
        onOriginPicked?.(lat, lng, addr);
      } else {
        onPinLocationPicked?.(lat, lng, addr);
      }
    };
    clickListenerRef.current = handler;
    window.kakao.maps.event.addListener(mapRef.current, 'click', handler);

    return () => {
      if (mapRef.current && clickListenerRef.current) {
        window.kakao.maps.event.removeListener(
          mapRef.current,
          'click',
          clickListenerRef.current
        );
        clickListenerRef.current = null;
      }
    };
  }, [pickingOriginFromMap, pickingPinFromMap, onOriginPicked, onPinLocationPicked]);

  // 기본 지도 POI 클릭 근사(Web API는 네이티브 POI 이벤트 없음) · 말풍선 닫기
  useEffect(() => {
    if (!mapRef.current) return;
    if (mapClickCloseInfoRef.current) {
      window.kakao.maps.event.removeListener(
        mapRef.current,
        'click',
        mapClickCloseInfoRef.current
      );
      mapClickCloseInfoRef.current = null;
    }
    if (pickingOriginFromMap || pickingPinFromMap) return;

    let cancelled = false;
    const handler = async (e: any) => {
      const map = mapRef.current;
      if (!map) return;
      const lat = e.latLng.getLat();
      const lng = e.latLng.getLng();
      const level = typeof map.getLevel === 'function' ? map.getLevel() : 99;

      // 축척이 멀면 POI 아이콘이 거의 안 보이므로 말풍선만 닫음
      if (level > 5) {
        infoHandlersRef.current.onCloseInfoWindow?.();
        return;
      }

      try {
        const nearest = await findNearestPlaceNear(lat, lng, {
          radiusMeters: 80,
          maxDistanceMeters: 80,
        });
        if (cancelled) return;
        if (nearest) {
          onSelectPlace?.(nearest);
        } else {
          infoHandlersRef.current.onCloseInfoWindow?.();
        }
      } catch {
        if (!cancelled) infoHandlersRef.current.onCloseInfoWindow?.();
      }
    };

    mapClickCloseInfoRef.current = handler;
    window.kakao.maps.event.addListener(mapRef.current, 'click', handler);

    return () => {
      cancelled = true;
      if (mapRef.current && mapClickCloseInfoRef.current) {
        window.kakao.maps.event.removeListener(
          mapRef.current,
          'click',
          mapClickCloseInfoRef.current
        );
        mapClickCloseInfoRef.current = null;
      }
    };
  }, [pickingOriginFromMap, pickingPinFromMap, onSelectPlace]);

  // 우클릭 → 검색 중심 메뉴
  useEffect(() => {
    if (!mapRef.current) return;
    if (rightClickListenerRef.current) {
      window.kakao.maps.event.removeListener(
        mapRef.current,
        'rightclick',
        rightClickListenerRef.current
      );
      rightClickListenerRef.current = null;
    }

    const handler = (mouseEvent: any) => {
      if (pickingOriginFromMap || pickingPinFromMap) return;
      const lat = mouseEvent.latLng.getLat();
      const lng = mouseEvent.latLng.getLng();
      const ev = mouseEvent.originalEvent as MouseEvent | undefined;
      const mapRect = mapEl.current?.getBoundingClientRect();
      let clientX = ev?.clientX ?? 0;
      let clientY = ev?.clientY ?? 0;
      if ((!clientX && !clientY) && mouseEvent.point && mapRect) {
        clientX = mapRect.left + mouseEvent.point.x;
        clientY = mapRect.top + mouseEvent.point.y;
      }
      onMapRightClick?.(lat, lng, clientX, clientY);
    };
    rightClickListenerRef.current = handler;
    window.kakao.maps.event.addListener(mapRef.current, 'rightclick', handler);

    return () => {
      if (mapRef.current && rightClickListenerRef.current) {
        window.kakao.maps.event.removeListener(
          mapRef.current,
          'rightclick',
          rightClickListenerRef.current
        );
        rightClickListenerRef.current = null;
      }
    };
  }, [pickingOriginFromMap, pickingPinFromMap, onMapRightClick]);

  // 공유마당 마커
  useEffect(() => {
    if (!mapRef.current || plazaMarkers.length === 0) return;

    const plazaOverlays: any[] = [];
    plazaMarkers.forEach((m) => {
      const isSelected = highlightPlazaId === m.id;
      const content = document.createElement('div');
      content.className = `map-marker plaza-marker ${isSelected ? 'selected' : ''}`;
      content.innerHTML = `
        <div class="marker-label plaza-marker-label">${escapeHtml(m.title)}</div>
        <div class="marker-dot plaza-marker-dot"></div>
      `;
      content.addEventListener('click', (e) => {
        e.stopPropagation();
        onPlazaMarkerClick?.(m.id);
      });
      const overlay = new window.kakao.maps.CustomOverlay({
        position: new window.kakao.maps.LatLng(m.lat, m.lng),
        content,
        yAnchor: 1,
        clickable: true,
      });
      overlay.setMap(mapRef.current);
      plazaOverlays.push(overlay);
    });

    if (plazaMarkers.length >= 2) {
      const bounds = new window.kakao.maps.LatLngBounds();
      plazaMarkers.forEach((m) =>
        bounds.extend(new window.kakao.maps.LatLng(m.lat, m.lng))
      );
      mapRef.current.setBounds(bounds);
    }

    return () => {
      plazaOverlays.forEach((o) => o.setMap(null));
    };
  }, [plazaMarkers, highlightPlazaId, onPlazaMarkerClick]);

  // 마커 렌더링 (검색 결과 + 핀업 표시)
  useEffect(() => {
    if (!mapRef.current) return;
    if (plazaMarkers.length > 0) return;
    overlaysRef.current.forEach((o) => o.setMap(null));
    overlaysRef.current = [];
    placeMarkerContentsRef.current = [];

    const pinnedMap = new Map(visiblePinned.map((p) => [p.id, p]));
    /* 핀 선택은 "어떤 핀을 볼지"만 정한다. 검색 결과까지 지우면 핀 탭에서
     * 체크 하나 남겨둔 채 검색하는 순간 지도에 결과가 안 뜬다. */
    const resultsForMarkers = searchResults;
    const searchIdSet = new Set(resultsForMarkers.map((s) => s.id));

    const places: Array<Place & { _pinned?: PinnedPlace }> = [
      ...resultsForMarkers.map((s) => ({ ...s, _pinned: pinnedMap.get(s.id) })),
      ...visiblePinned
        .filter((p) => !resultsForMarkers.some((s) => s.id === p.id))
        .map((p) => ({ ...p, _pinned: p })),
    ];

    const markerPlaces = places;

    markerPlaces.forEach((place) => {
      const isPinned = !!place._pinned;
      const isSearchResult = searchIdSet.has(place.id);

      const content = document.createElement('div');
      content.dataset.placeId = place.id;
      content.innerHTML = renderPlaceMarkerHtml({
        place,
        pinned: place._pinned,
        isSelected: false,
      });
      content.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isPinned) {
          pinnedClickRef.current?.(place);
        } else {
          selectPlaceRef.current?.(place);
        }
      });
      if (isSearchResult) {
        content.addEventListener('mouseenter', () => {
          hoverSearchRef.current?.(place);
        });
      }
      placeMarkerContentsRef.current.push(content);

      const overlay = new window.kakao.maps.CustomOverlay({
        position: new window.kakao.maps.LatLng(place.lat, place.lng),
        content,
        yAnchor: 1,
        zIndex: 1,
        clickable: true,
      });
      overlay.setMap(mapRef.current);
      overlaysRef.current.push(overlay);
    });

    if (draftPinLocation) {
      const content = document.createElement('div');
      content.className = 'map-marker draft-pin';
      content.innerHTML = `
        <div class="marker-label draft-pin-label">${i18n.t('map.pickedLocation', { ns: 'planner' })}</div>
        <div class="marker-dot draft-pin-dot">
          ${iconSvgMarkup('pinPlus', { size: 16, color: '#fff' })}
        </div>
      `;
      const overlay = new window.kakao.maps.CustomOverlay({
        position: new window.kakao.maps.LatLng(draftPinLocation.lat, draftPinLocation.lng),
        content,
        yAnchor: 1,
      });
      overlay.setMap(mapRef.current);
      overlaysRef.current.push(overlay);
    }
    // 선택 하이라이트는 highlightPlaceId effect에서 class만 갱신
  }, [
    searchResults,
    visiblePinned,
    pinSelectionActive,
    draftPinLocation,
    plazaMarkers.length,
    i18n.language,
  ]);

  // 선택 장소 마커 하이라이트 (호버/클릭 시 재생성 없이 class만 갱신)
  useEffect(() => {
    placeMarkerContentsRef.current.forEach((content) => {
      const id = content.dataset.placeId;
      const marker = content.querySelector('.map-marker');
      const selected = id != null && id === highlightPlaceId;
      marker?.classList.toggle('selected', selected);
    });
    overlaysRef.current.forEach((overlay) => {
      const content = overlay.getContent?.() as HTMLElement | undefined;
      const id = content?.dataset?.placeId;
      if (!id) return;
      overlay.setZIndex?.(id === highlightPlaceId ? 10 : 1);
    });
  }, [highlightPlaceId, searchResults, visiblePinned, pinSelectionActive, draftPinLocation]);

  // 대상물 상세 말풍선 (구글맵 POI 상세와 유사)
  useEffect(() => {
    if (!mapRef.current) return;
    if (infoOverlayRef.current) {
      infoOverlayRef.current.setMap(null);
      infoOverlayRef.current = null;
    }
    if (!infoWindowPlace) return;

    const place = infoWindowPlace;
    const content = createMapPlaceBubbleElement(place, {
      onClose: () => infoHandlersRef.current.onCloseInfoWindow?.(),
      onOpenDetail: (p) => infoHandlersRef.current.onOpenPlacePhotosFromInfo?.(p),
      onTogglePin: (p) => infoHandlersRef.current.onTogglePinFromInfo?.(p),
      onOpenRoadview: (p) => infoHandlersRef.current.onOpenRoadviewFromInfo?.(p),
      isPinned: pinnedIds.has(place.id),
    });

    const overlay = new window.kakao.maps.CustomOverlay({
      position: new window.kakao.maps.LatLng(place.lat, place.lng),
      content,
      yAnchor: 1.28,
      zIndex: 30,
      clickable: true,
    });
    overlay.setMap(mapRef.current);
    infoOverlayRef.current = overlay;
  }, [infoWindowPlace, pinnedIds]);

  // 검색 결과가 나오면 모든 포인트가 보이도록 축척 맞춤
  useEffect(() => {
    if (!mapRef.current || !fitSearchBounds) return;
    const points = validMapPoints(searchResults);
    if (points.length === 0) return;

    if (points.length === 1) {
      mapRef.current.panTo(new window.kakao.maps.LatLng(points[0].lat, points[0].lng));
      return;
    }

    const bounds = new window.kakao.maps.LatLngBounds();
    points.forEach((p) => bounds.extend(new window.kakao.maps.LatLng(p.lat, p.lng)));
    const pad = searchResultFitPadding();
    suppressLevelSyncRef.current = true;
    try {
      mapRef.current.setBounds(bounds, pad.top, pad.right, pad.bottom, pad.left);
    } catch {
      mapRef.current.setBounds(bounds);
    }
  }, [searchResults, fitSearchBounds]);

  // 조감 모드 — 보이는 핀(+출발지) 전체가 들어오도록 축척 맞춤
  useEffect(() => {
    if (!mapRef.current || !fitPinsBounds) return;

    let pins = pinCategoryFilter
      ? pinned.filter(
          (p) => getCategoryMeta(p.categoryCode).category === pinCategoryFilter
        )
      : pinned;
    if (pinSelectionFilter != null && pinSelectionFilter.size > 0) {
      pins = pins.filter((p) => pinSelectionFilter.has(p.id));
    }

    const points: Array<{ lat: number; lng: number }> = pins.map((p) => ({
      lat: p.lat,
      lng: p.lng,
    }));
    if (origin?.lat != null && origin?.lng != null) {
      points.push({ lat: origin.lat, lng: origin.lng });
    }
    if (points.length === 0) return;

    if (points.length === 1) {
      mapRef.current.setCenter(
        new window.kakao.maps.LatLng(points[0].lat, points[0].lng)
      );
      mapRef.current.setLevel(5);
      return;
    }

    const bounds = new window.kakao.maps.LatLngBounds();
    points.forEach((p) =>
      bounds.extend(new window.kakao.maps.LatLng(p.lat, p.lng))
    );
    // top/right/bottom/left — Overview 크롬·범례 여백
    try {
      mapRef.current.setBounds(bounds, 96, 48, 96, 48);
    } catch {
      mapRef.current.setBounds(bounds);
    }
  }, [
    fitPinsBounds,
    pinned,
    pinCategoryFilter,
    pinSelectionFilter,
    origin?.lat,
    origin?.lng,
  ]);

  // 출발지 마커
  useEffect(() => {
    if (!mapRef.current) return;
    if (originMarkerRef.current) {
      originMarkerRef.current.setMap(null);
      originMarkerRef.current = null;
    }
    if (origin?.lat && origin?.lng) {
      const content = document.createElement('div');
      content.className = 'origin-marker';
      content.innerHTML = `
        <div class="origin-label">${iconSvgMarkup('flag', { size: 14 })} ${i18n.t('map.origin', { ns: 'planner' })}</div>
        <div class="origin-dot"></div>
      `;
      const overlay = new window.kakao.maps.CustomOverlay({
        position: new window.kakao.maps.LatLng(origin.lat, origin.lng),
        content,
        yAnchor: 1,
      });
      overlay.setMap(mapRef.current);
      originMarkerRef.current = overlay;
    }
  }, [origin?.lat, origin?.lng, i18n.language]);

  // 지도 주변 검색 중심 마커
  useEffect(() => {
    if (!mapRef.current) return;
    if (searchCenterMarkerRef.current) {
      searchCenterMarkerRef.current.setMap(null);
      searchCenterMarkerRef.current = null;
    }
    if (!nearbySearchCenter) return;

    const content = document.createElement('div');
    content.innerHTML = renderSearchCenterMarkerHtml();
    const overlay = new window.kakao.maps.CustomOverlay({
      position: new window.kakao.maps.LatLng(
        nearbySearchCenter.lat,
        nearbySearchCenter.lng
      ),
      content,
      yAnchor: 0.5,
    });
    overlay.setMap(mapRef.current);
    searchCenterMarkerRef.current = overlay;
  }, [nearbySearchCenter?.lat, nearbySearchCenter?.lng]);

  /**
   * 최적화 3종 비교 경로.
   * 확정된 경로(아래 폴리라인)보다 먼저·연하게 깔아 배경처럼 보이게 한다.
   * 선택된 기준만 진하게 그려 어느 것을 고른 상태인지 지도에서 바로 보인다.
   */
  useEffect(() => {
    if (!mapRef.current) return;
    for (const line of comparePolylinesRef.current) line.setMap(null);
    comparePolylinesRef.current = [];
    if (!compareRoutes?.length) return;

    for (const r of compareRoutes) {
      if (r.path.length < 2) continue;
      const selected = r.optimizeBy === selectedOptimizeBy;
      const baseWeight = COMPARE_LINE_WEIGHT[r.optimizeBy as OptimizeBy] ?? 4;
      const line = new window.kakao.maps.Polyline({
        path: r.path.map((p) => new window.kakao.maps.LatLng(p.lat, p.lng)),
        strokeWeight: selected ? 7 : baseWeight,
        strokeColor: r.color,
        strokeOpacity: selected ? 0.9 : 0.6,
        strokeStyle: 'solid',
        // 선택된 것이 항상 맨 위, 미선택끼리는 얇은 쪽이 위 — 겹치는 구간에서
        // 두꺼운 쪽 테두리가 옆으로 드러나 층이 보인다(§6-7).
        zIndex: selected ? 10 : 10 - baseWeight,
      });
      line.setMap(mapRef.current);
      comparePolylinesRef.current.push(line);
    }
    return () => {
      for (const line of comparePolylinesRef.current) line.setMap(null);
      comparePolylinesRef.current = [];
    };
  }, [compareRoutes, selectedOptimizeBy]);

  // 생성된 경로 폴리라인
  useEffect(() => {
    if (!mapRef.current) return;
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }
    if (!generatedRoute) return;
    const path: any[] = [];
    if (generatedRoute.routePath?.length) {
      generatedRoute.routePath.forEach((p) =>
        path.push(new window.kakao.maps.LatLng(p.lat, p.lng))
      );
    } else if (generatedRoute.stops.length >= 2) {
      if (generatedRoute.origin.lat && generatedRoute.origin.lng) {
        path.push(
          new window.kakao.maps.LatLng(generatedRoute.origin.lat, generatedRoute.origin.lng)
        );
      }
      generatedRoute.stops.forEach((s) =>
        path.push(new window.kakao.maps.LatLng(s.lat, s.lng))
      );
    }
    if (path.length < 2) return;
    const line = new window.kakao.maps.Polyline({
      path,
      strokeWeight: 4,
      strokeColor: '#1f2937',
      strokeOpacity: 0.85,
      strokeStyle: 'solid',
    });
    line.setMap(mapRef.current);
    polylineRef.current = line;

    if (fitRouteBounds) {
      const bounds = new window.kakao.maps.LatLngBounds();
      path.forEach((p) => bounds.extend(p));
      mapRef.current.setBounds(bounds);
    }
  }, [generatedRoute, fitRouteBounds]);

  const longPress = useLongPress(() => onMapLongPress?.());

  return (
    <div
      ref={mapEl}
      className={`map-canvas ${pickingOriginFromMap || pickingPinFromMap ? 'picking' : ''}`}
      role="application"
      aria-label={i18n.t('map.ariaLabel', { ns: 'planner' })}
      onContextMenu={(e) => e.preventDefault()}
      {...longPress}
    />
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
