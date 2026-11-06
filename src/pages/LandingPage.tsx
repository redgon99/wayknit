import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Icon } from '../components/Icon';
import { LegalLinks } from '../components/LegalLinks';
import { SiteHeader } from '../components/SiteHeader';
import { useLandingCms } from '../hooks/useLandingCms';
import { useSeoMeta } from '../hooks/useSeoMeta';
import { normalizeLocale, pathWithLocale } from '../lib/locale';
import { plannerPath } from '../lib/routes';
import i18n from '../lib/i18n';
import { isGuidesConfigured, listPublishedGuides, pickGuideContent } from '../lib/guides';
import type { GuideArticle } from '../types/guides';
import { LandingCmsSections } from '../components/LandingCms';
import { landingAnchor } from '../lib/landingMenu';
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

  useSeoMeta({ title: t('meta.title'), description: t('meta.description'), path: '/' });

  /*
   * 여행 팁 카드 — 예전엔 최신 6개를 원문(한국어) 제목·요약 그대로 보여줘서, 영어
   * 번역이 있는 가이드도 영어 랜딩에 한국어로 나왔다(2026-10-27 크롬 점검).
   * 이제 카드마다 지금 언어의 번역을 고르고(pickGuideContent, 가이드 목록과 같은
   * 규칙), 후보를 넉넉히 받아 지금 언어로 읽을 수 있는 가이드를 앞에 세운다 —
   * 번역 없는 국내 코스가 최신이라는 이유로 외국인 랜딩을 채우지 않게.
   */
  useEffect(() => {
    if (!isGuidesConfigured()) return;
    let alive = true;
    // 한국어는 모든 가이드가 원문이라 고를 필요가 없다. 가이드 조회는 본문·번역까지
    // 통째로 받으므로 다른 언어도 후보를 18개로 제한한다.
    void listPublishedGuides(locale === 'ko' ? 6 : 18)
      .then((rows) => {
        if (!alive) return;
        const readable = (g: GuideArticle) => {
          const picked = pickGuideContent(g, locale).locale;
          return picked === locale || (locale.startsWith('zh') && picked.startsWith('zh'));
        };
        // sort는 안정 정렬이라 같은 그룹 안에선 최신순이 유지된다.
        const ordered = [...rows].sort((a, b) => Number(readable(b)) - Number(readable(a)));
        setTipGuides(ordered.slice(0, 6));
      })
      .catch(() => {
        /* optional teaser */
      });
    return () => {
      alive = false;
    };
  }, [locale]);

  // 헤더(SiteHeader)도 같은 훅을 쓴다 — 요청은 훅 안의 캐시로 한 번만 나간다.
  const { loaded: cmsLoaded, menu, heroCopy } = useLandingCms();

  /*
   * 다른 페이지 헤더의 CMS 메뉴는 "/#landing-<id>"로 들어온다.
   * 그 섹션은 CMS 조회가 끝나야 그려지므로, 브라우저가 첫 로드 때 해시로 스크롤하려는
   * 시점엔 아직 없다 — 조회가 끝난 뒤 직접 한 번 맞춰 준다. "#features"처럼 처음부터
   * 있는 섹션도 같은 경로로 처리된다.
   */
  const { hash } = useLocation();
  useEffect(() => {
    if (!cmsLoaded || !hash) return;
    const el = document.getElementById(decodeURIComponent(hash.slice(1)));
    el?.scrollIntoView({ block: 'start' });
  }, [cmsLoaded, hash]);

  const heroEyebrow = heroCopy?.heroEyebrow.trim() || t('hero.eyebrow');
  const heroTitle = heroCopy?.heroTitle.trim() || t('hero.title');
  const heroSubtitle = heroCopy?.heroSubtitle.trim() || t('hero.subtitle');
  const heroNote = heroCopy?.heroNote.trim() || t('hero.note');

  return (
    <div className="landing-page">
      <SiteHeader active="home" />

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

      {/* 상단 "소개" 메뉴의 도착지 — CMS 섹션(화면 미리보기 등)과 기능 쇼케이스를 한 구역으로 묶는다 */}
      <div className="landing-intro" id="features">
        {menu.length > 0 ? <LandingCmsSections tree={menu} skipId={heroCopy?.id} /> : null}

        <section className="landing-section landing-showcase" aria-labelledby="showcase-title">
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
      </div>

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
            {tipGuides.map((g) => {
              const content = pickGuideContent(g, locale);
              return (
                <Link
                  key={g.id}
                  to={pathWithLocale(`/guides/${g.slug}`, locale)}
                  className="landing-tip-card"
                >
                  <span className="landing-tip-kind">{tg(`kinds.${g.kind}`)}</span>
                  <h3>{content.title}</h3>
                  <p>{content.summary}</p>
                </Link>
              );
            })}
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
