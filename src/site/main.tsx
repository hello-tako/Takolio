import React from 'react';
import ReactDOM from 'react-dom/client';
import { SiteApp } from './SiteApp';
import '../web/styles/index.css';

const rootEl = document.getElementById('root');
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <SiteApp />
    </React.StrictMode>,
  );
}
