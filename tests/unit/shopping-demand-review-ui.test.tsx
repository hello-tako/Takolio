// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ShoppingDemandReview } from '../../src/web/features/ShoppingDemandReview';
import {
  shoppingApi,
  type ShoppingItem,
  type ShoppingSnapshot,
} from '../../src/web/services/shopping';
import { ApiError } from '../../src/web/services/http';
import { resetPrivateSession } from '../../src/web/lib/private-session';
import type { ShoppingUnknownDemand } from '../../packages/domain/src/shopping-plan-api';

const contribution = {
  planId: 'plan-a',
  slotId: '2030-01-07:dinner:0',
  componentId: 'soup-a',
  date: '2030-01-07',
  mealType: 'dinner',
  recipeId: 'recipe-a',
  title: 'Canh rau',
  quantity: null,
  unit: 'g',
};
const demand: ShoppingUnknownDemand = {
  sourceId: 'source-a',
  demandKey: 'SALT:g',
  snapshot: 'a'.repeat(64),
  reviewRevision: 0,
  ingredientId: 'SALT',
  name: 'Muối',
  unit: 'g',
  reviewState: 'pending',
  purchaseItemId: null,
  contributions: [
    contribution,
    { ...contribution, componentId: 'side-a', title: 'Rau xào', quantity: 5 },
  ],
};
const receipt = {
  success: true as const,
  sourceId: demand.sourceId,
  demandKey: demand.demandKey,
  reviewRevision: 1,
  reviewState: 'purchased' as const,
  purchaseItemId: 'purchase-a',
  idempotentReplay: false,
};
let host: HTMLDivElement;
let root: Root;
const changed = vi.fn<() => Promise<unknown>>();
const busyChanged = vi.fn();
let props: {
  demands: ShoppingSnapshot['unresolvedItems'];
  items: ShoppingItem[];
  source: ShoppingSnapshot['source'];
  hasPendingChanges?: boolean;
};
async function render() {
  await act(async () =>
    root.render(
      <MemoryRouter>
        <ShoppingDemandReview
          demands={props.demands ?? []}
          items={props.items}
          source={props.source}
          hasPendingChanges={props.hasPendingChanges}
          onChanged={changed}
          onBusyChange={busyChanged}
        />
      </MemoryRouter>,
    ),
  );
}
function button(text: string, scope: HTMLDivElement = host): HTMLButtonElement {
  const found = [...scope.querySelectorAll<HTMLButtonElement>('button')].find(
    (item) => item.textContent?.trim() === text,
  );
  if (!found) throw new Error(`Missing button: ${text}`);
  return found;
}
async function click(text: string, scope: HTMLDivElement = host) {
  await act(async () => button(text, scope).click());
}
async function fill(value: string) {
  await act(async () => {
    const input = host.querySelector<HTMLInputElement>('[role="dialog"] input')!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function submit() {
  await act(async () =>
    host
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
  );
}
beforeEach(() => {
  localStorage.clear();
  resetPrivateSession();
  localStorage.setItem('frigo_user_id', 'user-a');
  localStorage.setItem('frigo_household_id', 'house-a');
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  props = { demands: [demand], items: [], source: 'server' };
  changed.mockReset().mockResolvedValue(undefined);
  busyChanged.mockReset();
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('starts unknown buying intent blank, retains known source amounts, and never uses manual add to resolve it', async () => {
  const review = vi.spyOn(shoppingApi, 'reviewShoppingDemand').mockResolvedValue(receipt);
  const manual = vi.spyOn(shoppingApi, 'addShoppingItem');
  props.items = [{ id: 'manual-salt', name: 'Muối', quantity: 1, unit: 'pack', isChecked: true }];
  await render();
  expect(host.querySelector('.shopping-unresolved')?.textContent).toContain('Muối');
  const details = host.querySelector<HTMLDetailsElement>('.shopping-demand-sources')!;
  expect(details.open).toBe(false);
  expect(details.querySelector('summary')?.textContent).toBe('Xem 1 bữa liên quan');
  expect(details.textContent).toContain('5 g');
  expect(details.textContent).toContain('Lượng món này chưa rõ');
  expect(details.querySelector('a')?.getAttribute('href')).toBe('/recipes/id/recipe-a');
  await click('Chọn lượng mua');
  const panel = host.querySelector<HTMLDivElement>('[role="dialog"]')!;
  expect(panel.querySelector<HTMLInputElement>('input')?.value).toBe('');
  expect(document.activeElement).toBe(panel.querySelector('h2'));
  await submit();
  expect(review).not.toHaveBeenCalled();
  expect(panel.textContent).toContain('Nhập lượng lớn hơn 0');
  await fill('2.5');
  await act(async () => {
    const select = panel.querySelector('select') as HTMLSelectElement;
    select.value = 'bunch';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await submit();
  expect(review).toHaveBeenCalledWith(
    {
      sourceId: 'source-a',
      demandKey: 'SALT:g',
      snapshot: demand.snapshot,
      reviewRevision: 0,
      action: 'purchase',
      quantity: 2.5,
      unit: 'bunch',
    },
    expect.any(String),
  );
  expect(manual).not.toHaveBeenCalled();
  expect(host.querySelector('.shopping-demand-sources a')?.getAttribute('target')).toBe('_blank');
  expect(changed).toHaveBeenCalledTimes(1);
  expect(host.querySelector('[role="dialog"]')).toBeNull();
  expect(host.textContent).toContain('Tổng lượng theo thực đơn vẫn chưa xác định');
});

it('freezes quantity and key on uncertain delivery, retains retry after closing, and warns before leaving', async () => {
  const review = vi
    .spyOn(shoppingApi, 'reviewShoppingDemand')
    .mockRejectedValueOnce(new ApiError('offline', 'Lost response'))
    .mockResolvedValue(receipt);
  await render();
  await click('Chọn lượng mua');
  await fill('0.25');
  await submit();
  const first = review.mock.calls[0];
  expect(host.querySelectorAll('.shopping-demand-sources a')).toHaveLength(0);
  expect(host.querySelector('.shopping-demand-sources')?.textContent).toContain('Canh rau');
  expect(host.querySelector<HTMLInputElement>('[role="dialog"] input')?.matches(':disabled')).toBe(
    true,
  );
  const outside = document.createElement('button');
  document.body.appendChild(outside);
  await act(async () => outside.focus());
  expect(host.querySelector('[role="dialog"]')?.contains(document.activeElement)).toBe(true);
  outside.remove();
  const unload = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(unload);
  expect(unload.defaultPrevented).toBe(true);
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Đóng"]')!.click());
  expect(button('Chọn lượng mua').disabled).toBe(true);
  await click('Thử lại lượng vừa gửi');
  expect(review).toHaveBeenCalledTimes(2);
  expect(review.mock.calls[1]).toEqual(first);
  expect(changed).toHaveBeenCalledTimes(1);
  const after = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(after);
  expect(after.defaultPrevented).toBe(false);
});

it('requires explicit reload and a new choice after a stale rejection, instead of silently retrying or re-keying', async () => {
  const review = vi
    .spyOn(shoppingApi, 'reviewShoppingDemand')
    .mockRejectedValueOnce(
      new ApiError('http', 'HTTP 409: {"code":"SHOPPING_REVIEW_CHANGED"}', 409),
    )
    .mockResolvedValue({ ...receipt, reviewRevision: 2 });
  await render();
  await click('Chọn lượng mua');
  await fill('1');
  await submit();
  expect(host.textContent).toContain('Danh sách vừa thay đổi');
  expect(host.textContent).not.toContain('Thử lại lượng vừa gửi');
  expect(review).toHaveBeenCalledTimes(1);
  props.demands = [{ ...demand, snapshot: 'b'.repeat(64), reviewRevision: 1 }];
  await render();
  await click('Tải lại danh sách');
  expect(changed).toHaveBeenCalledTimes(1);
  expect(review).toHaveBeenCalledTimes(1);
  await click('Chọn lượng mua');
  expect(host.querySelector<HTMLInputElement>('[role="dialog"] input')?.value).toBe('');
  await fill('3');
  await submit();
  expect(review.mock.calls[1][0]).toMatchObject({
    snapshot: 'b'.repeat(64),
    reviewRevision: 1,
    quantity: 3,
  });
  expect(review.mock.calls[1][1]).not.toBe(review.mock.calls[0][1]);
});

it.each(['device', 'queued', 'legacy'] as const)(
  'keeps %s sources readable while disabling review',
  async (state) => {
    const review = vi.spyOn(shoppingApi, 'reviewShoppingDemand');
    if (state === 'device') props.source = 'device';
    if (state === 'queued') props.hasPendingChanges = true;
    if (state === 'legacy')
      props.demands = [
        {
          ingredientId: demand.ingredientId,
          name: demand.name,
          unit: demand.unit,
          contributions: demand.contributions,
        },
      ];
    await render();
    expect(host.querySelector('.shopping-unresolved')?.textContent).toContain('Muối');
    expect(host.querySelector('.shopping-demand-sources a')).not.toBeNull();
    expect(button('Chọn lượng mua').disabled).toBe(true);
    expect(button('Tạm bỏ qua').disabled).toBe(true);
    expect(review).not.toHaveBeenCalled();
    if (state === 'queued') expect(host.textContent).toContain('chờ đồng bộ');
    if (state === 'device') expect(host.textContent).toContain('Kết nối mạng');
  },
);

it('collapses chosen decisions, shows skipped undo, and sends the exact reopen binding', async () => {
  const review = vi
    .spyOn(shoppingApi, 'reviewShoppingDemand')
    .mockResolvedValue({ ...receipt, reviewState: 'pending' });
  props.demands = [
    { ...demand, reviewState: 'purchased', purchaseItemId: 'purchase-a' },
    {
      ...demand,
      sourceId: 'source-b',
      demandKey: 'ONION:piece',
      name: 'Hành tây',
      ingredientId: 'ONION',
      reviewState: 'skipped',
    },
  ];
  props.items = [{ id: 'purchase-a', name: 'Muối', quantity: 2, unit: 'pack', isChecked: false }];
  await render();
  expect(host.querySelector<HTMLDetailsElement>('.shopping-demand-chosen')?.open).toBe(false);
  expect(host.querySelector<HTMLDetailsElement>('.shopping-skipped')?.open).toBe(false);
  expect(host.querySelector('.shopping-demand-chosen')?.textContent).toContain('2 gói');
  expect(host.querySelector('.shopping-unresolved')).toBeNull();
  await click('Xem lại', host.querySelector<HTMLDivElement>('.shopping-skipped')!);
  expect(review.mock.calls[0][0]).toMatchObject({
    sourceId: 'source-b',
    demandKey: 'ONION:piece',
    action: 'reopen',
  });
});

it('separates a confirmed mutation from a failed reload and does not reissue the write', async () => {
  const review = vi.spyOn(shoppingApi, 'reviewShoppingDemand').mockResolvedValue(receipt);
  changed.mockRejectedValueOnce(new Error('read failed')).mockResolvedValue(undefined);
  await render();
  await click('Chọn lượng mua');
  await fill('1');
  await submit();
  expect(host.textContent).toContain('Thao tác đã được lưu');
  expect(button('Chọn lượng mua').disabled).toBe(true);
  expect(host.textContent).not.toContain('Thử lại lượng vừa gửi');
  await click('Tải lại danh sách');
  expect(review).toHaveBeenCalledTimes(1);
  expect(changed).toHaveBeenCalledTimes(2);
});

it('discards attempts on a private-session reset and ignores a late receipt', async () => {
  let resolve!: (value: typeof receipt) => void;
  vi.spyOn(shoppingApi, 'reviewShoppingDemand').mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  await render();
  await click('Chọn lượng mua');
  await fill('1');
  await submit();
  await act(async () => resetPrivateSession());
  expect(host.querySelector('[role="dialog"]')).toBeNull();
  await act(async () => resolve(receipt));
  expect(changed).not.toHaveBeenCalled();
  expect(host.textContent).not.toContain('Đã ghi lượng bạn chọn');
  expect(busyChanged).toHaveBeenLastCalledWith(false);
});

it('keeps known source quantities truthful when the aggregate is unknown and avoids private planner links', async () => {
  props.demands = [
    {
      ...demand,
      contributions: [
        { ...contribution, quantity: 0.13786382327688104, unit: 'kg' },
        {
          ...contribution,
          componentId: 'missing-recipe',
          recipeId: null,
          title: 'Món đã lưu trong bữa',
          quantity: 5,
        },
      ],
    },
  ];
  await render();
  const pending = host.querySelector('.shopping-unresolved')!;
  expect(pending.textContent).toContain('Tổng lượng chưa xác định');
  expect(pending.textContent).not.toContain('công thức vẫn chưa rõ lượng');
  const sources = pending.querySelector('.shopping-demand-sources')!;
  expect(sources.textContent).toContain('5 g');
  expect(sources.textContent).not.toContain('Lượng món này chưa rõ');
  expect(sources.querySelectorAll('a')).toHaveLength(1);
  expect(sources.querySelector('a')?.getAttribute('href')).toBe('/recipes/id/recipe-a');
  expect(sources.textContent).toContain('2030-01-07 · Tối');
  expect(sources.textContent).toContain('Món đã lưu trong bữa');
  expect(host.querySelector('a[href^="/planner/"]')).toBeNull();
});
