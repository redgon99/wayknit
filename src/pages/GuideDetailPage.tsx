import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SiteHeader } from '../components/SiteHeader';
import { ReportButton } from '../components/ReportButton';
import { ShareIcon } from '../components/ShareIcon';
import { trackEvent } from '../lib/analytics';
import { shareLink } from '../lib/shareLink';
import { useSeoMeta } from '../hooks/useSeoMeta';
import { GUIDE_KIND_META } from '../lib/guideKinds';
import { displayCourseTags } from '../lib/courseGuideTaxonomy';
import { LOCALE_LABELS, normalizeLocale, pathWithLocale, type AppLocale } from '../lib/locale';
import { plannerPath } from '../lib/routes';
import i18n from '../lib/i18n';
import {
  getPublishedGuideBySlug,
  guideAvailableLocales,
  isGuidesConfigured,
  pickGuideContent,
  plainGuideSummary,
} from '../lib/guides';
import { renderGuideMarkdown } from '../lib/guideMarkdown';
import { collectGuideSources } from '../lib/guideSources';
import { GuideCourseMap } from '../components/GuideCourseMap';
import { listRelatedCourses, type RelatedCourse } from '../lib/relatedGuides';
import type { GuideArticle } from '../types/guides';
import '../styles/app.css';

export default function GuideDetailPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const { t } = useTranslation('guides');
  const locale = normalizeLocale(i18n.language);
  const [guide, setGuide] = useState<GuideArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /**
   * 다국어 통합(2026-09-20) — 사이트 전체 언어(LocaleSwitcher)와는 별개로,
   * 이 가이드 콘텐츠만 다른 언어로 볼 수 있는 전환 버튼. null이면 사이트
   * 언어를 그대로 따른다(guide.slug가 바뀌면(다른 글로 이동) 다시 null로
   * 리셋 — 이전 글에서 고른 언어가 새 글에 남아 있지 않게).
   */
  const [viewLocale, setViewLocale] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<number | undefined>(undefined);
  /** 위쪽 "내 일정에 담기"가 화면에 보이는 동안엔 모바일 하단 고정 버튼을 숨긴다(같은 버튼 두 개 방지). */
  const courseCtaRef = useRef<HTMLDivElement | null>(null);
  const [courseCtaVisible, setCourseCtaVisible] = useState(true);
  const [related, setRelated] = useState<RelatedCourse[]>([]);
  useEffect(() => () => window.clearTimeout(copiedTimer.current), []);
  useEffect(() => {
    setViewLocale(null);
  }, [slug]);

  useEffect(() => {
    if (!isGuidesConfigured()) {
      setLoading(false);
      setError(t('errors.notConfigured'));
      return;
    }
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const row = await getPublishedGuideBySlug(slug);
        if (!alive) return;
        if (!row) {
          setGuide(null);
          setError(t('detail.notFound'));
        } else {
          setGuide(row);
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : t('errors.loadFailed'));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [slug, t]);

  // 개편 1단계(2026-11-21): 다 읽은 사람을 다음 코스로 — 태그가 겹치는 코스 3개
  useEffect(() => {
    if (!guide) {
      setRelated([]);
      return;
    }
    let alive = true;
    listRelatedCourses(guide, locale)
      .then((rows) => {
        if (alive) setRelated(rows);
      })
      .catch(() => {
        if (alive) setRelated([]);
      });
    return () => {
      alive = false;
    };
  }, [guide, locale]);

  const availableLocales = guide ? guideAvailableLocales(guide) : [];
  const content = guide ? pickGuideContent(guide, viewLocale ?? locale) : null;
  /* summaryEn은 translations가 생기기 전부터 있던 필드 — 제대로 된
     translations.en이 있으면 그쪽이 우선, 없을 때만 이 레거시 값을 쓴다. */
  const rawSummary =
    content?.locale === 'en' && !guide?.translations.en && guide?.summaryEn
      ? guide.summaryEn
      : content?.summary;
  const summaryText = rawSummary ? plainGuideSummary(rawSummary) : rawSummary;
  const sources = content ? collectGuideSources(content.bodyMd, guide?.sourceUrls ?? []) : [];

  useSeoMeta(
    guide && content
      ? {
          title: `${content.title} · ${t('brand')}`,
          description: summaryText || undefined,
          type: 'article',
          path: `/guides/${slug}`,
        }
      : null,
  );

  const primaryCta = (() => {
    if (!guide) return null;
    const meta = GUIDE_KIND_META[guide.kind];
    if (meta.cta === 'auto_route') {
      // 일정 제목·안내에 쓰이므로 원문(한국어) 제목이 아니라 지금 보고 있는 언어의 제목을 넘긴다.
      const q = new URLSearchParams({
        autoRoute: '1',
        guideTitle: content?.title ?? guide.title,
        fromGuide: guide.slug,
      });
      return {
        to: `${plannerPath(locale)}?${q.toString()}`,
        label: t('cta.autoRoute'),
        cta: 'auto_route',
      };
    }
    if (meta.cta === 'setup') {
      return { to: pathWithLocale('/setup', locale), label: t('cta.setup'), cta: 'setup' };
    }
    if (meta.cta === 'plaza') {
      return { to: pathWithLocale('/plaza', locale), label: t('cta.plaza'), cta: 'plaza' };
    }
    return { to: plannerPath(locale), label: t('cta.planner'), cta: 'planner' };
  })();

  /*
   * 코스 핀이 있는 추천 코스는 "내 일정에 담기"를 본문 맨 아래뿐 아니라 요약 바로 아래에도 둔다.
   * 2026-11 기준 가이드 방문자 110명 중 3명만 플래너로 갔다(개선계획 1단계).
   */
  const courseCta =
    guide && guide.coursePins.length > 0 && primaryCta?.cta === 'auto_route' ? primaryCta : null;

  const hasCourseCta = courseCta !== null;
  useEffect(() => {
    const el = courseCtaRef.current;
    if (!hasCourseCta || !el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setCourseCtaVisible(entry.isIntersecting));
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasCourseCta]);

  /** 코스 지도에서 고른 장소 하나만 플래너에 담는 주소(PlannerPage의 `pin` 파라미터) */
  const addPinHref = courseCta
    ? (order: number) => {
        const q = new URLSearchParams({
          autoRoute: '1',
          guideTitle: content?.title ?? guide?.title ?? '',
          fromGuide: guide?.slug ?? '',
          pin: String(order),
        });
        return `${plannerPath(locale)}?${q.toString()}`;
      }
    : undefined;

  const relatedAddHref = (r: RelatedCourse) =>
    `${plannerPath(locale)}?${new URLSearchParams({ autoRoute: '1', guideTitle: r.title, fromGuide: r.slug }).toString()}`;

  /** 지금 보고 있는 언어 버전의 주소를 공유한다. */
  const shareGuide = async () => {
    if (!guide) return;
    const path = pathWithLocale(`/guides/${guide.slug}`, normalizeLocale(content?.locale ?? locale));
    const result = await shareLink(content?.title ?? guide.slug, `${window.location.origin}${path}`, t('list.shareLabel'));
    if (result !== 'copied') return;
    setCopied(true);
    window.clearTimeout(copiedTimer.current);
    copiedTimer.current = window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <main className="guides-page">
      {/* 개편 1단계(2026-11-21): 랜딩과 같은 공통 헤더 — 메뉴·통합검색·플래너 열기. 방문의 80%가 가이드로 들어온다 */}
      <SiteHeader active={guide?.kind === 'course' ? 'courses' : 'info'} />

      <div className="guides-shell guide-detail-layout">
      <article className={`guides-detail${courseCta ? ' guides-detail-has-sticky' : ''}`}>
        <Link to={pathWithLocale('/guides', locale)} className="guides-brand guide-detail-back">
          ← {t('detail.back')}
        </Link>
        {loading && <p className="guides-muted">{t('list.loading')}</p>}
        {error && !guide && <p className="guides-error">{error}</p>}
        {guide && (
          <>
            {/* 오른쪽 위에 떠 있는 공유 버튼 — 스크롤해도 화면 위쪽에 붙어 따라온다 */}
            <div className="guide-share-float">
              <button
                type="button"
                className="guide-share-fab"
                aria-label={`${t('list.shareLabel')}: ${content?.title ?? ''}`}
                title={t('list.shareLabel')}
                onClick={() => void shareGuide()}
              >
                <ShareIcon size={18} />
              </button>
              {copied && (
                <span className="guides-card-copied guide-share-copied" role="status">
                  {t('list.shareCopied')}
                </span>
              )}
            </div>
            <div className="guides-card-tags">
              <span className="guides-tag guides-tag-kind">{t(`kinds.${guide.kind}`)}</span>
              {displayCourseTags(guide.topicTags, locale, 8).map((tag) => (
                <span key={tag} className="guides-tag">
                  {tag}
                </span>
              ))}
            </div>
            {availableLocales.length > 1 && (
              <div className="guide-lang-switch" role="group" aria-label="가이드 언어 전환">
                {availableLocales.map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    className={`guide-lang-switch-btn ${content?.locale === loc ? 'active' : ''}`}
                    onClick={() => setViewLocale(loc)}
                  >
                    {LOCALE_LABELS[loc as AppLocale] ?? loc}
                  </button>
                ))}
              </div>
            )}
            {content && !viewLocale && content.locale !== locale && (
              <p className="guide-lang-fallback">
                {t('detail.fallbackNotice', {
                  lang: LOCALE_LABELS[locale] ?? locale,
                  shown: LOCALE_LABELS[content.locale as AppLocale] ?? content.locale,
                })}
              </p>
            )}
            <h1>{content?.title}</h1>
            {summaryText && <p className="guides-detail-summary">{summaryText}</p>}
            {courseCta && (
              <div className="guide-course-cta" ref={courseCtaRef}>
                <Link
                  to={courseCta.to}
                  className="guides-btn guides-btn-primary"
                  onClick={() => trackEvent('guide_cta_click', { slug: guide.slug, cta: courseCta.cta, button: 'top' })}
                >
                  {courseCta.label}
                </Link>
                <span className="guide-course-cta-note">
                  {t('cta.courseNote', { count: guide.coursePins.length })}
                </span>
              </div>
            )}
            {guide.kind === 'course' && guide.coursePins.length > 0 && (
              <GuideCourseMap
                pins={guide.coursePins}
                addPinHref={addPinHref}
                onAddPin={(order) =>
                  trackEvent('guide_cta_click', { slug: guide.slug, cta: 'add_pin', button: 'map', pin: order })
                }
              />
            )}
            <div className="guides-body">{content && renderGuideMarkdown(content.bodyMd, locale)}</div>
            <p className="guides-disclaimer">{t('detail.disclaimer')}</p>
            {sources.length > 0 && (
              <section className="guides-sources">
                <h2>{t('detail.sources')}</h2>
                <ul>
                  {sources.map((src) => (
                    <li key={src.url}>
                      <a
                        className="guide-source-chip"
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {src.label}
                      </a>
                      {src.host && (
                        <span className="guides-source-host">{src.host}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <div className="guides-detail-cta">
              {primaryCta && (
                <Link
                  to={primaryCta.to}
                  className="guides-btn guides-btn-primary"
                  onClick={() => trackEvent('guide_cta_click', { slug: guide.slug, cta: primaryCta.cta, button: 'primary' })}
                >
                  {primaryCta.label}
                </Link>
              )}
              {guide.kind === 'course' ? (
                <Link
                  to={pathWithLocale('/plaza', locale)}
                  className="guides-btn"
                  onClick={() => trackEvent('guide_cta_click', { slug: guide.slug, cta: 'plaza', button: 'secondary' })}
                >
                  {t('cta.plaza')}
                </Link>
              ) : (
                <Link
                  to={plannerPath(locale)}
                  className="guides-btn"
                  onClick={() => trackEvent('guide_cta_click', { slug: guide.slug, cta: 'planner', button: 'secondary' })}
                >
                  {t('cta.planner')}
                </Link>
              )}
              <ReportButton
                target={{
                  type: 'guide',
                  id: guide.id,
                  label: guide.title,
                  url: window.location.href,
                }}
              />
            </div>
            {courseCta && (
              <div className="guide-course-sticky" hidden={courseCtaVisible}>
                <Link
                  to={courseCta.to}
                  className="guides-btn guides-btn-primary"
                  onClick={() => trackEvent('guide_cta_click', { slug: guide.slug, cta: courseCta.cta, button: 'sticky' })}
                >
                  {courseCta.label}
                </Link>
              </div>
            )}
          </>
        )}
      </article>

      {guide && (
        <aside className="guide-aside">
          {courseCta ? (
            <section className="guide-aside-card guide-aside-dup">
              <h2>{t('aside.courseTitle')}</h2>
              <Link
                to={courseCta.to}
                className="guides-btn guides-btn-primary guide-aside-main"
                onClick={() => trackEvent('guide_cta_click', { slug: guide.slug, cta: courseCta.cta, button: 'aside' })}
              >
                {t('aside.addAll', { count: guide.coursePins.length })}
              </Link>
              <p className="guide-aside-note">{t('aside.localNote')}</p>
            </section>
          ) : (
            primaryCta && (
              <section className="guide-aside-card guide-aside-dup">
                <h2>{t('aside.planTitle')}</h2>
                <p>{t('aside.planDesc')}</p>
                <Link
                  to={primaryCta.to}
                  className="guides-btn guides-btn-primary guide-aside-main"
                  onClick={() => trackEvent('guide_cta_click', { slug: guide.slug, cta: primaryCta.cta, button: 'aside' })}
                >
                  {primaryCta.label}
                </Link>
              </section>
            )
          )}
          {primaryCta?.cta !== 'setup' && (
            <section className="guide-aside-card">
              <h2>{t('aside.prepTitle')}</h2>
              <p>{t('aside.prepDesc')}</p>
              <Link
                to={pathWithLocale('/setup', locale)}
                className="guide-aside-link"
                onClick={() => trackEvent('guide_cta_click', { slug: guide.slug, cta: 'setup', button: 'aside' })}
              >
                {t('aside.prepLink')} →
              </Link>
            </section>
          )}
        </aside>
      )}
      </div>

      {related.length > 0 && (
        <section className="guides-shell guide-related" aria-labelledby="guide-related-title">
          <h2 id="guide-related-title">{t('detail.relatedTitle')}</h2>
          <div className="guide-related-grid">
            {related.map((r) => (
              <div key={r.slug} className="guide-related-card">
                <div className="guides-card-tags">
                  {displayCourseTags(r.tags, locale, 3).map((tag) => (
                    <span key={tag} className="guides-tag">
                      {tag}
                    </span>
                  ))}
                </div>
                <Link to={pathWithLocale(`/guides/${r.slug}`, locale)} className="guide-related-title">
                  {r.title}
                </Link>
                {r.summary && <p>{r.summary}</p>}
                <div className="guide-related-actions">
                  {r.hasPins && (
                    <Link
                      to={relatedAddHref(r)}
                      className="guides-btn guides-btn-primary"
                      onClick={() =>
                        trackEvent('guide_cta_click', {
                          slug: guide?.slug ?? '',
                          cta: 'auto_route',
                          button: 'related',
                          target: r.slug,
                        })
                      }
                    >
                      {t('detail.relatedAdd')}
                    </Link>
                  )}
                  <Link to={pathWithLocale(`/guides/${r.slug}`, locale)} className="guides-btn">
                    {t('detail.relatedRead')}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
