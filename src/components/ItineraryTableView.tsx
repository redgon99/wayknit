import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';
import { PlaceThumb } from './PlaceThumb';
import type { Place } from '../types';
import type { Trip } from '../lib/trips';
import {
  buildItineraryTableRows,
  countPinsByDay,
  filterItineraryTableRows,
  type ItineraryTableDayFilter,
  type ItineraryTableRow,
} from '../lib/itineraryTable';

interface Props {
  open: boolean;
  trip: Trip;
  selectedPlaceId?: string | null;
  onSelectPlaceId?: (placeId: string) => void;
  onOpenPlacePhotos?: (place: Place) => void;
  onClose: () => void;
  /** 있으면 헤더에 공유 아이콘을 보여준다 — 공유 링크로 열었을 때(읽기 전용)는 안 넘긴다. */
  onShare?: () => void;
  /**
   * U05(모바일 UX 리포트 2026-09-13) — "동선짜기" 탭이 항상 옵션 설정
   * 화면을 먼저 보여줘 이미 만든 일정의 시간표를 보려면 메뉴 → 표로보기를
   * 따로 알아야 했다. 이 모달을 그 탭에서 직접 열 때는 지금 보던 일차로
   * 필터를 미리 맞춰서 연다 — "표로보기(메뉴)"는 항상 전체(null)로 열리는
   * 기존 동작을 그대로 유지한다.
   */
  initialDayFilter?: number | null;
  /** 있으면 헤더에 "일정 수정" 아이콘을 보여준다 — 동선짜기 탭에서 열렸을 때만 켠다. */
  onEditRoute?: () => void;
}

