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
}

export function ItineraryTableView({
  open,
  trip,
  selectedPlaceId = null,
  onSelectPlaceId,
  onOpenPlacePhotos,
  onClose,
  onShare,
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
    if (open) setDayFilter(null);
  }, [open, trip.id]);

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
                        <td>{row.time}</td>
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
