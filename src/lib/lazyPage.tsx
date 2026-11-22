import { Component, lazy, Suspense, type ComponentType, type ReactNode } from 'react';

/**
 * 페이지를 처음 열 때 따로 받아 오는 지연 로딩(React.lazy) — 관리자 화면용(2026-11-22).
 * 관리자 화면 12개가 메인 번들에 다 들어 있어 여행자(대부분 외국인 모바일)가 첫 화면에서 쓰지 않는 코드까지 받았다.
 *
 * 배포 직후 예전 index를 연 채로 들어오면 이미 지워진 옛 조각 파일을 찾다가 실패한다
 * ("Failed to fetch dynamically imported module"). 그때는 한 번만 새로고침해 새 index를 받는다 —
 * 같은 탭에서 연속으로 새로고침되지 않도록 sessionStorage에 표시를 남긴다. 그래도 실패하면 안내 화면.
 */
const RELOAD_KEY = 'wayknit:lazy-reload';

export function lazyPage<T extends ComponentType<object>>(load: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      const mod = await load();
      try {
        sessionStorage.removeItem(RELOAD_KEY);
      } catch {
        /* 저장소를 못 써도 페이지는 연다 */
      }
      return mod;
    } catch (err) {
      let reloaded = false;
      try {
        reloaded = sessionStorage.getItem(RELOAD_KEY) === '1';
        if (!reloaded) sessionStorage.setItem(RELOAD_KEY, '1');
      } catch {
        reloaded = true; // 표시를 못 남기면 새로고침 반복을 막기 위해 그냥 오류를 낸다
      }
      if (!reloaded) {
        window.location.reload();
        return new Promise<{ default: T }>(() => {}); // 새로고침될 때까지 대기
      }
      throw err;
    }
  });
}

/** 새로고침 후에도 조각 파일을 못 받으면(오프라인·배포 중) 빈 화면 대신 안내 */
class ChunkErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" style={{ padding: '48px 24px', textAlign: 'center', fontSize: 15, lineHeight: 1.6 }}>
        <p style={{ margin: '0 0 16px' }}>화면을 불러오지 못했습니다. 네트워크를 확인한 뒤 새로고침해 주세요.</p>
        <button
          type="button"
          onClick={() => {
            try {
              sessionStorage.removeItem(RELOAD_KEY);
            } catch {
              /* 무시 */
            }
            window.location.reload();
          }}
          style={{ padding: '8px 18px', borderRadius: 999, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
        >
          새로고침
        </button>
      </div>
    );
  }
}

/** 조각 파일을 받는 동안 — 관리자 화면은 짧게 비워 둔다(깜빡임 최소) */
export function PageSuspense({ children }: { children: ReactNode }) {
  return (
    <ChunkErrorBoundary>
      <Suspense fallback={<div aria-busy="true" style={{ minHeight: '100vh' }} />}>{children}</Suspense>
    </ChunkErrorBoundary>
  );
}
