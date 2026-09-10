import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';
import { ThemePreferenceChips } from './ThemePreferenceChips';
import { formatDate } from '../lib/format';
import { normalizeLocale } from '../lib/locale';
import i18n from '../lib/i18n';
import { MapView } from './MapView';
import { ReportButton } from './ReportButton';
import { trackEvent } from '../lib/analytics';
import { useAuth } from '../contexts/AuthContext';
import { useIsMobile } from '../hooks/useIsMobile';
import { loadKakaoSdk } from '../lib/kakao';
import { isSupabaseConfigured } from '../lib/supabase';
import { KOREA_REGIONS } from '../lib/koreaRegions';
import type { TripTheme } from '../types';
import {
  cloneTripFromShare,
  getImportedSourceIds,
  listPlazaEntries,
  plazaListingToTrip,
  recordPlazaImport,
  tripsRepo,
  type PlazaListing,
} from '../lib/trips';

const KOREA_CENTER = { lat: 36.38, lng: 127.51 };
const KOREA_MAP_LEVEL = 13;

type PlazaTab = 'board' | 'map';
type DayFilter = 'all' | '1' | '2' | '3' | '4plus';
const DAY_FILTER_VALUES: DayFilter[] = ['all', '1', '2', '3', '4plus'];

function matchesDayFilter(totalDays: number, filter: DayFilter): boolean {
  if (filter === 'all') return true;
  if (filter === '4plus') return totalDays >= 4;
  return totalDays === Number(filter);
}

