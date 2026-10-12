// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { permissionsForRoles } from '@shared/admin';
import { AdminApp, createAdminQueryClient } from '../../src/admin/App';

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

async function waitFor(check: () => boolean) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
    if (check()) return;
  }
  throw new Error('condition not reached');
}

function meBody(fixtureDataset: string | null) {
  const roles = ['CONTENT_EDITOR'] as const;
  return {
    data: {
      userId: 'editor-1',
      displayName: 'Biên tập viên',
      email: 'bi••••@example.com',
      roles: [...roles],
      permissions: permissionsForRoles([...roles]),
      session: {
        id: 'session-1',
        authMethod: 'password',
        createdAt: '2026-10-12T01:00:00.000Z',
        expiresAt: '2026-10-12T09:00:00.000Z',
        idleExpiresAt: '2026-10-12T01:30:00.000Z',
      },
      rbacMatrixVersion: '2026-10-12.v1',
    },
    context: { environment: 'test', generatedAt: '2026-10-12T01:00:00.000Z', fixtureDataset },
  };
}

describe('admin shell for a content editor', () => {
  let root: Root | undefined;
  let host: HTMLDivElement;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = undefined;
    host.remove();
    vi.unstubAllGlobals();
    window.history.replaceState({}, '', '/');
  });

  function mountAt(path: string, fixtureDataset: string | null) {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/me')) return jsonResponse(200, meBody(fixtureDataset));
      if (url.endsWith('/settings')) {
        return jsonResponse(200, {
          data: {
            assignments: [],
            approvals: [],
            matrix: [{ permission: 'overview.read', label: 'Xem tổng quan', roles: ['SUPER_ADMIN'] }],
            preferences: { locale: 'vi', density: 'comfortable', sidebarCollapsed: false },
            rbacMatrixVersion: '2026-10-12.v1',
          },
          context: { environment: 'test', generatedAt: '2026-10-12T01:00:00.000Z', fixtureDataset },
        });
      }
      return jsonResponse(404, { error: 'not found', code: 'ADMIN_NOT_FOUND' });
    });
    vi.stubGlobal('fetch', fetchMock);
    window.history.replaceState({}, '', path);
    root = createRoot(host);
    act(() => root?.render(<AdminApp queryClient={createAdminQueryClient()} />));
  }

  it('shows only permitted navigation, the fixture banner, and PermissionDenied on a forbidden route', async () => {
    mountAt('/admin/billing', 'takosan-demo-2026');

    await waitFor(() => host.querySelector('[data-testid="admin-permission-denied"]') !== null);
    expect(host.querySelector('[data-testid="admin-fixture-banner"]')?.textContent).toContain('takosan-demo-2026');
    expect(host.querySelector('[data-testid="admin-page-title"]')?.textContent).toBeTruthy();

    const navIds = Array.from(host.querySelectorAll('[data-testid^="admin-nav-"]')).map((element) => element.getAttribute('data-testid'));
    expect(navIds).toEqual(['admin-nav-overview', 'admin-nav-recipes', 'admin-nav-settings']);
    expect(host.querySelector('[data-testid="admin-nav-billing"]')).toBeNull();
    expect(host.querySelector('[data-testid="admin-user-menu"]')?.textContent).toContain('Biên tập viên');
  });

  it('omits the fixture banner when the database is not a fixture', async () => {
    mountAt('/admin/settings', null);

    await waitFor(() => host.querySelector('[data-testid="admin-settings-matrix"]') !== null);
    expect(host.querySelector('[data-testid="admin-fixture-banner"]')).toBeNull();
    expect(host.querySelector('[data-testid="admin-nav-settings"]')?.getAttribute('aria-current')).toBe('page');
  });
});
