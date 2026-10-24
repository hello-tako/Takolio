// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';

const { retryPendingWrites, syncState } = vi.hoisted(() => ({
  retryPendingWrites: vi.fn(),
  syncState: { listener: undefined as ((count: number | null) => void) | undefined },
}));
vi.mock('../../src/web/lib/sync', () => ({
  subscribe: (listener: (count: number | null) => void) => {
    syncState.listener = listener;
    listener(null);
    return () => undefined;
  },
}));
vi.mock('../../src/web/services/api', () => ({
  api: { retryPendingWrites },
}));
import { OfflineBanner } from '../../src/web/components/common/OfflineBanner';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('renders unavailable outbox status and contains retry failure', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  retryPendingWrites.mockRejectedValue(new Error('PRIVATE_STORAGE_DETAIL'));
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<OfflineBanner />));
    expect(host.textContent).toContain('Không thể xác định trạng thái đồng bộ');
    expect(host.textContent).not.toContain('(0 thay đổi)');
    const retry = host.querySelector<HTMLButtonElement>('button');
    expect(retry).toBeTruthy();
    await act(async () => retry!.click());
    expect(retryPendingWrites).toHaveBeenCalledOnce();
    expect(host.textContent).toContain('Không thể đồng bộ');
    expect(host.textContent).not.toContain('PRIVATE_STORAGE_DETAIL');
    await act(async () => syncState.listener!(0));
    expect(host.textContent).toBe('');
    await act(async () => syncState.listener!(null));
    expect(host.textContent).toContain('Không thể xác định trạng thái đồng bộ');
    retryPendingWrites.mockResolvedValue({ attempted: 0, remaining: 0 });
    await act(async () => host.querySelector<HTMLButtonElement>('button')!.click());
    expect(host.textContent).toBe('');
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
