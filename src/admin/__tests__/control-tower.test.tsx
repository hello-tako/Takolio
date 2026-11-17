// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ADMIN_PERMISSIONS, ADMIN_PERMISSION_LABELS_VI, ADMIN_PERMISSION_MATRIX, permissionsForRoles } from '@shared/admin';
import { AdminApp, createAdminQueryClient } from '../App';

function json(status: number, data: unknown, fixtureDataset: string | null = 'takolio-v4-fixture') {
  return new Response(
    JSON.stringify({
      data,
      csrfToken: 'a'.repeat(64),
      context: { environment: 'staging', generatedAt: '2026-11-18T00:00:00.000Z', fixtureDataset },
    }),
    { status, headers: { 'Content-Type': 'application/json' } },
  );
}

async function waitFor(check: () => boolean) {
  for (let i = 0; i < 80; i += 1) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 8));
    });
    if (check()) return;
  }
  throw new Error('Timed out waiting for condition');
}

function srgbToLuminance(hex: string): number {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrastRatio(fg: string, bg: string): number {
  const l1 = srgbToLuminance(fg);
  const l2 = srgbToLuminance(bg);
  const bright = Math.max(l1, l2);
  const dark = Math.min(l1, l2);
  return (bright + 0.05) / (dark + 0.05);
}

describe('Takolio Control Tower V4 — 12-Screen & WCAG AA Verification', () => {
  let root: Root | undefined;
  let host: HTMLDivElement;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div');
    document.body.appendChild(host);
    window.localStorage.clear();
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = undefined;
    host.remove();
    vi.unstubAllGlobals();
    window.history.replaceState({}, '', '/');
  });

  it('meets WCAG AA (>= 4.5:1) contrast across every Control Tower palette pair', () => {
    const pairs: Array<[string, string, string]> = [
      ['Body ink on stone canvas', '#111A17', '#F7F4EE'],
      ['Body ink on glazed card', '#111A17', '#FFFFFF'],
      ['Muted text on stone canvas', '#505A55', '#F7F4EE'],
      ['Muted text on glazed card', '#505A55', '#FFFFFF'],
      ['Muted text on subtle inset', '#505A55', '#FBF9F5'],
      ['Link jade on glazed card', '#14543A', '#FFFFFF'],
      ['Primary button white on jade', '#FFFFFF', '#1B6B4A'],
      ['Danger button white on crimson', '#FFFFFF', '#A42424'],
      ['Sidebar text on sanctuary', '#F7F4EE', '#111A17'],
      ['Sidebar muted on sanctuary', '#B6C3BD', '#111A17'],
      ['Sidebar muted on raised card', '#B6C3BD', '#182520'],
      ['Badge neutral', '#353C38', '#EDE8DE'],
      ['Badge brand', '#0E3E2A', '#E2F2EA'],
      ['Badge terracotta', '#862415', '#FCEAE6'],
      ['Badge success', '#114E33', '#E2F3EA'],
      ['Badge warning', '#704003', '#FEF1D6'],
      ['Badge danger', '#881D1D', '#FDEAEA'],
      ['Badge info', '#16486E', '#E6F1FA'],
    ];

    for (const [label, fg, bg] of pairs) {
      expect(contrastRatio(fg, bg), `${label} (${fg} on ${bg})`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('renders all 12 screens, exercises PII reveal, recipe workflow review, AI telemetry, and live UI density', async () => {
    let savedDensity: 'comfortable' | 'compact' = 'comfortable';
    let aiWriterMode: 'not_wired' | 'wired' = 'not_wired';

    const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
      const url = new URL(input, 'http://localhost');
      const p = url.pathname.replace('/api/v1/admin', '');

      if (p === '/auth/config') return json(200, { mode: 'password' });
      if (p === '/me') {
        return json(200, {
          userId: 'fx_admin_super',
          displayName: 'Super Operator',
          email: 'su••••@fixture.takosan.test',
          roles: ['SUPER_ADMIN'],
          permissions: permissionsForRoles(['SUPER_ADMIN']),
          session: {
            id: 'sess-1',
            authMethod: 'cloudflare_access',
            createdAt: '2026-11-18T00:00:00.000Z',
            expiresAt: '2026-11-18T08:00:00.000Z',
            idleExpiresAt: '2026-11-18T00:30:00.000Z',
          },
          rbacMatrixVersion: '2026-10-13.v2',
          csrfToken: 'a'.repeat(64),
        });
      }
      if (p === '/settings') {
        return json(200, {
          assignments: [
            {
              id: 'asg-1',
              userId: 'fx_admin_super',
              userDisplayName: 'Super Operator',
              userEmailMasked: 'su••••@fixture.takosan.test',
              role: 'SUPER_ADMIN',
              status: 'active',
              grantSource: 'operator_bootstrap',
              grantedBy: null,
              grantedAt: '2026-11-01T00:00:00.000Z',
              revokedAt: null,
            },
          ],
          approvals: [
            {
              id: 'apr-1',
              action: 'role.grant.super_admin',
              targetUserId: 'fx_admin_ops',
              assignmentId: null,
              requestedBy: 'fx_admin_super',
              requestedAt: '2026-11-18T00:00:00.000Z',
              status: 'pending',
              decidedBy: null,
              decidedAt: null,
              expiresAt: '2026-11-20T00:00:00.000Z',
            },
          ],
          matrix: ADMIN_PERMISSIONS.map((perm) => ({
            permission: perm,
            label: ADMIN_PERMISSION_LABELS_VI[perm],
            roles: [...ADMIN_PERMISSION_MATRIX[perm]],
          })),
          preferences: { locale: 'vi', density: savedDensity, sidebarCollapsed: false },
          rbacMatrixVersion: '2026-10-13.v2',
        });
      }
      if (p === '/preferences' && init?.method === 'PUT') {
        const parsed = JSON.parse(String(init.body)) as { density: 'comfortable' | 'compact' };
        savedDensity = parsed.density;
        return json(200, { locale: 'vi', density: savedDensity, sidebarCollapsed: false });
      }
      if (p === '/sessions') {
        return json(200, [
          {
            id: 'sess-1',
            userId: 'fx_admin_super',
            authMethod: 'cloudflare_access',
            createdAt: '2026-11-18T00:00:00.000Z',
            lastSeenAt: '2026-11-18T00:05:00.000Z',
            expiresAt: '2026-11-18T08:00:00.000Z',
          },
        ]);
      }
      if (p === '/overview') {
        return json(200, {
          range: '30d',
          metrics: [1, 2, 3, 4, 5].map((n) => ({
            key: `m_${n}`,
            label: `Chỉ số ${n}`,
            value: n * 100,
            unit: 'count',
            status: 'ok',
            source: 'D1:users',
            definition: 'Định nghĩa chỉ số',
          })),
          series: [
            {
              key: 's1',
              label: 'Người dùng mới',
              unit: 'count',
              source: 'D1:users',
              points: [
                { date: '2026-11-16', value: 12 },
                { date: '2026-11-17', value: 20 },
              ],
            },
          ],
          health: {
            status: 'ok',
            checks: [{ key: 'd1', label: 'D1 Database', status: 'ok', observedBy: 'local', detail: '1ms' }],
          },
          incidents: [],
        });
      }
      if (p === '/users') {
        return json(200, {
          items: [
            {
              id: 'fx_user_001',
              displayName: 'Nguyễn Văn A',
              emailMasked: 'cu••••@fixture.takosan.test',
              isGuest: false,
              isVerified: true,
              plan: 'plus',
              subscriptionStatus: 'active',
              subscriptionExpiresAt: '2026-12-18T00:00:00.000Z',
              householdCount: 1,
              createdAt: '2026-10-01T00:00:00.000Z',
              lastSeenAt: '2026-11-18T00:00:00.000Z',
              isPlatformAdmin: false,
            },
          ],
          page: 1,
          pageSize: 25,
          total: 1,
        });
      }
      if (p === '/users/fx_user_001') {
        const reveal = url.searchParams.get('reveal') === 'email';
        return json(200, {
          id: 'fx_user_001',
          displayName: 'Nguyễn Văn A',
          emailMasked: 'cu••••@fixture.takosan.test',
          email: reveal ? 'customer001@fixture.takosan.test' : null,
          emailRevealed: reveal,
          isGuest: false,
          isVerified: true,
          plan: 'plus',
          subscriptionStatus: 'active',
          subscriptionExpiresAt: '2026-12-18T00:00:00.000Z',
          householdCount: 1,
          createdAt: '2026-10-01T00:00:00.000Z',
          lastSeenAt: '2026-11-18T00:00:00.000Z',
          isPlatformAdmin: false,
          onboardingCompletedAt: '2026-10-01T00:05:00.000Z',
          authProviders: ['google'],
          households: [{ id: 'hh_001', name: 'Bếp Nhà A', role: 'owner', memberCount: 3, createdAt: '2026-10-01T00:00:00.000Z' }],
          activity: { activeSessions: 2, scans30d: 14, lastScanAt: '2026-11-17T00:00:00.000Z', payments: { paid: 1, pending: 0, failed: 0 } },
          adminRoles: [],
        });
      }
      if (p === '/households') {
        return json(200, {
          items: [
            {
              id: 'hh_001',
              name: 'Bếp Nhà A',
              ownerUserId: 'fx_user_001',
              ownerDisplayName: 'Nguyễn Văn A',
              memberCount: 3,
              inventoryItemCount: 28,
              createdAt: '2026-10-01T00:00:00.000Z',
            },
          ],
          page: 1,
          pageSize: 25,
          total: 1,
        });
      }
      if (p === '/billing/summary') {
        return json(200, {
          range: '30d',
          metrics: [
            {
              key: 'rev',
              label: 'Doanh thu',
              value: 199000,
              unit: 'vnd',
              status: 'ok',
              source: 'D1:payment_intents',
              definition: 'Doanh thu',
            },
          ],
          statusBreakdown: [{ status: 'paid', count: 1, amountVnd: 199000 }],
          checkoutStates: [{ state: 'ready', count: 1 }],
          reconciliationExceptions: [],
          series: [{ key: 'rev_s', label: 'Doanh thu ngày', unit: 'vnd', source: 'D1:payment_intents', points: [{ date: '2026-11-17', value: 199000 }] }],
          providerReconciliation: { status: 'unavailable', note: 'Chưa nối PayOS trực tiếp.' },
        });
      }
      if (p === '/billing/transactions') {
        return json(200, {
          items: [
            {
              id: 'tx_1',
              userId: 'fx_user_001',
              orderCodeMasked: '4821',
              plan: 'plus_monthly',
              amountVnd: 199000,
              status: 'paid',
              effectiveStatus: 'paid',
              hasReconciliationRecord: true,
              createdAt: '2026-11-17T00:00:00.000Z',
              updatedAt: '2026-11-17T00:01:00.000Z',
              expiresAt: '2026-11-17T00:15:00.000Z',
            },
          ],
          page: 1,
          pageSize: 25,
          total: 1,
        });
      }
      if (p === '/ai/summary') {
        return json(200, {
          range: '30d',
          metrics: [{ key: 'ai_req', label: 'Lượt gọi AI', value: 0, unit: 'count', status: 'partial', source: 'D1:ai_requests', definition: 'AI' }],
          byTask: [{ task: 'receipt_ocr', requests: 12, errors: 0, avgLatencyMs: 840, estimatedCostUsd: 0.04 }],
          byModel: [{ provider: 'google', model: 'gemini-2.5-flash', requests: 12, inputTokens: 12000, outputTokens: 2400, estimatedCostUsd: 0.04 }],
          ocr: { scansByStatus: [{ status: 'completed', count: 10 }], jobsByStatus: [{ status: 'completed', count: 10 }], retriedJobs: 1, exhaustedJobs: 0 },
          queue: { localJobStatus: [{ status: 'idle', count: 0 }], remoteBacklog: { status: 'unavailable', note: 'Local preview' } },
          instrumentation: { aiRequestsWriter: aiWriterMode, note: 'Telemetry note' },
          series: [{ key: 'ai_s', label: 'Lượt quét', unit: 'count', source: 'D1:scans', points: [{ date: '2026-11-17', value: 10 }] }],
        });
      }
      if (p === '/ai/usage') {
        return json(200, {
          items: [
            {
              id: 'air_1',
              task: 'receipt_ocr',
              provider: 'google',
              model: 'gemini-2.5-flash',
              inputTokens: 1000,
              outputTokens: 200,
              latencyMs: 820,
              estimatedCostUsd: 0.003,
              status: 'ok',
              createdAt: '2026-11-17T00:00:00.000Z',
            },
          ],
          page: 1,
          pageSize: 25,
          total: 1,
        });
      }
      if (p === '/recipes/summary') {
        return json(200, {
          total: 120,
          byVerification: [{ state: 'reviewed', count: 100 }],
          bySource: [{ sourceType: 'curated', count: 120 }],
          byCuisine: [{ cuisine: 'vietnamese', count: 120 }],
          withReadyMedia: 110,
          catalogMode: 'curated_v3',
          editorialQueue: [{ state: 'in_review', count: 4 }],
        });
      }
      if (p === '/recipes') {
        return json(200, {
          items: [
            {
              id: 'rec_001',
              slug: 'canh-chua-ca-loc',
              title: 'Canh chua cá lóc',
              cuisine: 'vietnamese',
              difficulty: 'easy',
              cookTimeMinutes: 30,
              sourceType: 'curated',
              verificationState: 'reviewed',
              version: 3,
              hasReadyMedia: true,
              latestEditorialState: 'in_review',
              createdAt: '2026-10-01T00:00:00.000Z',
            },
          ],
          page: 1,
          pageSize: 25,
          total: 1,
        });
      }
      if (p === '/recipes/rec_001') {
        return json(200, {
          id: 'rec_001',
          slug: 'canh-chua-ca-loc',
          title: 'Canh chua cá lóc',
          description: 'Món canh miền Nam thanh mát.',
          cuisine: 'vietnamese',
          difficulty: 'easy',
          prepTimeMinutes: 15,
          cookTimeMinutes: 30,
          servings: 4,
          tags: ['mien-nam', 'mon-nuoc'],
          sourceType: 'curated',
          sourceReference: 'takolio-kitchen',
          familyId: 'fam_canh_chua',
          verificationState: 'reviewed',
          version: 3,
          hasReadyMedia: true,
          ingredientCount: 9,
          stepCount: 5,
          latestEditorialState: 'in_review',
          createdAt: '2026-10-01T00:00:00.000Z',
          media: [{ role: 'hero', version: 1, status: 'ready', sourceType: 'r2', mimeType: 'image/webp' }],
          editorialReviews: [{ id: 'rev_1', state: 'in_review', note: 'Đang rà soát định lượng me.', authorUserId: 'fx_admin_super', recipeVersion: 3, createdAt: '2026-11-17T00:00:00.000Z' }],
          publication: { canPublish: false, note: 'Xuất bản khóa an toàn V1.' },
        });
      }
      if (p === '/recipes/rec_001/reviews' && init?.method === 'POST') {
        return json(201, { id: 'rev_2' });
      }
      if (p === '/system/status') {
        return json(200, {
          checks: [{ key: 'd1', label: 'D1 Binding', status: 'ok', observedBy: 'local', detail: 'OK' }],
          release: { gitCommit: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2', environment: 'staging', rbacMatrixVersion: '2026-10-13.v2' },
          database: { reachable: true, schemaChecks: [{ object: 'admin_audit_events', present: true }] },
          featureFlags: [{ key: 'AI_GATEWAY_V4', value: 'true' }],
          warnings: [],
          remoteAdapters: [{ key: 'payos_recon', label: 'PayOS Webhook Ledger', status: 'unavailable', note: 'Isolated' }],
        });
      }
      if (p === '/audit') {
        return json(200, {
          items: [
            {
              id: 'aud_1',
              occurredAt: '2026-11-18T00:00:00.000Z',
              actorUserId: 'fx_admin_super',
              actorRoles: ['SUPER_ADMIN'],
              action: 'users.pii.reveal',
              targetType: 'user',
              targetId: 'fx_user_001',
              outcome: 'success',
              reasonCode: null,
              requestId: 'req_123',
              metadata: { reason: 'support_ticket' },
            },
          ],
          page: 1,
          pageSize: 25,
          total: 1,
        });
      }
      return json(404, { error: 'not found', code: 'ADMIN_NOT_FOUND' });
    });

    vi.stubGlobal('fetch', fetchMock);
    const navigateTo = async (path: string) => {
      act(() => root?.unmount());
      window.history.replaceState({}, '', path);
      root = createRoot(host);
      act(() => root?.render(<AdminApp queryClient={createAdminQueryClient()} />));
    };

    // 1. Login screen
    await navigateTo('/admin/login');
    await waitFor(() => host.querySelector('[data-testid="admin-login-email"]') !== null);
    expect(host.querySelector('[data-testid="admin-page-title"]')?.textContent).toBeTruthy();

    // 2. Overview screen
    await navigateTo('/admin/');
    await waitFor(() => host.querySelectorAll('[data-testid^="admin-metric-"]').length >= 5);
    expect(host.querySelectorAll('[data-testid^="admin-nav-"]').length).toBe(8);

    // 3. Users screen
    await navigateTo('/admin/users');
    await waitFor(() => host.querySelector('[data-testid="admin-user-row"]') !== null);

    // 4. Households screen
    await navigateTo('/admin/households');
    await waitFor(() => host.querySelector('[data-testid="admin-household-row"]') !== null);

    // 5. User Detail + PII Email Reveal Modal
    await navigateTo('/admin/users/fx_user_001');
    await waitFor(() => host.querySelector('[data-testid="admin-user-detail"]') !== null);
    expect(host.querySelector('[data-testid="admin-user-email"]')?.textContent).not.toContain('customer001@');
    act(() => host.querySelector<HTMLButtonElement>('[data-testid="admin-reveal-email"]')!.click());
    await waitFor(() => host.querySelector('[data-testid="admin-reveal-dialog"]') !== null);
    act(() => host.querySelector<HTMLButtonElement>('[data-testid="admin-reveal-confirm"]')!.click());
    await waitFor(() =>
      Boolean(host.querySelector('[data-testid="admin-user-email"]')?.textContent?.includes('customer001@fixture.takosan.test')),
    );

    // 6. Billing screen
    await navigateTo('/admin/billing');
    await waitFor(() => host.querySelector('[data-testid="admin-transaction-row"]') !== null);
    expect(host.querySelector('[data-testid="admin-billing-summary"]')).not.toBeNull();

    // 7a. AI screen (`not_wired`)
    await navigateTo('/admin/ai');
    await waitFor(() => host.querySelector('[data-testid="admin-ai-summary"]') !== null);
    expect(host.querySelector('[data-testid="admin-ai-instrumentation-warning"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="admin-ai-usage-row"]')).not.toBeNull();

    // 7b. AI screen (`wired`)
    aiWriterMode = 'wired';
    await navigateTo('/admin/ai');
    await waitFor(() => host.querySelector('[data-testid="admin-ai-summary"]') !== null);
    expect(host.querySelector('[data-testid="admin-ai-instrumentation-warning"]')).toBeNull();

    // 8. Recipes screen
    await navigateTo('/admin/recipes');
    await waitFor(() => host.querySelector('[data-testid="admin-recipe-row"]') !== null);

    // 9. Recipe Detail + Workflow State Machine + Review Form
    await navigateTo('/admin/recipes/rec_001');
    await waitFor(() => host.querySelector('[data-testid="admin-recipe-detail"]') !== null);
    expect(host.querySelector('.workflow-track')?.querySelectorAll('.workflow-step').length).toBe(5);
    const reviewForm = host.querySelector('[data-testid="admin-recipe-review-form"]')!;
    expect(reviewForm.querySelector('select')).not.toBeNull();
    expect(reviewForm.querySelector('textarea')).not.toBeNull();

    // 10. System screen
    await navigateTo('/admin/system');
    await waitFor(() => host.querySelector('[data-testid="admin-system-check"]') !== null);

    // 11. Audit screen
    await navigateTo('/admin/audit');
    await waitFor(() => host.querySelector('[data-testid="admin-audit-row"]') !== null);

    // 12. Settings screen + Live UI Density (`comfortable` -> `compact`) + Zero fake locale select
    await navigateTo('/admin/settings');
    await waitFor(() => host.querySelector('[data-testid="admin-settings-matrix"]') !== null);
    expect(host.querySelector('#admin-pref-locale')).toBeNull();
    expect(host.querySelector('.admin-app')?.getAttribute('data-density')).toBe('comfortable');

    const densitySelect = host.querySelector('[data-testid="admin-pref-density"]') as unknown as HTMLSelectElement;
    act(() => {
      densitySelect.value = 'compact';
      densitySelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(host.querySelector('.admin-app')?.getAttribute('data-density')).toBe('compact');
    expect(document.documentElement.getAttribute('data-density')).toBe('compact');

    const prefButtons = host.querySelector('[data-testid="admin-preferences-form"]')!.querySelectorAll('button');
    act(() => prefButtons[prefButtons.length - 1]!.click());
    await waitFor(() => host.querySelector('[data-testid="admin-preferences-saved"]') !== null);
  });
});
