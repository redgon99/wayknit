import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';
import type { TripSummary } from '../lib/trips';

interface Props {
  summaries: TripSummary[];
  currentTripId: string;
  onSelect: (tripId: string) => void;
  compact?: boolean;
  /** 여행 허브: 새 여행·삭제 등을 같은 메뉴에 묶음 */
  onNewTrip?: () => void;
  onDeleteTrip?: () => void;
}

export function TripSelectMenu({
  summaries,
  currentTripId,
  onSelect,
  compact = false,
  onNewTrip,
  onDeleteTrip,
}: Props) {
  const { t } = useTranslation('planner');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const isHub = Boolean(onNewTrip || onDeleteTrip);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!isHub && summaries.length === 0) return null;

  const current = summaries.find((s) => s.id === currentTripId);

  function handleSelect(id: string) {
    if (id !== currentTripId) onSelect(id);
    setOpen(false);
  }

  function runAction(action?: () => void) {
    setOpen(false);
    action?.();
  }

  const currentLabel = current
    ? t('trip.selectTripCurrent', { title: current.title, days: current.totalDays })
    : t('trip.selectTripMenu');

  return (
    <div
      className={`trip-select-menu ${open ? 'open' : ''} ${isHub ? 'trip-hub-menu' : ''}`}
      ref={rootRef}
    >
      <button
        type="button"
        className="trip-select-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup={isHub ? 'menu' : 'listbox'}
        aria-label={
          isHub
            ? t('trip.hubAria', { defaultValue: '여행 설정' })
            : current
              ? t('trip.selectTrip', { title: current.title, days: current.totalDays })
              : t('trip.selectTripMenu')
        }
        title={isHub ? t('trip.hubAria', { defaultValue: '여행 설정' }) : currentLabel}
      >
        <Icon name="chevronDown" size={compact ? 16 : 18} />
      </button>

      {open && (
        <div
          className="trip-select-dropdown trip-hub-dropdown"
          role={isHub ? 'menu' : 'listbox'}
          aria-label={
            isHub
              ? t('trip.hubAria', { defaultValue: '여행 설정' })
              : t('trip.savedTripsList')
          }
        >
          {onNewTrip && (
            <button
              type="button"
              role="menuitem"
              className="trip-hub-action"
              onClick={() => runAction(onNewTrip)}
            >
              <Icon name="plus" size={15} />
              {t('trip.newTrip')}
            </button>
          )}

          {summaries.length > 0 && (
            <>
              {isHub && (
                <div className="trip-hub-section-label">
                  {t('trip.hubMyTrips', { defaultValue: '내 여행' })}
                </div>
              )}
              <ul className="trip-hub-list" role={isHub ? 'none' : undefined}>
                {summaries.map((s) => {
                  const selected = s.id === currentTripId;
                  return (
                    <li key={s.id} role="none">
                      <button
                        type="button"
                        role={isHub ? 'menuitem' : 'option'}
                        aria-selected={isHub ? undefined : selected}
                        className={`trip-select-option ${selected ? 'selected' : ''}`}
                        onClick={() => handleSelect(s.id)}
                      >
                        <span className="trip-select-option-label">
                          {s.title}
                          <span className="trip-select-option-days">
                            ({t('trip.daysCount', { count: s.totalDays })})
                          </span>
                        </span>
                        {selected && (
                          <span className="trip-select-option-check" aria-hidden="true">
                            <Icon name="check" size={16} />
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {onDeleteTrip && summaries.length > 0 && (
            <>
              <div className="trip-hub-sep" aria-hidden />
              {isHub && (
                <div className="trip-hub-section-label">
                  {t('trip.hubThisTrip', { defaultValue: '이 여행' })}
                </div>
              )}
              <button
                type="button"
                role="menuitem"
                className="trip-hub-action danger"
                onClick={() => runAction(onDeleteTrip)}
              >
                {t('trip.deleteTripMenu', { defaultValue: '여행 삭제' })}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
