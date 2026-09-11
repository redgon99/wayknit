import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Icon } from '../components/Icon';
import { useSeoMeta } from '../hooks/useSeoMeta';
import { useAuth } from '../contexts/AuthContext';
import { loadKakaoSdk } from '../lib/kakao';
import { loadGoogleMapsSdk } from '../lib/googleMaps';
import { resolveMapProvider } from '../lib/mapProvider';
import { cloneTripFromShare, tripsRepo, type Trip } from '../lib/trips';
import { getRouteOptionsForDay } from '../lib/tripRouteOptions';
import { MapView } from '../components/MapView';
import { DayTabs } from '../components/DayTabs';
import { RouteSummary } from '../components/RouteSummary';
import { ItineraryTableView } from '../components/ItineraryTableView';
import { ShareOnboardingCoach } from '../components/ShareOnboardingCoach';
import { PresenceStack } from '../components/PresenceStack';
import { ReportButton } from '../components/ReportButton';
import { useTripPresence } from '../hooks/useTripPresence';
import { shouldShowShareOnboarding } from '../lib/onboarding';
import { normalizeLocale } from '../lib/locale';
import i18n from '../lib/i18n';
import { plannerPath } from '../lib/routes';
import '../styles/app.css';

const DEFAULT_CENTER = { lat: 37.8813, lng: 127.7298 };

