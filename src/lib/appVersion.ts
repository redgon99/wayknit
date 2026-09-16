/**
 * 이 빌드가 무엇인지 화면에 보여주기 위한 값들 (§29-32).
 *
 * 왜 필요한가: 이 프로젝트는 Netlify Git 연동이 없어 배포가 수동이고(§9),
 * PWA 서비스워커가 이전 빌드를 캐시해 두기 때문에 **폰에서 새로고침을 해도
 * 방금 배포한 빌드가 열렸는지 알 길이 없었다.** 실제로 수정 확인이 실패한 줄
 * 알았다가 하드 리프레시 후에야 반영된 적이 있다(§29-16 U14). 계정 시트
 * 하단에 버전·커밋·빌드시각을 띄워 눈으로 구분점을 만든다.
 *
 * 값은 vite.config.ts의 `define`으로 빌드 시점에 문자열로 치환된다.
 * 개발 서버에서도 같은 경로로 주입되므로 분기 처리는 필요 없다.
 */

export const APP_VERSION = __APP_VERSION__;
export const APP_COMMIT = __APP_COMMIT__;
export const APP_BUILD_TIME = __APP_BUILD_TIME__;

/** 빌드시각을 사용자의 시간대로 "09-14 22:31" 형태로 */
export function formatBuildTime(iso: string = APP_BUILD_TIME): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 계정 시트에 한 줄로 보여줄 문자열 — "v0.2.0 · b413696 · 09-14 22:31" */
export function buildLabel(): string {
  return [`v${APP_VERSION}`, APP_COMMIT, formatBuildTime()].filter(Boolean).join(' · ');
}
