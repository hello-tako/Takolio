// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminApp, createAdminQueryClient } from '../../src/admin/App';
import { vi as copy } from '../../src/admin/i18n/vi';

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function setInput(element: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  act(() => {
    setter?.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
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

describe('admin login screen', () => {
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

  function mountAt(path: string, fetchMock: ReturnType<typeof vi.fn>) {
    vi.stubGlobal('fetch', fetchMock);
    window.history.replaceState({}, '', path);
    root = createRoot(host);
    act(() => root?.render(<AdminApp queryClient={createAdminQueryClient()} />));
  }

  const passwordConfig = () =>
    jsonResponse(200, { data: { mode: 'password', environment: 'test' }, context: { environment: 'test', generatedAt: '2026-10-12T00:00:00.000Z', fixtureDataset: null } });

  it('shows the expiry reason banner and the generic message for invalid credentials', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/auth/config')) return passwordConfig();
      return jsonResponse(401, { error: 'bad', code: 'ADMIN_INVALID_CREDENTIALS' });
    });
    mountAt('/admin/login?reason=expired', fetchMock);

    await waitFor(() => host.querySelector('[data-testid="admin-login-email"]') !== null);
    expect(host.querySelector('[data-testid="admin-login-reason"]')?.textContent).toContain(copy.auth.reasons.expired);

    setInput(host.querySelector<HTMLInputElement>('[data-testid="admin-login-email"]')!, 'staff@example.com');
    setInput(host.querySelector<HTMLInputElement>('[data-testid="admin-login-password"]')!, 'wrong-password');
    act(() => {
      host.querySelector<HTMLButtonElement>('[data-testid="admin-login-submit"]')!.click();
    });

    await waitFor(() => host.querySelector('[data-testid="admin-login-error"]') !== null);
    expect(host.querySelector('[data-testid="admin-login-error"]')?.textContent).toBe(copy.errors.ADMIN_INVALID_CREDENTIALS);
    const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit | undefined]>;
    const loginCall = calls.find(([url]) => url.endsWith('/auth/login'));
    expect(loginCall?.[1]).toMatchObject({ method: 'POST', credentials: 'same-origin' });
    expect(loginCall?.[1]?.headers).not.toHaveProperty('X-Admin-CSRF');
  });

  it('renders an explicit unavailable state without a form when password and Access are not configured', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, { data: { mode: 'unavailable', environment: 'production', reason: 'not configured' }, context: { environment: 'production', generatedAt: '2026-10-12T00:00:00.000Z', fixtureDataset: null } }),
    );
    mountAt('/admin/login', fetchMock);

    await waitFor(() => host.querySelector('[data-testid="admin-login-unavailable"]') !== null);
    expect(host.querySelector('[data-testid="admin-login-email"]')).toBeNull();
    expect(host.textContent).not.toContain('not configured');
  });
});
