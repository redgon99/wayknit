import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface Props {
  onShare: () => void;
  plazaNavVisible?: boolean;
  /** 표로 보기 — 데스크톱에선 앱바 보기 전환 세그먼트에 있는 기능 */
  onOpenTableView?: () => void;
  /**
   * 함께 편집 — 데스크톱에선 앱바 아이콘으로 여는 입구다. 모바일에는 입구가
   * 아예 없어서, 협업자는 누구와 편집 중인지도 활동 기록도 볼 수 없었다.
   */
  onOpenCollaborators?: () => void;
  /** 협업자에게는 "관리"가 아니라 함께 편집 중인 사람을 보는 입구다(§14). */
  collabEntryLabel?: 'manage' | 'shared';
}

export function MobileMoreMenu({
  onShare,
  plazaNavVisible,
  onOpenTableView,
  onOpenCollaborators,
  collabEntryLabel = 'manage',
}: Props) {
  const { t } = useTranslation('planner');
  const { t: ts } = useTranslation('share');
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
          {onOpenCollaborators &&
            item(
              ts(collabEntryLabel === 'shared' ? 'collab.entryShared' : 'collab.entry'),
              onOpenCollaborators
            )}
          {onOpenTableView && item(t('view.table'), onOpenTableView)}
          {plazaNavVisible && item(t('plazaNav'), () => navigate('/plaza'))}
          {item(t('nav.setup'), () => navigate('/setup'))}
          {item(t('nav.help'), () => navigate('/help'))}
        </div>
      )}
    </div>
  );
}
