// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { PendingOp } from '../../src/web/lib/sync';

const { retryPendingWrites, getBlockedWeekSwap, syncState } = vi.hoisted(() => ({
  retryPendingWrites: vi.fn(),
  getBlockedWeekSwap: vi.fn(),
  syncState: {
    count: null as number | null,
    listener: undefined as ((count: number | null) => void) | undefined,
  },
}));
vi.mock('../../src/web/lib/sync', () => ({
  subscribe: (listener: (count: number | null) => void) => {
    syncState.listener = listener;
    listener(syncState.count);
    return () => undefined;
  },
}));
vi.mock('../../src/web/services/api', () => ({
  api: { retryPendingWrites, getBlockedWeekSwap },
}));
import { OfflineBanner } from '../../src/web/components/common/OfflineBanner';

let root: Root | undefined;
let host: HTMLDivElement;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  retryPendingWrites.mockReset();
  getBlockedWeekSwap.mockReset().mockReturnValue(null);
  syncState.count = null;
  syncState.listener = undefined;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = undefined;
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function render() {
  await act(async () => root!.render(<OfflineBanner />));
}

function button(text: string) {
  const result = [...host.querySelectorAll<HTMLButtonElement>('button')].find((item) => item.textContent === text);
  expect(result, text).toBeTruthy();
  return result!;
}

function conflict(): PendingOp {
  const op: PendingOp = {
    id: 'PRIVATE_OP_ID', operationId: 'PRIVATE_OP_ID', ts: 1,
    path: '/week/plans/PRIVATE_PLAN/meals/PRIVATE_MEAL/swap', method: 'POST',
    body: '{"recipeId":"PRIVATE_RECIPE","commandId":"PRIVATE_COMMAND"}',
    headers: { 'Idempotency-Key': 'PRIVATE_COMMAND' }, label: 'PRIVATE_SERVER_DETAIL',
    userId: 'PRIVATE_USER', householdId: 'PRIVATE_HOUSEHOLD',
  };
  syncState.count = 1;
  getBlockedWeekSwap.mockReturnValue(op);
  return op;
}

it('renders unavailable outbox status and contains retry failure', async () => {
  retryPendingWrites.mockRejectedValue(new Error('PRIVATE_STORAGE_DETAIL'));
  await render();
  expect(host.textContent).toContain('Không thể xác định trạng thái đồng bộ');
  expect(host.textContent).not.toContain('(0 thay đổi)');
  await act(async () => button('Đồng bộ ngay').click());
  expect(retryPendingWrites).toHaveBeenCalledOnce();
  expect(host.textContent).toContain('Không thể đồng bộ');
  expect(host.textContent).not.toContain('PRIVATE_STORAGE_DETAIL');
  await act(async () => syncState.listener!(0));
  expect(host.textContent).toBe('');
  await act(async () => syncState.listener!(null));
  expect(host.textContent).toContain('Không thể xác định trạng thái đồng bộ');
  retryPendingWrites.mockResolvedValue({ attempted: 0, remaining: 0 });
  await act(async () => button('Đồng bộ ngay').click());
  expect(host.textContent).toBe('');
});

it('uses fixed safe conflict copy and cancellation keeps the queued request', async () => {
  conflict();
  await render();
  expect(host.textContent).toContain('Yêu cầu vẫn được giữ trên thiết bị');
  expect(host.textContent).not.toContain('PRIVATE_');
  await act(async () => button('Tải lại và bỏ yêu cầu đổi món').click());
  const dialog = host.querySelector('[role="alertdialog"]');
  expect(dialog).toBeTruthy();
  expect(dialog?.getAttribute('aria-modal')).toBe('true');
  expect(document.activeElement).toBe(button('Giữ yêu cầu'));
  await act(async () => button('Giữ yêu cầu').click());
  expect(host.querySelector('[role="alertdialog"]')).toBeNull();
  expect(retryPendingWrites).not.toHaveBeenCalled();
  expect(host.textContent).toContain('Yêu cầu vẫn được giữ trên thiết bị');
});

it('passes only the confirmed exact snapshot and disables actions during recovery', async () => {
  const original = conflict();
  await render();
  await act(async () => button('Tải lại và bỏ yêu cầu đổi món').click());
  getBlockedWeekSwap.mockReturnValue({ ...original, body: '{}' });
  await act(async () => syncState.listener!(1));
  let finish!: (value: { attempted: number; remaining: number }) => void;
  retryPendingWrites.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
  await act(async () => button('Tải lại và bỏ yêu cầu').click());
  expect(retryPendingWrites).toHaveBeenCalledExactlyOnceWith({ discardWeekSwapConflict: original });
  expect(host.querySelector('[role="alertdialog"]')).toBeNull();
  expect([...host.querySelectorAll<HTMLButtonElement>('button')].every((item) => item.disabled)).toBe(true);
  getBlockedWeekSwap.mockReturnValue(null);
  await act(async () => finish({ attempted: 0, remaining: 0 }));
  expect(host.textContent).toBe('');
});

it('closes confirmation offline and restores the recovery entry point online', async () => {
  conflict();
  await render();
  await act(async () => button('Tải lại và bỏ yêu cầu đổi món').click());
  await act(async () => window.dispatchEvent(new Event('offline')));
  expect(host.querySelector('[role="alertdialog"]')).toBeNull();
  expect(host.querySelector('button')).toBeNull();
  expect(retryPendingWrites).not.toHaveBeenCalled();
  await act(async () => window.dispatchEvent(new Event('online')));
  expect(button('Tải lại và bỏ yêu cầu đổi món')).toBeTruthy();
});

it('contains recovery failure and keeps a retryable conflict visible', async () => {
  conflict();
  retryPendingWrites.mockRejectedValue(new Error('PRIVATE_STORAGE_DETAIL'));
  await render();
  await act(async () => button('Tải lại và bỏ yêu cầu đổi món').click());
  await act(async () => button('Tải lại và bỏ yêu cầu').click());
  expect(host.textContent).toContain('Chưa thể tải lại và bỏ yêu cầu');
  expect(host.textContent).not.toContain('PRIVATE_');
  expect(button('Tải lại và bỏ yêu cầu đổi món').disabled).toBe(false);
});

it('contains unreadable conflict storage without presenting an empty queue', async () => {
  syncState.count = 1;
  getBlockedWeekSwap.mockImplementation(() => { throw new Error('PRIVATE_STORAGE_DETAIL'); });
  await render();
  expect(host.textContent).toContain('Không thể xác định trạng thái đồng bộ');
  expect(host.textContent).not.toContain('PRIVATE_');
  expect(host.textContent).not.toContain('(0 thay đổi)');
  expect(host.textContent).not.toContain('Tải lại và bỏ yêu cầu');
});
