import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { tripsRepo, acceptPendingInvites } from '../lib/trips';
import { formatAuthError, isGoogleAuthEnabled } from '../lib/authErrors';
import { fetchUserProfile } from '../lib/profiles';
import { isCurrentUserAdmin } from '../lib/admin';
import { isMockMailUser, signInMockMailUser } from '../lib/mockMailUsers';
import {
  forgetPersistedSession,
  forgetUserId,
  hasPersistedSession,
  readPersistedSession,
  rememberUserId,
} from '../lib/authIdentity';
import type { PlanId } from '../lib/subscription';
import type { Session, User } from '@supabase/supabase-js';

export interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  configured: boolean;
}

interface AuthContextValue extends AuthState {
  plan: PlanId;
  /** admin_users / VITE_ADMIN_EMAILS — 플랜 한도·유료 기능 제한 없음 */
  isAdmin: boolean;
  googleAuthEnabled: boolean;
  signInWithEmail: (email: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  syncLocalTrips: () => Promise<number>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** 세션 조회가 이 시간 안에 답을 못 주면 기기에 저장된 세션으로 진행한다 (§29-31) */
const SESSION_PROBE_TIMEOUT_MS = 5000;

function loginRedirectUrl(): string {
  return `${window.location.origin}/login`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: isSupabaseConfigured,
    configured: isSupabaseConfigured,
  });
  const migratedForUserRef = useRef<string | null>(null);
  const [plan, setPlan] = useState<PlanId>('free');
  const [isAdmin, setIsAdmin] = useState(false);

  const refreshProfile = useCallback(async () => {
    const userId = state.user?.id;
    if (!userId) {
      setPlan('free');
      setIsAdmin(false);
      return;
    }
    const profile = await fetchUserProfile(userId);
    setPlan(profile.plan);
  }, [state.user?.id]);

  const refreshAdmin = useCallback(async () => {
    if (!isSupabaseConfigured || !state.user?.id) {
      setIsAdmin(false);
      return;
    }
    try {
      const ok = await isCurrentUserAdmin();
      setIsAdmin(ok);
    } catch {
      setIsAdmin(false);
    }
  }, [state.user?.id]);

  const syncLocalTrips = useCallback(async () => {
    const userId = state.user?.id;
    if (!userId || !isSupabaseConfigured) return 0;
    if (migratedForUserRef.current === userId) return 0;
    const count = await tripsRepo.migrateLocalToUser(userId);
    migratedForUserRef.current = userId;
    return count;
  }, [state.user?.id]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }
    const sb = getSupabase()!;

    /* §29-31 — 오프라인에서 새로고침하면 getSession()이 만료 토큰 갱신을
     * 재시도하다가 **끝내 응답하지 않거나 예외로 튄다.** 그러면 아래
     * setState가 영영 실행되지 않아 loading이 true에 고정되고,
     * PlannerPage의 하이드레이션(`if (hydrated || authLoading) return`)이
     * 아예 시작되지 않는다 — 로컬에 여행이 멀쩡히 있는데도 화면엔 초기값인
     * 빈 "새 여행"만 남는다(사용자 신고 증상).
     *
     * 세션을 서버에 확인하지 못하더라도 기기에 저장된 세션이 있으면 그걸로
     * 화면을 이어간다. 원격 호출은 어차피 실패/타임아웃 후 로컬 사본으로
     * 폴백하고(remoteOrNull), 온라인이 되면 onAuthStateChange가 진짜 세션으로
     * 정정한다. */
    let sessionResolved = false;
    const useStoredSession = (why: string) => {
      if (sessionResolved) return;
      sessionResolved = true;
      const cached = readPersistedSession();
      const cachedUser = cached?.user as User | undefined;
      if (cachedUser?.id) {
        console.warn(`세션 확인 실패(${why}) — 기기에 저장된 세션으로 계속합니다`);
        rememberUserId(cachedUser.id);
        setState({
          user: cachedUser,
          session: cached as unknown as Session,
          loading: false,
          configured: true,
        });
      } else {
        setState({ user: null, session: null, loading: false, configured: true });
      }
    };
    const sessionTimer = setTimeout(() => useStoredSession('응답 없음'), SESSION_PROBE_TIMEOUT_MS);

    sb.auth
      .getSession()
      .then(({ data }) => {
        if (!data.session) {
          // 세션이 없다고 하는데 저장된 세션은 남아 있다 = 네트워크 때문에
          // 확인만 못 한 상태(로그아웃이면 supabase가 저장분을 지운다)
          useStoredSession('세션 없음 통보');
          return;
        }
        sessionResolved = true;
        clearTimeout(sessionTimer);
        if (data.session.user) rememberUserId(data.session.user.id);
        setState({
          user: data.session.user ?? null,
          session: data.session,
          loading: false,
          configured: true,
        });
      })
      .catch((e) => {
        console.warn('세션 조회 오류', e);
        useStoredSession('오류');
      })
      .finally(() => clearTimeout(sessionTimer));
    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      if (session?.user) rememberUserId(session.user.id);