export function ItineraryTableView({
  open,
  trip,
  selectedPlaceId = null,
  onSelectPlaceId,
  onOpenPlacePhotos,
  onClose,
  onShare,
  initialDayFilter,
  onEditRoute,
}: Props) {
  const { t } = useTranslation('planner');
  const [dayFilter, setDayFilter] = useState<ItineraryTableDayFilter>(null);

  const allRows = useMemo(() => buildItineraryTableRows(trip), [trip]);
  const countsByDay = useMemo(() => countPinsByDay(trip), [trip]);
  const rows = useMemo(
    () => filterItineraryTableRows(allRows, dayFilter),
    [allRows, dayFilter]
  );
  /**
   * F16(모바일 감사) — 4열 표가 매 행마다 "1일차"를 반복해 좁은 화면에서
   * 정작 중요한 장소·시간 칸을 밀어냈다. 일차를 열이 아니라 그룹 제목으로
   * 뺀다 — day는 이미 오름차순으로 쌓여 있어(buildItineraryTableRows) 재정렬 없이
   * 순서대로 묶기만 하면 된다.
   */
  const dayGroups = useMemo(() => {
    const groups: { day: number; dayLabel: string; rows: ItineraryTableRow[] }[] = [];
    for (const row of rows) {
      const last = groups[groups.length - 1];
      if (last && last.day === row.day) last.rows.push(row);
      else groups.push({ day: row.day, dayLabel: row.dayLabel, rows: [row] });
    }
    return groups;
  }, [rows]);
  const days = useMemo(
    () => Array.from({ length: trip.totalDays }, (_, i) => i + 1),
    [trip.totalDays]
  );
  const placeById = useMemo(() => {
    const map = new Map<string, Place>();
    for (const dayPins of Object.values(trip.pinnedByDay)) {
      for (const pin of dayPins) map.set(pin.id, pin);
    }
    return map;
  }, [trip.pinnedByDay]);

  useEffect(() => {
    if (open) setDayFilter(initialDayFilter ?? null);
  }, [open, trip.id, initialDayFilter]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const subtitle =
    dayFilter == null
      ? allRows.length > 0
        ? `${trip.title} · ${t('table.summary', {
            days: trip.totalDays,
            count: allRows.length,
          })}`
        : trip.title
      : `${trip.title} · ${t('table.dayLabel', { day: dayFilter })} · ${t('table.countPlaces', {
          count: rows.length,
        })}`;

  return (
    <div className="itinerary-table-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="itinerary-table-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="itinerary-table-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="itinerary-table-modal-header">
          <div className="itinerary-table-modal-heading">
            <h2 id="itinerary-table-title">{t('view.table')}</h2>
            <p className="itinerary-table-modal-sub">{subtitle}</p>
          </div>
          <div className="itinerary-table-modal-header-actions">
            {onEditRoute && (
              <button
                type="button"
                className="itinerary-table-modal-edit"
                onClick={onEditRoute}
                aria-label={t('route.openOptions')}
                title={t('route.openOptions')}
              >
                <Icon name="pencil" size={17} />
              </button>
            )}
            {onShare && (
              <button
                type="button"
                className="itinerary-table-modal-share"
                onClick={onShare}
                aria-label={t('table.shareAria')}
                title={t('table.shareAria')}
              >
                <Icon name="share" size={17} />
              </button>
            )}
            <button
              type="button"
              className="itinerary-table-modal-close"
              onClick={onClose}
              aria-label={t('view.tableExit')}
              title={t('view.tableExit')}
            >
              <Icon name="close" size={18} />
            </button>
          </div>
        </header>

        <div
          className="itinerary-table-day-filters"
          role="tablist"
          aria-label={t('table.filterAria', { defaultValue: '일차 필터' })}
        >
          <button
            type="button"
            role="tab"
            aria-selected={dayFilter == null}
            className={`itinerary-table-day-chip ${dayFilter == null ? 'active' : ''}`}
            onClick={() => setDayFilter(null)}
          >
            {t('table.filterAll', { defaultValue: '전체' })}
            {allRows.length > 0 ? ` · ${allRows.length}` : ''}
          </button>
          {days.map((d) => {
            const count = countsByDay[d] ?? 0;
            return (
              <button
                key={d}
                type="button"
                role="tab"
                aria-selected={dayFilter === d}
                className={`itinerary-table-day-chip ${dayFilter === d ? 'active' : ''}`}
                onClick={() => setDayFilter(d)}
              >
                {t('table.dayLabel', { day: d })}
                {count > 0 ? ` · ${count}` : ''}
              </button>
            );
          })}
        </div>

        <div className="itinerary-table-modal-body">
          {rows.length === 0 ? (
            <p className="table-view-empty">{t('table.empty')}</p>
          ) : (
            <table className="itinerary-table">
              <thead>
                <tr>
                  <th scope="col">{t('table.col.time')}</th>
                  <th scope="col">{t('table.col.place')}</th>
                  <th scope="col">{t('table.col.district')}</th>
                </tr>
              </thead>
              {dayGroups.map((group) => (
                <tbody key={group.day}>
                  <tr className="itinerary-table-day-group">
                    <th scope="rowgroup" colSpan={3}>
                      {group.dayLabel}
                    </th>
                  </tr>
                  {group.rows.map((row) => {
                    const selected = selectedPlaceId === row.placeId;
                    const place = placeById.get(row.placeId);
                    return (
                      <tr
                        key={row.key}
                        className={[
                          row.required ? 'is-required' : '',
                          selected ? 'is-selected' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        onClick={() => onSelectPlaceId?.(row.placeId)}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onSelectPlaceId?.(row.placeId);
                          }
                        }}
                      >
                        <td>
                          {row.time}
                          {/*
                            U10(모바일 UX 리포트 2026-09-13) — "—"가 단순
                            데이터 누락(오류처럼 보임)인지 "이 장소가 아직
                            생성된 동선에 없음"인지 구분이 안 됐다. scheduled로
                            판별해 후자일 때만 이름표를 붙인다.
                          */}
                          {!row.scheduled && (
                            <span className="itinerary-table-unscheduled-badge">
                              {t('table.unscheduled')}
                            </span>
                          )}
                        </td>
                        <td>
                          <div className="itinerary-table-place">
                            {place && onOpenPlacePhotos && (
                              <PlaceThumb
                                place={place}
                                variant="emoji"
                                onOpenPhotos={onOpenPlacePhotos}
                              />
                            )}
                            <span className="itinerary-table-place-name">
                              {row.placeName}
                            </span>
                            {/*
                              필수 방문은 지금까지 행 전체를 빨간 글씨로
                              칠하는 것으로만 표시했다 — 색만 보면 오류·휴무처럼
                              읽힐 수 있어(U10) 글자 배지를 더한다. 빨간 글씨
                              스타일(.is-required)은 그대로 둬 색으로도 빠르게
                              훑을 수 있게 하되, 배지가 실제 의미를 전달한다.
                            */}
                            {row.required && (
                              <span className="itinerary-table-required-badge">
                                {t('table.required')}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>{row.district || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              ))}
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
