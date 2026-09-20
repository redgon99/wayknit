import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthBar } from '../components/AuthBar';
import { LocaleSwitcher } from '../components/LocaleSwitcher';
import { ReportButton } from '../components/ReportButton';
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
} from '../lib/guides';
import { renderGuideMarkdown } from '../lib/guideMarkdown';
import { collectGuideSources } from '../lib/guideSources';
import { GuideCourseMap } from '../components/GuideCourseMap';
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

  const availableLocales = guide ? guideAvailableLocales(guide) : [];
  const content = guide ? pickGuideContent(guide, viewLocale ?? locale) : null;
  /* summaryEn은 translations가 생기기 전부터 있던 필드 — 제대로 된
     translations.en이 있으면 그쪽이 우선, 없을 때만 이 레거시 값을 쓴다. */
  const summaryText =
    content?.locale === 'en' && !guide?.translations.en && guide?.summaryEn
      ? guide.summaryEn
      : content?.summary;
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
      const q = new URLSearchParams({
        autoRoute: '1',
        guideTitle: guide.title,
        fromGuide: guide.slug,
      });
      return {
        to: `${plannerPath(locale)}?${q.toString()}`,
        label: t('cta.autoRoute'),
      };
    }
    if (meta.cta === 'setup') {
      return { to: pathWithLocale('/setup', locale), label: t('cta.setup') };
    }
    if (meta.cta === 'plaza') {
      return { to: pathWithLocale('/plaza', locale), label: t('cta.plaza') };
    }
    return { to: plannerPath(locale), label: t('cta.planner') };
  })();

  return (
    <main className="guides-page">
      <header className="guides-header">
        <div className="guides-header-inner">
          <div>
            <Link to={pathWithLocale('/guides', locale)} className="guides-brand">
              ← {t('detail.back')}
            </Link>
          </div>
          <div className="guides-header-actions">
            <LocaleSwitcher />
            <AuthBar hideLocale />
          </div>
        </div>
      </header>

      <article className="guides-shell guides-detail">
        {loading && <p className="guides-muted">{t('list.loading')}</p>}
        {error && !guide && <p className="guides-error">{error}</p>}
        {guide && (
          <>
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
            <h1>{content?.title}</h1>
            {summaryText && <p className="guides-detail-summary">{summaryText}</p>}
            {guide.kind === 'course' && guide.coursePins.length > 0 && (
              <GuideCourseMap pins={guide.coursePins} />
            )}
            <div className="guides-body">{content && renderGuideMarkdown(content.bodyMd)}</div>
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
                <Link to={primaryCta.to} className="guides-btn guides-btn-primary">
                  {primaryCta.label}
                </Link>
              )}
              {guide.kind === 'course' ? (
                <Link to={pathWithLocale('/plaza', locale)} className="guides-btn">
                  {t('cta.plaza')}
                </Link>
              ) : (
                <Link to={plannerPath(locale)} className="guides-btn">
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
          </>
        )}
      </article>
    </main>
  );
}
