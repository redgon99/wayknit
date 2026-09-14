import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';
import type { GeneratedRoute, PinnedPlace } from '../types';
import { getCategoryMeta } from '../lib/categories';
import { useTravelModeMeta } from '../lib/i18nCategories';
import { buildKakaoMapDirectionsUrl, buildLegMapLinks } from '../lib/mapLinks';
import { parseHHMM, formatHHMM } from '../lib/timeOfDay';

interface Props {
  route: GeneratedRoute;
  currentDay: number;
  panelOpen: boolean;
  collapsed: boolean;
  /** 'mobile'이면 데스크톱 사이드패널 오버레이 배치 대신 모바일 바텀시트 위 고정 카드로 렌더링 */
  variant?: 'desktop' | 'mobile';
  onToggleCollapsed: () => void;
  onReoptimize: () => void;
  onClearRoute?: () => void;
  selectedStopId?: string | null;
  onSelectStop?: (placeId: string) => void;
  onShowTaxiCard?: (place: PinnedPlace) => void;
  refining?: boolean;
}

function formatStayLabel(
  minutes: number,
  t: (key: string, opts?: Record<string, unknown>) => string
): string {
  if (minutes <= 0) return '';
  if (minutes < 60) return t('dock.stayMinutes', { n: minutes });
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return t('dock.stayHours', { n: h });
  return t('dock.stayHoursMinutes', { h, m });
}

