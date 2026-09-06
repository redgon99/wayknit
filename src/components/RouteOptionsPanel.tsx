import { Icon } from './Icon';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  PinnedPlace,
  RouteOptions,
  RouteStop,
  TravelMode,
  OptimizeBy,
  OriginType,
  Origin,
  SimpleCategory,
} from '../types';
import { isHoursProblem } from '../lib/openingHours';
import { suggestStayMinutes, getCategoryMeta } from '../lib/categories';
import { useTravelModeMeta } from '../lib/i18nCategories';
import { generateRoute } from '../lib/planner';
import { normalizeLocale } from '../lib/locale';
import { fetchAiStaySuggestions } from '../lib/routeStaySuggest';
import {
 COMPARE_COLORS,
 compareRouteOptions,
 comparisonKey,
 type RouteComparison,
} from '../lib/routeCompare';
import { BookingLinkCards } from './BookingLinkCards';
import { BookingSearchSuggestions } from './BookingSearchSuggestions';
import { SortableContainer, SortableItem } from './Sortable';

interface Props {
  open: boolean;
  currentDay: number;
  totalDays: number;
  pinned: PinnedPlace[];
  options: RouteOptions;
  onChange: (next: RouteOptions) => void;
  onClose: () => void;
  onGenerate: () => void;
  onPickOriginFromMap: () => void;
  onCopyFromPreviousDay?: () => void;
  pickingOriginFromMap?: boolean;
  hasExistingRoute?: boolean;
  onUpdateStayMinutes?: (placeId: string, minutes: number) => void;
  /** 도착 시각 고정 — null이면 해제 */
  onUpdateFixedArrival?: (placeId: string, time: string | null) => void;
  /** 예약 아이템 여부 — 예약은 시각이 움직이지 않는 하드 앵커가 된다 */
  onUpdateItemKind?: (placeId: string, kind: PinnedPlace['itemKind']) => void;
  /** 핀 메모 — 예약 링크를 붙여 넣으면 카드로 렌더링된다 */
  onUpdateNote?: (placeId: string, note: string) => void;
  /** "핀 순서"(autoOrder=false) 모드에서 방문 순서를 드래그로 바꿀 때 호출 */
  onReorderPins?: (next: PinnedPlace[]) => void;
  /** 좌측 탭 패널 안에 임베드 (고정 우측 슬라이드 비활성) */
  embedded?: boolean;
  /** 최적화 3종 비교 경로 — 지도에 겹쳐 그리도록 상위로 올린다 */
  onCompareRoutesChange?: (routes: RouteComparison[]) => void;
}

const OPTIMIZE_KEYS: OptimizeBy[] = ['distance', 'time', 'no-toll'];

const OPTIMIZE_I18N: Record<OptimizeBy, string> = {
  distance: 'route.options.optimizeDistance',
  time: 'route.options.optimizeTime',
  'no-toll': 'route.options.optimizeNoToll',
};

