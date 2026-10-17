import clsx from 'clsx';
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ADMIN_ROLE_LABELS_VI, type AdminMe } from '@shared/admin';
import { getAdminDataContext, subscribeAdminDataContext } from '../api/client';
import { useLogout } from '../api/hooks';
import { useSidebarCollapsed } from '../lib/hooks';
import { isNavItemActive, visibleNavItems } from '../lib/nav';
import { vi } from '../i18n/vi';
import { Button, FixtureBanner } from './ui';

function useDataContext() {
  return useSyncExternalStore(subscribeAdminDataContext, getAdminDataContext, getAdminDataContext);
}

export function AdminShell({ me, children }: { me: AdminMe; children: ReactNode }) {
  const context = useDataContext();
  const location = useLocation();
  const navigate = useNavigate();
  const logout = useLogout();
  const [collapsed, toggleCollapsed] = useSidebarCollapsed();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const items = visibleNavItems(me.permissions);

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen]);

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className={clsx('admin-app', collapsed && 'is-collapsed', drawerOpen && 'drawer-open')}>
      <a className="skip-link" href="#admin-main">
        {vi.layout.skip}
      </a>
      <aside id="admin-sidebar" className={clsx('admin-sidebar', drawerOpen && 'is-open')} aria-label={vi.layout.sidebarLabel}>
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            T
          </span>
          <span className="brand-name">{vi.appName}</span>
        </div>
        <nav aria-label={vi.layout.navLabel} id="admin-sidebar-nav">
          <ul className="nav-list">
            {items.map((item) => {
              const label = vi.layout.nav[item.id];
              const Icon = item.icon;
              const active = isNavItemActive(item, location.pathname);
              return (
                <li key={item.id}>
                  <Link
                    to={item.to}
                    title={collapsed ? label : undefined}
                    data-testid={`admin-nav-${item.id}`}
                    aria-current={active ? 'page' : undefined}
                    className={clsx('nav-link', active && 'is-active')}
                  >
                    <Icon size={18} aria-hidden="true" />
                    <span className={clsx(collapsed ? 'sr-only' : 'nav-label')}>{label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <button
          type="button"
          className="sidebar-toggle"
          data-testid="admin-sidebar-toggle"
          aria-expanded={!collapsed}
          aria-controls="admin-sidebar-nav"
          aria-label={collapsed ? vi.layout.expand : vi.layout.collapse}
          onClick={toggleCollapsed}
        >
          <span className="sidebar-toggle-icon" aria-hidden="true">
            {collapsed ? '»' : '«'}
          </span>
          <span className={clsx(collapsed ? 'sr-only' : 'nav-label')}>{vi.layout.collapse}</span>
        </button>
      </aside>
      {drawerOpen ? (
        <button type="button" className="drawer-backdrop" aria-label={vi.layout.closeMenu} onClick={() => setDrawerOpen(false)} />
      ) : null}
      <div className="admin-body">
        <header className="admin-topbar">
          <button
            type="button"
            className="mobile-menu-button"
            data-testid="admin-mobile-menu"
            aria-expanded={drawerOpen}
            aria-controls="admin-sidebar"
            onClick={() => setDrawerOpen(true)}
          >
            {vi.layout.menu}
          </button>
          {context ? (
            <span className="env-badge" data-testid="admin-environment">
              {vi.common.environment}: {context.environment}
            </span>
          ) : null}
          <div className="topbar-spacer" />
          <div className="user-chip" data-testid="admin-user-menu">
            <span className="user-name">{me.displayName}</span>
            <span className="user-roles">
              {me.roles.map((role) => ADMIN_ROLE_LABELS_VI[role]).join(' · ') || vi.settings.noRoles}
            </span>
          </div>
          <Button variant="ghost" data-testid="admin-logout" onClick={handleLogout} disabled={loggingOut}>
            {loggingOut ? vi.auth.loggingOut : vi.auth.logout}
          </Button>
        </header>
        <FixtureBanner fixtureDataset={context?.fixtureDataset ?? null} />
        <main id="admin-main" className="admin-main" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
