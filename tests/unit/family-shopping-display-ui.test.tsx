// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { ShoppingPage } from '../../src/web/pages/ShoppingPage';
import { shoppingApi } from '../../src/web/services/shopping';

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
    expect(unresolved.textContent).toContain('Lượng chưa rõ');
    const details = unresolved.querySelector('details')!;
    expect(details.open).toBe(false);
    expect(details.querySelector('summary')?.textContent).toBe('Xem 2 bữa liên quan');
    expect(details.querySelectorAll('a')).toHaveLength(3);
    expect(details.querySelector('a')?.getAttribute('href')).toBe(
      '/planner/plan-a/meal/2030-01-07%3Adinner%3A0',
    );
    expect(host.querySelector('.shopping-row-quantity')?.textContent).toBe(
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