      /* §29-31 — 네트워크가 끊기면 supabase가 토큰 자동 갱신에 실패하면서
       * 세션 없음(user=null)을 통보한다. 이걸 로그아웃으로 받아들이면
       * `user?.id`에 매달린 화면들이 전부 "게스트"로 다시 그려지고,
       * 로컬 저장소의 내 여행이 소유자 필터에 걸려 통째로 사라진다
       * (데이터가 지워진 게 아니라 읽을 자격을 잃는 것).
       *
       * 저장된 세션이 아직 남아 있다면 그건 "지금 확인할 수 없음"이지
       * "로그아웃"이 아니다 — 기존 상태를 유지하고 다음 통보를 믿는다.
       * (supabase는 로그아웃/토큰 무효일 때만 저장된 세션을 지운다.)
       * 사용자가 직접 누르는 로그아웃은 signOut()에서 상태를 명시적으로
       * 비우므로 이 완화에 걸리지 않는다. */
      if (!session && hasPersistedSession()) return;

      setState({
        user: session?.user ?? null,
        session,
        loading: false,
        configured: true,
      });
      if (event === 'SIGNED_OUT') {
        migratedForUserRef.current = null;
        forgetUserId();
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!state.user?.id) return;
    void syncLocalTrips();
    void refreshProfile();
    void refreshAdmin();
    // 이 이메일로 온 여행 공동편집 초대가 있으면 로그인 시점에 자동 수락
    void acceptPendingInvites();
  }, [state.user?.id, syncLocalTrips, refreshProfile, refreshAdmin]);

  useEffect(() => {
    if (!state.user?.id) {
      setPlan('free');
      setIsAdmin(false);
    }
  }, [state.user?.id]);

  const signInWithEmail = useCallback(async (email: string) => {
    const sb = getSupabase();
    if (!sb) throw new Error('Supabase 미설정');
    const trimmed = email.trim();
    if (isMockMailUser(trimmed)) {
      await signInMockMailUser(trimmed);
      return;
    }
    const { error } = await sb.auth.signInWithOtp({
      email: trimmed,
      options: {
        emailRedirectTo: loginRedirectUrl(),
      },
    });
    if (error) throw error;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!isGoogleAuthEnabled) {
      throw new Error(
        'Google 로그인이 비활성화되어 있습니다. Supabase에서 Google Provider를 켠 뒤 VITE_AUTH_GOOGLE_ENABLED=true 로 설정하세요.'
      );
    }
    const sb = getSupabase();
    if (!sb) throw new Error('Supabase 미설정');
    const { data, error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: loginRedirectUrl(),
        skipBrowserRedirect: true,
      },
    });
    if (error) throw new Error(formatAuthError(error));
    if (!data.url) throw new Error('Google 로그인 URL을 받지 못했습니다.');
    window.location.assign(data.url);
  }, []);

  const signOut = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) return;
    try {
      await sb.auth.signOut();
    } catch (e) {
      /* 오프라인이면 서버 세션 폐기 요청이 실패한다. 그래도 이 기기에서는
       * 반드시 로그아웃돼야 하므로 로컬 범위로 한 번 더 정리한다. */
      console.warn('로그아웃 요청 실패 — 이 기기에서만 정리합니다', e);
      await sb.auth.signOut({ scope: 'local' }).catch(() => {});
    }
    migratedForUserRef.current = null;
    /* §29-31 — 위 onAuthStateChange는 "저장된 세션이 남아 있으면" 세션 소실
     * 통보를 무시한다(네트워크 문제와 로그아웃을 구분하기 위해). 그래서
     * 사용자가 직접 누른 로그아웃은 여기서 저장된 세션까지 확실히 지우고
     * 상태를 명시적으로 비워야 오프라인에서도 제대로 로그아웃된다. */
    forgetPersistedSession();
    forgetUserId();
    setState({ user: null, session: null, loading: false, configured: true });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      plan,
      isAdmin,
      googleAuthEnabled: isGoogleAuthEnabled,
      signInWithEmail,
      signInWithGoogle,
      signOut,
      syncLocalTrips,
      refreshProfile,
    }),
    [
      state,
      plan,
      isAdmin,
      signInWithEmail,
      signInWithGoogle,
      signOut,
      syncLocalTrips,
      refreshProfile,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
