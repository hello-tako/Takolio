import clsx from 'clsx';
import { Menu } from 'lucide-react';
import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ADMIN_ROLE_LABELS_VI, type AdminMe } from '@shared/admin';
import { getAdminDataContext, subscribeAdminDataContext } from '../api/client';
import { useLogout, useSettings } from '../api/hooks';
import { formatDateTime } from '../lib/format';
import { storeDensityPreference, useSidebarCollapsed, useUiDensity } from '../lib/hooks';
import { isNavItemActive, visibleNavItems } from '../lib/nav';
import { vi } from '../i18n/vi';
import { BrandLockup } from './TakolioEmblem';
import { Button, FixtureBanner } from './ui';

function useDataContext() {
  return useSyncExternalStore(subscribeAdminDataContext, getAdminDataContext, getAdminDataContext);
}

function monogramOf(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return 'T';
  return trimmed.slice(0, 1).toUpperCase();
}

export function AdminShell({ me, children }: { me: AdminMe; children: ReactNode }) {
  const context = useDataContext();
  const settings = useSettings();
  const location = useLocation();
  const navigate = useNavigate();
  const logout = useLogout();
  const [collapsed, toggleCollapsed] = useSidebarCollapsed();
  const [density] = useUiDensity();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [quickQuery, setQuickQuery] = useState('');
  const quickInputRef = useRef<HTMLInputElement>(null);

  const serverDensity = settings.data?.preferences.density;
  useEffect(() => {
    if (serverDensity) {
      storeDensityPreference(serverDensity);
    }
  }, [serverDensity]);

  const items = visibleNavItems(me.permissions);
  const normalizedQuery = quickQuery.trim().toLowerCase();
  const filteredItems = normalizedQuery
    ? items.filter((item) => {
        const label = vi.layout.nav[item.id].toLowerCase();
        return label.includes(normalizedQuery) || item.id.includes(normalizedQuery);
      })
    : items;

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onGlobalKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && drawerOpen) {
        setDrawerOpen(false);
        return;
      }
      const target = event.target as HTMLElement | null;
      const inEditable =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        Boolean(target?.isContentEditable);
      if (!inEditable && !collapsed && (event.key === '/' || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k'))) {
        if (quickInputRef.current) {
          event.preventDefault();
          quickInputRef.current.focus();
        }
      }
    };
    document.addEventListener('keydown', onGlobalKeyDown);
    return () => document.removeEventListener('keydown', onGlobalKeyDown);
  }, [drawerOpen, collapsed]);

  const onQuickKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && filteredItems.length > 0) {
      event.preventDefault();
      navigate(filteredItems[0]!.to);
      setQuickQuery('');
      event.currentTarget.blur();
    } else if (event.key === 'Escape') {
      setQuickQuery('');
      event.currentTarget.blur();
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    navigate('/login', { replace: true });
  };

  const envNormalized = (context?.environment ?? '').toLowerCase();
  const envToneClass =
    envNormalized === 'production' ? 'is-production' : envNormalized === 'staging' ? 'is-staging' : undefined;

  return (
    <div
      className={clsx('admin-app', collapsed && 'is-collapsed', drawerOpen && 'drawer-open')}
      data-density={density}
    >
      <a className="skip-link" href="#admin-main">
        {vi.layout.skip}
      </a>

      <aside
        id="admin-sidebar"
        className={clsx('admin-sidebar', drawerOpen && 'is-open')}
        aria-label={vi.layout.sidebarLabel}
      >
        <BrandLockup collapsed={collapsed} />

        {!collapsed ? (
          <div className="sidebar-quick-jump">
            <label htmlFor="admin-quick-jump-input" className="sr-only">
              {vi.layout.quickJumpLabel}
            </label>
            <input
              ref={quickInputRef}
              id="admin-quick-jump-input"
              data-testid="admin-quick-jump"
              type="search"
              className="sidebar-search-input"
              placeholder={vi.layout.quickJumpPlaceholder}
              value={quickQuery}
              onChange={(event) => setQuickQuery(event.target.value)}
              onKeyDown={onQuickKeyDown}
            />
            {!quickQuery ? (
              <span className="sidebar-search-kbd" aria-hidden="true">
                /
              </span>
            ) : null}
          </div>
        ) : null}

        <nav aria-label={vi.layout.navLabel} id="admin-sidebar-nav">
          {filteredItems.length === 0 ? (
            <p className="sidebar-empty-hint">{vi.layout.quickJumpEmpty}</p>
          ) : (
            <ul className="nav-list">
              {filteredItems.map((item) => {
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
          )}
        </nav>

        <div className="sidebar-footer">
          {!collapsed ? (
            <div className="sidebar-posture">
              <span>
                <strong>{vi.labels.authMethod[me.session.authMethod] ?? me.session.authMethod}</strong>
              </span>
              <span>
                RBAC <span className="mono">{me.rbacMatrixVersion}</span> · {vi.layout.densityBadge}:{' '}
                {vi.labels.density[density]}
              </span>
            </div>
          ) : null}
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
        </div>
      </aside>

      {drawerOpen ? (
        <button
          type="button"
          className="drawer-backdrop"
          aria-label={vi.layout.closeMenu}
          onClick={() => setDrawerOpen(false)}
        />
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
            <Menu size={16} aria-hidden="true" />
            <span>{vi.layout.menu}</span>
          </button>

          <div className="topbar-telemetry">
            {context ? (
              <span className={clsx('env-badge', envToneClass)} data-testid="admin-environment">
                <span className="env-dot" aria-hidden="true" />
                <span>
                  {vi.common.environment}: {context.environment.toUpperCase()}
                </span>
              </span>
            ) : null}
            {context?.generatedAt ? (
              <span className="telemetry-pill">
                {vi.layout.telemetrySynced}: {formatDateTime(context.generatedAt)}
              </span>
            ) : null}
          </div>

          <div className="topbar-spacer" />

          <div className="user-chip" data-testid="admin-user-menu">
            <span className="user-avatar" aria-hidden="true">
              {monogramOf(me.displayName)}
            </span>
            <span className="user-meta">
              <span className="user-name">{me.displayName}</span>
              <span className="user-roles">
                {me.roles.map((role) => ADMIN_ROLE_LABELS_VI[role]).join(' · ') || vi.settings.noRoles}
              </span>
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
