import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { LocaleLayout } from './components/LocaleLayout';
import LandingPage from './pages/LandingPage';
import PlannerPage from './pages/PlannerPage';
import ShareTripPage from './pages/ShareTripPage';
import ShareTargetPage from './pages/ShareTargetPage';
import SharePlazaPage from './pages/SharePlazaPage';
import LoginPage from './pages/LoginPage';
import GuidesPage from './pages/GuidesPage';
import GuideDetailPage from './pages/GuideDetailPage';
import KoreaInfoPage from './pages/KoreaInfoPage';
import KoreaSetupPage from './pages/KoreaSetupPage';
import HelpPage from './pages/HelpPage';
import ThemesPage from './pages/ThemesPage';
import TermsPage from './pages/TermsPage';
import PrivacyPage from './pages/PrivacyPage';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from './lib/locale';
import { lazyPage, PageSuspense } from './lib/lazyPage';

// 관리자 화면은 처음 들어갈 때 따로 받는다(지연 로딩, 2026-11-22) — 여행자 첫 화면 번들에서 뺀다
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

const PAGE_ROUTES = (
  <>
    <Route path="login" element={<LoginPage />} />
    <Route index element={<LandingPage />} />
    <Route path="plan" element={<PlannerPage />} />
    <Route path="trip/:slug" element={<ShareTripPage />} />
    {/* PWA share_target 수신 — manifest의 action과 경로가 같아야 한다 */}
    <Route path="share" element={<ShareTargetPage />} />
    <Route path="plaza" element={<SharePlazaPage />} />
    <Route path="guides" element={<GuidesPage />} />
    <Route path="guides/:slug" element={<GuideDetailPage />} />
    <Route path="info" element={<KoreaInfoPage />} />
    <Route path="admin" element={<PageSuspense><AdminPage /></PageSuspense>} />
    <Route path="admin/insights" element={<PageSuspense><AdminInsightsPage /></PageSuspense>} />
    <Route path="admin/insight-reports" element={<PageSuspense><AdminInsightReportsPage /></PageSuspense>} />
    <Route path="admin/guides" element={<PageSuspense><AdminGuidesPage /></PageSuspense>} />
    <Route path="admin/distribution" element={<PageSuspense><AdminDistributionPage /></PageSuspense>} />
    <Route path="admin/scenarios" element={<PageSuspense><AdminScenariosPage /></PageSuspense>} />
    <Route path="admin/landing" element={<PageSuspense><AdminLandingPage /></PageSuspense>} />
    <Route path="admin/reports" element={<PageSuspense><AdminReportsPage /></PageSuspense>} />
    <Route path="admin/audit" element={<PageSuspense><AdminAuditPage /></PageSuspense>} />
    <Route path="admin/access-log" element={<PageSuspense><AdminAccessLogPage /></PageSuspense>} />
    <Route path="admin/dashboard" element={<PageSuspense><AdminDashboardPage /></PageSuspense>} />
    <Route path="admin/search" element={<PageSuspense><AdminSearchPage /></PageSuspense>} />
    <Route path="setup" element={<KoreaSetupPage />} />
    <Route path="help" element={<HelpPage />} />
    <Route path="themes" element={<ThemesPage />} />
    <Route path="terms" element={<TermsPage />} />
    <Route path="privacy" element={<PrivacyPage />} />
  </>
);

export default function App() {
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
