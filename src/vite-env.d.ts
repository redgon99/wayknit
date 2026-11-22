/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/* vite.config.ts의 define으로 빌드 시점에 박히는 값들 (§29-32) */
declare const __APP_VERSION__: string;
declare const __APP_COMMIT__: string;
declare const __APP_BUILD_TIME__: string;

/* vite.config.ts localeCrossPlugin — 9개 언어에서 뽑은 몇 줄(번역은 언어별로 따로 받으므로) */
declare module 'virtual:locale-cross' {
  /** 각 언어의 planner `trip.newTrip`("새 여행", "New trip" …) */
  export const NEW_TRIP_TITLES: string[];
  /** 언어 → planner `export` 묶음(내보내기 파일 열 이름·머리말) */
  export const EXPORT_LABELS: Record<string, Record<string, unknown>>;
}

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

interface WindowEventMap {
  beforeinstallprompt: BeforeInstallPromptEvent;
}
