import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { migrateLegacyStorageKeys } from './lib/migrateStorageKeys';
import { startAnalyticsSink } from './lib/analyticsSink';
import { i18nReady } from './lib/i18n';
import App, { preloadRoute } from './App';
// 페이지들이 지연 로딩으로 빠지면 공용 스타일 app.css도 따라 빠져 랜딩에서 사라지고 순서가 바뀐다.
// App(랜딩 → landing.css) 다음에 불러와 예전 메인 CSS 순서(landing.css → app.css)를 그대로 지킨다(2026-11-22).
import './styles/app.css';

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
