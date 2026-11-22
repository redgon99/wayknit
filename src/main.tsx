import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { migrateLegacyStorageKeys } from './lib/migrateStorageKeys';
import { startAnalyticsSink } from './lib/analyticsSink';
import { i18nReady } from './lib/i18n';
import App from './App';

migrateLegacyStorageKeys();
startAnalyticsSink();

registerSW({
  immediate: true,
  onOfflineReady() {
    console.info('[PWA] 오프라인에서도 열 수 있습니다.');
  },
});

// 주소 언어의 번역(한국어 말고는 따로 받는 조각)이 온 뒤에 그린다 — 실패해도 한국어로 그린다(i18nReady는 거부되지 않음)
void i18nReady.then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
