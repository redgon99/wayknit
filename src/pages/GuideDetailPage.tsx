import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthBar } from '../components/AuthBar';
import { LocaleSwitcher } from '../components/LocaleSwitcher';
import { ReportButton } from '../components/ReportButton';
import { useSeoMeta } from '../hooks/useSeoMeta';
import { GUIDE_KIND_META } from '../lib/guideKinds';
import { normalizeLocale, pathWithLocale } from '../lib/locale';
import { plannerPath } from '../lib/routes';
import i18n from '../lib/i18n';
import { getPublishedGuideBySlug, isGuidesConfigured } from '../lib/guides';
import { renderGuideMarkdown } from '../lib/guideMarkdown';
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

  const summaryText =
    locale === 'en' && guide?.summaryEn ? guide.summaryEn : guide?.summary;

  useSeoMeta(
    guide
      ? {
          title: `${guide.title} · ${t('brand')}`,
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
              {guide.topicTags.map((tag) => (
                <span key={tag} className="guides-tag">
                  {tag}
                </span>
              ))}
            </div>
            <h1>{guide.title}</h1>
            {summaryText && <p className="guides-detail-summary">{summaryText}</p>}
            {guide.kind === 'course' && guide.coursePins.length > 0 && (
              <GuideCourseMap pins={guide.coursePins} />
            )}
            <div className="guides-body">{renderGuideMarkdown(guide.bodyMd)}</div>
            <p className="guides-disclaimer">{t('detail.disclaimer')}</p>
            {guide.sourceUrls.length > 0 && (
              <section className="guides-sources">
                <h2>{t('detail.sources')}</h2>
                <ul>
                  {guide.sourceUrls.map((url) => (
                    <li key={url}>
                      <a href={url} target="_blank" rel="noopener noreferrer">
                        {url}
                      </a>
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
