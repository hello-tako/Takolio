import React from 'react';
import { Outlet } from 'react-router-dom';

/** Canonical consumer kitchen route predicate (retained for route-scope invariants). */
export function isKitchenSurface(pathname: string) {
  pathname = pathname.toLowerCase();
  return (
    pathname === '/' ||
    /^\/search\/?$/.test(pathname) ||
    /^\/plus\/?$/.test(pathname) ||
    /^\/(fridge|inventory)\/?$/.test(pathname) ||
    /^\/(fridge|inventory|ingredients)\/[^/]+\/?$/.test(pathname) ||
    /^\/inventory-reconciliation\/?$/.test(pathname) ||
    /^\/scan(?:\/|$)/.test(pathname) ||
    /^\/recipes(?:\/|$)/.test(pathname) ||
    /^\/(cook|cooking)(?:\/|$)/.test(pathname) ||
    /^\/(planner|shopping)(?:\/|$)/.test(pathname) ||
    /^\/week(?:\/(?:setup|generating|[^/]+(?:\/(?:shopping|settings|meal\/[^/]+))?))?\/?$/.test(pathname) ||
    /^\/(me|profile|notifications)\/?$/.test(pathname) ||
    /^\/me\/(preferences|household)\/?$/.test(pathname) ||
    /^\/settings\/(app|planning|notifications|privacy)\/?$/.test(pathname)
  );
}

/** Pure vNext Kitchen Studio Route Outlet — legacy dual-shell removed at Gate G12. */
export const AppLayout: React.FC = () => <Outlet />;
