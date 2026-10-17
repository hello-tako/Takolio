import { useEffect, type ReactNode } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AdminApiError, isSessionFailure, onAdminSessionFailure, setMemoryCsrfToken } from '../api/client';
import { useMe } from '../api/hooks';
import { AdminShell } from '../components/AdminShell';
import { AdminErrorBoundary } from '../components/ErrorBoundary';
import { ErrorState, LoadingState, NotConfigured, PermissionDenied } from '../components/ui';
import { vi } from '../i18n/vi';
import { hasPermission } from '../lib/nav';
import type { AdminPermission } from '@shared/admin';

/** `midSession` distinguishes an ended session from a first visit. */
export function loginPathFor(code: string | undefined, midSession = false): string {
  switch (code) {
    case 'ADMIN_SESSION_EXPIRED':
      return '/login?reason=expired';
    case 'ADMIN_SESSION_REVOKED':
      return '/login?reason=revoked';
    case 'ADMIN_ACCESS_DENIED':
      return '/login?reason=access';
    case 'ADMIN_UNAUTHENTICATED':
      return midSession ? '/login?reason=ended' : '/login';
    default:
      return '/login';
  }
}

/** Global 401 handling for ordinary requests: clears cached data and returns to the sign-in screen. */
export function SessionBridge() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  useEffect(
    () =>
      onAdminSessionFailure((error) => {
        setMemoryCsrfToken(null);
        queryClient.clear();
        navigate(loginPathFor(error.code, true), { replace: true });
      }),
    [navigate, queryClient],
  );
  return null;
}

function StandaloneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="standalone">
      <main id="admin-main" className="standalone-main" tabIndex={-1}>
        <h1 className="standalone-title" data-testid="admin-page-title">
          {vi.appName}
        </h1>
        {children}
      </main>
    </div>
  );
}

/** Layout route: every console screen requires a verified admin session (/me). */
export function RequireSession() {
  const me = useMe();
  const location = useLocation();

  if (me.isPending) {
    return (
      <StandaloneFrame>
        <LoadingState rows={4} />
      </StandaloneFrame>
    );
  }
  if (me.isError) {
    const error = me.error;
    if (isSessionFailure(error) || (error instanceof AdminApiError && error.code === 'ADMIN_ACCESS_DENIED')) {
      return <Navigate to={loginPathFor(error.code)} replace />;
    }
    return (
      <StandaloneFrame>
        {error instanceof AdminApiError && error.code === 'ADMIN_AUTH_NOT_CONFIGURED' ? (
          <NotConfigured />
        ) : (
          <ErrorState error={error} onRetry={() => void me.refetch()} />
        )}
      </StandaloneFrame>
    );
  }

  return (
    <AdminShell me={me.data}>
      <AdminErrorBoundary key={location.pathname}>
        <Outlet />
      </AdminErrorBoundary>
    </AdminShell>
  );
}

/** Frontend gate for a route; the API still returns 403 ADMIN_FORBIDDEN for the same request. */
export function RequirePermission({ permission, children }: { permission: AdminPermission; children: ReactNode }) {
  const me = useMe();
  if (!me.data) return null;
  if (!hasPermission(me.data.permissions, permission)) return <PermissionDenied permission={permission} />;
  return <>{children}</>;
}
