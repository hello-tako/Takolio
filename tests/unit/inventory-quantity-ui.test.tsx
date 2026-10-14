// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { InventoryPage } from '../../src/web/pages/InventoryPage';
import { IngredientRow } from '../../src/web/components/common/IngredientRow';
import { adjustedInventoryQuantity, inventoryQuantityStep } from '../../src/web/lib/inventory-quantity';

const mocks = vi.hoisted(() => ({ inventory: vi.fn(), add: vi.fn(), update: vi.fn(), invalidate: vi.fn() }));
vi.mock('../../src/web/services/api', async () => ({
  ApiError: (await import('../../src/web/services/http')).ApiError,
  api: { getInventory: mocks.inventory, addInventoryItem: mocks.add, updateInventoryItem: mocks.update },
}));
vi.mock('../../src/web/lib/query-invalidation', () => ({ invalidateInventoryDependents: mocks.invalidate }));
vi.mock('../../src/web/components/common/TopBar', () => ({ TopBar: () => null }));
let host: HTMLDivElement, root: Root, client: QueryClient;
const button = (label: string) => [...host.querySelectorAll('button')].find(element =>
  element.textContent?.trim() === label || element.getAttribute('aria-label') === label)!;
async function until(check: () => void) {
  for (let attempt = 0; attempt < 100; attempt++) {
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 5)); });
    try { check(); return; } catch (error) { if (attempt === 99) throw error; }
  }
}
async function fill(selector: string, value: string) {
  const input = host.querySelector<HTMLInputElement>(selector)!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function mount() {
  await act(async () => root.render(<QueryClientProvider client={client}>
    <MemoryRouter><InventoryPage /></MemoryRouter>
  </QueryClientProvider>));
  await until(() => expect(mocks.inventory).toHaveBeenCalled());
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.clearAllMocks();
  mocks.inventory.mockResolvedValue([]);
  mocks.add.mockResolvedValue({ id: 'new-stock' });
  mocks.update.mockResolvedValue({ success: true });
  mocks.invalidate.mockResolvedValue(undefined);
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount()); client.clear(); host.remove(); vi.unstubAllGlobals();
});

it('accepts half a kilogram in the actual add form without converting a package into mass', async () => {
  await mount();
  await act(async () => button('Thêm nguyên liệu').click());
  await fill('#add-name', 'Thịt ba chỉ'); await fill('#add-quantity', '0.5');
  const select = host.querySelector('#add-unit') as unknown as HTMLSelectElement;
  await act(async () => {
    select.value = 'kg'; select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  expect(host.querySelector<HTMLInputElement>('#add-quantity')!.checkValidity()).toBe(true);
  await act(async () => button('Lưu vào tủ lạnh').click());
  await until(() => expect(mocks.add).toHaveBeenCalledTimes(1));
  expect(mocks.add.mock.calls[0][0]).toMatchObject({ name: 'Thịt ba chỉ', quantity: 0.5, unit: 'kg' });
});

it.each(['0', '-1', '10001'])('does not dispatch an invalid amount %s', async value => {
  await mount(); await act(async () => button('Thêm nguyên liệu').click());
  await fill('#add-name', 'Thịt'); await fill('#add-quantity', value);
  await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(mocks.add).not.toHaveBeenCalled();
});

it('decrements measured kg stock exactly without manufacturing a positive quantity floor', async () => {
  mocks.inventory.mockResolvedValue([{ id: 'pork', ingredientId: 'PORK_BELLY', name: 'Thịt', quantity: 0.55,
    unit: 'kg', category: 'meat', storage: 'fridge', freshness: 'fresh', version: 7 }]);
  await mount(); await until(() => expect(button('Giảm số lượng')).toBeTruthy());
  await act(async () => button('Giảm số lượng').click());
  await until(() => expect(mocks.update).toHaveBeenCalledExactlyOnceWith('pork', { quantity: 0.5 }, 7));
});

it.each(['kg', 'l', 'g', 'ml', 'piece', 'pack', 'bunch'])('keeps a positive remainder for unit %s until explicitly corrected/deleted', async unit => {
  const change = vi.fn();
  const step = inventoryQuantityStep(unit);
  await act(async () => root.render(<IngredientRow id="stock" name="Nguyên liệu" quantity={step / 2}
    unit={unit} category="other" freshness="fresh" onUpdateQuantity={change} />));
  expect(button('Giảm số lượng').disabled).toBe(true);
  expect(adjustedInventoryQuantity(step / 2, -step)).toBeNull();
  expect(adjustedInventoryQuantity(step, -step)).toBeNull();
  expect(change).not.toHaveBeenCalled();
});
