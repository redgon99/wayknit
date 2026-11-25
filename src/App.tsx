import { useEffect, type ComponentType } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { LocaleLayout } from './components/LocaleLayout';
import LandingPage from './pages/LandingPage';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, stripLocalePrefix } from './lib/locale';
import { lazyPage, PageSuspense, type LazyPage } from './lib/lazyPage';
import { firstScreenSettled } from './lib/firstScreen';

/*
 * 랜딩만 메인 번들에 두고 나머지 페이지는 처음 들어갈 때 따로 받는다(지연 로딩).
 * 2026-11-22 관리자 화면 12개 → 같은 날 공개 페이지까지. 첫 진입 페이지 조각은 main.tsx가 번역과 동시에 미리 받고(preloadRoute),
 * 플래너는 첫 화면이 뜬 뒤 한가할 때 미리 받는다 — 랜딩·가이드에서 "내 일정에 담기"를 누를 때 기다리지 않게.
 */
const PlannerPage = lazyPage(() => import('./pages/PlannerPage'));
const ShareTripPage = lazyPage(() => import('./pages/ShareTripPage'));
const ShareTargetPage = lazyPage(() => import('./pages/ShareTargetPage'));
const SharePlazaPage = lazyPage(() => import('./pages/SharePlazaPage'));
const LoginPage = lazyPage(() => import('./pages/LoginPage'));
const GuidesPage = lazyPage(() => import('./pages/GuidesPage'));
const GuideDetailPage = lazyPage(() => import('./pages/GuideDetailPage'));
const KoreaInfoPage = lazyPage(() => import('./pages/KoreaInfoPage'));
const KoreaSetupPage = lazyPage(() => import('./pages/KoreaSetupPage'));
const HelpPage = lazyPage(() => import('./pages/HelpPage'));
const ThemesPage = lazyPage(() => import('./pages/ThemesPage'));
const TermsPage = lazyPage(() => import('./pages/TermsPage'));
const PrivacyPage = lazyPage(() => import('./pages/PrivacyPage'));
const AdminPage = lazyPage(() => import('./pages/AdminPage'));
const AdminInsightsPage = lazyPage(() => import('./pages/AdminInsightsPage'));
const AdminInsightReportsPage = lazyPage(() => import('./pages/AdminInsightReportsPage'));
const AdminGuidesPage = lazyPage(() => import('./pages/AdminGuidesPage'));
const AdminDistributionPage = lazyPage(() => import('./pages/AdminDistributionPage'));
const AdminScenariosPage = lazyPage(() => import('./pages/AdminScenariosPage'));
const AdminLandingPage = lazyPage(() => import('./pages/AdminLandingPage'));
const AdminReportsPage = lazyPage(() => import('./pages/AdminReportsPage'));
const AdminAuditPage = lazyPage(() => import('./pages/AdminAuditPage'));
const AdminAccessLogPage = lazyPage(() => import('./pages/AdminAccessLogPage'));
const AdminDashboardPage = lazyPage(() => import('./pages/AdminDashboardPage'));
const AdminSearchPage = lazyPage(() => import('./pages/AdminSearchPage'));

type AnyLazyPage = LazyPage<ComponentType<object>>;

/** 주소 → 페이지. 아래 PAGE_ROUTES와 preloadRoute가 함께 쓴다 */
const LAZY_ROUTES: [path: string, page: AnyLazyPage][] = [
  ['login', LoginPage],
  ['plan', PlannerPage],
  ['trip/:slug', ShareTripPage],
  // PWA share_target 수신 — manifest의 action과 경로가 같아야 한다
  ['share', ShareTargetPage],
  ['plaza', SharePlazaPage],
  ['guides', GuidesPage],
  ['guides/:slug', GuideDetailPage],
  ['info', KoreaInfoPage],
  ['admin', AdminPage],
  ['admin/insights', AdminInsightsPage],
  ['admin/insight-reports', AdminInsightReportsPage],
  ['admin/guides', AdminGuidesPage],
  ['admin/distribution', AdminDistributionPage],
  ['admin/scenarios', AdminScenariosPage],
  ['admin/landing', AdminLandingPage],
  ['admin/reports', AdminReportsPage],
  ['admin/audit', AdminAuditPage],
  ['admin/access-log', AdminAccessLogPage],
  ['admin/dashboard', AdminDashboardPage],
  ['admin/search', AdminSearchPage],
  ['setup', KoreaSetupPage],
  ['help', HelpPage],
  ['themes', ThemesPage],
  ['terms', TermsPage],
  ['privacy', PrivacyPage],
];

/** 첫 진입 페이지 조각을 번역과 동시에 받기 시작한다(main.tsx) — 받는 순서가 줄줄이 늘어나지 않게 */
export function preloadRoute(pathname: string): void {
  const segs = stripLocalePrefix(pathname).split('/').filter(Boolean);
  if (segs.length === 0) return; // 랜딩은 메인 번들
  for (const [path, page] of LAZY_ROUTES) {
    const parts = path.split('/');
    if (parts.length === segs.length && parts.every((p, i) => p.startsWith(':') || p === segs[i])) {
      page.preload();
      return;
    }
  }
}

const PAGE_ROUTES = (
  <>
    <Route index element={<LandingPage />} />
    {LAZY_ROUTES.map(([path, Page]) => (
      <Route
        key={path}
        path={path}
        element={
          <PageSuspense>
            <Page />
          </PageSuspense>
        }
      />
    ))}
  </>
);

/** 랜딩이 아닌 페이지로 들어왔거나 첫 화면 데이터가 오래 걸려도 이 시간이 지나면 미리 받는다 */
const PLANNER_PRELOAD_MAX_WAIT_MS = 8000;

/**
 * 첫 화면이 자기 데이터를 다 받은 뒤(firstScreenSettled) 한가할 때 플래너 조각을 받아 둔다(가장 많이 가는 다음 화면).
 * 예전엔 첫 그림 직후 바로 시작해 느린 회선에서 추천 코스 조회와 대역폭을 나눠 썼다(§69·§70).
 */
function usePreloadPlannerWhenIdle() {
  useEffect(() => {
    let cancelled = false;
    let idleId: number | undefined;
    let timerId: ReturnType<typeof setTimeout> | undefined;
    const run = () => {
      if (!cancelled) PlannerPage.preload();
    };
    const maxWait = new Promise<void>((resolve) => {
      timerId = globalThis.setTimeout(resolve, PLANNER_PRELOAD_MAX_WAIT_MS);
    });
    void Promise.race([firstScreenSettled, maxWait]).then(() => {
      if (cancelled) return;
      if ('requestIdleCallback' in window) idleId = window.requestIdleCallback(run, { timeout: 5000 });
      else run();
    });
    return () => {
      cancelled = true;
      if (timerId !== undefined) globalThis.clearTimeout(timerId);
      if (idleId !== undefined && 'cancelIdleCallback' in window) window.cancelIdleCallback(idleId);
    };
  }, []);
}

export default function App() {
  usePreloadPlannerWhenIdle();
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<LocaleLayout />}>{PAGE_ROUTES}</Route>
          {SUPPORTED_LOCALES.filter((l) => l !== DEFAULT_LOCALE).map((lang) => (
            <Route key={lang} path={lang} element={<LocaleLayout />}>
              {PAGE_ROUTES}
            </Route>
          ))}
          {/* Legacy Simplified Chinese prefix */}
          <Route path="zh" element={<LocaleLayout />}>
            {PAGE_ROUTES}
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
