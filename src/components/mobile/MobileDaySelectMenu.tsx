import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../Icon';

interface Props {
  totalDays: number;
  currentDay: number;
  countsByDay: Record<number, number>;
  onSelectDay: (day: number) => void;
  onAddDay: () => void;
}

/**
 * 모바일 상단 한 줄에서 일차를 고르는 단일 버튼 + 드롭다운.
 *
 * 예전엔 일차 수만큼 필(pill)이 가로로 늘어서 있었다(§25/§27) — 2일 이상이면
 * 그것만으로 한 줄의 절반 이상을 먹었다. 사용자 요청으로 현재 일차를 보여주는
 * 버튼 하나로 접고, 나머지는 드롭다운(상단 "+ 일차 추가", 하단에 일차 목록
 * 순서대로)으로 옮겼다. 데스크톱 `PlannerDayPills`의 오버플로 메뉴
 * (`.planner-day-overflow-menu`/`-item`)와 같은 클래스를 그대로 쓴다 — 여기서도
 * "넘치는 일차를 드롭다운으로"라는 같은 문제라 스타일을 새로 만들 필요가 없었다.
 */
export function MobileDaySelectMenu({
  totalDays,
  currentDay,
  countsByDay,
  onSelectDay,
  onAddDay,
}: Props) {
  const { t } = useTranslation('planner');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

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

  const dayLabel = (d: number) => {
    const count = countsByDay[d] ?? 0;
    const base = t('day.tab', { n: d });
    return count > 0 ? `${base} · ${count}` : base;
  };

  return (
    <div className={`mobile-day-select ${open ? 'open' : ''}`} ref={rootRef}>
      <button
        type="button"
        className="mobile-planner-day active mobile-day-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {dayLabel(currentDay)}
        <Icon name="chevronDown" size={13} />
      </button>

      {open && (
        <div
          className="planner-day-overflow-menu mobile-day-overflow-menu"
          role="listbox"
          aria-label={t('day.tabsAria', { defaultValue: '일차' })}
        >
          <button
            type="button"
            className="trip-hub-action"
            onClick={() => {
              setOpen(false);
              onAddDay();
            }}
          >
            <Icon name="plus" size={15} />
            {t('trip.addDay')}
          </button>
          <div className="trip-hub-sep" aria-hidden />
          {Array.from({ length: totalDays }, (_, i) => i + 1).map((d) => {
            const active = d === currentDay;
            return (
              <button
                key={d}
                type="button"
                role="option"
                aria-selected={active}
                className={`planner-day-overflow-item ${active ? 'active' : ''}`}
                onClick={() => {
                  onSelectDay(d);
                  setOpen(false);
                }}
              >
                {dayLabel(d)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
