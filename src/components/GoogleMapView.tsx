import { useEffect, useRef } from 'react';
import type { Place, PinnedPlace, GeneratedRoute, Origin, SimpleCategory } from '../types';
import { getCategoryMeta } from '../lib/categories';
import { reverseGeocodeWithGoogle } from '../lib/googleMaps';
import { GoogleHtmlMarker } from '../lib/googleHtmlMarker';
import {
  renderPlaceMarkerHtml,
  renderSearchCenterMarkerHtml,
} from '../lib/mapMarkers';
import {
  createMapPlaceBubbleHtml,
  isMapPlaceBubbleDetailClick,
  isMapPlaceBubblePinClick,
  isMapPlaceBubbleRoadviewClick,
} from '../lib/mapPlaceBubble';
import {
  googleZoomForPlannerLevel,
  googleZoomToKakaoLevel,
  kakaoLevelToGoogleZoom,
  MIN_PLANNER_GOOGLE_ZOOM,
} from '../lib/mapZoom';
import { useLongPress, type LongPressPoint } from '../hooks/useLongPress';
import { mapCentersNear, searchResultFitPadding, shouldAnimateMapCenter, validMapPoints, type MapLatLng } from '../lib/mapCenterMotion';
import i18n from '../lib/i18n';
import { COMPARE_LINE_WEIGHT } from '../lib/routeCompare';
import type { OptimizeBy } from '../types';

interface Props {
  mapsReady?: boolean;
  center: { lat: number; lng: number };
  level?: number;
  levelTick?: number;
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
  /** 모바일 지도 롱프레스 — 누른 지점(뷰포트 픽셀)을 함께 전달해 말풍선이 그 자리를 가리키게 한다 */
  onMapLongPress?: (point: LongPressPoint) => void;
  draftPinLocation?: { lat: number; lng: number } | null;
  onSelectPlace?: (place: Place) => void;
  onPinnedMarkerClick?: (place: Place) => void;
  onMapRightClick?: (lat: number, lng: number, clientX: number, clientY: number) => void;
  onMapCenterChange?: (lat: number, lng: number) => void;
  onMapLevelChange?: (level: number) => void;
  infoWindowPlace?: Place | null;
  onCloseInfoWindow?: () => void;
  onTogglePinFromInfo?: (place: Place) => void;
  onOpenPlacePhotosFromInfo?: (place: Place) => void;
  onOpenRoadviewFromInfo?: (place: Place) => void;
  fitRouteBounds?: boolean;
  fitSearchBounds?: boolean;
  /** 조감(Overview) 등 — 보이는 핀(+출발지) 전체가 들어오도록 축척 맞춤 */
  fitPinsBounds?: boolean;
  highlightPlaceId?: string | null;
  onHoverSearchPlace?: (place: Place) => void;
  pinSelectionFilter?: ReadonlySet<string>;
  plazaMarkers?: ReadonlyArray<{ id: string; lat: number; lng: number; title: string }>;
  highlightPlazaId?: string | null;
  onPlazaMarkerClick?: (id: string) => void;
}

