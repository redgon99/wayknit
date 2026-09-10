import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Icon } from '../Icon';
import { AppSheetModal } from '../AppSheetModal';
import { useAuth } from '../../contexts/AuthContext';
import { pathWithLocale, normalizeLocale } from '../../lib/locale';
import i18n from '../../lib/i18n';

interface Props {
  open: boolean;
  onClose: () => void;
  onOpenUpgrade: () => void;
}

/**
 * 모바일 "계정" 메뉴의 실제 내용.
 *
 * 예전엔 "계정" 항목을 누르면 곧장 UpgradeModal(요금제 가입 안내)이 열렸다 —
 * 로그인 여부와 무관하게 항상 같은 동작이었다. 그 결과 모바일 플래너에는
 * 로그인 화면으로 가는 길도, 랜딩으로 나가는 길도 없었다(데스크톱은
 * `PlannerAppBar`의 `AuthBar`가 이 역할을 했는데 `!useMobileChrome`로 모바일에서
 * 통째로 안 뜬다). `AuthBar`와 같은 3분기(미설정/로그인/게스트)를 따르되,
 * 데스크톱 앱바가 아니라 시트로 보여준다.
 */
export function MobileAccountSheet({ open, onClose, onOpenUpgrade }: Props) {
  const { t } = useTranslation('planner');
  const { t: tc } = useTranslation('common');
  const { t: tb } = useTranslation('billing');
  const navigate = useNavigate();
  const { user, configured, plan, isAdmin, signOut } = useAuth();
  const locale = normalizeLocale(i18n.language);

  const go = (path: string) => {
    onClose();
    navigate(pathWithLocale(path, locale));
  };

  return (
    <AppSheetModal open={open} title={t('chrome.tabAccount')} onClose={onClose}>
      {!configured ? (
        <div className="mobile-account-row">
          <Icon name="save" size={18} />
          <span>{tc('auth.localMode')}</span>
        </div>
      ) : user ? (
        <>
          <div className="mobile-account-identity">
            <div className="mobile-account-avatar" aria-hidden>
              {(user.email ?? '?').slice(0, 1).toUpperCase()}
            </div>
            <div className="mobile-account-identity-text">
              <span className="mobile-account-email">{user.email}</span>
              <span className={`mobile-tabbar-plan-badge plan-${plan}`}>
                {tb(`plan.${plan}`)}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="trip-hub-action"
            onClick={() => {
              onClose();
              onOpenUpgrade();
            }}
          >
            <Icon name="sparkles" size={15} />
            {t('account.viewPlans')}
          </button>

          {isAdmin && (
            <button type="button" className="trip-hub-action" onClick={() => go('/admin')}>
              {tc('auth.admin')}
            </button>
          )}

          <div className="trip-hub-sep" aria-hidden />

          <button type="button" className="trip-hub-action" onClick={() => go('/')}>
            {t('account.backToHome')}
          </button>
          <button
            type="button"
            className="trip-hub-action danger"
            onClick={() => {
              onClose();
              void signOut();
            }}
          >
            {tc('auth.logout')}
          </button>
        </>
      ) : (
        <>
          <p className="mobile-account-guest-lead">{t('account.guestLead')}</p>
          <button type="button" className="trip-hub-action" onClick={() => go('/login')}>
            <Icon name="cloud" size={15} />
            {tc('auth.cloudLogin')}
          </button>
          <div className="trip-hub-sep" aria-hidden />
          <button type="button" className="trip-hub-action" onClick={() => go('/')}>
            {t('account.backToHome')}
          </button>
        </>
      )}
    </AppSheetModal>
  );
}
