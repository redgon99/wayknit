import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Icon } from '../components/Icon';
import { LegalLinks } from '../components/LegalLinks';
import { SiteHeader } from '../components/SiteHeader';
import { useLandingCms } from '../hooks/useLandingCms';
import { useSeoMeta } from '../hooks/useSeoMeta';
import { normalizeLocale, pathWithLocale } from '../lib/locale';
import { plannerPath } from '../lib/routes';
import i18n from '../lib/i18n';
import { isGuidesConfigured } from '../lib/guides';
import { listLandingCourses, regionLabel, type LandingCourse } from '../lib/landingCourses';
import { readActiveLocalTripSummary } from '../lib/localTripSummary';
import { trackEvent } from '../lib/analytics';
import { LandingCmsSections } from '../components/LandingCms';
import { landingAnchor } from '../lib/landingMenu';
import '../styles/landing.css';

/** "추천 코스에서 시작"의 지역 칩 — 공개 코스 글이 많은 지역 */
const START_REGIONS = ['seoul', 'busan', 'gyeongju', 'gangneung'];
/** "테마로 첫 일정 받기"의 테마 칩(lib/themes.ts의 TRIP_THEMES 중 일부) */
const START_THEMES = ['kfood', 'nightlife', 'family', 'nature'];
/** 코스 카드 머리 색 — 사진 대신 지역별로 구분만 되게 */
const CARD_TINTS = ['#f3e6d6', '#dbe7f3', '#e3eedf', '#ede4f3', '#f3efd6', '#dcecef'];

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

/**
 * 랜딩 — 개편 3단계(2026-11-21, 시안 docs/design/2026-11-21_개편시안_추천안/LandingDesktop·LandingMobile).
 * 예전엔 히어로 → 소개 → 기능 쇼케이스 → 포지셔닝 → 여행 팁 → CTA 7구역이었다. 이제 첫 화면에서
 * "어디서 시작할지"를 고르게 하고(시작점 3개), 그 아래 바로 담을 수 있는 추천 코스와 여행 정보만 둔다.
 */