export function GoogleMapView({
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
  onMapRightClick,
  onMapCenterChange,
  onMapLevelChange,
  infoWindowPlace = null,
  onCloseInfoWindow,
  onTogglePinFromInfo,
  onOpenPlacePhotosFromInfo,
  onOpenRoadviewFromInfo,
  fitRouteBounds = false,
  fitSearchBounds = false,
  fitPinsBounds = false,
  highlightPlaceId = null,
  onHoverSearchPlace,
  pinSelectionFilter,
  plazaMarkers = [],
  highlightPlazaId = null,
  onPlazaMarkerClick,
}: Props) {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const centerReadyRef = useRef(false);
  const suppressZoomSyncRef = useRef(false);
  const skipStaleZoomApplyRef = useRef(false);
  const onMapLevelChangeRef = useRef(onMapLevelChange);
  onMapLevelChangeRef.current = onMapLevelChange;
  const markersRef = useRef<any[]>([]);
  const placeMarkersRef = useRef<GoogleHtmlMarker[]>([]);
  const routeLineRef = useRef<any>(null);
  const compareLinesRef = useRef<any[]>([]);
  const originMarkerRef = useRef<any>(null);
  const searchCenterMarkerRef = useRef<any>(null);
  const draftPinRef = useRef<any>(null);
  const listenersRef = useRef<any[]>([]);
  const selectPlaceRef = useRef(onSelectPlace);
  const pinnedClickRef = useRef(onPinnedMarkerClick);
  const hoverSearchRef = useRef(onHoverSearchPlace);
  selectPlaceRef.current = onSelectPlace;
  pinnedClickRef.current = onPinnedMarkerClick;
  hoverSearchRef.current = onHoverSearchPlace;
  const infoBubbleRef = useRef<GoogleHtmlMarker | null>(null);
  const openPlacePhotosRef = useRef(onOpenPlacePhotosFromInfo);
  const togglePinFromInfoRef = useRef(onTogglePinFromInfo);
  const openRoadviewRef = useRef(onOpenRoadviewFromInfo);
  openPlacePhotosRef.current = onOpenPlacePhotosFromInfo;
  togglePinFromInfoRef.current = onTogglePinFromInfo;
  openRoadviewRef.current = onOpenRoadviewFromInfo;

  const pinSelectionActive = pinSelectionFilter != null && pinSelectionFilter.size > 0;
  let visiblePinned = pinCategoryFilter
    ? pinned.filter((p) => getCategoryMeta(p.categoryCode).category === pinCategoryFilter)
    : pinned;
  if (pinSelectionActive) {
    visiblePinned = visiblePinned.filter((p) => pinSelectionFilter!.has(p.id));
  }

  useEffect(() => {
    if (!mapsReady || !mapEl.current || !window.google?.maps) return;
    if (mapRef.current) return;
    const { zoom: initialZoom, recoveredLevel } = googleZoomForPlannerLevel(level);
    mapRef.current = new window.google.maps.Map(mapEl.current, {
      center,
      zoom: initialZoom,
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: false,
    });
    if (recoveredLevel != null) {
      skipStaleZoomApplyRef.current = true;
      onMapLevelChangeRef.current?.(recoveredLevel);
    }
    return () => {
      markersRef.current.forEach((m) => {
        try {
          m.setMap(null);
        } catch {
          /* ignore */
        }
      });
      markersRef.current = [];
      for (const ref of [
        routeLineRef,
        originMarkerRef,
        searchCenterMarkerRef,
        draftPinRef,
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
      listenersRef.current.forEach((l) => l.remove?.());
      listenersRef.current = [];
      infoBubbleRef.current?.setMap(null);
      infoBubbleRef.current = null;
      mapRef.current = null;
      if (mapEl.current) mapEl.current.innerHTML = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapsReady]);

  useEffect(() => {
    if (!mapRef.current || fitSearchBounds) return;
    const target: MapLatLng = { lat: center.lat, lng: center.lng };
    const isInitial = !centerReadyRef.current;

    if (isInitial) {
      mapRef.current.setCenter(target);
      centerReadyRef.current = true;
      return;
    }

    const c = mapRef.current.getCenter();
    const current: MapLatLng = { lat: c.lat(), lng: c.lng() };

    /* 좌측 패널이 지도를 가릴 때 대상이 패널 뒤로 들어가지 않도록 남은 영역
     * 한가운데로 민다.
     *
     * panBy는 쓰지 않는다 — 상대 이동인 데다 애니메이션이라 setCenter와 겹치면
     * 이동량이 누적된다. 대신 월드 좌표에서 offset(픽셀)을 현재 축척으로 나눠
     * 빼는 방식으로 중심을 구한다. 동기 계산이라 여러 번 실행해도 결과가 같다. */
    if (centerOffsetX) {
      const projection = mapRef.current.getProjection();
      /* 지도의 현재 줌(getZoom)을 쓰면 안 된다. 이 효과는 줌 효과보다 먼저
       * 실행되므로 확대 전 축척이 잡히고, 그 축척으로 픽셀을 환산하면 수백 km
       * 밀려 대상이 화면 밖으로 나간다. 곧 적용될 목표 줌으로 계산한다. */
      const zoom = kakaoLevelToGoogleZoom(level);
      if (projection && typeof zoom === 'number') {
        const scale = 2 ** zoom;
        const pt = projection.fromLatLngToPoint(
          new window.google.maps.LatLng(target.lat, target.lng),
        );
        const shifted = new window.google.maps.Point(pt.x - centerOffsetX / scale, pt.y);
        mapRef.current.setCenter(projection.fromPointToLatLng(shifted));
      } else {
        mapRef.current.setCenter(target);
      }
      return;
    }

    if (shouldAnimateMapCenter(current, target)) {
      mapRef.current.panTo(target);
    } else if (!mapCentersNear(current, target)) {
      mapRef.current.setCenter(target);
    }
  }, [center.lat, center.lng, fitSearchBounds, centerOffsetX, level]);

  useEffect(() => {
    if (!mapRef.current || fitSearchBounds) return;
    const nextZoom = kakaoLevelToGoogleZoom(level);
    if (skipStaleZoomApplyRef.current) {
      skipStaleZoomApplyRef.current = false;
      if (nextZoom < MIN_PLANNER_GOOGLE_ZOOM) return;
    }
    const currentZoom = mapRef.current.getZoom();
    if (typeof currentZoom === 'number' && Math.round(currentZoom) === nextZoom) {
      return;
    }
    suppressZoomSyncRef.current = true;
    mapRef.current.setZoom(nextZoom);
  }, [level, levelTick, fitSearchBounds]);

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setMapTypeId(mapType === 'satellite' ? 'hybrid' : 'roadmap');
  }, [mapType]);

  useEffect(() => {
    if (!mapRef.current) return;
    listenersRef.current.forEach((l) => l.remove?.());
    listenersRef.current = [];
    if (onMapCenterChange) {
      listenersRef.current.push(
        mapRef.current.addListener('dragend', () => {
          const c = mapRef.current.getCenter();
          onMapCenterChange(c.lat(), c.lng());
        })
      );
    }
    listenersRef.current.push(
      mapRef.current.addListener('zoom_changed', () => {
        if (suppressZoomSyncRef.current) {
          suppressZoomSyncRef.current = false;
          return;
        }
        const z = mapRef.current.getZoom();
        if (typeof z === 'number') onMapLevelChange?.(googleZoomToKakaoLevel(z));
        if (onMapCenterChange) {
          const c = mapRef.current.getCenter();
          onMapCenterChange(c.lat(), c.lng());
        }
      })
    );
    if (onCloseInfoWindow && !pickingOriginFromMap && !pickingPinFromMap) {
      listenersRef.current.push(
        mapRef.current.addListener('click', () => onCloseInfoWindow())
      );
    }
    if (pickingOriginFromMap || pickingPinFromMap) {
      listenersRef.current.push(
        mapRef.current.addListener('click', async (e: any) => {
          const lat = e.latLng.lat();
          const lng = e.latLng.lng();
          let addr = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
          try {
            addr = await reverseGeocodeWithGoogle(lat, lng);
          } catch {
            // noop
          }
          if (pickingOriginFromMap) onOriginPicked?.(lat, lng, addr);
          else onPinLocationPicked?.(lat, lng, addr);
        })
      );
    }
    if (onMapRightClick && !pickingOriginFromMap && !pickingPinFromMap) {
      listenersRef.current.push(
        mapRef.current.addListener('rightclick', (e: any) => {
          const lat = e.latLng.lat();
          const lng = e.latLng.lng();
          const ev = e.domEvent as MouseEvent | undefined;
          onMapRightClick(lat, lng, ev?.clientX ?? 0, ev?.clientY ?? 0);
        })
      );
    }
    return () => {
      listenersRef.current.forEach((l) => l.remove?.());
      listenersRef.current = [];
    };
  }, [
    onMapCenterChange,
    onMapLevelChange,
    onMapRightClick,
    pickingOriginFromMap,
    pickingPinFromMap,
    onOriginPicked,
    onPinLocationPicked,
    onCloseInfoWindow,
  ]);

  useEffect(() => {
    if (!mapRef.current) return;
    infoBubbleRef.current?.setMap(null);
    infoBubbleRef.current = null;
    if (!infoWindowPlace) return;
    const place = infoWindowPlace;
    const isPinned = pinned.some((p) => p.id === place.id);
    infoBubbleRef.current = new GoogleHtmlMarker(
      mapRef.current,
      { lat: place.lat, lng: place.lng },
      createMapPlaceBubbleHtml(place, isPinned),
      1.28,
      {
        zIndex: 2000,
        onClick: (e) => {
          if (isMapPlaceBubblePinClick(e.target)) {
            e.preventDefault();
            togglePinFromInfoRef.current?.(place);
            return;
          }
          if (isMapPlaceBubbleDetailClick(e.target)) {
            e.preventDefault();
            openPlacePhotosRef.current?.(place);
            return;
          }
          if (isMapPlaceBubbleRoadviewClick(e.target)) {
            e.preventDefault();
            openRoadviewRef.current?.(place);
          }
        },
      }
    );
  }, [infoWindowPlace, pinned]);

  useEffect(() => {
    if (!mapRef.current) return;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    placeMarkersRef.current = [];

    if (plazaMarkers.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      plazaMarkers.forEach((m) => {
        const marker = new window.google.maps.Marker({
          map: mapRef.current,
          position: { lat: m.lat, lng: m.lng },
          title: m.title,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            fillColor: highlightPlazaId === m.id ? '#dc2626' : '#2563eb',
            fillOpacity: 1,
            strokeColor: '#fff',
            strokeWeight: 2,
            scale: highlightPlazaId === m.id ? 9 : 7,
          },
        });
        marker.addListener('click', () => onPlazaMarkerClick?.(m.id));
        markersRef.current.push(marker);
        bounds.extend(marker.getPosition());
      });
      if (plazaMarkers.length >= 2) mapRef.current.fitBounds(bounds);
      return;
    }

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

    places.forEach((place) => {
      const isPinned = !!place._pinned;
      const isSearchResult = searchIdSet.has(place.id);
      const marker = new GoogleHtmlMarker(
        mapRef.current,
        { lat: place.lat, lng: place.lng },
        renderPlaceMarkerHtml({
          place,
          pinned: place._pinned,
          isSelected: false,
        }),
        1,
        {
          placeId: place.id,
          zIndex: isPinned ? 500 : 200,
          onClick: () => {
            if (isPinned) pinnedClickRef.current?.(place);
            else selectPlaceRef.current?.(place);
          },
          onMouseEnter: isSearchResult
            ? () => hoverSearchRef.current?.(place)
            : undefined,
        }
      );
      markersRef.current.push(marker);
      placeMarkersRef.current.push(marker);
    });
  }, [
    searchResults,
    visiblePinned,
    pinSelectionActive,
    plazaMarkers,
    highlightPlazaId,
    onPlazaMarkerClick,
  ]);

  useEffect(() => {
    placeMarkersRef.current.forEach((marker) => {
      marker.setSelected(marker.placeId === highlightPlaceId);
    });
  }, [highlightPlaceId, searchResults, visiblePinned, pinSelectionActive]);

  useEffect(() => {
    if (!mapRef.current) return;
    originMarkerRef.current?.setMap(null);
    originMarkerRef.current = null;
    if (origin?.lat && origin?.lng) {
      originMarkerRef.current = new window.google.maps.Marker({
        map: mapRef.current,
        position: { lat: origin.lat, lng: origin.lng },
        title: i18n.t('map.origin', { ns: 'planner' }),
        icon: {
          path: window.google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
          fillColor: '#2563eb',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 1.5,
          scale: 5,
        },
      });
    }
  }, [origin?.lat, origin?.lng, i18n.language]);

  useEffect(() => {
    if (!mapRef.current) return;
    searchCenterMarkerRef.current?.setMap(null);
    searchCenterMarkerRef.current = null;
    if (!nearbySearchCenter) return;
    searchCenterMarkerRef.current = new GoogleHtmlMarker(
      mapRef.current,
      nearbySearchCenter,
      renderSearchCenterMarkerHtml(),
      0.5
    );
  }, [nearbySearchCenter?.lat, nearbySearchCenter?.lng]);

  useEffect(() => {
    if (!mapRef.current) return;
    draftPinRef.current?.setMap(null);
    draftPinRef.current = null;
    if (!draftPinLocation) return;
    draftPinRef.current = new window.google.maps.Marker({
      map: mapRef.current,
      position: draftPinLocation,
      title: i18n.t('map.pickedLocation', { ns: 'planner' }),
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        fillColor: '#1f2937',
        fillOpacity: 1,
        strokeColor: '#fff',
        strokeWeight: 2,
        scale: 8,
      },
    });
  }, [draftPinLocation?.lat, draftPinLocation?.lng, i18n.language]);

  /** 최적화 3종 비교 경로 — 확정 경로 아래에 연하게, 선택된 것만 진하게 */
  useEffect(() => {
    if (!mapRef.current) return;
    for (const line of compareLinesRef.current) line.setMap(null);
    compareLinesRef.current = [];
    if (!compareRoutes?.length) return;

    for (const r of compareRoutes) {
      if (r.path.length < 2) continue;
      const selected = r.optimizeBy === selectedOptimizeBy;
      const baseWeight = COMPARE_LINE_WEIGHT[r.optimizeBy as OptimizeBy] ?? 4;
      compareLinesRef.current.push(
        new window.google.maps.Polyline({
          map: mapRef.current,
          path: r.path,
          strokeColor: r.color,
          strokeOpacity: selected ? 0.9 : 0.6,
          strokeWeight: selected ? 7 : baseWeight,
          // 선택된 것이 항상 맨 위, 미선택끼리는 얇은 쪽이 위 — 겹치는 구간에서
          // 두꺼운 쪽 테두리가 옆으로 드러나 층이 보인다(§6-7).
          zIndex: selected ? 10 : 10 - baseWeight,
        }),
      );
    }
    return () => {
      for (const line of compareLinesRef.current) line.setMap(null);
      compareLinesRef.current = [];
    };
  }, [compareRoutes, selectedOptimizeBy]);

  useEffect(() => {
    if (!mapRef.current) return;
    routeLineRef.current?.setMap(null);
    routeLineRef.current = null;
    if (!generatedRoute) return;
    const path: Array<{ lat: number; lng: number }> = [];
    if (generatedRoute.routePath?.length) {
      generatedRoute.routePath.forEach((p) => path.push({ lat: p.lat, lng: p.lng }));
    } else if (generatedRoute.stops.length >= 2) {
      if (generatedRoute.origin.lat && generatedRoute.origin.lng) {
        path.push({ lat: generatedRoute.origin.lat, lng: generatedRoute.origin.lng });
      }
      generatedRoute.stops.forEach((s) => path.push({ lat: s.lat, lng: s.lng }));
    }
    if (path.length < 2) return;
    routeLineRef.current = new window.google.maps.Polyline({
      map: mapRef.current,
      path,
      strokeColor: '#1f2937',
      strokeOpacity: 0.85,
      strokeWeight: 4,
    });
    if (fitRouteBounds) {
      const bounds = new window.google.maps.LatLngBounds();
      path.forEach((p) => bounds.extend(p));
      mapRef.current.fitBounds(bounds);
    }
  }, [generatedRoute, fitRouteBounds]);

  useEffect(() => {
    if (!mapRef.current || !fitSearchBounds) return;
    const points = validMapPoints(searchResults);
    if (points.length === 0) return;

    if (points.length === 1) {
      mapRef.current.panTo(points[0]);
      return;
    }

    const bounds = new window.google.maps.LatLngBounds();
    points.forEach((p) => bounds.extend(p));
    const pad = searchResultFitPadding();
    suppressZoomSyncRef.current = true;
    mapRef.current.fitBounds(bounds, pad);
  }, [searchResults, fitSearchBounds]);

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
      mapRef.current.setCenter(points[0]);
      mapRef.current.setZoom(14);
      return;
    }

    const bounds = new window.google.maps.LatLngBounds();
    points.forEach((p) => bounds.extend(p));
    mapRef.current.fitBounds(bounds, { top: 96, right: 48, bottom: 96, left: 48 });
  }, [
    fitPinsBounds,
    pinned,
    pinCategoryFilter,
    pinSelectionFilter,
    origin?.lat,
    origin?.lng,
  ]);

  const longPress = useLongPress((point) => onMapLongPress?.(point));

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
