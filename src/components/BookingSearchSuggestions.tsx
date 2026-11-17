import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';
import { trackEvent } from '../lib/analytics';
import { extractBookingLinks } from '../lib/bookingLinks';
import { getBookingSearchLinks } from '../lib/bookingSearchLinks';
import type { SimpleCategory } from '../types';

type Props = {
  category: SimpleCategory | undefined;
  placeName: string;
  placeId: string;
  note: string | undefined | null;
  className?: string;
};

/**
 * 아직 예약 전인 장소에 "예약" 버튼 하나만 보여주고, 클릭하면 제공처 목록이 펼쳐진다.
 * 제공처별 버튼을 카드에 늘어놓으면 좁은 폭에서 텍스트가 줄바꿈되어 지저분해지므로
 * 트리거 하나 + 드롭다운으로 묶는다.
 * 이미 예약 링크를 붙여 넣은 곳(BookingLinkCards가 뜨는 곳)은 중복 노출하지 않는다.
 */
export function BookingSearchSuggestions({ category, placeName, placeId, note, className = '' }: Props) {
  const { t, i18n } = useTranslation('planner');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (extractBookingLinks(note).length > 0) return null;

  const links = getBookingSearchLinks(category, placeName, i18n.language);
  if (links.length === 0) return null;

  return (
    <div className={`booking-search ${className}`.trim()} ref={rootRef}>
      <button
        type="button"
        className={`booking-search-trigger ${open ? 'active' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-expanded={open}
      >
        <Icon name="search" size={11} />
        {t('booking.reserve')}
      </button>
      {open && (
        <div className="booking-search-menu" role="menu">
          {links.map((link) => (
            <a
              key={link.id}
              role="menuitem"
              className="booking-search-menu-item"
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              title={t('booking.findAria', { brand: link.brand, name: placeName })}
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                trackEvent('booking_search_click', { placeId, provider: link.id, category: category ?? '' });
              }}
            >
              {t('booking.findOn', { brand: link.brand })}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
