import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { AdminMetric } from '@shared/admin';
import { AdminApiError } from '../../src/admin/api/client';
import { FixtureBanner, ErrorState } from '../../src/admin/components/ui';
import { MetricCard } from '../../src/admin/components/MetricCard';
import { vi } from '../../src/admin/i18n/vi';

const unavailableMetric: AdminMetric = {
  key: 'confirmed_revenue',
  label: 'Doanh thu xác nhận',
  value: null,
  unit: 'vnd',
  status: 'unavailable',
  source: 'D1:payment_intents',
  definition: 'Tổng tiền các giao dịch đã thanh toán trong khoảng thời gian.',
  note: 'Đối soát nhà cung cấp chưa khả dụng.',
};

const partialMetric: AdminMetric = {
  key: 'active_users',
  label: 'Người dùng hoạt động',
  value: 42,
  unit: 'count',
  status: 'partial',
  source: 'D1:users',
  definition: 'Người dùng có hoạt động trong khoảng thời gian.',
  note: 'Không tính phiên khách.',
};

describe('MetricCard', () => {
  it('renders an unavailable metric with its note, source and definition', () => {
    const html = renderToStaticMarkup(<MetricCard metric={unavailableMetric} />);
    expect(html).toContain('data-testid="admin-metric-confirmed_revenue"');
    expect(html).toContain(vi.common.notAvailable);
    expect(html).toContain('Đối soát nhà cung cấp chưa khả dụng.');
    expect(html).toContain('D1:payment_intents');
    expect(html).toContain('Tổng tiền các giao dịch đã thanh toán');
  });

  it('renders a partial metric value with its note', () => {
    const html = renderToStaticMarkup(<MetricCard metric={partialMetric} />);
    expect(html).toContain('42');
    expect(html).toContain(vi.labels.status.partial);
    expect(html).toContain('Không tính phiên khách.');
    expect(html).toContain('D1:users');
  });
});

describe('FixtureBanner', () => {
  it('is rendered only when a fixture dataset is present', () => {
    const shown = renderToStaticMarkup(<FixtureBanner fixtureDataset="demo-2026" />);
    expect(shown).toContain('data-testid="admin-fixture-banner"');
    expect(shown).toContain('fixture: demo-2026');
    expect(shown).toContain('không phải số liệu sản xuất');
    expect(renderToStaticMarkup(<FixtureBanner fixtureDataset={null} />)).toBe('');
  });
});

describe('ErrorState', () => {
  it('shows the permission-denied state for a 403 ADMIN_FORBIDDEN response', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <ErrorState error={new AdminApiError(403, 'ADMIN_FORBIDDEN', 'forbidden')} />
      </MemoryRouter>,
    );
    expect(html).toContain('data-testid="admin-permission-denied"');
    expect(html).not.toContain('data-testid="admin-error-state"');
  });

  it('shows a retry-later message for rate limits and a generic error otherwise', () => {
    const limited = renderToStaticMarkup(<ErrorState error={new AdminApiError(429, 'RATE_LIMIT_EXCEEDED', 'slow down')} />);
    expect(limited).toContain(vi.errors.RATE_LIMIT_EXCEEDED);
    const generic = renderToStaticMarkup(<ErrorState error={new Error('boom')} />);
    expect(generic).toContain('data-testid="admin-error-state"');
    expect(generic).not.toContain('boom');
  });
});