export default function ShareTripPage() {
  const { t } = useTranslation('share');
  const locale = normalizeLocale(i18n.language);
  const planPath = plannerPath(locale);
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  /** 표로보기 공유 아이콘("?view=table")으로 들어온 링크는 표 모달이 그대로 열린 채 시작한다. */
  const tableViewOpen = searchParams.get('view') === 'table';
  const { user } = useAuth();
  const [kakaoReady, setKakaoReady] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const mapProvider = resolveMapProvider(mapCenter);
  const [adding, setAdding] = useState(false);
  const [addMessage, setAddMessage] = useState<string | null>(null);
  const [shareOnboardingOpen, setShareOnboardingOpen] = useState(false);

  useEffect(() => {
    if (!loading && trip && !error) {
      setShareOnboardingOpen(shouldShowShareOnboarding(true));
    }
  }, [loading, trip, error]);

  useEffect(() => {
    const key = import.meta.env.VITE_KAKAO_JS_KEY;
    if (!key) return;
    loadKakaoSdk(key)
      .then(() => setKakaoReady(true))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (mapProvider !== 'google') return;
    const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!key) return;
    loadGoogleMapsSdk(key)
      .then(() => setGoogleReady(true))
      .catch(console.error);
  }, [mapProvider]);

  useEffect(() => {
    if (!slug) {
      setError('잘못된 공유 링크입니다.');
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const loaded = await tripsRepo.loadBySlug(slug);
        if (!loaded) {
          setError('공유된 여행을 찾을 수 없습니다. 링크가 만료되었거나 비공개일 수 있습니다.');
          setTrip(null);
        } else {
          setTrip(loaded);
          const firstPin = loaded.pinnedByDay[loaded.currentDay]?.[0];
          if (firstPin) {
            setMapCenter({ lat: firstPin.lat, lng: firstPin.lng });
          }
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  const handleAddToMyTrips = useCallback(async () => {
    if (!trip || adding) return;
    setAdding(true);
    setAddMessage(null);
    try {
      const userId = user?.id ?? null;
      const cloned = cloneTripFromShare(trip, userId ?? undefined);
      await tripsRepo.save(cloned);
      navigate('/', { state: { openTripId: cloned.id } });
    } catch (e) {
      console.error(e);
      setAddMessage('저장에 실패했습니다. 다시 시도해 주세요.');
      setAdding(false);
    }
  }, [trip, adding, user?.id, navigate]);

  const currentDay = trip?.currentDay ?? 1;
  const pinned = useMemo(
    () => trip?.pinnedByDay[currentDay] ?? [],
    [trip?.pinnedByDay, currentDay]
  );
  const generatedRoute = trip?.generatedRouteByDay[currentDay] ?? null;
  const routeOptions = trip ? getRouteOptionsForDay(trip, currentDay) : null;

  useSeoMeta({
    title: t('meta.tripTitle', { title: trip?.title?.trim() || t('meta.tripFallback') }),
    description: t('meta.tripDescription'),
    type: 'article',
    path: slug ? `/trip/${slug}` : undefined,
  });

  const viewers = useTripPresence(trip?.id, Boolean(trip));

  const countsByDay = useMemo(() => {
    if (!trip) return {};
    const counts: Record<number, number> = {};
    for (let d = 1; d <= trip.totalDays; d++) {
      counts[d] = (trip.pinnedByDay[d] ?? []).length;
    }
    return counts;
  }, [trip]);

  if (loading) {
    return (
      <div className="share-page">
        <p>여행 불러오는 중…</p>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="share-page">
        <p className="share-error">{error ?? '여행을 불러올 수 없습니다.'}</p>
        <Link to={planPath} className="share-home-link">
          편집 화면으로 이동
        </Link>
      </div>
    );
  }

  return (
    <div
      className={`wayknit-root share-mode${shareOnboardingOpen ? ' share-onboarding-active' : ''}`}
    >
      {!((mapProvider === 'kakao' && kakaoReady) || (mapProvider === 'google' && googleReady)) && (
        <div className="map-canvas map-loading" aria-live="polite">
          지도를 불러오는 중…
        </div>
      )}
      {((mapProvider === 'kakao' && kakaoReady) || (mapProvider === 'google' && googleReady)) && (
        <MapView
          provider={mapProvider}
          mapsReady={kakaoReady}
          googleMapsReady={googleReady}
          center={mapCenter}
          searchResults={[]}
          pinned={pinned}
          origin={routeOptions?.origin}
          generatedRoute={generatedRoute}
          fitRouteBounds
        />
      )}

      <header className="share-header">
        <div>
          <span className="share-badge">공유 보기</span>
          <h1 className="share-title">{trip.title}</h1>
        </div>
        <div className="share-header-actions">
          <PresenceStack viewers={viewers} />
          <button
            type="button"
            className="share-action-btn share-action-btn--add"
            onClick={() => void handleAddToMyTrips()}
            disabled={adding}
          >
            <Icon name="plus" size={16} />
            {adding ? '추가 중…' : '내 여행에 추가'}
          </button>
          <Link to={planPath} className="share-action-btn share-action-btn--edit">
            내 여행 편집하기
          </Link>
          <ReportButton
            target={{
              type: 'trip',
              id: trip.id,
              label: trip.title,
              url: window.location.href,
            }}
            compact
          />
          {addMessage && <p className="share-add-error">{addMessage}</p>}
        </div>
      </header>

      <div className="overlay-top share-overlay-top">
        <DayTabs
          totalDays={trip.totalDays}
          currentDay={trip.currentDay}
          countsByDay={countsByDay}
          onSelect={(day) => setTrip({ ...trip, currentDay: day })}
          onAddDay={() => {}}
          onRemoveDay={() => {}}
          readOnly
        />
      </div>

      {generatedRoute && (
        <div className="overlay-bottom-left">
          <RouteSummary route={generatedRoute} readOnly />
        </div>
      )}

      {pinned.length === 0 && !generatedRoute && (
        <div className="share-empty-hint">등록된 장소가 없습니다.</div>
      )}

      {shareOnboardingOpen && (
        <div className="share-onboarding-layer">
          <ShareOnboardingCoach onComplete={() => setShareOnboardingOpen(false)} />
        </div>
      )}

      <ItineraryTableView
        open={tableViewOpen}
        trip={trip}
        onClose={() => setSearchParams({}, { replace: true })}
      />
    </div>
  );
}
