import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';
import { trackEvent } from '../lib/analytics';
import { normalizeLocale, pathWithLocale } from '../lib/locale';
import { plannerPath } from '../lib/routes';
import { loadSiteSearchIndex, searchSiteIndex, type SiteSearchIndex } from '../lib/siteSearch';
import i18n from '../lib/i18n';

type ResultKind = 'guide' | 'plaza' | 'planner';

interface ResultRow {
  kind: ResultKind;
  key: string;
  href: string;
  title: string;
  meta: string;
}

interface SiteSearchProps {
  className?: string;
  /** 결과로 이동한 뒤(모바일 메뉴 닫기 등) */
  onNavigate?: () => void;
  /** 좁은 데스크톱 헤더용 — 돋보기 버튼으로 접어 두고 누르면 펼친다(버튼 표시 여부는 CSS가 정한다) */
  collapsible?: boolean;
}

/**
 * 공개 페이지 상단 통합검색 — 여행 팁·공유마당 코스는 바로 결과로,
 * 장소는 플래너 검색으로 넘긴다(lib/siteSearch.ts 주석).
 */
export function SiteSearch({ className = '', onNavigate, collapsible = false }: SiteSearchProps) {
  const { t } = useTranslation(['landing', 'guides']);
  const navigate = useNavigate();
  const locale = normalizeLocale(i18n.language);
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState<SiteSearchIndex | null>(null);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [expanded, setExpanded] = useState(false);

  const ensureIndex = () => {
    if (index || loading) return;
    setLoading(true);
    loadSiteSearchIndex(locale)
      .then(setIndex)
      .finally(() => setLoading(false));
  };

  // 언어를 바꾸면 그 언어 제목으로 다시 받는다
  useEffect(() => {
    setIndex(null);
  }, [locale]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setExpanded(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    if (expanded) inputRef.current?.focus();
  }, [expanded]);

  const trimmed = query.trim();

  const rows = useMemo<ResultRow[]>(() => {
    if (!trimmed) return [];
    const found = index ? searchSiteIndex(index, trimmed) : { guides: [], plaza: [] };
    const out: ResultRow[] = [
      ...found.guides.map((g) => ({
        kind: 'guide' as const,
        key: `g:${g.slug}`,
        href: pathWithLocale(`/guides/${g.slug}`, locale),
        title: g.title,
        meta: t(`guides:kinds.${g.kind}`, { defaultValue: '' }),
      })),
      ...found.plaza.map((p) => ({
        kind: 'plaza' as const,
        key: `p:${p.slug}`,
        href: pathWithLocale(`/trip/${p.slug}`, locale),
        title: p.title,
        meta: [t('landing:search.days', { count: p.totalDays }), p.pinSummary].filter(Boolean).join(' · '),
      })),
    ];
    out.push({
      kind: 'planner',
      key: 'planner',
      href: `${plannerPath(locale)}?searchKeyword=${encodeURIComponent(trimmed)}`,
      title: t('landing:search.inPlanner', { q: trimmed }),
      meta: t('landing:search.inPlannerHint'),
    });
    return out;
  }, [index, trimmed, locale, t]);

  useEffect(() => {
    setActive(0);
  }, [trimmed, index]);

  const go = (row: ResultRow) => {
    trackEvent('site_search_select', { type: row.kind, chars: trimmed.length });
    setOpen(false);
    setExpanded(false);
    setQuery('');
    inputRef.current?.blur();
    onNavigate?.();
    navigate(row.href);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setOpen(false);
      setExpanded(false);
      return;
    }
    if (!rows.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % rows.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i - 1 + rows.length) % rows.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const row = rows[active] ?? rows[rows.length - 1];
      if (row) go(row);
    }
  };

  const showPanel = open && trimmed.length > 0;
  const guideRows = rows.filter((r) => r.kind === 'guide');
  const plazaRows = rows.filter((r) => r.kind === 'plaza');
  const plannerRow = rows.find((r) => r.kind === 'planner');
  const nothingFound = index !== null && guideRows.length === 0 && plazaRows.length === 0;

  const renderRow = (row: ResultRow) => {
    const i = rows.indexOf(row);
    return (
      <li
        key={row.key}
        id={`${listId}-${i}`}
        role="option"
        aria-selected={i === active}
        className={`site-search-row site-search-row-${row.kind}${i === active ? ' is-active' : ''}`}
        onMouseDown={(e) => e.preventDefault()}
        onMouseEnter={() => setActive(i)}
        onClick={() => go(row)}
      >
        {row.kind === 'planner' && <Icon name="mapPin" size={16} className="site-search-row-icon" />}
        <span className="site-search-row-text">
          <span className="site-search-row-title">{row.title}</span>
          {row.meta ? <span className="site-search-row-meta">{row.meta}</span> : null}
        </span>
      </li>
    );
  };

  return (
    <div
      ref={rootRef}
      className={['site-search', className, collapsible ? 'is-collapsible' : '', expanded ? 'is-expanded' : '']
        .filter(Boolean)
        .join(' ')}
    >
      {collapsible && (
        <button
          type="button"
          className="site-search-toggle"
          aria-label={t('landing:search.label')}
          aria-expanded={expanded}
          onClick={() => {
            setExpanded((v) => !v);
            ensureIndex();
          }}
        >
          <Icon name={expanded ? 'close' : 'search'} size={18} />
        </button>
      )}
      <div className="site-search-field">
        <Icon name="search" size={16} className="site-search-icon" />
        <input
          ref={inputRef}
          type="search"
          className="site-search-input"
          value={query}
          placeholder={t('landing:search.placeholder')}
          aria-label={t('landing:search.label')}
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showPanel && rows.length ? `${listId}-${active}` : undefined}
          enterKeyHint="search"
          onFocus={() => {
            ensureIndex();
            setOpen(true);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            ensureIndex();
          }}
          onKeyDown={onKeyDown}
        />
      </div>
      {showPanel && (
        <div className="site-search-panel">
          <ul id={listId} role="listbox" aria-label={t('landing:search.label')} className="site-search-list">
            {guideRows.length > 0 && (
              <li role="presentation" className="site-search-group">
                {t('landing:search.groupGuides')}
              </li>
            )}
            {guideRows.map(renderRow)}
            {plazaRows.length > 0 && (
              <li role="presentation" className="site-search-group">
                {t('landing:search.groupPlaza')}
              </li>
            )}
            {plazaRows.map(renderRow)}
            {loading && !index && (
              <li role="presentation" className="site-search-status">
                {t('landing:search.loading')}
              </li>
            )}
            {nothingFound && (
              <li role="presentation" className="site-search-status">
                {t('landing:search.empty')}
              </li>
            )}
            {plannerRow && renderRow(plannerRow)}
          </ul>
        </div>
      )}
    </div>
  );
}
