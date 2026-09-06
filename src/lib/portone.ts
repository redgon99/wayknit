declare global {
  interface Window {
    PortOne: any;
  }
}

// =============================================
// 포트원(PortOne) V2 브라우저 SDK 로더 (싱글톤)
// 참고: docs/Wayknit_수익화_실행계획_2026-08-27.md §1.4
// =============================================

let sdkPromise: Promise<typeof window.PortOne> | null = null;

export function loadPortOneSdk(): Promise<typeof window.PortOne> {
  if (typeof window === 'undefined') return Promise.reject(new Error('SSR'));
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise((resolve, reject) => {
    if (window.PortOne) {
      resolve(window.PortOne);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.portone.io/v2/browser-sdk.js';
    script.async = true;
    script.onload = () => {
      if (window.PortOne) resolve(window.PortOne);
      else reject(new Error('PortOne SDK load failed'));
    };
    script.onerror = (e) => reject(e);
    document.head.appendChild(script);
  });

  return sdkPromise;
}

export function getPortOneStoreId(): string | undefined {
  const v = import.meta.env.VITE_PORTONE_STORE_ID;
  return v ? String(v) : undefined;
}

export function getPortOneChannelKey(): string | undefined {
  const v = import.meta.env.VITE_PORTONE_CHANNEL_KEY;
  return v ? String(v) : undefined;
}

export function isPortOneConfigured(): boolean {
  return Boolean(getPortOneStoreId() && getPortOneChannelKey());
}
