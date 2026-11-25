import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { migrateLegacyStorageKeys } from './lib/migrateStorageKeys';
import { startAnalyticsSink } from './lib/analyticsSink';
import { i18nReady } from './lib/i18n';
import App, { preloadRoute } from './App';
// 공용 스타일 app.css 중 메인 묶음(랜딩·머리글·검색 등)이 쓰는 규칙만 골라 넣는다 — vite.config.ts mainCssSubsetPlugin(§67).
// App(랜딩 → landing.css) 다음에 불러와 예전 순서(landing.css → app.css)를 지킨다. app.css 원본은 각 페이지 조각이 가져온다.
import './styles/app.css?main';

migrateLegacyStorageKeys();
startAnalyticsSink();

registerSW({
  immediate: true,
  onOfflineReady() {
    console.info('[PWA] 오프라인에서도 열 수 있습니다.');
  },
});

// 첫 진입 페이지 조각은 번역과 동시에 받기 시작한다
preloadRoute(window.location.pathname);

// 주소 언어의 번역(한국어 말고는 따로 받는 조각)이 온 뒤에 그린다 — 실패해도 한국어로 그린다(i18nReady는 거부되지 않음)
void i18nReady.then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
