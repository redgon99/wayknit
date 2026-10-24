import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';
import { AuthBar } from './AuthBar';
import { LocaleSwitcher } from './LocaleSwitcher';
import { normalizeLocale, pathWithLocale } from '../lib/locale';
import { plannerPath } from '../lib/routes';
import i18n from '../lib/i18n';
import '../styles/landing.css';

export type SiteHeaderActive = 'home' | 'plaza' | 'guides' | 'info';

function SiteBrand({ className = '' }: { className?: string }) {
  const { t } = useTranslation('landing');
  const secondary = t('brand.secondary');
  return (
    <span className={`landing-brand-text ${className}`.trim()}>
      <span className="landing-brand-primary">{t('brand.primary')}</span>
      {secondary ? <span className="landing-brand-sub">{secondary}</span> : null}
    </span>
  );
}

interface SiteHeaderProps {
  /** 현재 페이지에 해당하는 내비게이션 항목 (하이라이트용) */
  active: SiteHeaderActive;
  /** 랜딩페이지의 CMS 프로모 메뉴 등, 이 페이지만의 추가 링크 */
  beforeLinks?: ReactNode;
  /** 상단 공지 배너 문구 (기본: 시범운영 안내). 빈 배열을 넘기면 배너를 숨긴다 */
  noticeTexts?: string[];
}

/**
 * 랜딩·한국여행정보·가이드 페이지가 공유하는 상단 바.
 * 페이지마다 따로 헤더를 그려서 언어 선택이 두 번 뜨거나(AuthBar 내부 + 페이지 자체)
 * 관리자 로그아웃 링크가 공개 페이지에 그대로 노출되던 문제를 여기서 한 번에 해소한다.
 */
export function SiteHeader({ active, beforeLinks, noticeTexts }: SiteHeaderProps) {
  const { t } = useTranslation('landing');
  const notices = noticeTexts ?? [t('notice.trial')];
  const locale = normalizeLocale(i18n.language);
  const homePath = pathWithLocale('/', locale);
  const plazaPath = pathWithLocale('/plaza', locale);
  const guidesPath = pathWithLocale('/guides', locale);
  const infoPath = pathWithLocale('/info', locale);
  const planPath = plannerPath(locale);
  const [menuOpen, setMenuOpen] = useState(false);

  const navLinks = (
    <>
      {beforeLinks}
      <a href={`${homePath}#features`} onClick={() => setMenuOpen(false)}>
        {t('nav.features')}
      </a>
      <Link
        to={plazaPath}
        className={active === 'plaza' ? 'nav-active' : ''}
        onClick={() => setMenuOpen(false)}
      >
        {t('nav.plaza')}
      </Link>
      <Link
        to={guidesPath}
        className={active === 'guides' ? 'nav-active' : ''}
        onClick={() => setMenuOpen(false)}
      >
        {t('nav.tips')}
      </Link>
      <Link
        to={infoPath}
        className={active === 'info' ? 'nav-active' : ''}
        onClick={() => setMenuOpen(false)}
      >
        {t('nav.info')}
      </Link>
    </>
  );

  return (
    <div className="landing-top">
      {notices.map((text, i) => (
        <p key={`${i}-${text}`} className="landing-notice" role="status">
          {text}
        </p>
      ))}
      <header className="landing-nav">
        <button
          type="button"
          className="landing-nav-hamburger"
          aria-label={t('nav.menu')}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <Icon name={menuOpen ? 'close' : 'menu'} size={18} />
        </button>
        <Link to={homePath} className="landing-brand">
          <span className="landing-brand-mark" aria-hidden>
            <Icon name="pin" size={20} />
          </span>
          <SiteBrand />
        </Link>
        <nav className="landing-nav-links" aria-label="Main">
          {navLinks}
        </nav>
        <div className="landing-nav-actions">
          <LocaleSwitcher compact />
          <AuthBar hideLocale />
          <Link to={planPath} className="landing-btn landing-btn-primary">
            {t('nav.start')}
          </Link>
        </div>
        <Link to={planPath} className="landing-btn landing-btn-primary landing-nav-cta-mobile">
          {t('nav.start')}
        </Link>

        {menuOpen && (
          <div className="landing-nav-drawer" role="dialog" aria-label={t('nav.menu')}>
            <nav className="landing-nav-drawer-links" aria-label="Main">
              {navLinks}
            </nav>
            <div className="landing-nav-drawer-actions">
              <LocaleSwitcher compact />
              <AuthBar hideLocale />
            </div>
          </div>
        )}
      </header>
    </div>
  );
}
