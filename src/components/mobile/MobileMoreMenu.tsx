import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface Props {
  onShare: () => void;
  plazaNavVisible?: boolean;
  /** 표로 보기 — 데스크톱에선 앱바 보기 전환 세그먼트에 있는 기능 */
  onOpenTableView?: () => void;
}

export function MobileMoreMenu({ onShare, plazaNavVisible, onOpenTableView }: Props) {
  const { t } = useTranslation('planner');
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
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

  const item = (label: string, action: () => void) => (
    <button
      type="button"
      role="menuitem"
      className="planner-more-item"
      onClick={() => {
        setOpen(false);
        action();
      }}
    >
      {label}
    </button>
  );

  return (
    <div className="planner-bar-more mobile-more-menu" ref={rootRef}>
      <button
        type="button"
        className={`mobile-planner-menu-btn ${open ? 'active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t('nav.more', { defaultValue: '더보기' })}
        title={t('nav.more', { defaultValue: '더보기' })}
      >
        <span className="planner-bar-more-dots" aria-hidden>
          ⋯
        </span>
      </button>
      {open && (
        <div className="planner-more-menu" role="menu">
          {item(t('trip.share'), onShare)}
          {onOpenTableView && item(t('view.table'), onOpenTableView)}
          {plazaNavVisible && item(t('plazaNav'), () => navigate('/plaza'))}
          {item(t('nav.setup'), () => navigate('/setup'))}
          {item(t('nav.help'), () => navigate('/help'))}
        </div>
      )}
    </div>
  );
}
