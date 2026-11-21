import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';
import { siteNavGroups, type SiteNavActive, type SiteNavGroup, type SiteNavGroupId } from '../lib/siteNav';
import { normalizeLocale, pathWithLocale } from '../lib/locale';
import { plannerPath } from '../lib/routes';
import i18n from '../lib/i18n';

/** 메뉴 묶음 이름 — 데스크톱 메뉴·모바일 서랍 */
function groupLabelKey(id: SiteNavGroupId): string {
  return id === 'courses' ? 'nav.courses' : id === 'info' ? 'nav.infoGroup' : 'nav.myTrip';
}

function GroupItems({ group, onNavigate }: { group: SiteNavGroup; onNavigate?: () => void }) {
  const { t } = useTranslation('landing');
  return (
    <>
      {group.items.map((item) => (
        <Link key={item.id} to={item.to} className="site-nav-item" onClick={onNavigate}>
          <span className="site-nav-item-label">{t(`navItems.${item.id}.label`)}</span>
          <span className="site-nav-item-desc">{t(`navItems.${item.id}.desc`)}</span>
        </Link>
      ))}
    </>
  );
}

/**
 * 데스크톱 메뉴 3묶음. 마우스를 올리거나(hover) 누르면 펼친다.
 * 터치 기기(가로 768px 이상 태블릿)는 hover가 없어 눌러서 연다.
 */
export function SiteNavDesktop({ active }: { active: SiteNavActive }) {
  const { t } = useTranslation('landing');
  const locale = normalizeLocale(i18n.language);
  const groups = siteNavGroups(locale);
  const [open, setOpen] = useState<SiteNavGroupId | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const baseId = useId();

  useEffect(() => {
    setOpen(null);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="site-nav">
      {groups.map((group) => {
        const panelId = `${baseId}-${group.id}`;
        return (
          <div
            key={group.id}
            className={`site-nav-group${open === group.id ? ' is-open' : ''}`}
            onMouseLeave={() => setOpen((cur) => (cur === group.id ? null : cur))}
          >
            <button
              type="button"
              className={`site-nav-trigger${active === group.id ? ' nav-active' : ''}`}
              aria-expanded={open === group.id}
              aria-controls={panelId}
              onClick={() => setOpen((cur) => (cur === group.id ? null : group.id))}
            >
              {t(groupLabelKey(group.id))}
              <Icon name="chevronDown" size={14} />
            </button>
            <div id={panelId} className="site-nav-panel">
              <GroupItems group={group} onNavigate={() => setOpen(null)} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** 모바일 메뉴 서랍 안의 3묶음 목록 */
export function SiteNavDrawer({ onNavigate }: { onNavigate: () => void }) {
  const { t } = useTranslation('landing');
  const groups = siteNavGroups(normalizeLocale(i18n.language));
  return (
    <div className="site-nav-drawer">
      {groups.map((group) => (
        <section key={group.id} className="site-nav-drawer-group">
          <h2>{t(groupLabelKey(group.id))}</h2>
          <GroupItems group={group} onNavigate={onNavigate} />
        </section>
      ))}
    </div>
  );
}

/**
 * 모바일 하단 탭 4개 — 홈 · 코스 · 정보 · 내 여행.
 * 코스·정보는 따로 모아 둔 페이지가 없어 누르면 그 묶음 항목을 아래에서 올라오는 시트로 보여 준다.
 * `.landing-nav`의 backdrop-filter가 position:fixed 기준을 바꾸므로 헤더 바깥(형제)에 둔다.
 */
export function SiteTabBar({ active }: { active: SiteNavActive }) {
  const { t } = useTranslation('landing');
  const locale = normalizeLocale(i18n.language);
  const groups = siteNavGroups(locale);
  const [sheet, setSheet] = useState<'courses' | 'info' | null>(null);
  const location = useLocation();

  useEffect(() => {
    setSheet(null);
  }, [location.pathname, location.search]);

  // 탭이 본문 끝을 가리지 않게 body 아래 여백(CSS: body.site-has-tabbar)
  useEffect(() => {
    document.body.classList.add('site-has-tabbar');
    return () => document.body.classList.remove('site-has-tabbar');
  }, []);

  useEffect(() => {
    if (!sheet) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSheet(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [sheet]);

  const sheetGroup = sheet ? groups.find((g) => g.id === sheet) : undefined;
  const tabClass = (on: boolean) => `site-tab${on ? ' is-active' : ''}`;

  return (
    <>
      {sheetGroup && (
        <div className="site-tab-sheet-backdrop" onClick={() => setSheet(null)}>
          <div
            className="site-tab-sheet"
            role="dialog"
            aria-label={t(groupLabelKey(sheetGroup.id))}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="site-tab-sheet-head">
              <h2>{t(groupLabelKey(sheetGroup.id))}</h2>
              <button type="button" className="site-tab-sheet-close" aria-label={t('nav.close')} onClick={() => setSheet(null)}>
                <Icon name="close" size={18} />
              </button>
            </div>
            <GroupItems group={sheetGroup} onNavigate={() => setSheet(null)} />
          </div>
        </div>
      )}
      <nav className="site-tabbar" aria-label={t('nav.tabs')}>
        <Link to={pathWithLocale('/', locale)} className={tabClass(active === 'home')} aria-current={active === 'home' ? 'page' : undefined}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M3 11 12 4l9 7" />
            <path d="M5 10v10h14V10" />
          </svg>
          <span>{t('nav.home')}</span>
        </Link>
        <button
          type="button"
          className={tabClass(active === 'courses' || sheet === 'courses')}
          aria-expanded={sheet === 'courses'}
          onClick={() => setSheet((cur) => (cur === 'courses' ? null : 'courses'))}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M4 19c4-1 4-7 8-7s4 6 8 7" />
            <circle cx="6" cy="6" r="2" />
            <circle cx="18" cy="6" r="2" />
          </svg>
          <span>{t('nav.courses')}</span>
        </button>
        <button
          type="button"
          className={tabClass(active === 'info' || sheet === 'info')}
          aria-expanded={sheet === 'info'}
          onClick={() => setSheet((cur) => (cur === 'info' ? null : 'info'))}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v6" />
            <path d="M12 7.5v.5" />
          </svg>
          <span>{t('nav.tabInfo')}</span>
        </button>
        <Link to={plannerPath(locale)} className={tabClass(active === 'trip')}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <rect x="4" y="5" width="16" height="15" rx="2" />
            <path d="M4 10h16" />
            <path d="M9 3v4" />
            <path d="M15 3v4" />
          </svg>
          <span>{t('nav.myTrip')}</span>
        </Link>
      </nav>
    </>
  );
}
