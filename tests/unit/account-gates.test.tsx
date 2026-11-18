import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authState = {
  userId: 'account-user',
  householdId: 'account-household',
  householdSize: 2,
  displayName: 'Khách ghé thăm',
  email: '',
  isGuest: true,
  isPlus: false,
  logoutStatus: 'idle' as const,
  logoutError: null,
  logout: vi.fn(async () => true),
  avatarUrl: undefined,
  syncPlusFromServer: vi.fn(async () => {}),
};

vi.mock('../../src/web/stores/useAuthStore', () => ({
  useAuthStore: (selector?: (state: typeof authState) => unknown) =>
    selector ? selector(authState) : authState,
}));

vi.mock('../../src/web/components/payment/VietQRModal', () => ({
  VietQRModal: () => <div data-testid="payment-modal" />,
}));

import { PlusPaywallPage } from '../../src/web/pages/PlusPaywallPage';
import { U01ProfileHubVNext } from '../../src/web/vnext/screens/AccountAndSystemPages';

const render = (ui: React.ReactElement, path: string) =>
  renderToStaticMarkup(<StaticRouter location={path}>{ui}</StaticRouter>);

describe('guest account gates (vNext + Red-Zone PlusPaywall)', () => {
  beforeEach(() => {
    authState.isGuest = true;
    authState.isPlus = false;
  });

  it('replaces Plus pricing and payment UI with an explicit sign-in link for guests', () => {
    const html = render(<PlusPaywallPage />, '/plus');
    expect(html).toContain('Đăng nhập trước khi chọn gói Plus');
    expect(html).toContain('href="/auth?mode=login&amp;returnTo=%2Fplus"');
    expect(html).not.toContain('Gói 1 Năm');
    expect(html).not.toContain('599.000đ');
    expect(html).not.toContain('data-testid="payment-modal"');
  });

  it('surfaces the guest registration upgrade CTA on U01ProfileHubVNext', () => {
    const html = render(<U01ProfileHubVNext />, '/me');
    expect(html).toContain('Phiên dùng thử khách');
    expect(html).toContain('Tạo tài khoản');
  });

  it('keeps the authenticated Plus shell free of client-owned prices', () => {
    authState.isGuest = false;
    const html = render(<PlusPaywallPage />, '/plus');
    expect(html).toContain('Nâng cấp Takosan Plus');
    expect(html).not.toContain('599.000đ');
    expect(html).not.toContain('79.000đ');
    expect(html).not.toContain('Đăng nhập trước khi chọn gói Plus');
  });
});
