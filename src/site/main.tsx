import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { SiteApp } from './SiteApp';
import { readClientSsrPayload } from './types/ssr-data';
import './site.css';

const rootEl = document.getElementById('root');
if (rootEl) {
  const ssrData = readClientSsrPayload();
  const tree = (
    <React.StrictMode>
      <BrowserRouter useTransitions={false}>
        <SiteApp ssrData={ssrData} />
      </BrowserRouter>
    </React.StrictMode>
  );

  // Hydrate True-SSR markup cleanly without destroying the DOM or flashing a spinner
  if (rootEl.hasChildNodes() && rootEl.firstElementChild) {
    ReactDOM.hydrateRoot(rootEl, tree);
  } else {
    ReactDOM.createRoot(rootEl).render(tree);
  }
}
