import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { isCurrentUserAdmin } from '../lib/admin';

export type AdminAccessStatus = 'loading' | 'anon' | 'denied' | 'ok';

/**
 * L3(관리자 검토 2026-09-16) — 관리자 페이지마다 로컬 checkingAdmin/isAdmin
 * state를 따로 두고 있었다. 마운트 시 `loading=true`라 이펙트가
 * `checkingAdmin=false`로 두고 조기 리턴했다가, `loading`이 false로 바뀐
 * 첫 렌더에서 "아직 관리자 확인 전"인데 `isAdmin=false`로 읽혀 새로고침마다
 * 리다이렉트/접근거부 화면이 잠깐(또는 AdminLandingPage처럼 계속) 떴다.
 *
 * 이 훅은 "관리자 여부를 아직 모름"과 "아니라고 확인됨"을 하나의 상태값으로
 * 분리해 그 틈을 없앤다 — user id가 바뀌면 다시 'loading'부터 시작한다.
 */
export function useAdminAccess(): AdminAccessStatus {
  const { configured, loading, user } = useAuth();
  const [status, setStatus] = useState<AdminAccessStatus>('loading');

  useEffect(() => {
    if (!configured) {
      setStatus('denied');
      return;
    }
    if (loading) {
      setStatus('loading');
      return;
    }
    if (!user) {
      setStatus('anon');
      return;
    }
    let alive = true;
    setStatus('loading');
    (async () => {
      try {
        const ok = await isCurrentUserAdmin();
        if (alive) setStatus(ok ? 'ok' : 'denied');
      } catch {
        if (alive) setStatus('denied');
      }
    })();
    return () => {
      alive = false;
    };
  }, [configured, loading, user?.id]);

  return status;
}