export default function LandingPage() {
  const { t } = useTranslation('landing');
  const { t: tp } = useTranslation('planner');
  const navigate = useNavigate();
  const locale = normalizeLocale(i18n.language);
  const planPath = plannerPath(locale);
  const plazaPath = pathWithLocale('/plaza', locale);
  const guidesPath = pathWithLocale('/guides', locale);
  const infoPath = pathWithLocale('/info', locale);
  const setupPath = pathWithLocale('/setup', locale);
  const themesPath = pathWithLocale('/themes', locale);
  const loginPath = pathWithLocale('/login', locale);
  const year = new Date().getFullYear();

  const [courses, setCourses] = useState<LandingCourse[]>([]);
  const [coursesLoaded, setCoursesLoaded] = useState(false);
  const [placeQuery, setPlaceQuery] = useState('');
  // 이 기기에 저장된 여행(가입 없이 쓰는 사람의 "이어서 하기")
  const [continueTrip] = useState(() => readActiveLocalTripSummary());

  useSeoMeta({ title: t('meta.title'), description: t('meta.description'), path: '/' });

  useEffect(() => {
    if (!isGuidesConfigured()) {
      setCoursesLoaded(true);
      return;
    }
    let alive = true;
    void listLandingCourses(locale)
      .then((rows) => {
        if (alive) setCourses(rows);
      })
      .catch(() => {
        /* 카드는 없어도 시작점 3개로 충분하다 */
      })
      .finally(() => {
        if (alive) setCoursesLoaded(true);
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
   * 시점엔 아직 없다 — 조회가 끝난 뒤 직접 한 번 맞춰 준다.
   */
  const { hash } = useLocation();
  useEffect(() => {
    if (!cmsLoaded || !hash) return;
    const el = document.getElementById(decodeURIComponent(hash.slice(1)));
    el?.scrollIntoView({ block: 'start' });
  }, [cmsLoaded, hash]);

  // 제목만 관리자 CMS(홍보문구)로 바꿀 수 있다. 부제는 시작점 고르기 안내라 고정 문구.
  const heroTitle = heroCopy?.heroTitle.trim() || t('hero.title');

  const submitPlace = (e: FormEvent) => {
    e.preventDefault();
    const q = placeQuery.trim();
    navigate(q ? `${planPath}?searchKeyword=${encodeURIComponent(q)}` : planPath);
  };

  const courseImportPath = (c: LandingCourse) =>
    `${planPath}?${new URLSearchParams({ autoRoute: '1', guideTitle: c.title, fromGuide: c.slug }).toString()}`;

  return (
    <div className="landing-page">
      <SiteHeader active="home" />

      <main className="home-main">
        <section
          className="home-start"
          aria-labelledby="home-title"
          id={heroCopy ? landingAnchor(heroCopy.id) : undefined}
        >
          <div className="home-start-head">
            <div>
              <h1 id="home-title" className="home-title">
                {heroTitle}
              </h1>
              <p className="home-lead">{t('home.lead')}</p>
            </div>
            {continueTrip && (
              <Link to={planPath} className="home-continue">
                <span className="home-continue-label">{t('home.continue')}</span>
                <span className="home-continue-trip">
                  {t('home.continueTrip', { title: continueTrip.title, count: continueTrip.totalDays })} →
                </span>
              </Link>
            )}
          </div>

          <div className="home-start-grid">
            <section className="home-start-card home-start-card--dark" aria-labelledby="home-start-course">
              <span className="home-start-badge">{t('home.course.badge')}</span>
              <h2 id="home-start-course">{t('home.course.title')}</h2>
              <p>{t('home.course.body')}</p>
              <div className="home-chips">
                {START_REGIONS.map((id) => (
                  <Link key={id} to={`${guidesPath}?kind=course&tag=${id}`} className="home-chip home-chip--dark">
                    {regionLabel(id, locale)}
                  </Link>
                ))}
              </div>
              <Link to={`${guidesPath}?kind=course`} className="home-start-cta home-start-cta--accent">
                {t('home.course.cta')} →
              </Link>
            </section>

            <section className="home-start-card" aria-labelledby="home-start-place">
              <span className="home-start-badge">{t('home.place.badge')}</span>
              <h2 id="home-start-place">{t('home.place.title')}</h2>
              <p>{t('home.place.body')}</p>
              <form className="home-place-form" role="search" onSubmit={submitPlace}>
                <label htmlFor="home-place-input" className="home-visually-hidden">
                  {t('home.place.title')}
                </label>
                <Icon name="search" size={18} />
                <input
                  id="home-place-input"
                  type="search"
                  value={placeQuery}
                  onChange={(e) => setPlaceQuery(e.target.value)}
                  placeholder={t('home.place.placeholder')}
                />
                <button type="submit">{t('home.place.submit')}</button>
              </form>
            </section>

            <section className="home-start-card home-start-card--soft" aria-labelledby="home-start-theme">
              <span className="home-start-badge">{t('home.theme.badge')}</span>
              <h2 id="home-start-theme">{t('home.theme.title')}</h2>
              <p>{t('home.theme.body')}</p>
              <div className="home-chips">
                {START_THEMES.map((id) => (
                  <Link key={id} to={`${planPath}?openScenario=1&theme=${id}`} className="home-chip home-chip--soft">
                    {tp(`themes.${id}`)}
                  </Link>
                ))}
              </div>
              <Link to={themesPath} className="home-start-cta">
                {t('home.theme.cta')} →
              </Link>
            </section>
          </div>
        </section>

        <section className="home-block" aria-labelledby="home-courses-title">
          <div className="home-block-head">
            <h2 id="home-courses-title">{t('home.courses.title')}</h2>
            <Link to={`${guidesPath}?kind=course`}>{t('home.courses.more')} →</Link>
          </div>
          {coursesLoaded && courses.length === 0 ? (
            <p className="home-empty">{t('home.courses.empty')}</p>
          ) : (
            <div className="home-course-grid">
              {courses.map((c, i) => (
                <article key={c.slug} className="home-course-card">
                  <div className="home-course-tint" style={{ background: CARD_TINTS[i % CARD_TINTS.length] }}>
                    {c.regionId && <span className="home-course-region">{regionLabel(c.regionId, locale)}</span>}
                  </div>
                  <div className="home-course-body">
                    <Link to={pathWithLocale(`/guides/${c.slug}`, locale)} className="home-course-title">
                      {c.title}
                    </Link>
                    <div className="home-course-actions">
                      <Link
                        to={courseImportPath(c)}
                        className="home-course-add"
                        onClick={() =>
                          trackEvent('guide_cta_click', { slug: c.slug, cta: 'auto_route', button: 'landing' })
                        }
                      >
                        + {t('home.courses.add')}
                      </Link>
                      <Link to={pathWithLocale(`/guides/${c.slug}`, locale)} className="home-course-read">
                        {t('home.courses.read')}
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="home-block" aria-labelledby="home-info-title">
          <div className="home-block-head">
            <h2 id="home-info-title">{t('home.info.title')}</h2>
            <Link to={guidesPath}>{t('home.info.more')} →</Link>
          </div>
          <div className="home-info-grid">
            <Link to={setupPath} className="home-info-tile">
              <strong>{t('navItems.prep.label')}</strong>
              <span>{t('navItems.prep.desc')}</span>
            </Link>
            <Link to={`${guidesPath}?kind=practical`} className="home-info-tile">
              <strong>{t('home.info.transport.label')}</strong>
              <span>{t('home.info.transport.desc')}</span>
            </Link>
            <Link to={`${guidesPath}?kind=culture`} className="home-info-tile">
              <strong>{t('home.info.culture.label')}</strong>
              <span>{t('home.info.culture.desc')}</span>
            </Link>
            <Link to={infoPath} className="home-info-tile">
              <strong>{t('navItems.resources.label')}</strong>
              <span>{t('navItems.resources.desc')}</span>
            </Link>
          </div>
        </section>
      </main>

      {/* 관리자 CMS 섹션(홍보이미지 등)과 예전 "소개" 링크(#features)의 도착지 — 시작점 아래로 내렸다 */}
      {menu.length > 0 ? (
        <div className="landing-intro" id="features">
          <LandingCmsSections tree={menu} skipId={heroCopy?.id} />
        </div>
      ) : null}

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
