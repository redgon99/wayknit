import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SiteHeader } from '../components/SiteHeader';
import { SegmentedTabs } from '../components/SegmentedTabs';
import { ShareIcon } from '../components/ShareIcon';
import { shareLink } from '../lib/shareLink';
import { useSeoMeta } from '../hooks/useSeoMeta';
import { GUIDE_KINDS, type GuideKind } from '../lib/guideKinds';
import { CourseTaxonomyChips } from '../components/CourseTaxonomyChips';
import {
  displayCourseTags,
  getCourseTaxonomyTag,
  guideMatchesCourseFilters,
  inferCourseTaxonomyTags,
  resolveCourseTag,
} from '../lib/courseGuideTaxonomy';
import { normalizeLocale, pathWithLocale } from '../lib/locale';
import i18n from '../lib/i18n';
import { isGuidesConfigured, listPublishedGuideCards, pickGuideContent, plainGuideSummary } from '../lib/guides';
import type { GuideArticle } from '../types/guides';
import '../styles/app.css';

export default function GuidesPage() {
  const { t } = useTranslation('guides');
  const locale = normalizeLocale(i18n.language);
  const [guides, setGuides] = useState<GuideArticle[]>([]);
  // 개편 2단계(2026-11-21): 메뉴「추천 코스」가 /guides?kind=course로 들어온다 — 종류 필터는 주소가 기준
  const [searchParams, setSearchParams] = useSearchParams();
  const kindParam = searchParams.get('kind');
  const kindFilter: GuideKind | '' = (GUIDE_KINDS as readonly string[]).includes(kindParam ?? '')
    ? (kindParam as GuideKind)
    : '';
  const setKindFilter = (next: GuideKind | '') =>
    setSearchParams(next ? { kind: next } : {}, { replace: true });
  // 랜딩 "추천 코스에서 시작"의 지역 칩이 ?kind=course&tag=<지역 id>로 들어온다(개편 3단계)
  const [courseFilters, setCourseFilters] = useState<string[]>(() => {
    const tag = searchParams.get('tag');
    return tag && getCourseTaxonomyTag(tag) ? [tag] : [];
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copiedTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(copiedTimer.current), []);

  const shareGuide = async (id: string, title: string, path: string) => {
    const result = await shareLink(title, `${window.location.origin}${path}`, t('list.shareLabel'));
    if (result !== 'copied') return;
    setCopiedId(id);
    window.clearTimeout(copiedTimer.current);
    copiedTimer.current = window.setTimeout(() => setCopiedId(null), 1800);
  };

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
        // 2026-11-25 — 태그 필터가 최신 80편 안에서만 찾던 문제: 카드용 가벼운 목록으로 공개 글 전부를 받는다
        const rows = await listPublishedGuideCards(kindFilter || undefined);
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

  // 필터가 없을 때는 예전처럼 최신 48편(추천 코스는 80편)만 보여 주고, 필터를 고르면 맞는 글을 모두 보여 준다
  const visibleGuides = useMemo(() => {
    if (courseFilters.length === 0) return guides.slice(0, kindFilter === 'course' ? 80 : 48);
    return guides.filter((g) =>
      guideMatchesCourseFilters(g.topicTags, g.title, g.summary, courseFilters)
    );
  }, [guides, courseFilters, kindFilter]);

  return (
    <main className="guides-page">
      <SiteHeader active={kindFilter === 'course' ? 'courses' : 'info'} />

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
          {visibleGuides.map((g) => {
            /* 다국어 통합(2026-09-20) — 이 가이드에 방문자 언어 버전이
               있으면 카드도 그 언어로 보여준다(scenario_catalog와 같은
               방식). 없으면 대표 언어 그대로. */
            const content = pickGuideContent(g, locale);
            const path = pathWithLocale(`/guides/${g.slug}`, locale);
            return (
              <div key={g.id} className="guides-card-wrap">
              <Link to={path} className="guides-card">
                <div className="guides-card-tags">
                  <span className="guides-tag guides-tag-kind">{t(`kinds.${g.kind}`)}</span>
                  {displayCourseTags(g.topicTags, locale, 3).map((tag) => (
                    <span key={tag} className="guides-tag">
                      {tag}
                    </span>
                  ))}
                </div>
                <h2>{content.title}</h2>
                <p>{plainGuideSummary(content.summary)}</p>
              </Link>
              <button
                type="button"
                className="guides-card-share"
                aria-label={`${t('list.shareLabel')}: ${content.title}`}
                title={t('list.shareLabel')}
                onClick={() => void shareGuide(g.id, content.title, path)}
              >
                <ShareIcon />
              </button>
              {copiedId === g.id && (
                <span className="guides-card-copied" role="status">
                  {t('list.shareCopied')}
                </span>
              )}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
