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
import { canCreateTrip, FREE_MAX_TRIPS } from '../lib/subscription';
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
  const { t: tb } = useTranslation('billing');
  const locale = normalizeLocale(i18n.language);
  const planPath = plannerPath(locale);
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  /** 표로보기 공유 아이콘("?view=table")으로 들어온 링크는 표 모달이 그대로 열린 채 시작한다. */
  const tableViewOpen = searchParams.get('view') === 'table';
  const { user, plan, isAdmin } = useAuth();
  const [kakaoReady, setKakaoReady] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  // 문구가 아니라 종류를 저장한다 — 예전엔 한국어 문장을 그대로 담아 어느 언어로 열어도 한국어였다.
  const [error, setError] = useState<'invalid' | 'notFound' | 'failed' | null>(null);
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
      setError('invalid');
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const loaded = await tripsRepo.loadBySlug(slug);
        if (!loaded) {
          setError('notFound');
          setTrip(null);
        } else {
          setTrip(loaded);
          const firstPin = loaded.pinnedByDay[loaded.currentDay]?.[0];
          if (firstPin) {
            setMapCenter({ lat: firstPin.lat, lng: firstPin.lng });
          }
        }
      } catch (e) {
        // 기술적인 오류 문구(대개 영어·한국어 혼재)는 콘솔로만 보내고 화면엔 안내 문구를 쓴다.
        console.error('[share] 공유 여행 조회 실패', e);
        setError('failed');
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
      /*
       * 세 번째로 찾은 같은 구멍(2026-09-15) — 이것도 새 여행을 만드는
       * 경로인데 Free 캡 체크가 없었다(PlannerPage 세션 복구 경로,
       * SharePlazaPanel "복사"에 이어). 여기서 막지 않으면 공유 링크를
       * 계속 열어 "내 여행에 추가"만 눌러도 무한히 쌓인다.
       */
      const currentCount = (await tripsRepo.list(userId)).length;
      if (!canCreateTrip(plan, currentCount, isAdmin)) {
        setAddMessage(tb('limits.plazaImport', { max: FREE_MAX_TRIPS }));
        setAdding(false);
        return;
      }
      const cloned = cloneTripFromShare(trip, userId ?? undefined);
      await tripsRepo.save(cloned);
      // 복사한 여행은 플래너(PlannerPage의 openTripId)가 연다 — 예전엔 '/'(랜딩)로 보내
      // 여행이 열리지 않았고 언어도 한국어로 바뀌었다.
      navigate(planPath, { state: { openTripId: cloned.id } });
    } catch (e) {
      console.error(e);
      setAddMessage(t('trip.addFailed'));
      setAdding(false);
    }
  }, [trip, adding, user?.id, navigate, planPath, plan, isAdmin, t, tb]);

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
        <p>{t('trip.loading')}</p>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="share-page">
        <p className="share-error">
          {error === 'invalid'
            ? t('trip.invalidLink')
            : error === 'notFound'
              ? t('trip.notFoundDetail')
              : t('trip.loadFailed')}
        </p>
        <Link to={planPath} className="share-home-link">
          {t('trip.goToPlanner')}
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
          {t('trip.mapLoading')}
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
        <div className="share-header-title">
          <span className="share-badge">{t('trip.badge')}</span>
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
            {adding ? t('trip.adding') : t('trip.addToMine')}
          </button>
          <Link to={planPath} className="share-action-btn share-action-btn--edit">
            {t('trip.editMine')}
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
        <div className="share-empty-hint">{t('trip.empty')}</div>
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