export function SharePlazaPanel() {
  const { t } = useTranslation('share');
  const { user } = useAuth();
  const locale = normalizeLocale(i18n.language);
  const [sdkReady, setSdkReady] = useState(false);
  const [tab, setTab] = useState<PlazaTab>('board');
  const isMobile = useIsMobile();
  const [localeFilter, setLocaleFilter] = useState<string>('');
  const [themeFilter, setThemeFilter] = useState<TripTheme[]>([]);
  const [dayFilter, setDayFilter] = useState<DayFilter>('all');
  const [regionFilter, setRegionFilter] = useState<string[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [entries, setEntries] = useState<PlazaListing[]>([]);
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [pullingId, setPullingId] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const key = import.meta.env.VITE_KAKAO_JS_KEY;
    if (!key) return;
    loadKakaoSdk(key)
      .then(() => setSdkReady(true))
      .catch(console.error);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [list, imported] = await Promise.all([
        listPlazaEntries(localeFilter || null),
        getImportedSourceIds(user?.id),
      ]);
      setEntries(list);
      setImportedIds(imported);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [user?.id, localeFilter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filteredEntries = useMemo(
    () =>
      entries.filter((e) => {
        if (themeFilter.length > 0 && !themeFilter.some((t) => e.themes.includes(t))) {
          return false;
        }
        if (regionFilter.length > 0 && !regionFilter.some((r) => e.regions.includes(r))) {
          return false;
        }
        return matchesDayFilter(e.totalDays, dayFilter);
      }),
    [entries, themeFilter, dayFilter, regionFilter]
  );

  const activeFilterCount =
    themeFilter.length + regionFilter.length + (dayFilter === 'all' ? 0 : 1);

  // 실제로 등장하는 지역만 보여준다 — 핀 주소가 없어 지역을 못 정한 여행도 많아,
  // 17개를 다 늘어놓으면 대부분 눌러도 결과가 0개인 빈 칩이 된다.
  const availableRegions = useMemo(() => {
    const present = new Set<string>();
    for (const e of entries) for (const r of e.regions) present.add(r);
    return KOREA_REGIONS.filter((r) => present.has(r.code));
  }, [entries]);

  const plazaMarkers = useMemo(
    () =>
      filteredEntries
        .filter((e) => e.center != null)
        .map((e) => ({
          id: e.id,
          lat: e.center!.lat,
          lng: e.center!.lng,
          title: e.title,
        })),
    [filteredEntries]
  );

  const handlePull = useCallback(
    async (listing: PlazaListing) => {
      if (importedIds.has(listing.id) || pullingId) return;
      setPullingId(listing.id);
      try {
        const full =
          (await tripsRepo.loadBySlug(listing.slug)) ?? plazaListingToTrip(listing);
        const cloned = cloneTripFromShare(full, user?.id ?? undefined);
        await tripsRepo.save(cloned);
        await recordPlazaImport(listing.id, cloned.id, user?.id);
        setImportedIds((prev) => new Set([...prev, listing.id]));
        trackEvent('plaza_import', { sourceTripId: listing.id });
        setToast(t('plaza.importedToast', { title: listing.title }));
        setTimeout(() => setToast(null), 3500);
      } catch (e) {
        console.error(e);
        setToast(t('plaza.importFailed'));
        setTimeout(() => setToast(null), 3500);
      } finally {
        setPullingId(null);
      }
    },
    [importedIds, pullingId, user?.id, t]
  );

  const toggleRegion = useCallback((code: string) => {
    setRegionFilter((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  }, []);

  const filterFields: ReactNode = (
    <>
      <ThemePreferenceChips selected={themeFilter} onChange={setThemeFilter} />

      <div className="plaza-day-filter">
        <span className="theme-chips-label">{t('plaza.dayFilterLabel')}</span>
        <div className="theme-chips-row" role="group" aria-label={t('plaza.dayFilterLabel')}>
          {DAY_FILTER_VALUES.map((value) => (
            <button
              key={value}
              type="button"
              className={`theme-chip ${dayFilter === value ? 'active' : ''}`}
              aria-pressed={dayFilter === value}
              onClick={() => setDayFilter(value)}
            >
              {t(`plaza.day.${value}`)}
            </button>
          ))}
        </div>
      </div>

      {availableRegions.length > 0 && (
        <div className="plaza-day-filter">
          <span className="theme-chips-label">{t('plaza.regionFilterLabel')}</span>
          <div className="theme-chips-row" role="group" aria-label={t('plaza.regionFilterLabel')}>
            {availableRegions.map((region) => {
              const active = regionFilter.includes(region.code);
              return (
                <button
                  key={region.code}
                  type="button"
                  className={`theme-chip ${active ? 'active' : ''}`}
                  aria-pressed={active}
                  onClick={() => toggleRegion(region.code)}
                >
                  {t(region.labelKey)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <label className="plaza-locale-filter">
        <span>{t('plaza.filterLocale')}</span>
        <select
          value={localeFilter}
          onChange={(e) => setLocaleFilter(e.target.value)}
          aria-label={t('plaza.filterLocale')}
        >
          <option value="">{t('plaza.localeAll')}</option>
          <option value="ko">{t('plaza.localeKo')}</option>
          <option value="en">{t('plaza.localeEn')}</option>
          <option value="ja">{t('plaza.localeJa')}</option>
          <option value="zh-CN">{t('plaza.localeZhCN')}</option>
          <option value="zh-TW">{t('plaza.localeZhTW')}</option>
          <option value="es">{t('plaza.localeEs')}</option>
          <option value="fr">{t('plaza.localeFr')}</option>
          <option value="de">{t('plaza.localeDe')}</option>
          <option value="ru">{t('plaza.localeRu')}</option>
        </select>
      </label>
    </>
  );

  return (
    <div className="plaza-panel">
      {!isSupabaseConfigured && (
        <p className="plaza-local-notice">
          {t('plaza.localNotice')}
        </p>
      )}
      {isMobile ? (
        <>
          <div className="plaza-filter-bar">
            <span className="plaza-filter-summary">
              {activeFilterCount > 0
                ? t('plaza.filterSummaryActive', {
                    count: activeFilterCount,
                    results: filteredEntries.length,
                  })
                : t('plaza.filterSummaryEmpty', { count: entries.length })}
            </span>
            <button
              type="button"
              className={`plaza-filter-icon-btn ${filterOpen ? 'active' : ''}`}
              onClick={() => setFilterOpen((v) => !v)}
              aria-expanded={filterOpen}
              aria-label={t('plaza.filters')}
              title={t('plaza.filters')}
            >
              <Icon name="filter" size={16} />
              {activeFilterCount > 0 && (
                <span className="plaza-filter-badge">{activeFilterCount}</span>
              )}
            </button>
          </div>

          {filterOpen && <div className="plaza-filter-panel">{filterFields}</div>}
        </>
      ) : (
        <div className="plaza-filter-panel">
          {filterFields}
          <span className="plaza-filter-panel-count">
            {activeFilterCount > 0
              ? t('plaza.filterSummaryActive', {
                  count: activeFilterCount,
                  results: filteredEntries.length,
                })
              : t('plaza.filterSummaryEmpty', { count: entries.length })}
          </span>
        </div>
      )}

      <div className="plaza-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'board'}
          className={`plaza-tab${tab === 'board' ? ' active' : ''}`}
          onClick={() => setTab('board')}
        >
          {t('plaza.board')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'map'}
          className={`plaza-tab${tab === 'map' ? ' active' : ''}`}
          onClick={() => setTab('map')}
        >
          {t('plaza.map')}
        </button>
      </div>

      {tab === 'board' && (
        <section className="plaza-board" aria-label={t('plaza.boardAria')}>
          {loading && <p className="plaza-status">{t('plaza.loading')}</p>}
          {!loading && entries.length === 0 && (
            <p className="plaza-empty">{t('plaza.empty')}</p>
          )}
          {!loading && entries.length > 0 && filteredEntries.length === 0 && (
            <p className="plaza-empty">{t('plaza.filterEmpty')}</p>
          )}
          {!loading &&
            filteredEntries.map((entry) => {
              const pulled = importedIds.has(entry.id);
              const isPulling = pullingId === entry.id;
              return (
                <article key={entry.id} id={`plaza-row-${entry.id}`} className="plaza-board-row">
                  <div className="plaza-board-meta">
                    {/* F04(모바일 감사 보고서) — 작성자 이메일 원문을 비로그인
                        방문자에게도 그대로 보여주고 있었다. 클릭도 안 되는
                        평문이라 얻는 기능은 없이 스팸 수집 위험만 있어 아예
                        없앴다(트립 데이터 자체가 안 실려 오도록 PLAZA_LIST_SELECT
                        에서도 뺐다). 작성자 표시는 별명 하나로 충분하다. */}
                    <span className="plaza-board-author">
                      {entry.displayName?.trim() || t('plaza.anonymous')}
                    </span>
                    <time
                      className="plaza-board-date"
                      dateTime={new Date(entry.listedAt).toISOString()}
                    >
                      {formatDate(
                        entry.listedAt,
                        {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        },
                        locale
                      )}
                    </time>
                  </div>
                  <h2 className="plaza-board-trip-title">{entry.title}</h2>
                  <p className="plaza-board-summary">{entry.pinSummary}</p>
                  <div className="plaza-board-actions">
                    <Link to={`/trip/${entry.slug}`} className="plaza-board-link">
                      {t('plaza.viewDetail')}
                    </Link>
                    {pulled ? (
                      <span className="plaza-pulled-badge" title={t('plaza.alreadyImported')}>
                        <Icon name="check" /> {t('plaza.imported')}
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="plaza-pull-btn"
                        title={t('plaza.import')}
                        disabled={isPulling}
                        onClick={() => void handlePull(entry)}
                      >
                        <Icon name="download" />
                        {isPulling ? t('plaza.importing') : t('plaza.import')}
                      </button>
                    )}
                    <ReportButton
                      target={{
                        type: 'plaza_listing',
                        id: entry.id,
                        label: entry.title,
                        url: `${window.location.origin}/trip/${entry.slug}`,
                      }}
                      compact
                    />
                  </div>
                </article>
              );
            })}
        </section>
      )}

      {tab === 'map' && (
        <section className="plaza-map-section" aria-label={t('plaza.mapAria')}>
          <div className="plaza-map-wrap">
            {sdkReady ? (
              <MapView
                mapsReady={sdkReady}
                center={KOREA_CENTER}
                level={KOREA_MAP_LEVEL}
                searchResults={[]}
                pinned={[]}
                plazaMarkers={plazaMarkers}
                highlightPlazaId={highlightId}
                onPlazaMarkerClick={(id) => {
                  setHighlightId(id);
                  const entry = entries.find((e) => e.id === id);
                  if (entry) {
                    setTab('board');
                    requestAnimationFrame(() => {
                      document
                        .getElementById(`plaza-row-${id}`)
                        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    });
                  }
                }}
              />
            ) : (
              <p className="plaza-status">{t('plaza.mapLoading')}</p>
            )}
          </div>
          {plazaMarkers.length === 0 && !loading && (
            <p className="plaza-map-empty">
              {t('plaza.mapEmpty')}
            </p>
          )}
        </section>
      )}

      {toast && (
        <div className="plaza-toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