export function RouteTimelineDock({
  route,
  currentDay,
  panelOpen,
  collapsed,
  variant = 'desktop',
  onToggleCollapsed,
  onReoptimize,
  onClearRoute,
  selectedStopId,
  onSelectStop,
  onShowTaxiCard,
  refining,
}: Props) {
  const { t } = useTranslation('planner');
  const travelModeMeta = useTravelModeMeta();
  const modeMeta = travelModeMeta[route.options.travelMode];
  const directionsUrl = buildKakaoMapDirectionsUrl(route);
  const leftClass = panelOpen ? 'dock-beside-panel' : 'dock-beside-rail';
  const placementClass =
    variant === 'mobile' ? 'route-dock-mobile' : `${leftClass} desktop-only-overlay`;
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const chipTrackRef = useRef<HTMLDivElement>(null);

  const focusIndex = useMemo(() => {
    if (!route.stops.length) return 0;
    if (selectedStopId) {
      const i = route.stops.findIndex((s) => s.id === selectedStopId);
      if (i >= 0) return i;
    }
    return 0;
  }, [route.stops, selectedStopId]);

  const focusStop = route.stops[focusIndex] ?? null;
  const focusMeta = focusStop
    ? getCategoryMeta(focusStop.categoryCode, focusStop.category)
    : null;
  const stayLabel = focusStop
    ? formatStayLabel(focusStop.stayMinutes ?? 0, t)
    : '';
  /**
   * `route.legs[i]`가 "stops[i]로 들어오는 구간"인지 "stops[i+1]로 들어오는
   * 구간"인지는 출발지 유무에 따라 갈린다 — `generateRoute()`(planner.ts)는
   * 출발지가 있으면(실제로는 거의 항상 있다, resolveOriginForRoute가 좌표를
   * 채워 넣는다) legs[i]=stops[i]로 들어오는 구간이지만, 출발지가 없으면
   * legs[i]=stops[i+1]로 들어오는 구간이라 한 칸 밀린다. `legs.length -
   * stops.length`가 그 차이(0 또는 -1)라 이 오프셋으로 항상 맞는 구간을
   * 가리킨다 — 예전엔 `focusIndex - 1`로 고정해서 출발지가 있는 보통의
   * 경우 엉뚱한(한 칸 이전) 구간의 소요시간을 보여주고 있었다(N01 작업
   * 중 발견 — 신규 "출발 권장 시각" 기능이 이 값에 그대로 의존해서 먼저
   * 바로잡았다).
   */
  const legOffset = route.legs.length - route.stops.length;
  const legIndex = focusIndex + legOffset;
  const legIntoFocus = legIndex >= 0 ? route.legs[legIndex] ?? null : null;

  /**
   * N01(모바일 UX 리포트 2026-09-13, 신규 제안 — 다음 장소 실행 화면).
   * "언제 출발해야 정시에 도착하나"는 도착 예정시각에서 이 구간 이동시간을
   * 빼면 된다. 1분 단위 갱신이면 충분해 30초마다만 다시 읽는다.
   */
  const [nowMinutes, setNowMinutes] = useState(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });
  useEffect(() => {
    const id = window.setInterval(() => {
      const d = new Date();
      setNowMinutes(d.getHours() * 60 + d.getMinutes());
    }, 30_000);
    return () => window.clearInterval(id);
  }, []);

  const recommendDepartMinutes =
    focusStop && legIntoFocus
      ? parseHHMM(focusStop.arriveAt) - legIntoFocus.durationMinutes
      : null;
  const departIsPast = recommendDepartMinutes != null && recommendDepartMinutes <= nowMinutes;

  /** 이 구간(이전 지점 → 다음 목적지)만의 길찾기 링크 — 전체 동선용 buildKakaoMapDirectionsUrl과 별개 */
  const navFromPoint =
    focusIndex > 0
      ? route.stops[focusIndex - 1]
      : route.origin.lat !== undefined && route.origin.lng !== undefined
        ? { name: route.origin.label, lat: route.origin.lat, lng: route.origin.lng }
        : null;
  const legNavUrl =
    focusStop && legIntoFocus && navFromPoint
      ? buildLegMapLinks(
          navFromPoint,
          { name: focusStop.name, lat: focusStop.lat, lng: focusStop.lng },
          route.options.travelMode
        ).kakao
      : null;

  const nextStop = focusStop && focusIndex < route.stops.length - 1 ? route.stops[focusIndex + 1] : null;

  useEffect(() => {
    const el = chipTrackRef.current?.querySelector<HTMLElement>(
      '.route-dock-chip.selected'
    );
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [focusIndex, collapsed]);

  useEffect(() => {
    if (!moreOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [moreOpen]);

  if (collapsed) {
    const nextName = route.stops[0]?.name ?? '';
    return (
      <div className={`route-timeline-dock collapsed ${placementClass}`}>
        <button type="button" className="route-dock-pill" onClick={onToggleCollapsed}>
          <span className="route-dock-pill-title">
            {t('dock.pillTitle', { day: currentDay, count: route.stops.length })}
          </span>
          <span className="route-dock-pill-stats">
            {nextName
              ? t('dock.pillNext', { name: nextName, finish: route.finishAt })
              : t('dock.endsAt', { time: route.finishAt })}
          </span>
          <Icon name="chevronDown" size={16} className="route-dock-chevron-up" />
        </button>
      </div>
    );
  }

  return (
    <div className={`route-timeline-dock route-dock-nextup ${placementClass}`}>
      {refining && (
        <div className="route-dock-refining">
          <Icon name="loader" spin size={14} /> {t('route.refining')}
        </div>
      )}

      <div className="route-dock-header">
        <span className="route-dock-title">{t('dock.dayTitle', { day: currentDay })}</span>
        {focusStop && (
          <span className="route-dock-next-chip">
            {t('dock.nextLabel')} · {focusStop.name}
          </span>
        )}
        <span className="route-dock-ends">{t('dock.endsAt', { time: route.finishAt })}</span>
        <div className="route-dock-spacer" />

        <button
          type="button"
          className={`route-dock-btn ghost ${detailsOpen ? 'active' : ''}`}
          onClick={() => setDetailsOpen((v) => !v)}
          aria-expanded={detailsOpen}
        >
          {detailsOpen ? t('dock.hideDetails') : t('dock.showDetails')}
        </button>

        <div className="route-dock-more" ref={moreRef}>
          <button
            type="button"
            className={`route-dock-btn ghost icon-only ${moreOpen ? 'active' : ''}`}
            onClick={() => setMoreOpen((v) => !v)}
            aria-expanded={moreOpen}
            aria-haspopup="menu"
            aria-label={t('dock.more')}
            title={t('dock.more')}
          >
            <span className="route-dock-more-dots" aria-hidden>
              ⋯
            </span>
          </button>
          {moreOpen && (
            <div className="route-dock-more-menu" role="menu">
              {directionsUrl && (
                <a
                  role="menuitem"
                  className="route-dock-more-item"
                  href={directionsUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setMoreOpen(false)}
                >
                  {t('route.mapDrive')}
                </a>
              )}
              {onClearRoute && (
                <>
                  <div className="route-dock-more-sep" aria-hidden />
                  <button
                    type="button"
                    role="menuitem"
                    className="route-dock-more-item danger"
                    onClick={() => {
                      setMoreOpen(false);
                      onClearRoute();
                    }}
                  >
                    {t('dock.clearRoute')}
                  </button>
                </>
              )}
              <div className="route-dock-more-meta" role="note">
                {modeMeta.label} · {t('dock.departAt', { time: route.options.departTime })}
              </div>
            </div>
          )}
        </div>

        <button type="button" className="route-dock-btn accent" onClick={onReoptimize}>
          {t('dock.rebuild')}
        </button>
        <button
          type="button"
          className="route-dock-btn ghost icon-only"
          onClick={onToggleCollapsed}
          aria-label={t('dock.collapse')}
        >
          <Icon name="chevronDown" size={16} />
        </button>
      </div>

      {detailsOpen && (
        <div className="route-dock-details">
          <span>
            {t('dock.detailDistance', { km: route.totalDistanceKm })}
          </span>
          <span aria-hidden>·</span>
          <span>
            {t('dock.detailTravel', { minutes: route.totalTravelMinutes })}
          </span>
          <span aria-hidden>·</span>
          <span>{t('dock.detailStops', { count: route.stops.length })}</span>
          <span aria-hidden>·</span>
          <span>{modeMeta.label}</span>
        </div>
      )}

      <div className="route-dock-body">
        {focusStop && focusMeta && (
          <div className="route-dock-focus">
            <div className="route-dock-focus-top">
              <span
                className="route-dock-focus-num"
                style={{ background: focusMeta.bgColor, color: focusMeta.iconColor }}
              >
                {focusIndex + 1}
              </span>
              <span className="route-dock-focus-badge">{t('dock.focusBadge')}</span>
              {onShowTaxiCard && (
                <button
                  type="button"
                  className="route-dock-focus-taxi"
                  onClick={() => onShowTaxiCard(focusStop)}
                  title={t('taxi.showCard')}
                  aria-label={t('taxi.showCard')}
                >
                  <Icon name="transportCar" size={14} />
                  <span>{t('taxi.showCard')}</span>
                </button>
              )}
            </div>
            <div className="route-dock-focus-name">{focusStop.name}</div>
            <div className="route-dock-focus-meta">
              <span>{t('dock.arriveAt', { time: focusStop.arriveAt })}</span>
              {stayLabel && (
                <>
                  <span aria-hidden>·</span>
                  <span>{stayLabel}</span>
                </>
              )}
            </div>
            {legIntoFocus && (
              <div className="route-dock-focus-leg">
                {t('dock.travelFromPrev', { minutes: legIntoFocus.durationMinutes })}
              </div>
            )}
            {recommendDepartMinutes != null && (
              <div className={`route-dock-focus-depart ${departIsPast ? 'past' : ''}`}>
                {departIsPast
                  ? t('dock.departNow')
                  : t('dock.departRecommend', { time: formatHHMM(recommendDepartMinutes) })}
              </div>
            )}
            <div className="route-dock-focus-actions">
              <button
                type="button"
                className="route-dock-focus-edit"
                onClick={() => onSelectStop?.(focusStop.id)}
              >
                <Icon name="mapPin" size={14} />
                {t('dock.editOnMap')}
              </button>
              {legNavUrl && (
                <a
                  className="route-dock-focus-edit"
                  href={legNavUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Icon name="route" size={14} />
                  {t('dock.navigateHere')}
                </a>
              )}
            </div>
            {nextStop ? (
              <button
                type="button"
                className="route-dock-focus-arrived"
                onClick={() => onSelectStop?.(nextStop.id)}
              >
                <Icon name="check" size={15} />
                {t('dock.arrivedGoNext')}
              </button>
            ) : (
              <div className="route-dock-focus-lastbadge">{t('dock.lastStop')}</div>
            )}
          </div>
        )}

        <div
          className="route-dock-chip-track"
          ref={chipTrackRef}
          role="list"
          aria-label={t('dock.stopsAria')}
        >
          {route.stops.map((stop, i) => {
            const meta = getCategoryMeta(stop.categoryCode, stop.category);
            const selected = i === focusIndex;
            // legIntoFocus와 같은 오프셋 보정 — 위 주석 참고.
            const legI = i + legOffset;
            const leg = legI >= 0 ? route.legs[legI] ?? null : null;
            return (
              <div key={stop.id} className="route-dock-chip-wrap" role="listitem">
                {i > 0 && (
                  <span className="route-dock-chip-arrow" aria-hidden>
                    {leg ? `${leg.durationMinutes}${t('route.minutes')}` : '›'}
                  </span>
                )}
                <button
                  type="button"
                  className={`route-dock-chip ${selected ? 'selected' : ''}`}
                  onClick={() => onSelectStop?.(stop.id)}
                  aria-current={selected ? 'step' : undefined}
                  title={`${stop.name} · ${stop.arriveAt}`}
                >
                  <span
                    className="route-dock-chip-num"
                    style={{ background: meta.bgColor, color: meta.iconColor }}
                  >
                    {i + 1}
                  </span>
                  <span className="route-dock-chip-name">{stop.name}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
