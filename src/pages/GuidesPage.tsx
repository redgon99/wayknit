import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SiteHeader } from '../components/SiteHeader';
import { SegmentedTabs } from '../components/SegmentedTabs';
import { useSeoMeta } from '../hooks/useSeoMeta';
import { useLandingNoticeTexts } from '../hooks/useLandingNoticeTexts';
import { GUIDE_KINDS, type GuideKind } from '../lib/guideKinds';
import { normalizeLocale, pathWithLocale } from '../lib/locale';
import i18n from '../lib/i18n';
import { isGuidesConfigured, listPublishedGuides } from '../lib/guides';
import type { GuideArticle } from '../types/guides';
import '../styles/app.css';

export default function GuidesPage() {
  const { t } = useTranslation('guides');
  const locale = normalizeLocale(i18n.language);
  const noticeTexts = useLandingNoticeTexts();
  const [guides, setGuides] = useState<GuideArticle[]>([]);
  const [kindFilter, setKindFilter] = useState<GuideKind | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useSeoMeta({ title: t('list.metaTitle'), description: t('list.subtitle'), path: '/guides' });

  useEffect(() => {
    if (!isGuidesConfigured()) {
      setLoading(false);
      setError(t('errors.notConfigured'));
      return;
    }
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const rows = await listPublishedGuides(48, kindFilter || undefined);
        if (alive) setGuides(rows);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : t('errors.loadFailed'));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [t, kindFilter]);

  const kindChips = useMemo(
    () => [{ id: '' as const, label: t('kinds.all') }, ...GUIDE_KINDS.map((k) => ({ id: k, label: t(`kinds.${k}`) }))],
    [t]
  );

  return (
    <main className="guides-page">
      <SiteHeader active="guides" noticeTexts={noticeTexts} />

      <div className="guides-shell">
        <div className="guides-page-title">
          <h1>{t('list.title')}</h1>
          <p className="guides-lead">{t('list.subtitle')}</p>
        </div>

        <SegmentedTabs
          ariaLabel={t('list.kindFilter')}
          items={kindChips.map((c) => ({ id: c.id || 'all', label: c.label }))}
          value={kindFilter || 'all'}
          onChange={(id) => setKindFilter(id === 'all' ? '' : (id as GuideKind))}
        />

        {loading && <p className="guides-muted">{t('list.loading')}</p>}
        {error && <p className="guides-error">{error}</p>}
        {!loading && !error && guides.length === 0 && (
          <p className="guides-muted">{t('list.empty')}</p>
        )}
        <div className="guides-grid">
          {guides.map((g) => (
            <Link
              key={g.id}
              to={pathWithLocale(`/guides/${g.slug}`, locale)}
              className="guides-card"
            >
              <div className="guides-card-tags">
                <span className="guides-tag guides-tag-kind">{t(`kinds.${g.kind}`)}</span>
                {g.topicTags.slice(0, 2).map((tag) => (
                  <span key={tag} className="guides-tag">
                    {tag}
                  </span>
                ))}
              </div>
              <h2>{g.title}</h2>
              <p>{g.summary}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
