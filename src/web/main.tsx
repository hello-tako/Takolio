import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { api } from './services/api';
import { initSync } from './lib/sync';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// S3: replay queued offline writes automatically when connectivity returns.
initSync(() => api.retryPendingWrites());

// Register Service Worker for PWA in production; in dev, unregister stale SWs so assets stay fresh
if ('serviceWorker' in navigator && import.meta.env.DEV) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      void registration.unregister();
    }
  });
  if ('caches' in window) {
    caches.keys().then((keys) => {
      for (const key of keys) {
        if (key.startsWith('takosan-pwa-')) void caches.delete(key);
      }
    });
  }
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    const buildId = import.meta.env.VITE_GIT_COMMIT || import.meta.env.VITE_BUILD_TIMESTAMP || 'local';
    const serviceWorkerUrl = `/sw.js?v=${encodeURIComponent(buildId)}`;

    navigator.serviceWorker.register(serviceWorkerUrl, { updateViaCache: 'none' })
      .then((registration) => {
        const update = () => registration.update().catch((err) => {
          console.warn('SW update check failed:', err);
        });
        void update();
        window.addEventListener('online', update);
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') void update();
        });
      })
      .catch((err) => {
        console.warn('SW registration failed:', err);
      });
  });
}
