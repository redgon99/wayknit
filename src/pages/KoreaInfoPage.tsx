import { useEffect, useState, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { SiteHeader } from '../components/SiteHeader';
import { SegmentedTabs } from '../components/SegmentedTabs';
import { TrailRouteModal } from '../components/TrailRouteModal';
import { OdiiStoriesModal } from '../components/OdiiStoriesModal';
import { Icon } from '../components/Icon';
import { useSeoMeta } from '../hooks/useSeoMeta';
import { useLandingNoticeTexts } from '../hooks/useLandingNoticeTexts';
import { normalizeLocale, type AppLocale } from '../lib/locale';
import { plannerPath } from '../lib/routes';
import i18n from '../lib/i18n';
import {
  fetchDataLabRegions,
  fetchFilteredPlaces,
  fetchOdiiSites,
  fetchTourPhotos,
  fetchTourTrails,
  isTourInfoConfigured,
  PHOTO_GALLERY_THEMES,
  TOUR_CONTENT_TYPE_IDS,
  type DataLabLevel,
  type DataLabRegion,
  type MultilingualLocale,
  type OdiiSite,
  type PlaceListKind,
  type TourContentTypeId,
  type TourFilteredPlace,
  type TourPhoto,
  type TourTrailCourse,
} from '../lib/tourInfo';
import '../styles/app.css';

type InfoTab = 'photos' | 'trails' | 'audio' | 'stats' | 'pet' | 'with';

/** ko는 오버레이 대상이 아니라 서버에 아예 안 보낸다(원문 그대로).
 *  TourAPI는 간체(Chs)만 있어 zh-CN/zh-TW 모두 zh로 매핑한다. */
function toMultilingualLocale(locale: string): MultilingualLocale | undefined {
  if (locale === 'zh-CN' || locale === 'zh-TW' || locale === 'zh') return 'zh';
  return locale === 'en' || locale === 'ja' || locale === 'es' ||
    locale === 'fr' || locale === 'de' || locale === 'ru'
    ? locale
    : undefined;
}

function ymdInputDefault(): string {
  // DataLab 집계는 최신 데이터까지 약 한 달의 시차가 있어 35일 전을 기본값으로 둔다.
  const d = new Date();
  d.setDate(d.getDate() - 35);
  return d.toISOString().slice(0, 10);
}

function formatNumber(n: number): string {
  return Math.round(n).toLocaleString('ko-KR');
}

/** 다국어 주소 오버레이를 마지막으로 확인(캐시 갱신)한 시점을 "N일 전 확인"으로 표시 */
function checkedLabel(t: (key: string, options?: Record<string, unknown>) => string, fetchedAt: string): string {
  const days = Math.max(0, Math.floor((Date.now() - new Date(fetchedAt).getTime()) / (24 * 60 * 60 * 1000)));
  return days === 0 ? t('list.checkedToday') : t('list.checkedDaysAgo', { days });
}

const LEVEL_LABEL_KEY: Record<'1' | '2' | '3', string> = {
  '1': 'trails.levelLow',
  '2': 'trails.levelMid',
  '3': 'trails.levelHigh',
};

/**
 * 두루누비 courseList는 brdDiv(걷기/자전거) 필터가 실효가 없고, 자체는 100% 걷기길인
 * 코리아둘레길 4개 브랜드로만 구성되어 있다(서해랑길/해파랑길/남파랑길/DMZ 평화의 길).
 * 이 4개는 서버 필터가 아니라 코스명 접두어로 클라이언트에서 구분한다.
 */
const TRAIL_BRANDS = ['해파랑길', '남파랑길', '서해랑길', 'DMZ 평화의 길'] as const;

function trailBrandOf(name: string): string | null {
  return TRAIL_BRANDS.find((b) => name.startsWith(b)) ?? null;
}

function formatMonth(month: string | undefined): string | null {
  if (!month || month.length !== 6) return null;
  return `${month.slice(0, 4)}.${month.slice(4, 6)}`;
}

function formatHours(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h <= 0) return `${m}${m ? 'm' : ''}`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/**
 * 해외 관광객이 택시기사·지도앱에 그대로 보여줄 수 있도록 TourAPI 원문(한국어) 주소를
 * 복사하는 버튼. 다국어 UI여도 이 카드들의 address/region 필드는 항상 한국어
 * 원문이라(다국어 TourAPI 미연동 상태) 번역 텍스트가 아니라 원문 그대로를 복사해 준다.
 */
function CopyAddressButton({ text }: { text: string }) {
  const { t } = useTranslation('korInfo');
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  };

  return (
    <button
      type="button"
      className="place-detail-copy-btn info-copy-btn"
      onClick={(e) => void handleCopy(e)}
      aria-label={t('list.copyAria')}
    >
      {copied ? t('list.copied') : t('list.copyAddress')}
    </button>
  );
}

