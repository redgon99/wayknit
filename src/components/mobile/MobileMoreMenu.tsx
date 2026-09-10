import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Icon } from '../Icon';
import type { PlanId } from '../../lib/subscription';

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
  /** 관심 테마 편집 — §26-7. 데스크톱 더보기 메뉴와 같은 항목이다. */
  onOpenPreferences?: () => void;
  /** 요금제 배지 — 데스크톱에선 계정 탭이 따로 있었지만, 하단내비가 4칸으로
   *  줄면서(지도·자료·시나리오·메뉴) 계정도 이 메뉴 안으로 들어온다. */
  plan: PlanId;
  /**
   * "계정" 항목이 여는 것. 예전엔 이 자리가 그대로 UpgradeModal을 열어서
   * 로그인 여부와 무관하게 늘 요금제 안내만 떴다(2026-09-10 사용자 지적) —
   * 실제 계정 정보·로그아웃·로그인 진입로가 모바일 어디에도 없었다.
   * 이제 `MobileAccountSheet`를 여는 콜백이고, 업그레이드는 그 시트 안의
   * 버튼 하나가 됐다.
   */
  onOpenAccount: () => void;
}

export function MobileMoreMenu({
  onShare,
  plazaNavVisible,
  onOpenTableView,
  onOpenCollaborators,
  collabEntryLabel = 'manage',
  onOpenPreferences,
  plan,
  onOpenAccount,
}: Props) {
  const { t } = useTranslation('planner');
  const { t: ts } = useTranslation('share');
  const { t: tb } = useTranslation('billing');
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

  const item = (label: string, action: () => void, content?: ReactNode) => (
    <button
      type="button"
      role="menuitem"
      className="planner-more-item"
      onClick={() => {
        setOpen(false);
        action();
      }}
    >
      {content ?? label}
    </button>
  );

  return (
    <div className="planner-bar-more mobile-more-menu" ref={rootRef}>
      <button
        type="button"
        className={`mobile-tabbar-btn ${open ? 'active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t('chrome.tabMenu')}
      >
        <Icon name="menu" size={20} />
        {t('chrome.tabMenu')}
      </button>
      {open && (
        <div className="planner-more-menu" role="menu">
          {item(t('trip.share'), onShare)}
          {onOpenCollaborators &&
            item(
              ts(collabEntryLabel === 'shared' ? 'collab.entryShared' : 'collab.entry'),
              onOpenCollaborators
            )}
          {onOpenPreferences && item(t('themes.label'), onOpenPreferences)}
          {onOpenTableView && item(t('view.table'), onOpenTableView)}
          {plazaNavVisible && item(t('plazaNav'), () => navigate('/plaza'))}
          {item(t('nav.setup'), () => navigate('/setup'))}
          {item(t('nav.help'), () => navigate('/help'))}
          <div className="planner-more-sep" aria-hidden />
          {item(
            t('chrome.tabAccount'),
            onOpenAccount,
            <span className="planner-more-item-account">
              {t('chrome.tabAccount')}
              <span className={`mobile-tabbar-plan-badge plan-${plan}`}>{tb(`plan.${plan}`)}</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
