import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { pendingCountMock, subscribeMock, logoutMock } = vi.hoisted(() => ({
  pendingCountMock: vi.fn(),
  subscribeMock: vi.fn(() => () => {}),
  logoutMock: vi.fn(() => Promise.resolve(true)),
}));

vi.mock('../../src/web/lib/sync', () => ({
  pendingCount: pendingCountMock,
  subscribe: subscribeMock,
}));

vi.mock('../../src/web/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    userId: 'user-a',
    householdId: 'house-a',
    logout: logoutMock,
    logoutError: null,
  }),
}));

import { LogoutDialog } from '../../src/web/components/common/LogoutDialog';

describe('LogoutDialog', () => {
  beforeEach(() => {
    pendingCountMock.mockReturnValue(5);
    pendingCountMock.mockClear();
    subscribeMock.mockClear();
    logoutMock.mockClear();
  });

  it('renders the owned pending-write warning on its first open render', () => {
    const html = renderToStaticMarkup(
      <LogoutDialog open onCancel={vi.fn()} onLoggedOut={vi.fn()} />
    );

    expect(html).toContain('Bạn còn 5 thay đổi chưa đồng bộ.');
    expect(html).toContain('Đăng xuất và bỏ thay đổi');
    expect(html).toContain('Ở lại');
  });


  it('renders conservative copy when pending count is unavailable', () => {
    pendingCountMock.mockReturnValue(null);
    const html = renderToStaticMarkup(<LogoutDialog open onCancel={vi.fn()} onLoggedOut={vi.fn()} />);
    expect(html).toContain('Không thể xác định số thay đổi chưa đồng bộ');
    expect(html).toContain('Đăng xuất');
  });
});
