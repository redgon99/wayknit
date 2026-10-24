import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Icon } from '../components/Icon';
import { LegalLinks } from '../components/LegalLinks';
import { SiteHeader } from '../components/SiteHeader';
import { useSeoMeta } from '../hooks/useSeoMeta';
import { normalizeLocale, pathWithLocale } from '../lib/locale';
import { plannerPath } from '../lib/routes';
import i18n from '../lib/i18n';
import { isGuidesConfigured, listPublishedGuides } from '../lib/guides';
import type { GuideArticle } from '../types/guides';
import {
  collectNoticeTexts,
  LandingCmsNav,
  LandingCmsSections,
  landingNavItems,
} from '../components/LandingCms';
import { findFirstEnabledOfType, landingAnchor } from '../lib/landingMenu';
import { fetchLandingPromo, type LandingPromo } from '../lib/landingPromo';
import '../styles/landing.css';

function LandingBrand({ className = '' }: { className?: string }) {
  const { t } = useTranslation('landing');
  const secondary = t('brand.secondary');
  return (
    <span className={`landing-brand-text ${className}`.trim()}>
      <span className="landing-brand-primary">{t('brand.primary')}</span>
      {secondary ? <span className="landing-brand-sub">{secondary}</span> : null}
    </span>
  );
}

