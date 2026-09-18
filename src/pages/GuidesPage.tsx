import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SiteHeader } from '../components/SiteHeader';
import { SegmentedTabs } from '../components/SegmentedTabs';
import { useSeoMeta } from '../hooks/useSeoMeta';
import { useLandingNoticeTexts } from '../hooks/useLandingNoticeTexts';
import { GUIDE_KINDS, type GuideKind } from '../lib/guideKinds';
import { CourseTaxonomyChips } from '../components/CourseTaxonomyChips';
import {
  displayCourseTags,
  guideMatchesCourseFilters,
  inferCourseTaxonomyTags,
  resolveCourseTag,
} from '../lib/courseGuideTaxonomy';
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
  const [courseFilters, setCourseFilters] = useState<string[]>([]);
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
        const rows = await listPublishedGuides(
          kindFilter === 'course' || courseFilters.length > 0 ? 80 : 48,
          kindFilter || undefined
        );
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
  }, [t, kindFilter, courseFilters.length]);

  const kindChips = useMemo(
    () => [{ id: '' as const, label: t('kinds.all') }, ...GUIDE_KINDS.map((k) => ({ id: k, label: t(`kinds.${k}`) }))],
    [t]
  );

  const showCourseFilters = kindFilter === '' || kindFilter === 'course';

  const availableTagIds = useMemo(() => {
    const ids = new Set<string>();
    for (const g of guides) {
      if (g.kind !== 'course' && kindFilter === 'course') continue;
      for (const raw of g.topicTags) {
        const tag = resolveCourseTag(raw);
        if (tag) ids.add(tag.id);
      }
      for (const id of inferCourseTaxonomyTags([g.title, g.summary, ...g.topicTags], 16)) {
        ids.add(id);
      }
    }
    return [...ids];
  }, [guides, kindFilter]);

  const visibleGuides = useMemo(
    () =>
      guides.filter((g) =>
        guideMatchesCourseFilters(g.topicTags, g.title, g.summary, courseFilters)
      ),
    [guides, courseFilters]
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
          onChange={(id) => {
            const next = id === 'all' ? '' : (id as GuideKind);
            setKindFilter(next);
            if (next && next !== 'course') setCourseFilters([]);
          }}
        />

        {showCourseFilters && (
          <CourseTaxonomyChips
            mode="filter"
            selected={courseFilters}
            onChange={setCourseFilters}
            availableIds={availableTagIds}
            locale={locale}
          />
        )}

        {loading && <p className="guides-muted">{t('list.loading')}</p>}
        {error && <p className="guides-error">{error}</p>}
        {!loading && !error && visibleGuides.length === 0 && (
          <p className="guides-muted">{t('list.empty')}</p>
        )}
        <div className="guides-grid">
          {visibleGuides.map((g) => (
            <Link
              key={g.id}
              to={pathWithLocale(`/guides/${g.slug}`, locale)}
              className="guides-card"
            >
              <div className="guides-card-tags">
                <span className="guides-tag guides-tag-kind">{t(`kinds.${g.kind}`)}</span>
                {displayCourseTags(g.topicTags, locale, 3).map((tag) => (
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