/** 반려동물 동반여행(KorPetTourService2)/무장애여행(KorWithService2) — 검색 가능한 목록 브라우징 */
function FilteredPlaceSection({
  kind,
  contentTypeId,
  locale,
}: {
  kind: PlaceListKind;
  contentTypeId: TourContentTypeId | '';
  locale?: MultilingualLocale;
}) {
  const { t } = useTranslation('korInfo');
  const [keyword, setKeyword] = useState('');
  const [places, setPlaces] = useState<TourFilteredPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isTourInfoConfigured()) {
      setLoading(false);
      setError(t('errors.notConfigured'));
      return;
    }
    let alive = true;
    setLoading(true);
    setError(null);
    const timer = setTimeout(() => {
      fetchFilteredPlaces(kind, {
        keyword,
        contentTypeId: contentTypeId || undefined,
        numOfRows: 24,
        locale,
      })
        .then(({ items }) => {
          if (alive) setPlaces(items);
        })
        .catch((e) => {
          if (alive) setError(e instanceof Error ? e.message : t('errors.loadFailed'));
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
    }, 300);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [kind, keyword, contentTypeId, locale, t]);

  return (
    <section>
      <input
        type="search"
        className="info-search-input"
        placeholder={t(`${kind}.searchPlaceholder`)}
        value={keyword}
        onChange={(e) => setKeyword(e.currentTarget.value)}
      />
      {loading && <p className="guides-muted">{t('list.loading')}</p>}
      {error && <p className="guides-error">{error}</p>}
      {!loading && !error && places.length === 0 && <p className="guides-muted">{t('list.empty')}</p>}
      <div className="info-photo-grid">
        {places.map((p) => (
          <figure key={p.contentId} className="info-photo-card">
            {p.thumbnailUrl ? (
              <img src={p.thumbnailUrl} alt={p.title} loading="lazy" />
            ) : (
              <div className="info-photo-card-noimg" aria-hidden />
            )}
            <figcaption>
              <strong>{p.title}</strong>
              {p.address && (
                <span className="info-address-row">
                  <span>{p.officialAddress ?? p.address}</span>
                  <CopyAddressButton text={p.address} />
                </span>
              )}
              {p.officialAddress && p.officialAddressFetchedAt && (
                <span className="info-checked-badge">
                  {checkedLabel(t, p.officialAddressFetchedAt)}
                </span>
              )}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

/** 관광사진 고화질 보기 + 동선짜기 검색 연결 */
function PhotoLightbox({
  photos,
  index,
  locale,
  onClose,
  onNavigate,
}: {
  photos: TourPhoto[];
  index: number;
  locale: AppLocale;
  onClose: () => void;
  onNavigate: (index: number) => void;
}) {
  const { t } = useTranslation('korInfo');
  const photo = photos[index];
  const hasPrev = index > 0;
  const hasNext = index < photos.length - 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft' && index > 0) onNavigate(index - 1);
      else if (e.key === 'ArrowRight' && index < photos.length - 1) onNavigate(index + 1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [index, photos.length, onClose, onNavigate]);

  if (!photo) return null;

  const searchHref = `${plannerPath(locale)}?searchKeyword=${encodeURIComponent(photo.title)}`;

  return (
    <div className="modal-backdrop photo-lightbox-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className="modal-card photo-lightbox-card"
        onClick={(e: MouseEvent) => e.stopPropagation()}
      >
        <button type="button" className="modal-close" onClick={onClose} aria-label={t('photos.close')}>
          <Icon name="close" />
        </button>
        {hasPrev && (
          <button
            type="button"
            className="photo-lightbox-nav photo-lightbox-prev"
            onClick={() => onNavigate(index - 1)}
            aria-label={t('photos.prev')}
          >
            <Icon name="chevronLeft" />
          </button>
        )}
        {hasNext && (
          <button
            type="button"
            className="photo-lightbox-nav photo-lightbox-next"
            onClick={() => onNavigate(index + 1)}
            aria-label={t('photos.next')}
          >
            <Icon name="chevronRight" />
          </button>
        )}
        <img src={photo.imageUrl} alt={photo.title} className="photo-lightbox-img" />
        <div className="photo-lightbox-caption">
          <strong>{photo.title}</strong>
          <span>{[photo.location, formatMonth(photo.month)].filter(Boolean).join(' · ')}</span>
          {photo.photographer && (
            <span className="place-detail-muted">
              {t('photos.photographer', { name: photo.photographer })}
            </span>
          )}
          <Link to={searchHref} className="landing-btn landing-btn-primary photo-lightbox-search-btn">
            <Icon name="search" size={16} /> {t('photos.searchThisPlace')}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function KoreaInfoPage() {
  const { t } = useTranslation('korInfo');
  const locale = normalizeLocale(i18n.language);
  const multilingualLocale = toMultilingualLocale(locale);
  const noticeTexts = useLandingNoticeTexts();

  const [tab, setTab] = useState<InfoTab>('photos');
  const [placeTypeId, setPlaceTypeId] = useState<TourContentTypeId | ''>('');

  const [photoKeyword, setPhotoKeyword] = useState('');
  const [photos, setPhotos] = useState<TourPhoto[]>([]);
  const [photosLoading, setPhotosLoading] = useState(true);
  const [photosError, setPhotosError] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const [trailKeyword, setTrailKeyword] = useState('');
  const [trailBrand, setTrailBrand] = useState<string>('');
  const [trailLevel, setTrailLevel] = useState<'1' | '2' | '3' | ''>('');
  const [trails, setTrails] = useState<TourTrailCourse[]>([]);
  const [trailsLoading, setTrailsLoading] = useState(true);
  const [trailsError, setTrailsError] = useState<string | null>(null);
  const [routeModalCourse, setRouteModalCourse] = useState<TourTrailCourse | null>(null);

  const [audioKeyword, setAudioKeyword] = useState('');
  const [audioSites, setAudioSites] = useState<OdiiSite[]>([]);
  const [audioLoading, setAudioLoading] = useState(true);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [storyModalSite, setStoryModalSite] = useState<OdiiSite | null>(null);

  const [statsLevel, setStatsLevel] = useState<DataLabLevel>('metco');
  const [statsDate, setStatsDate] = useState(ymdInputDefault);
  const [statsKeyword, setStatsKeyword] = useState('');
  const [statsRegions, setStatsRegions] = useState<DataLabRegion[]>([]);
  const [statsBaseYmd, setStatsBaseYmd] = useState<string | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  useSeoMeta({ title: t('metaTitle'), description: t('subtitle'), path: '/info' });

  useEffect(() => {
    if (!isTourInfoConfigured()) {
      setPhotosLoading(false);
      setPhotosError(t('errors.notConfigured'));
      return;
    }
    let alive = true;
    setPhotosLoading(true);
    setPhotosError(null);
    setLightboxIndex(null);
    const timer = setTimeout(() => {
      fetchTourPhotos({ keyword: photoKeyword, numOfRows: 24 })
        .then(({ items }) => {
          if (alive) setPhotos(items);
        })
        .catch((e) => {
          if (alive) setPhotosError(e instanceof Error ? e.message : t('errors.loadFailed'));
        })
        .finally(() => {
          if (alive) setPhotosLoading(false);
        });
    }, 300);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [photoKeyword, t]);

  useEffect(() => {
    if (!isTourInfoConfigured()) {
      setTrailsLoading(false);
      setTrailsError(t('errors.notConfigured'));
      return;
    }
    let alive = true;
    setTrailsLoading(true);
    setTrailsError(null);
    const timer = setTimeout(() => {
      // 필터 없는 전체 코스 수 자체가 144건뿐이라 페이지네이션 없이 한 번에 받아온다.
      fetchTourTrails({
        keyword: trailKeyword,
        level: trailLevel || undefined,
        numOfRows: 150,
      })
        .then(({ items }) => {
          if (alive) setTrails(items);
        })
        .catch((e) => {
          if (alive) setTrailsError(e instanceof Error ? e.message : t('errors.loadFailed'));
        })
        .finally(() => {
          if (alive) setTrailsLoading(false);
        });
    }, 300);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [trailKeyword, trailLevel, t]);

  const visibleTrails = trailBrand ? trails.filter((c) => c.name.startsWith(trailBrand)) : trails;

  useEffect(() => {
    if (!isTourInfoConfigured()) {
      setAudioLoading(false);
      setAudioError(t('errors.notConfigured'));
      return;
    }
    let alive = true;
    setAudioLoading(true);
    setAudioError(null);
    const timer = setTimeout(() => {
      fetchOdiiSites({ keyword: audioKeyword, numOfRows: 24, locale: multilingualLocale })
        .then(({ items }) => {
          if (alive) setAudioSites(items);
        })
        .catch((e) => {
          if (alive) setAudioError(e instanceof Error ? e.message : t('errors.loadFailed'));
        })
        .finally(() => {
          if (alive) setAudioLoading(false);
        });
    }, 300);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [audioKeyword, multilingualLocale, t]);

  useEffect(() => {
    if (!isTourInfoConfigured()) {
      setStatsLoading(false);
      setStatsError(t('errors.notConfigured'));
      return;
    }
    const ymd = statsDate.replace(/-/g, '');
    if (!/^\d{8}$/.test(ymd)) return;
    let alive = true;
    setStatsLoading(true);
    setStatsError(null);
    fetchDataLabRegions(statsLevel, ymd)
      .then(({ regions, baseYmd }) => {
        if (alive) {
          setStatsRegions(regions);
          setStatsBaseYmd(baseYmd);
        }
      })
      .catch((e) => {
        if (alive) setStatsError(e instanceof Error ? e.message : t('errors.loadFailed'));
      })
      .finally(() => {
        if (alive) setStatsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [statsLevel, statsDate, t]);

  const visibleStatsRegions = statsKeyword
    ? statsRegions.filter((r) => r.name.includes(statsKeyword))
    : statsRegions;

  return (
    <main className="guides-page">
      <SiteHeader active="info" noticeTexts={noticeTexts} />
      <div className="guides-page-title guides-shell">
        <h1>{t('title')}</h1>
        <p className="guides-lead">{t('subtitle')}</p>
      </div>

      <div className="guides-shell">
        <SegmentedTabs
          ariaLabel={t('tabs.label')}
          items={[
            { id: 'photos', label: t('tabs.photos') },
            { id: 'trails', label: t('tabs.trails') },
            { id: 'audio', label: t('tabs.audio') },
            { id: 'stats', label: t('tabs.stats') },
            { id: 'pet', label: t('tabs.pet') },
            { id: 'with', label: t('tabs.with') },
          ]}
          value={tab}
          onChange={(id) => {
            setTab(id as InfoTab);
            setPlaceTypeId('');
          }}
        />
        <p className="info-tab-desc">{t(`tabs.desc.${tab}`)}</p>

        {tab === 'photos' && (
          <SegmentedTabs
            nested
            size="sm"
            ariaLabel={t('subcats.label')}
            items={[
              { id: '', label: t('kinds.all') },
              ...PHOTO_GALLERY_THEMES.map((theme) => ({ id: theme.keyword, label: t(`photos.themes.${theme.id}`) })),
            ]}
            value={photoKeyword}
            onChange={(id) => setPhotoKeyword(id)}
          />
        )}
        {tab === 'trails' && (
          <SegmentedTabs
            nested
            size="sm"
            ariaLabel={t('subcats.label')}
            items={[{ id: '', label: t('kinds.all') }, ...TRAIL_BRANDS.map((b) => ({ id: b, label: t(`trails.brand.${b}`) }))]}
            value={trailBrand}
            onChange={(id) => setTrailBrand(id)}
          />
        )}
        {tab === 'stats' && (
          <SegmentedTabs
            nested
            size="sm"
            ariaLabel={t('subcats.label')}
            items={[
              { id: 'metco', label: t('stats.level.metco') },
              { id: 'locgo', label: t('stats.level.locgo') },
            ]}
            value={statsLevel}
            onChange={(id) => setStatsLevel(id as DataLabLevel)}
          />
        )}
        {(tab === 'pet' || tab === 'with') && (
          <SegmentedTabs
            nested
            size="sm"
            ariaLabel={t('subcats.label')}
            items={[
              { id: '', label: t('kinds.all') },
              ...TOUR_CONTENT_TYPE_IDS.map((id) => ({ id, label: t(`contentTypes.${id}`) })),
            ]}
            value={placeTypeId}
            onChange={(id) => setPlaceTypeId(id as TourContentTypeId | '')}
          />
        )}

        {tab === 'photos' && (
          <section>
            <input
              type="search"
              className="info-search-input"
              placeholder={t('photos.searchPlaceholder')}
              value={photoKeyword}
              onChange={(e) => setPhotoKeyword(e.currentTarget.value)}
            />
            {photosLoading && <p className="guides-muted">{t('list.loading')}</p>}
            {photosError && <p className="guides-error">{photosError}</p>}
            {!photosLoading && !photosError && photos.length === 0 && (
              <p className="guides-muted">{t('list.empty')}</p>
            )}
            <div className="info-photo-grid">
              {photos.map((p, i) => (
                <figure key={p.contentId} className="info-photo-card">
                  <button
                    type="button"
                    className="info-photo-card-open"
                    onClick={() => setLightboxIndex(i)}
                    aria-label={t('photos.viewLarge')}
                  >
                    <img src={p.imageUrl} alt={p.title} loading="lazy" />
                  </button>
                  <figcaption>
                    <strong>{p.title}</strong>
                    <span>
                      {[p.location, formatMonth(p.month)].filter(Boolean).join(' · ')}
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>
            {lightboxIndex !== null && (
              <PhotoLightbox
                photos={photos}
                index={lightboxIndex}
                locale={locale}
                onClose={() => setLightboxIndex(null)}
                onNavigate={setLightboxIndex}
              />
            )}
          </section>
        )}

        {tab === 'trails' && (
          <section>
            <input
              type="search"
              className="info-search-input"
              placeholder={t('trails.searchPlaceholder')}
              value={trailKeyword}
              onChange={(e) => setTrailKeyword(e.currentTarget.value)}
            />
            <SegmentedTabs
              size="sm"
              ariaLabel={t('trails.levelFilterLabel')}
              items={[
                { id: '', label: t('kinds.all') },
                { id: '1', label: t('trails.levelLow') },
                { id: '2', label: t('trails.levelMid') },
                { id: '3', label: t('trails.levelHigh') },
              ]}
              value={trailLevel}
              onChange={(id) => setTrailLevel(id as '1' | '2' | '3' | '')}
              className="info-trail-level"
            />
            {trailsLoading && <p className="guides-muted">{t('list.loading')}</p>}
            {trailsError && <p className="guides-error">{trailsError}</p>}
            {!trailsLoading && !trailsError && visibleTrails.length === 0 && (
              <p className="guides-muted">{t('list.empty')}</p>
            )}
            <div className="info-trail-list">
              {visibleTrails.map((c) => (
                <article key={c.courseId} className="info-trail-card">
                  <div className="info-trail-card-head">
                    <h2>{c.name}</h2>
                    {trailBrandOf(c.name) && (
                      <span className="guides-tag guides-tag-kind">{t(`trails.brand.${trailBrandOf(c.name)}`)}</span>
                    )}
                  </div>
                  <div className="info-trail-meta">
                    {c.region && <span>{c.region}</span>}
                    <span>{c.distanceKm}km</span>
                    <span>{formatHours(c.totalMinutes)}</span>
                    <span>{t(LEVEL_LABEL_KEY[c.level])}</span>
                    {c.cycle && <span>{c.cycle}</span>}
                  </div>
                  {c.summary && <p className="info-trail-summary">{c.summary}</p>}
                  {c.gpxUrl && (
                    <button type="button" className="guides-btn" onClick={() => setRouteModalCourse(c)}>
                      {t('trails.viewRoute')}
                    </button>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}
        {tab === 'audio' && (
          <section>
            <input
              type="search"
              className="info-search-input"
              placeholder={t('audio.searchPlaceholder')}
              value={audioKeyword}
              onChange={(e) => setAudioKeyword(e.currentTarget.value)}
            />
            {audioLoading && <p className="guides-muted">{t('list.loading')}</p>}
            {audioError && <p className="guides-error">{audioError}</p>}
            {!audioLoading && !audioError && audioSites.length === 0 && (
              <p className="guides-muted">{t('list.empty')}</p>
            )}
            <div className="info-photo-grid">
              {audioSites.map((s) => (
                <figure
                  key={`${s.tid}-${s.tlid}`}
                  className="info-photo-card odii-site-card"
                  onClick={() => setStoryModalSite(s)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') setStoryModalSite(s);
                  }}
                >
                  {s.imageUrl ? (
                    <img src={s.imageUrl} alt={s.title} loading="lazy" />
                  ) : (
                    <div className="info-photo-card-noimg" aria-hidden />
                  )}
                  <figcaption>
                    <strong>{s.title}</strong>
                    <span className="info-address-row">
                      <span>{[s.officialAddress ?? s.region, s.themeCategory].filter(Boolean).join(' · ')}</span>
                      {s.region && <CopyAddressButton text={s.region} />}
                    </span>
                    {s.officialAddress && s.officialAddressFetchedAt && (
                      <span className="info-checked-badge">
                        {checkedLabel(t, s.officialAddressFetchedAt)}
                      </span>
                    )}
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}
        {tab === 'stats' && (
          <section>
            <div className="info-stats-controls">
              <input
                type="date"
                className="info-search-input"
                value={statsDate}
                max={ymdInputDefault()}
                onChange={(e) => setStatsDate(e.currentTarget.value)}
              />
              <input
                type="search"
                className="info-search-input"
                placeholder={t('stats.searchPlaceholder')}
                value={statsKeyword}
                onChange={(e) => setStatsKeyword(e.currentTarget.value)}
              />
            </div>
            {statsBaseYmd && (
              <p className="guides-muted">
                {t('stats.baseYmd', {
                  date: `${statsBaseYmd.slice(0, 4)}.${statsBaseYmd.slice(4, 6)}.${statsBaseYmd.slice(6, 8)}`,
                })}
              </p>
            )}
            {statsLoading && <p className="guides-muted">{t('list.loading')}</p>}
            {statsError && <p className="guides-error">{statsError}</p>}
            {!statsLoading && !statsError && visibleStatsRegions.length === 0 && (
              <p className="guides-muted">{t('list.empty')}</p>
            )}
            <div className="info-stats-list">
              {visibleStatsRegions.map((r, i) => (
                <article key={r.code} className="info-stats-row">
                  <span className="info-stats-rank">{i + 1}</span>
                  <span className="info-stats-name">{r.name}</span>
                  <span className="info-stats-total">{formatNumber(r.total)}</span>
                  <span className="info-stats-breakdown">
                    <span className="info-stats-chip">
                      {t('stats.local')} {formatNumber(r.local)}
                    </span>
                    <span className="info-stats-chip">
                      {t('stats.domestic')} {formatNumber(r.domestic)}
                    </span>
                    <span className="info-stats-chip">
                      {t('stats.foreign')} {formatNumber(r.foreign)}
                    </span>
                  </span>
                </article>
              ))}
            </div>
          </section>
        )}
        {tab === 'pet' && (
          <FilteredPlaceSection kind="pet" contentTypeId={placeTypeId} locale={multilingualLocale} />
        )}
        {tab === 'with' && (
          <FilteredPlaceSection kind="with" contentTypeId={placeTypeId} locale={multilingualLocale} />
        )}
      </div>

      <TrailRouteModal course={routeModalCourse} onClose={() => setRouteModalCourse(null)} />
      <OdiiStoriesModal site={storyModalSite} onClose={() => setStoryModalSite(null)} />
    </main>
  );
}
