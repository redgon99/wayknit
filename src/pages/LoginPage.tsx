import { FormEvent, useEffect, useState, type MouseEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { Icon } from '../components/Icon';
import { LegalLinks } from '../components/LegalLinks';
import { LegalModal, type LegalModalKind } from '../components/LegalModal';
import { useAuth } from '../contexts/AuthContext';
import {
  clearAuthCallbackErrorFromUrl,
  formatAuthError,
  readAuthCallbackError,
} from '../lib/authErrors';
import {
  GOOGLE_CLOUD_CONSOLE_CREDENTIALS,
  SUPABASE_AUTH_CALLBACK_URL,
  SUPABASE_DASHBOARD,
} from '../lib/authSetup';
import { normalizeLocale } from '../lib/locale';
import i18n from '../lib/i18n';
import { isMockMailUser } from '../lib/mockMailUsers';
import { plannerPath } from '../lib/routes';
import '../styles/app.css';

const FEATURE_ICONS = ['cloudOk', 'route', 'share'] as const;

export default function LoginPage() {
  const { t } = useTranslation('common');
  const { t: ta } = useTranslation('auth');
  const { t: tp } = useTranslation('planner');

  useEffect(() => {
    document.title = tp('chrome.appTitle');
  }, [tp]);
  const features = [
    {
      icon: FEATURE_ICONS[0],
      title: ta('login.featureCloudTitle'),
      desc: ta('login.featureCloudDesc'),
    },
    {
      icon: FEATURE_ICONS[1],
      title: ta('login.featureSyncTitle'),
      desc: ta('login.featureSyncDesc'),
    },
    {
      icon: FEATURE_ICONS[2],
      title: ta('login.featureShareTitle'),
      desc: ta('login.featureShareDesc'),
    },
  ];
  const locale = normalizeLocale(i18n.language);
  const planPath = plannerPath(locale);
  const navigate = useNavigate();
  const { user, loading, configured, googleAuthEnabled, signInWithEmail, signInWithGoogle, syncLocalTrips } =
    useAuth();
  const [searchParams] = useSearchParams();
  /* 공동편집 초대로 넘어온 경우 초대받은 주소를 미리 채운다. 그 주소로
   * 로그인해야만 초대가 연결되므로, 다시 받아 적게 할 이유가 없다. */
  const [email, setEmail] = useState(() => searchParams.get('email')?.trim() ?? '');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [migrating, setMigrating] = useState(false);
  const [copiedCallback, setCopiedCallback] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [legalModal, setLegalModal] = useState<LegalModalKind | null>(null);
  const canAuth = agreeTerms && agreePrivacy;

  async function copyCallbackUrl() {
    try {
      await navigator.clipboard.writeText(SUPABASE_AUTH_CALLBACK_URL);
      setCopiedCallback(true);
      window.setTimeout(() => setCopiedCallback(false), 2000);
    } catch {
      /* noop */
    }
  }

  useEffect(() => {
    const callbackError = readAuthCallbackError();
    if (callbackError) {
      setError(callbackError);
      clearAuthCallbackErrorFromUrl();
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setMigrating(true);
      try {
        await syncLocalTrips();
      } finally {
        if (!cancelled) setMigrating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, syncLocalTrips]);

  if (!loading && user) {
    return <Navigate to={planPath} replace />;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    if (!canAuth) {
      setError(ta('login.consentRequired'));
      return;
    }
    setSending(true);
    setError(null);
    try {
      const trimmed = email.trim();
      await signInWithEmail(trimmed);
      if (!isMockMailUser(trimmed)) setSent(true);
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setSending(false);
    }
  }

  function openLegal(e: MouseEvent, kind: LegalModalKind) {
    e.preventDefault();
    e.stopPropagation();
    setLegalModal(kind);
  }

  async function handleGoogle() {
    if (!canAuth) {
      setError(ta('login.consentRequired'));
      return;
    }
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(formatAuthError(err));
    }
  }

  return (
    <div className="login-page">
      <div className="login-page-bg" aria-hidden="true">
        <div className="login-page-map-grid" />
      </div>

      <div className="login-page-shell">
        <header className="login-page-brand">
          <div className="login-page-logo">
            <Icon name="route" size={28} />
          </div>
          <div>
            <h1>
              {t('appName')}
              {t('appNameEn') && t('appNameEn') !== t('appName') ? (
                <span className="login-page-brand-en"> {t('appNameEn')}</span>
              ) : null}
            </h1>
            <p>{t('appTagline')}</p>
          </div>
        </header>

        <section className="login-page-features" aria-label={ta('login.featuresAria')}>
          {features.map((item) => (
            <article key={item.title} className="login-feature-card">
              <span className="login-feature-icon">
                <Icon name={item.icon} size={20} />
              </span>
              <div>
                <strong>{item.title}</strong>
                <p>{item.desc}</p>
              </div>
            </article>
          ))}
        </section>

        <section className="login-page-card surface-float">
          {!configured ? (
            <div className="login-page-unconfigured">
              <Icon name="save" size={22} />
              <h2>{ta('login.localTitle')}</h2>
              <p>
                {ta('login.localBody')}
                <br />
                클라우드 동기화를 쓰려면 <code>VITE_SUPABASE_URL</code>과{' '}
                <code>VITE_SUPABASE_ANON_KEY</code>를 설정하세요.
              </p>
              <Link to={planPath} className="login-primary-btn">
                {ta('login.startWithoutLogin')}
              </Link>
            </div>
          ) : sent ? (
            <div className="login-page-sent">
              <Icon name="mailOk" size={28} />
              <h2>{ta('login.sentTitle')}</h2>
              <p>{ta('login.sentBody', { email })}</p>
              <button
                type="button"
                className="login-secondary-btn"
                onClick={() => {
                  setSent(false);
                  setEmail('');
                }}
              >
                {ta('login.otherEmail')}
              </button>
            </div>
          ) : (
            <>
              <h2>{ta('login.startTitle')}</h2>
              <p className="login-page-lead">{ta('login.startLead')}</p>

              <fieldset className="login-consent">
                <legend className="sr-only">{ta('login.consentLegend')}</legend>
                <label className="login-consent-item">
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                  />
                  <span>
                    <Trans
                      i18nKey="login.agreeTerms"
                      ns="auth"
                      components={{
                        terms: (
                          <button
                            type="button"
                            className="login-legal-link"
                            onClick={(e) => openLegal(e, 'terms')}
                          />
                        ),
                      }}
                    />
                  </span>
                </label>
                <label className="login-consent-item">
                  <input
                    type="checkbox"
                    checked={agreePrivacy}
                    onChange={(e) => setAgreePrivacy(e.target.checked)}
                  />
                  <span>
                    <Trans
                      i18nKey="login.agreePrivacy"
                      ns="auth"
                      components={{
                        privacy: (
                          <button
                            type="button"
                            className="login-legal-link"
                            onClick={(e) => openLegal(e, 'privacy')}
                          />
                        ),
                      }}
                    />
                  </span>
                </label>
              </fieldset>

              <form className="login-form" onSubmit={submit}>
                <label className="login-label" htmlFor="login-email">
                  {ta('login.email')}
                </label>
                <input
                  id="login-email"
                  type="email"
                  className="login-input"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  autoComplete="email"
                />
                <button
                  type="submit"
                  className="login-primary-btn"
                  disabled={sending || loading || !canAuth}
                >
                  {sending
                    ? ta('login.sending')
                    : isMockMailUser(email)
                      ? ta('login.mockSignIn')
                      : ta('login.sendLink')}
                </button>
              </form>

              {googleAuthEnabled ? (
                <>
                  <div className="login-divider">
                    <span>{ta('login.or')}</span>
                  </div>

                  <button
                    type="button"
                    className="login-oauth-btn"
                    onClick={() => void handleGoogle()}
                    disabled={!canAuth}
                  >
                    <Icon name="globe" size={18} />
                    {ta('login.google')}
                  </button>
                </>
              ) : configured && import.meta.env.DEV ? (
                <details className="login-google-setup">
                  <summary>Google 로그인 설정 안내 (관리자)</summary>
                  <p>
                    Supabase에서 Google Provider가 아직 꺼져 있습니다. 아래 순서로
                    설정한 뒤 <code>VITE_AUTH_GOOGLE_ENABLED=true</code>를 추가하세요.
                  </p>
                  <ol>
                    <li>
                      Google Cloud에서 OAuth 클라이언트 생성 후, 리디렉션 URI에
                      아래 주소를 등록합니다.
                    </li>
                  </ol>
                  <div className="login-callback-row">
                    <code className="login-callback-url">{SUPABASE_AUTH_CALLBACK_URL}</code>
                    <button type="button" className="login-copy-btn" onClick={() => void copyCallbackUrl()}>
                      {copiedCallback ? '복사됨' : '복사'}
                    </button>
                  </div>
                  <ol start={2}>
                    <li>Supabase Google Provider에 Client ID/Secret 입력 후 Enable</li>
                    <li>Redirect URL에 <code>http://localhost:5173/login</code> 추가</li>
                  </ol>
                  <div className="login-setup-links">
                    <a href={GOOGLE_CLOUD_CONSOLE_CREDENTIALS} target="_blank" rel="noreferrer">
                      Google Cloud 콘솔
                    </a>
                    <a href={SUPABASE_DASHBOARD.googleProvider} target="_blank" rel="noreferrer">
                      Supabase Google 설정
                    </a>
                    <a href={SUPABASE_DASHBOARD.urlConfiguration} target="_blank" rel="noreferrer">
                      Supabase Redirect URLs
                    </a>
                  </div>
                </details>
              ) : null}

              {error && <p className="login-error">{error}</p>}
            </>
          )}
        </section>

        <footer className="login-page-footer">
          <button type="button" className="login-guest-link" onClick={() => navigate(planPath)}>
            {ta('login.guestStart')}
          </button>
          <LegalLinks className="login-legal-links" />
          {migrating && (
            <p className="login-migrating">
              <Icon name="loader" spin size={14} /> {ta('login.syncing')}
            </p>
          )}
        </footer>
      </div>
      <LegalModal kind={legalModal} onClose={() => setLegalModal(null)} />
    </div>
  );
}