export function RouteOptionsPanel({
  open,
  currentDay,
  totalDays: _totalDays,
  pinned,
  options,
  onChange,
  onClose,
  onGenerate,
  onPickOriginFromMap,
  onCopyFromPreviousDay,
  pickingOriginFromMap = false,
  hasExistingRoute = false,
  onUpdateStayMinutes,
  onUpdateFixedArrival,
  onUpdateItemKind,
  onUpdateNote,
  onReorderPins,
  embedded = false,
  onCompareRoutesChange,
}: Props) {
  const { t, i18n } = useTranslation('planner');
  const travelModeMeta = useTravelModeMeta();
  const [originMenuOpen, setOriginMenuOpen] = useState(false);
  const [aiStayLoading, setAiStayLoading] = useState(false);
  const [aiStayReasons, setAiStayReasons] = useState<Record<string, string>>({});
  const [aiStayError, setAiStayError] = useState(false);
  const [hoursOnly, setHoursOnly] = useState(false);
  const [comparisons, setComparisons] = useState<RouteComparison[]>([]);
  const [comparing, setComparing] = useState(false);

  const preview = useMemo(() => {
    if (pinned.length === 0) return null;
    try {
      return generateRoute(pinned, options);
    } catch {
      return null;
    }
  }, [pinned, options]);

  // 예정 방문 시각에 문을 닫는 곳만 추려 보기
  const hoursProblemStops = useMemo(
    () => (preview?.stops ?? []).filter((s) => isHoursProblem(s.hoursStatus)),
    [preview],
  );
  const hoursProblemCount = hoursProblemStops.length;
  const stayRows: Array<PinnedPlace & Partial<RouteStop>> =
    hoursOnly && hoursProblemCount > 0 ? hoursProblemStops : (preview?.stops ?? pinned);

  /**
   * "핀 순서"(autoOrder=false) 모드에서만 드래그 재정렬을 허용한다 — 자동 모드는
   * 매번 최적 순서로 재계산되므로 드래그해도 다음 렌더에서 그대로 되돌아간다.
   * hoursOnly 필터가 켜져 있을 때는 stayRows가 전체 스톱의 부분집합이라 드래그
   * 결과를 원래 배열에 정확히 되꽂을 수 없으므로 그때도 끈다.
   */
  const canReorderStops = !options.autoOrder && !hoursOnly && Boolean(onReorderPins);

  function handleReorderStops(orderedIds: string[]) {
    if (!onReorderPins) return;
    const byId = new Map(pinned.map((p) => [p.id, p]));
    const next = orderedIds
      .map((id) => byId.get(id))
      .filter((p): p is PinnedPlace => Boolean(p));
    onReorderPins(next);
  }

  /**
   * 최적화 3종 경로를 미리 받아 지도에 겹쳐 보여준다.
   * 좌표·이동수단이 그대로면 다시 부르지 않는다(호출 3회를 아끼려고 키로 묶음).
   */
  const comparePoints = useMemo(() => {
    const pts: Array<{ lat: number; lng: number }> = [];
    if (options.origin.lat !== undefined && options.origin.lng !== undefined) {
      pts.push({ lat: options.origin.lat, lng: options.origin.lng });
    }
    for (const s of preview?.stops ?? pinned) pts.push({ lat: s.lat, lng: s.lng });
    return pts;
  }, [options.origin.lat, options.origin.lng, preview, pinned]);

  const compareKey = useMemo(
    () => comparisonKey(comparePoints, options.travelMode),
    [comparePoints, options.travelMode],
  );

  useEffect(() => {
    if (options.travelMode !== 'car' || comparePoints.length < 2) {
      setComparisons([]);
      return;
    }
    let alive = true;
    setComparing(true);
    void compareRouteOptions(comparePoints, options.travelMode).then((rows) => {
      if (!alive) return;
      setComparisons(rows);
      setComparing(false);
    });
    return () => {
      alive = false;
    };
    // comparePoints는 compareKey에 녹아 있다 — 키가 같으면 재호출하지 않는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compareKey]);

  useEffect(() => {
    onCompareRoutesChange?.(comparisons);
  }, [comparisons, onCompareRoutesChange]);

  const selectedComparison = comparisons.find((c) => c.optimizeBy === options.optimizeBy) ?? null;

  function patch<K extends keyof RouteOptions>(key: K, value: RouteOptions[K]) {
    onChange({ ...options, [key]: value });
  }

  function patchOrigin(next: Partial<Origin>) {
    onChange({ ...options, origin: { ...options.origin, ...next } });
  }

  async function handleToggleAutoStay() {
    if (options.autoStayTime) {
      patch('autoStayTime', false);
      return;
    }
    if (!onUpdateStayMinutes || pinned.length === 0) {
      patch('autoStayTime', true);
      return;
    }

    setAiStayLoading(true);
    setAiStayError(false);
    const targets = pinned.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      categoryLabel: p.categoryLabel,
      address: p.address,
    }));
    const suggestions = await fetchAiStaySuggestions(targets, normalizeLocale(i18n.language));

    if (suggestions && suggestions.length > 0) {
      const reasons: Record<string, string> = {};
      for (const s of suggestions) {
        onUpdateStayMinutes(s.id, s.minutes);
        if (s.reason) reasons[s.id] = s.reason;
      }
      setAiStayReasons(reasons);
      patch('autoStayTime', true);
    } else {
      // 실패를 화면에 알린다 — 여기서 autoStayTime을 true로 바꾸지 않는다.
      // true는 "AI 추천이 실제로 적용된 상태"를 뜻하므로, 실패했는데 켜진 것처럼
      // 보이면 사용자가 다시 시도할 수 없고(버튼이 이미 눌린 상태) 체류시간 직접
      // 수정도 막힌다(§ options.autoStayTime이 입력창을 숨기는 조건이기 때문).
      setAiStayError(true);
    }
    setAiStayLoading(false);
  }

  function setOriginType(type: OriginType) {
    if (type === 'current') {
      patchOrigin({ type, label: t('route.options.originCurrent') });
      setOriginMenuOpen(false);
    } else if (type === 'map-click') {
      patchOrigin({
        type,
        label: t('route.options.originMapPick'),
        lat: undefined,
        lng: undefined,
      });
      onPickOriginFromMap();
      setOriginMenuOpen(false);
    } else {
      patchOrigin({
        type,
        label: options.origin.address || '',
        address: options.origin.address || '',
      });
    }
  }

  const originLabel = originDisplayLabel(
    options.origin,
    pickingOriginFromMap,
    pinned,
    t
  );

  if (!open && !embedded) return null;

  return (
    <aside
      className={`route-panel route-panel-v2 ${open || embedded ? 'open' : ''} ${
        embedded ? 'route-panel-embedded' : ''
      }`}
      aria-label={t('route.options.panelAria')}
      lang={i18n.language}
    >
      {!embedded && (
        <header className="route-panel-header">
          <div>
            <div className="panel-title">
              <Icon name="route" />
              <span>{t('route.options.title')}</span>
            </div>
            <div className="panel-subtitle">
              {t('route.options.subtitle', {
                day: currentDay,
                count: pinned.length,
              })}
            </div>
          </div>
          <button
            className="icon-btn"
            onClick={onClose}
            aria-label={t('route.options.close')}
          >
            <Icon name="close" />
          </button>
        </header>
      )}

      <div className="route-panel-body">
        <section className="route-section">
          <div className="section-header">
            <span className="section-label route-v2-label">
              {t('route.options.sectionDepart')}
            </span>
            {currentDay > 1 && onCopyFromPreviousDay && (
              <button type="button" className="copy-day-btn" onClick={onCopyFromPreviousDay}>
                {t('route.options.copySameAsDay', { day: currentDay - 1 })}
              </button>
            )}
          </div>
          <div className="route-depart-row">
            <label className="route-depart-chip">
              <Icon name="clock" size={16} />
              <input
                type="time"
                lang={normalizeLocale(i18n.language)}
                value={options.departTime}
                onChange={(e) => patch('departTime', e.target.value)}
                aria-label={t('route.options.departTime')}
              />
            </label>
            <button
              type="button"
              className={`route-depart-chip origin ${originMenuOpen ? 'open' : ''} ${
                pickingOriginFromMap ? 'picking' : ''
              }`}
              onClick={() => setOriginMenuOpen((v) => !v)}
              aria-expanded={originMenuOpen}
              aria-haspopup="listbox"
              aria-label={t('route.options.originAria', { label: originLabel })}
              title={t('route.options.originAria', { label: originLabel })}
            >
              <span className="route-depart-origin-badge">
                {t('route.options.originBadge')}
              </span>
              <Icon name="mapPin" size={15} />
              <span className="route-depart-origin-text">{originLabel}</span>
            </button>
          </div>

          {originMenuOpen && (
            <div className="route-origin-menu" role="listbox">
              <button
                type="button"
                className={options.origin.type === 'current' ? 'active' : ''}
                onClick={() => setOriginType('current')}
              >
                <Icon name="location" size={14} /> {t('route.options.originCurrent')}
              </button>
              <button
                type="button"
                className={options.origin.type === 'map-click' ? 'active' : ''}
                onClick={() => setOriginType('map-click')}
              >
                <Icon name="pinSelect" size={14} /> {t('route.options.originMapPick')}
              </button>
              <div
                className={`route-origin-address ${
                  options.origin.type === 'address' ? 'active' : ''
                }`}
              >
                <Icon name="search" size={14} />
                <input
                  type="text"
                  placeholder={t('route.options.originAddressPlaceholder')}
                  value={
                    options.origin.type === 'address' ? options.origin.address ?? '' : ''
                  }
                  onChange={(e) =>
                    patchOrigin({
                      type: 'address',
                      address: e.target.value,
                      label: e.target.value,
                    })
                  }
                  onFocus={() => setOriginType('address')}
                />
              </div>
            </div>
          )}

          <label className="route-mini-toggle">
            <input
              type="checkbox"
              checked={options.reflectMealTime}
              onChange={(e) => patch('reflectMealTime', e.target.checked)}
            />
            <span>{t('route.options.reflectMeal')}</span>
          </label>
        </section>

        <section className="route-section">
          <div className="section-label route-v2-label">
            {t('route.options.sectionTransport')}
          </div>
          <div className="route-mode-row">
            {(Object.keys(travelModeMeta) as TravelMode[]).map((mode) => {
              const meta = travelModeMeta[mode];
              return (
                <button
                  key={mode}
                  type="button"
                  className={`route-mode-chip ${
                    options.travelMode === mode ? 'selected' : ''
                  }`}
                  onClick={() => patch('travelMode', mode)}
                >
                  <Icon name={meta.icon} size={18} />
                  <span>{meta.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="route-section">
          <div className="section-label route-v2-label">
            {t('route.options.sectionOptimize')}
          </div>
          <div className="route-optimize-row">
            {OPTIMIZE_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                className={`route-optimize-chip ${
                  options.optimizeBy === key ? 'selected' : ''
                }`}
                disabled={options.travelMode !== 'car'}
                onClick={() => patch('optimizeBy', key)}
              >
                {t(OPTIMIZE_I18N[key])}
              </button>
            ))}
          </div>
          {/* 길찾기 API가 우선순위·유료도로 회피를 자동차에서만 받는다 */}
          {options.travelMode !== 'car' && (
            <p className="route-optimize-hint">{t('route.options.optimizeCarOnly')}</p>
          )}

          {/* 세 경로를 미리 받아 지도에 겹쳐 보여주고, 여기서 수치로 비교한다 */}
          {options.travelMode === 'car' && comparing && comparisons.length === 0 && (
            <p className="route-optimize-hint">{t('route.options.compareLoading')}</p>
          )}
          {comparisons.length > 0 && (
            <ul className="route-compare-list">
              {comparisons.map((c) => (
                <li
                  key={c.optimizeBy}
                  className={`route-compare-row ${
                    options.optimizeBy === c.optimizeBy ? 'selected' : ''
                  }`}
                >
                  <button type="button" onClick={() => patch('optimizeBy', c.optimizeBy)}>
                    <span
                      className="route-compare-dot"
                      style={{ background: COMPARE_COLORS[c.optimizeBy] }}
                      aria-hidden
                    />
                    <span className="route-compare-name">{t(OPTIMIZE_I18N[c.optimizeBy])}</span>
                    <span className="route-compare-stats">
                      {t('route.options.compareStats', {
                        km: c.distanceKm,
                        minutes: c.durationMinutes,
                      })}
                      {/* 무료도로는 정의상 0원이라 통행료를 따로 적지 않는다 */}
                      {c.optimizeBy !== 'no-toll' && c.tollFare !== null && (
                        <>
                          {' · '}
                          {t('route.options.compareToll', {
                            fare: c.tollFare.toLocaleString('ko-KR'),
                          })}
                        </>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="route-order-row">
            <button
              type="button"
              className={`route-order-chip ${options.autoOrder ? 'selected' : ''}`}
              onClick={() => patch('autoOrder', true)}
            >
              <Icon name="wand" size={12} /> {t('route.options.orderAuto')}
            </button>
            <button
              type="button"
              className={`route-order-chip ${!options.autoOrder ? 'selected' : ''}`}
              onClick={() => patch('autoOrder', false)}
            >
              <Icon name="grip" size={12} /> {t('route.options.orderPins')}
            </button>
          </div>
        </section>

        <section className="route-section">
          <div className="section-header">
            <span className="section-label route-v2-label">
              {t('route.options.sectionStay')}
            </span>
            {hoursProblemCount > 0 && (
              <button
                type="button"
                className={`route-hours-filter ${hoursOnly ? 'active' : ''}`}
                onClick={() => setHoursOnly((v) => !v)}
                aria-pressed={hoursOnly}
              >
                <Icon name="clock" size={12} />{' '}
                {t('route.options.hoursFilter', { n: hoursProblemCount })}
              </button>
            )}
            <button
              type="button"
              className={`route-ai-suggest ${options.autoStayTime ? 'active' : ''}`}
              onClick={() => void handleToggleAutoStay()}
              disabled={aiStayLoading}
              aria-pressed={options.autoStayTime}
            >
              <Icon name="sparkles" size={12} spin={aiStayLoading} />{' '}
              {aiStayLoading ? t('route.options.aiSuggesting') : t('route.options.aiSuggest')}
            </button>
          </div>
          {aiStayError && (
            <p className="route-ai-suggest-error">{t('route.options.aiSuggestError')}</p>
          )}
          <div className="route-stay-list">
            <SortableContainer
              ids={stayRows.map((p) => p.id)}
              onReorder={canReorderStops ? handleReorderStops : undefined}
            >
            {stayRows.map((p, idx) => {
              const meta = getCategoryMeta(p.categoryCode);
              const sug = suggestStayMinutes(p.category);
              const minutes = p.stayMinutes ?? sug.minutes;
              const reason = aiStayReasons[p.id] ?? stayReasonLabel(p.category, t);
              const card = (
                key: string,
                handle?: { listeners: Record<string, unknown>; ref: (el: HTMLElement | null) => void }
              ) => (
                <div key={key} className="route-stay-card">
                  {handle ? (
                    <button
                      type="button"
                      className="route-stay-num route-stay-drag"
                      style={{ background: meta.bgColor, color: '#fff' }}
                      ref={handle.ref}
                      {...handle.listeners}
                      aria-label={t('route.dragReorder')}
                    >
                      {idx + 1}
                    </button>
                  ) : (
                    <span
                      className="route-stay-num"
                      style={{ background: meta.bgColor, color: '#fff' }}
                    >
                      {idx + 1}
                    </span>
                  )}
                  <div className="route-stay-body">
                    <div className="route-stay-name">{p.name}</div>
                    <div className="route-stay-hint">
                      {options.autoStayTime ? reason : p.categoryLabel}
                    </div>
                    {isHoursProblem(p.hoursStatus) && (
                      <div className="route-stay-hours-warning">
                        <Icon name="clock" size={11} />{' '}
                        {t(`route.hours.${p.hoursStatus}`, {
                          opens: p.hoursOpensAt ?? '',
                          closes: p.hoursClosesAt ?? '',
                        })}
                      </div>
                    )}
                    {onUpdateNote ? (
                      <input
                        type="text"
                        className="route-stay-note"
                        value={p.note ?? ''}
                        placeholder={t('booking.notePlaceholder')}
                        onChange={(e) => onUpdateNote(p.id, e.target.value)}
                        aria-label={t('booking.noteAria', { name: p.name })}
                      />
                    ) : (
                      p.note && <div className="route-stay-note-text">{p.note}</div>
                    )}
                    <BookingLinkCards note={p.note} placeId={p.id} />
                    <BookingSearchSuggestions
                      category={p.category}
                      placeName={p.name}
                      placeId={p.id}
                      note={p.note}
                    />
                  </div>
                  {options.autoStayTime || !onUpdateStayMinutes ? (
                    <span className="route-stay-badge">{minutes} min</span>
                  ) : (
                    <label className="route-stay-edit">
                      <input
                        type="number"
                        min={0}
                        max={480}
                        step={5}
                        value={minutes}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          if (!Number.isFinite(n) || !onUpdateStayMinutes) return;
                          onUpdateStayMinutes(p.id, n);
                        }}
                        aria-label={t('route.options.stayMinutesAria', { name: p.name })}
                      />
                      <span>min</span>
                    </label>
                  )}
                  {onUpdateFixedArrival && (
                    <label className="route-fixed-arrival">
                      <Icon name="clock" size={12} />
                      <input
                        type="time"
                        value={p.fixedArrival ?? ''}
                        onChange={(e) =>
                          onUpdateFixedArrival(p.id, e.target.value || null)
                        }
                        aria-label={t('route.options.fixedArrivalAria', { name: p.name })}
                        title={t('route.options.fixedArrivalHint')}
                      />
                      {p.fixedArrival && (
                        <button
                          type="button"
                          className="route-fixed-arrival-clear"
                          onClick={() => {
                            onUpdateFixedArrival(p.id, null);
                            onUpdateItemKind?.(p.id, 'place');
                          }}
                          aria-label={t('route.options.fixedArrivalClear')}
                        >
                          <Icon name="close" size={11} />
                        </button>
                      )}
                    </label>
                  )}
                  {onUpdateItemKind && p.fixedArrival && (
                    <button
                      type="button"
                      className={`route-reserved-toggle ${p.itemKind === 'reserved' ? 'active' : ''}`}
                      onClick={() =>
                        onUpdateItemKind(
                          p.id,
                          p.itemKind === 'reserved' ? 'place' : 'reserved',
                        )
                      }
                      aria-pressed={p.itemKind === 'reserved'}
                      title={t('route.options.reservedHint')}
                    >
                      <Icon name="facilityReservation" size={12} />{' '}
                      {t('route.options.reserved')}
                    </button>
                  )}
                </div>
              );
              return canReorderStops ? (
                <SortableItem key={p.id} id={p.id}>
                  {({ listeners, setActivatorNodeRef }) =>
                    card(p.id, { listeners, ref: setActivatorNodeRef })
                  }
                </SortableItem>
              ) : (
                card(p.id)
              );
            })}
            </SortableContainer>
          </div>
        </section>
      </div>

      <footer className="route-panel-footer">
        {preview && (
          <div className="preview-stats route-preview-line">
            <span className="stat-label">{t('route.options.preview')}</span>
            <span className="stat-value">
              {t('route.options.previewStats', {
                km: preview.totalDistanceKm,
                minutes: preview.totalTravelMinutes,
                stayMinutes: preview.totalStayMinutes,
                time: preview.finishAt,
              })}
              {/* 무료도로는 0원이 당연하므로 나머지 두 기준에서만 통행료를 적는다 */}
              {options.optimizeBy !== 'no-toll' && selectedComparison?.tollFare != null && (
                <>
                  {' · '}
                  {t('route.options.compareToll', {
                    fare: selectedComparison.tollFare.toLocaleString('ko-KR'),
                  })}
                </>
              )}
            </span>
          </div>
        )}
        <button
          className="generate-btn"
          onClick={onGenerate}
          disabled={pinned.length < 2}
        >
          <Icon name="sparkles" />
          {hasExistingRoute ? t('route.options.rebuild') : t('route.options.build')}
        </button>
      </footer>
    </aside>
  );
}

function stayReasonLabel(
  category: SimpleCategory,
  t: (key: string) => string
): string {
  return t(`route.options.stayReason.${category}`);
}

function originDisplayLabel(
  origin: Origin,
  picking: boolean,
  pinned: PinnedPlace[],
  t: (key: string, opts?: Record<string, unknown>) => string
): string {
  if (picking) return t('route.options.originClickMap');
  if (origin.type === 'current') return t('route.options.originCurrent');
  if (origin.type === 'map-click') {
    if (origin.address || origin.label) {
      const raw = (origin.address || origin.label || '').trim();
      // 언어 전환 후에도 타입 기준 기본 문구는 재번역
      if (
        raw === '지도에서 선택' ||
        raw === 'Pick on map' ||
        raw === '地図で選択' ||
        raw === '在地图上选择'
      ) {
        return t('route.options.originMapPick');
      }
      return raw;
    }
    return t('route.options.originMapPick');
  }
  if (origin.type === 'address') {
    return origin.address?.trim() || t('route.options.originEnterAddress');
  }
  if (pinned[0]) return t('route.options.originStop1', { name: pinned[0].name });
  return t('route.options.originSelect');
}
