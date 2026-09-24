import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { LocaleLayout } from './components/LocaleLayout';
import LandingPage from './pages/LandingPage';
import PlannerPage from './pages/PlannerPage';
import ShareTripPage from './pages/ShareTripPage';
import ShareTargetPage from './pages/ShareTargetPage';
import SharePlazaPage from './pages/SharePlazaPage';
import LoginPage from './pages/LoginPage';
import AdminPage from './pages/AdminPage';
import AdminInsightsPage from './pages/AdminInsightsPage';
import AdminInsightReportsPage from './pages/AdminInsightReportsPage';
import AdminGuidesPage from './pages/AdminGuidesPage';
import AdminDistributionPage from './pages/AdminDistributionPage';
import AdminScenariosPage from './pages/AdminScenariosPage';
import AdminLandingPage from './pages/AdminLandingPage';
import AdminReportsPage from './pages/AdminReportsPage';
import AdminAuditPage from './pages/AdminAuditPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminSearchPage from './pages/AdminSearchPage';
import GuidesPage from './pages/GuidesPage';
import GuideDetailPage from './pages/GuideDetailPage';
import KoreaInfoPage from './pages/KoreaInfoPage';
import KoreaSetupPage from './pages/KoreaSetupPage';
import HelpPage from './pages/HelpPage';
import ThemesPage from './pages/ThemesPage';
import TermsPage from './pages/TermsPage';
import PrivacyPage from './pages/PrivacyPage';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from './lib/locale';

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
    <Route path="admin" element={<AdminPage />} />
    <Route path="admin/insights" element={<AdminInsightsPage />} />
    <Route path="admin/insight-reports" element={<AdminInsightReportsPage />} />
    <Route path="admin/guides" element={<AdminGuidesPage />} />
    <Route path="admin/distribution" element={<AdminDistributionPage />} />
    <Route path="admin/scenarios" element={<AdminScenariosPage />} />
    <Route path="admin/landing" element={<AdminLandingPage />} />
    <Route path="admin/reports" element={<AdminReportsPage />} />
    <Route path="admin/audit" element={<AdminAuditPage />} />
    <Route path="admin/dashboard" element={<AdminDashboardPage />} />
    <Route path="admin/search" element={<AdminSearchPage />} />
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
