// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { ShoppingPage } from '../../src/web/pages/ShoppingPage';
import { shoppingApi, type ShoppingSnapshot } from '../../src/web/services/shopping';

it('keeps unresolved amounts visible, collapses source meals, and preserves the exact edit value', async () => {
  const quantity = 7 / 12;
  const contribution = {
    planId: 'plan-a',
    slotId: '2030-01-07:dinner:0',
    componentId: 'main-a',
    date: '2030-01-07',
    mealType: 'dinner',
    recipeId: 'recipe-a',
    title: 'Canh rau',
    quantity: null,
    unit: 'g',
  };
  const read = vi.spyOn(shoppingApi, 'getShoppingListSnapshot').mockResolvedValue({
    source: 'server',
    items: [{ id: 'onion-a', name: 'Hành tây', quantity, unit: 'piece', isChecked: false }],
    unresolvedItems: [
      {
        ingredientId: 'SALT',
        name: 'Muối',
        unit: 'g',
        contributions: [
          contribution,
          { ...contribution, componentId: 'side-a', title: 'Rau xào' },
          { ...contribution, slotId: '2030-01-08:dinner:0', date: '2030-01-08', title: 'Canh bí' },
        ],
      },
    ],
  });
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  try {
    await act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <MemoryRouter>
            <ShoppingPage />
          </MemoryRouter>
        </QueryClientProvider>,
      ),
    );
    for (let index = 0; index < 10; index++)
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
      });
    const unresolved = host.querySelector('.shopping-unresolved')!;
    expect(unresolved.textContent).toContain('Muối');
    expect(unresolved.textContent).toContain('Tổng lượng chưa xác định');
    const details = unresolved.querySelector('details')!;
    expect(details.open).toBe(false);
    expect(details.querySelector('summary')?.textContent).toBe('Xem 2 bữa liên quan');
    expect(details.querySelectorAll('a')).toHaveLength(3);
    expect(details.querySelector('a')?.getAttribute('href')).toBe('/recipes/id/recipe-a');
    expect(host.querySelector('.shopping-saved-row .shopping-row-quantity')?.textContent).toBe(
      'Khoảng 0,58 cái / quả / bìa',
    );
    await act(async () =>
      host.querySelector<HTMLButtonElement>('button[aria-label="Sửa số lượng: Hành tây"]')!.click(),
    );
    expect(
      host.querySelector<HTMLInputElement>('[role="dialog"] input[type="number"]')?.value,
    ).toBe(String(quantity));
    expect(read).toHaveBeenCalledTimes(1);
  } finally {
    await act(async () => root.unmount());
    client.clear();
    host.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  }
});

async function withShoppingPage(
  snapshot: ShoppingSnapshot,
  check: (host: HTMLDivElement) => Promise<void>,
) {
  vi.spyOn(shoppingApi, 'getShoppingListSnapshot').mockResolvedValue(snapshot);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  try {
    await act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <MemoryRouter>
            <ShoppingPage />
          </MemoryRouter>
        </QueryClientProvider>,
      ),
    );
    for (let index = 0; index < 10; index++)
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
      });
    await check(host);
  } finally {
    await act(async () => root.unmount());
    client.clear();
    host.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  }
}

it('shows pending demand before the checklist and never declares an unknown-only trip empty', async () => {
  await withShoppingPage(
    {
      source: 'server',
      items: [],
      unresolvedItems: [
        {
          sourceId: 'source-a',
          demandKey: 'SALT:g',
          snapshot: 'a'.repeat(64),
          reviewRevision: 0,
          ingredientId: 'SALT',
          name: 'Muối',
          unit: 'g',
          contributions: [],
          reviewState: 'pending',
          purchaseItemId: null,
        },
      ],
    },
    async (host) => {
      expect(host.querySelector('.shopping-review-count')?.textContent).toBe(
        '1 nguyên liệu cần chọn lượng',
      );
      expect(host.querySelector('.shopping-empty h3')?.textContent).toBe(
        'Còn nguyên liệu cần chọn lượng',
      );
      expect(host.textContent).not.toContain('Chưa có nguyên liệu cần mua');
      expect(
        host
          .querySelector('.shopping-unresolved')!
          .compareDocumentPosition(host.querySelector('.shopping-empty')!) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    },
  );
});

it('marks chosen purchase amounts separately from unresolved recipes and keeps chosen/skipped controls collapsed', async () => {
  await withShoppingPage(
    {
      source: 'server',
      items: [
        {
          id: 'purchase-a',
          name: 'Muối',
          quantity: 0.5,
          unit: 'pack',
          isChecked: false,
          generated: true,
          quantityOverridden: true,
          unknownDemand: true,
          reviewState: 'purchased',
        },
      ],
      unresolvedItems: [
        {
          sourceId: 'source-a',
          demandKey: 'SALT:g',
          snapshot: 'a'.repeat(64),
          reviewRevision: 1,
          ingredientId: 'SALT',
          name: 'Muối',
          unit: 'g',
          contributions: [],
          reviewState: 'purchased',
          purchaseItemId: 'purchase-a',
        },
        {
          sourceId: 'source-a',
          demandKey: 'OIL:ml',
          snapshot: 'b'.repeat(64),
          reviewRevision: 1,
          ingredientId: 'OIL',
          name: 'Dầu ăn',
          unit: 'ml',
          contributions: [],
          reviewState: 'skipped',
          purchaseItemId: null,
        },
      ],
    },
    async (host) => {
      const purchase = host.querySelector('.shopping-saved-row')!;
      expect(purchase.textContent).toContain('1/2 gói · Lượng bạn chọn');
      expect(purchase.textContent).toContain('Tổng lượng theo thực đơn chưa xác định');
      expect(host.querySelector('.shopping-review-count')).toBeNull();
      expect(host.querySelector('.shopping-unresolved')).toBeNull();
      expect(host.querySelector<HTMLDetailsElement>('.shopping-demand-chosen')?.open).toBe(false);
      expect(host.querySelector<HTMLDetailsElement>('.shopping-skipped')?.open).toBe(false);
      expect(
        host.querySelector('.shopping-item-list')?.querySelectorAll('.shopping-saved-row'),
      ).toHaveLength(1);
    },
  );
});
