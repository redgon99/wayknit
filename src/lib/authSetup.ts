/** Wayknit 프로젝트 Supabase ref (VITE_SUPABASE_URL에서 추출) */
export const SUPABASE_PROJECT_REF = 'ainftwifvclgiookzrwm';

export const SUPABASE_AUTH_CALLBACK_URL = `https://${SUPABASE_PROJECT_REF}.supabase.co/auth/v1/callback`;

export const APP_LOGIN_REDIRECTS = [
  'http://localhost:5173/login',
  'http://127.0.0.1:5173/login',
] as const;

export const GOOGLE_CLOUD_CONSOLE_CREDENTIALS =
  'https://console.cloud.google.com/apis/credentials';

export const SUPABASE_DASHBOARD = {
  googleProvider: `https://supabase.com/dashboard/project/${SUPABASE_PROJECT_REF}/auth/providers?provider=Google`,
  urlConfiguration: `https://supabase.com/dashboard/project/${SUPABASE_PROJECT_REF}/auth/url-configuration`,
  authLogs: `https://supabase.com/dashboard/project/${SUPABASE_PROJECT_REF}/auth/logs`,
} as const;
