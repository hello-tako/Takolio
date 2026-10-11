import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';

const h = React.createElement;
const memory = new URLSearchParams(location.search).get('router') === 'memory';
const state = window.__b08RouterProbe = { ready: false, kind: memory ? 'MemoryRouter' : 'BrowserRouter', errors: [], navigationResults: [], codeExecuted: false };
window.addEventListener('error', (event) => {
  state.errors.push(String(event.message));
  if (String(event.message).includes('External navigation is not allowed')) event.preventDefault();
});
const navigateTargets = [
  ['protocol-relative', '//attacker.invalid/probe'],
  ['mixed-slash', '/\\attacker.invalid/probe'],
  ['script-scheme', 'javascript:window.__b08RouterProbe.codeExecuted=true'],
  ['data-scheme', 'data:text/html,synthetic'],
];
function Controls() {
  const current = useLocation();
  const navigate = useNavigate();
  React.useEffect(() => { state.ready = true; }, []);
  return h('main', null,
    h('h1', null, state.kind),
    h('output', { 'data-testid': 'router-location' }, current.pathname + current.search + current.hash),
    h(Link, { 'data-testid': 'trusted-link', to: '/next?from=link#kept' }, 'Trusted Link'),
    h('button', { 'data-testid': 'trusted-navigate', onClick: () => navigate('/safe?from=navigate#kept') }, 'Trusted navigate'),
    h('button', { 'data-testid': 'router-back', onClick: () => navigate(-1) }, 'Back'),
    h('button', { 'data-testid': 'router-forward', onClick: () => navigate(1) }, 'Forward'),
    ...navigateTargets.map(([id, target]) => h('button', {
      key: id, 'data-testid': `unsafe-navigate-${id}`, onClick: () => {
        const before = current.pathname + current.search + current.hash;
        try { navigate(target); state.navigationResults.push({ id, rejected: false, before }); }
        catch (error) { state.navigationResults.push({ id, rejected: true, error: String(error.message), before }); }
      },
    }, id)),
    h(Link, { 'data-testid': 'unsafe-object-link', to: { pathname: '//attacker.invalid/probe' } }, 'Adversarial object Link'),
    h(Link, { 'data-testid': 'explicit-external-link', to: 'https://attacker.invalid/explicit' }, 'Explicit external Link'),
  );
}
const routes = h(Routes, null, h(Route, { path: '*', element: h(Controls) }));
createRoot(document.getElementById('root')).render(memory
  ? h(MemoryRouter, { initialEntries: ['/initial?deep=1#saved'], useTransitions: false }, routes)
  : h(BrowserRouter, { useTransitions: false }, routes));