export default function LandingPage() {
  const { t } = useTranslation('landing');
  const { t: tg } = useTranslation('guides');
  const locale = normalizeLocale(i18n.language);
  const planPath = plannerPath(locale);
  const plazaPath = pathWithLocale('/plaza', locale);
  const guidesPath = pathWithLocale('/guides', locale);
  const infoPath = pathWithLocale('/info', locale);
  const loginPath = pathWithLocale('/login', locale);
  const year = new Date().getFullYear();
  const [tipGuides, setTipGuides] = useState<GuideArticle[]>([]);
  const [promo, setPromo] = useState<LandingPromo | null>(null);

  useSeoMeta({ title: t('meta.title'), description: t('meta.description'), path: '/' });

  useEffect(() => {
    if (!isGuidesConfigured()) return;
    let alive = true;
    void listPublishedGuides(6)
      .then((rows) => {
        if (alive) setTipGuides(rows);
      })
      .catch(() => {
        /* optional teaser */
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    void fetchLandingPromo(locale, { publishedOnly: true })
      .then((row) => {
        if (alive) setPromo(row);
      })
      .catch(() => {
        if (alive) setPromo(null);
      });
    return () => {
      alive = false;
    };
  }, [locale]);

  const menu = promo?.menu ?? [];
  const heroCopy = findFirstEnabledOfType(menu, 'copy');
  const noticeTexts = menu.length > 0 ? collectNoticeTexts(menu) : [t('notice.trial')];
  const cmsNav = landingNavItems(menu, heroCopy?.id);
  const heroEyebrow = heroCopy?.heroEyebrow.trim() || t('hero.eyebrow');
  const heroTitle = heroCopy?.heroTitle.trim() || t('hero.title');
  const heroSubtitle = heroCopy?.heroSubtitle.trim() || t('hero.subtitle');
  const heroNote = heroCopy?.heroNote.trim() || t('hero.note');

  return (
    <div className="landing-page">
      <SiteHeader
        active="home"
        beforeLinks={<LandingCmsNav items={cmsNav} />}
        noticeTexts={noticeTexts}
      />

      <section
        className="landing-section landing-hero"
        id={heroCopy ? landingAnchor(heroCopy.id) : undefined}
      >
        <div className="landing-hero-copy">
          <p className="landing-eyebrow">{heroEyebrow}</p>
          <h1 style={{ whiteSpace: 'pre-line' }}>{heroTitle}</h1>
          <p className="landing-hero-lead">{heroSubtitle}</p>
          <div className="landing-hero-ctas">
            <Link to={planPath} className="landing-btn landing-btn-primary">
              {t('hero.ctaPrimary')}
            </Link>
            <Link to={plazaPath} className="landing-btn landing-btn-secondary">
              {t('hero.ctaSecondary')}
            </Link>
          </div>
          <p className="landing-hero-note">{heroNote}</p>
        </div>
        <div className="landing-hero-visual">
          <div className="landing-hero-demo" aria-hidden>
            <div className="landing-hero-demo-glow" />
            <div className="landing-hero-demo-card">
              <p className="landing-hero-demo-label">{t('hero.demo.pins')}</p>
              <div className="landing-hero-demo-pin" style={{ background: '#fef9c3' }}>
                <span style={{ background: '#a16207' }} />
                경복궁
              </div>
              <div className="landing-hero-demo-pin" style={{ background: '#eff6ff' }}>
                <span style={{ background: '#2563eb' }} />
                인사동 카페
              </div>
              <div className="landing-hero-demo-pin" style={{ background: '#fef2f2' }}>
                <span style={{ background: '#dc2626' }} />
                광장시장
              </div>
            </div>
            <span className="landing-hero-demo-arrow">
              <Icon name="route" size={18} />
            </span>
            <div className="landing-hero-demo-card">
              <p className="landing-hero-demo-label">{t('hero.demo.route')}</p>
              <div className="landing-hero-demo-stop">
                <span className="landing-hero-demo-time">09:00</span>경복궁
              </div>
              <div className="landing-hero-demo-stop">
                <span className="landing-hero-demo-time">10:40</span>인사동 카페
              </div>
              <div className="landing-hero-demo-stop">
                <span className="landing-hero-demo-time">12:10</span>광장시장
              </div>
            </div>
          </div>
        </div>
      </section>

      {menu.length > 0 ? <LandingCmsSections tree={menu} skipId={heroCopy?.id} /> : null}

      <section className="landing-section landing-showcase" id="features" aria-labelledby="showcase-title">
        <div className="landing-section-header">
          <h2 id="showcase-title">{t('showcase.title')}</h2>
          <p>{t('showcase.subtitle')}</p>
        </div>
        <div className="landing-showcase-grid">
          <div className="landing-showcase-video" aria-hidden="true">
            <span className="landing-showcase-video-badge">
              <span>02</span> {t('pillars.route.title')}
            </span>
            <span className="landing-showcase-video-play">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 5v14l12-7z" />
              </svg>
            </span>
          </div>
          <div className="landing-showcase-tabs">
            <div className="landing-showcase-tab">
              <span className="landing-showcase-tab-icon">
                <Icon name="search" size={18} />
              </span>
              <div>
                <p>01 · {t('pillars.search.title')}</p>
                <p>{t('pillars.search.body')}</p>
              </div>
            </div>
            <div className="landing-showcase-tab landing-showcase-tab-active">
              <div className="landing-showcase-tab-row">
                <span className="landing-showcase-tab-icon">
                  <Icon name="route" size={18} />
                </span>
                <div>
                  <p>02 · {t('pillars.route.title')}</p>
                  <p>{t('pillars.route.body')}</p>
                </div>
              </div>
              <div className="landing-showcase-tab-progress">
                <div className="landing-showcase-tab-progress-fill" />
              </div>
            </div>
            <div className="landing-showcase-tab">
              <span className="landing-showcase-tab-icon">
                <Icon name="sparkles" size={18} />
              </span>
              <div>
                <p>03 · {t('features.scenario.title')}</p>
                <p>{t('features.scenario.body')}</p>
              </div>
            </div>
            <div className="landing-showcase-tab">
              <span className="landing-showcase-tab-icon">
                <Icon name="share" size={18} />
              </span>
              <div>
                <p>04 · {t('pillars.share.title')}</p>
                <p>{t('pillars.share.body')}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-positioning" aria-labelledby="positioning-title">
        <p className="landing-positioning-eyebrow" id="positioning-title">
          {t('compare.title')}
        </p>
        <p className="landing-positioning-statement">{t('features.subtitle')}</p>
        <span className="landing-positioning-underline" aria-hidden="true" />
      </section>

      <section className="landing-section" aria-labelledby="tips-title">
        <div className="landing-section-header landing-tips-header">
          <div>
            <h2 id="tips-title">{t('tips.title')}</h2>
            <p>{t('tips.subtitle')}</p>
          </div>
          <Link to={guidesPath} className="landing-tips-more">
            {t('tips.more')} →
          </Link>
        </div>
        {tipGuides.length === 0 ? (
          <p className="landing-tips-empty">{t('tips.empty')}</p>
        ) : (
          <div className="landing-tips-grid">
            {tipGuides.map((g) => (
              <Link
                key={g.id}
                to={pathWithLocale(`/guides/${g.slug}`, locale)}
                className="landing-tip-card"
              >
                <span className="landing-tip-kind">{tg(`kinds.${g.kind}`)}</span>
                <h3>{g.title}</h3>
                <p>{g.summary}</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="landing-cta-band" aria-labelledby="cta-title">
        <h2 id="cta-title">{t('cta.title')}</h2>
        <p>{t('cta.subtitle')}</p>
        <Link to={planPath} className="landing-btn landing-btn-primary landing-btn-accent">
          {t('cta.button')}
        </Link>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-brand">
            <span className="landing-brand-mark" aria-hidden>
              <Icon name="pin" size={18} />
            </span>
            <LandingBrand />
          </div>
          <p className="landing-footer-copy">{t('footer.tagline')}</p>
          <nav className="landing-footer-links">
            <Link to={planPath}>{t('footer.plan')}</Link>
            <Link to={plazaPath}>{t('footer.plaza')}</Link>
            <Link to={guidesPath}>{t('footer.tips')}</Link>
            <Link to={infoPath}>{t('footer.info')}</Link>
            <Link to={loginPath}>{t('footer.login')}</Link>
          </nav>
          <LegalLinks className="landing-footer-legal" />
          <p className="landing-footer-copy">{t('footer.rights', { year })}</p>
        </div>
      </footer>
    </div>
  );
}
