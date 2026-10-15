// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FamilyPreferencesSchema } from '../../packages/domain/src/family-preferences-api';
import { resetPrivateSession } from '../../src/web/lib/private-session';
import { ApiError } from '../../src/web/services/http';
import { familyPreferencesKey } from '../../src/web/features/family/useFamilyPreferences';
import { OnboardingPage } from '../../src/web/pages/OnboardingPage';
import { useAuthStore } from '../../src/web/stores/useAuthStore';

const mocks = vi.hoisted(() => ({
  completeOnboarding: vi.fn(),
  familyGet: vi.fn(),
  familySave: vi.fn(),
}));

vi.mock('../../src/web/services/api', () => ({
  api: { completeOnboarding: mocks.completeOnboarding },
}));

vi.mock('../../src/web/services/family-preferences', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, familyPreferencesApi: { get: mocks.familyGet, save: mocks.familySave } };
});

const LocationProbe = () => {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
};

describe('screens 04-06 — onboarding contract', () => {
  let root: Root | undefined;
  let host: HTMLDivElement;
  let client: QueryClient;

  const mount = async (path: string) => {
    await act(async () => {
      root = createRoot(host);
      root.render(
        <QueryClientProvider client={client}>
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route path="/onboarding/*" element={<OnboardingPage />} />
              <Route path="*" element={<div data-testid="destination" />} />
            </Routes>
            <LocationProbe />
          </MemoryRouter>
        </QueryClientProvider>,
      );
      await Promise.resolve();
    });
    for (let index = 0; index < 5; index++)
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
      });
  };

  const location = () => host.querySelector('[data-testid="location"]')?.textContent;
  const button = (name: string) =>
    Array.from(host.querySelectorAll('button')).find((item) => item.textContent?.includes(name)) as
      HTMLButtonElement | undefined;
  const click = async (element: HTMLElement | undefined) => {
    expect(element).toBeDefined();
    await act(async () => element?.click());
  };

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('frigo_user_id', 'user-onboarding');
    localStorage.setItem('frigo_household_id', 'household-onboarding');
    useAuthStore.setState({
      userId: 'user-onboarding',
      householdId: 'household-onboarding',
      isGuest: false,
      isOnboarded: false,
      householdSize: 2,
      spicyLevel: 'medium',
      favoriteCuisines: [],
      dietaryRestrictions: [],
      primaryGoal: undefined,
    });
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(['planning-preferences', 'unused'], {});
    mocks.familyGet.mockReset();
    mocks.familySave.mockReset();
    mocks.familyGet.mockImplementation(async () => ({
      revision: 0,
      preferences: FamilyPreferencesSchema.parse({
        preferredCuisines: useAuthStore
          .getState()
          .favoriteCuisines.filter((value) =>
            ['vietnamese', 'korean', 'japanese', 'italian', 'chinese', 'thai'].includes(value),
          ),
      }),
    }));
    mocks.familySave.mockImplementation(async (revision, preferences) => ({
      revision: revision + 1,
      preferences,
    }));
    mocks.completeOnboarding.mockReset();
    mocks.completeOnboarding.mockResolvedValue({ success: true, onboardingCompleted: true });
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = undefined;
    host.remove();
    client.clear();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('screen 04 owns only household size and exposes native single-select state', async () => {
    await mount('/onboarding/household');

    expect(location()).toBe('/onboarding/household');
    expect(host.textContent).toContain('Nhà mình thường có bao nhiêu người ăn?');
    expect(host.textContent).not.toContain('Khẩu vị quen của nhà mình');
    expect(host.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('1');

    const radios = Array.from(
      host.querySelectorAll<HTMLInputElement>('input[type="radio"][name="household-size"]'),
    );
    expect(radios).toHaveLength(5);
    expect(radios.filter((radio) => radio.checked).map((radio) => radio.value)).toEqual(['2']);
    await act(async () => radios[3].click());
    expect(radios[3].checked).toBe(true);
  });

  it('screen 05 separates family habits, supported international cuisines and hard restrictions', async () => {
    await mount('/onboarding/preferences');
    expect(location()).toBe('/onboarding/preferences');
    expect(host.textContent).toContain('Khẩu vị quen của nhà mình');
    expect(host.textContent).toContain('Dị ứng cần tránh');
    expect(host.textContent).toContain('Nguyên liệu không ăn');
    expect(host.textContent).toContain('Nguyên liệu không thích');
    expect(host.textContent).not.toContain('Số người thường ăn');
    const cuisines = Array.from(
      host.querySelectorAll<HTMLInputElement>('input[name="favorite-cuisines"]'),
    );
    expect(cuisines.map((item) => item.value)).toEqual([
      'korean',
      'japanese',
      'chinese',
      'thai',
      'italian',
    ]);
    expect(cuisines.every((item) => !item.checked)).toBe(true);
    await act(async () => cuisines[0].click());
    expect(cuisines[0].checked).toBe(true);
    await click(button('Tiếp tục'));
    await click(button('Bắt đầu với Takolio'));
    expect(mocks.familySave).toHaveBeenCalledWith(
      0,
      expect.objectContaining({
        preferredCuisines: ['korean'],
        internationalMealsPerWeek: 0,
        mealStyle: 'family',
      }),
    );
    expect(mocks.completeOnboarding).toHaveBeenCalledWith(
      expect.objectContaining({
        favoriteCuisines: ['korean'],
        dietaryRestrictions: [],
      }),
    );
  });

  it('next and back change both content and URL while direct navigation selects the URL-owned step', async () => {
    await mount('/onboarding/household');

    await click(button('Tiếp tục'));
    expect(location()).toBe('/onboarding/preferences');
    expect(host.textContent).toContain('Nhà mình thường nấu thế nào?');

    await click(button('Tiếp tục'));
    expect(location()).toBe('/onboarding/goals');
    expect(host.textContent).toContain('Bạn muốn Takolio giúp việc gì trước?');

    await click(button('Quay lại'));
    expect(location()).toBe('/onboarding/preferences');
    expect(host.textContent).toContain('Khẩu vị quen của nhà mình');
  });

  it('screen 06 owns a native single-select planning goal with exactly the supported values', async () => {
    await mount('/onboarding/goals');

    expect(host.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('3');
    const goals = Array.from(
      host.querySelectorAll<HTMLInputElement>('input[type="radio"][name="primary-goal"]'),
    );
    expect(goals.map((goal) => goal.value)).toEqual(['today', 'week', 'both']);
    expect(goals.filter((goal) => goal.checked).map((goal) => goal.value)).toEqual(['both']);
    expect(host.textContent).not.toContain('Xem lại sở thích của nhà mình');

    await act(async () => goals[1].click());
    expect(goals.filter((goal) => goal.checked).map((goal) => goal.value)).toEqual(['week']);
  });

  it('screen 06 reviews persisted preference fields alongside the goal and keeps completion server-authoritative', async () => {
    useAuthStore.setState({ favoriteCuisines: ['vietnamese'] });
    await mount('/onboarding/goals');

    expect(host.querySelector('[data-testid="onboarding-preference-review"]')).toBeTruthy();
    expect(host.querySelector('[data-testid="onboarding-goal-group"]')).toBeTruthy();
    expect(host.textContent).toContain('Quy mô bữa ăn');
    expect(host.textContent).toContain('2 người');
    expect(host.textContent).toContain('Việt Nam');
    expect(host.textContent).toContain('Mức độ cay');
    expect(host.textContent).toContain('Cay vừa');
    expect(host.textContent).toContain('Không có lựa chọn');

    await click(button('Bắt đầu với Takolio'));

    expect(mocks.completeOnboarding).toHaveBeenCalledWith({
      householdSize: 2,
      spicyLevel: 'medium',
      favoriteCuisines: ['vietnamese'],
      dietaryRestrictions: [],
    });
    expect(mocks.completeOnboarding.mock.calls[0][0]).not.toHaveProperty('primaryGoal');
    expect(location()).toBe('/');
    expect(useAuthStore.getState()).toMatchObject({
      isOnboarded: true,
      householdSize: 2,
      favoriteCuisines: ['vietnamese'],
      dietaryRestrictions: [],
      primaryGoal: 'both',
    });
  });

  it('goal selection survives route navigation and week routes to /week/setup without being sent to the server', async () => {
    await mount('/onboarding/goals');

    const week = host.querySelector<HTMLInputElement>('input[name="primary-goal"][value="week"]');
    await act(async () => week?.click());
    await click(button('Quay lại'));
    expect(location()).toBe('/onboarding/preferences');
    await click(button('Tiếp tục'));
    expect(location()).toBe('/onboarding/goals');
    expect(
      host.querySelector<HTMLInputElement>('input[name="primary-goal"][value="week"]')?.checked,
    ).toBe(true);

    await click(button('Bắt đầu với Takolio'));

    expect(mocks.completeOnboarding).toHaveBeenCalledTimes(1);
    expect(Object.keys(mocks.completeOnboarding.mock.calls[0][0]).sort()).toEqual([
      'dietaryRestrictions',
      'favoriteCuisines',
      'householdSize',
      'spicyLevel',
    ]);
    expect(location()).toBe('/week/setup');
    expect(useAuthStore.getState().primaryGoal).toBe('week');
  });

  it.each(['today', 'both'] as const)(
    '%s goal routes to / after confirmed completion',
    async (goal) => {
      await mount('/onboarding/goals');
      const option = host.querySelector<HTMLInputElement>(
        `input[name="primary-goal"][value="${goal}"]`,
      );
      await act(async () => option?.click());
      await click(button('Bắt đầu với Takolio'));

      expect(location()).toBe('/');
      expect(mocks.completeOnboarding.mock.calls[0][0]).not.toHaveProperty('primaryGoal');
      expect(useAuthStore.getState().primaryGoal).toBe(goal);
    },
  );

  it('does not navigate on goal when completion is not confirmed', async () => {
    mocks.completeOnboarding.mockResolvedValueOnce({ success: true, onboardingCompleted: false });
    await mount('/onboarding/goals');
    const week = host.querySelector<HTMLInputElement>('input[name="primary-goal"][value="week"]');
    await act(async () => week?.click());
    await click(button('Bắt đầu với Takolio'));

    expect(location()).toBe('/onboarding/goals');
    expect(useAuthStore.getState().primaryGoal).toBeUndefined();
  });

  it('round-trips an authoritative household size above the visible buckets when untouched', async () => {
    useAuthStore.setState({ householdSize: 7 });
    await mount('/onboarding/household');

    const radios = Array.from(
      host.querySelectorAll<HTMLInputElement>('input[type="radio"][name="household-size"]'),
    );
    expect(radios).toHaveLength(5);
    expect(radios.filter((radio) => radio.checked).map((radio) => radio.value)).toEqual(['5']);
    expect(radios[4].closest('label')?.textContent).toContain('5+');

    await click(button('Tiếp tục'));
    expect(location()).toBe('/onboarding/preferences');
    await click(button('Tiếp tục'));
    expect(location()).toBe('/onboarding/goals');
    expect(
      host.querySelector('[data-testid="onboarding-preference-review"]')?.textContent,
    ).toContain('5 người trở lên');

    await click(button('Bắt đầu với Takolio'));
    expect(mocks.completeOnboarding).toHaveBeenCalledWith(
      expect.objectContaining({ householdSize: 7 }),
    );
    expect(useAuthStore.getState().householdSize).toBe(7);
  });

  it('retains a saved family size when the older account profile has a different size', async () => {
    useAuthStore.setState({ householdSize: 2 });
    mocks.familyGet.mockResolvedValue({
      revision: 4,
      preferences: FamilyPreferencesSchema.parse({ householdSize: 4 }),
    });
    await mount('/onboarding/household');
    expect(
      host.querySelector<HTMLInputElement>('input[name="household-size"][value="4"]')?.checked,
    ).toBe(true);
    await click(button('Tiếp tục'));
    await click(button('Tiếp tục'));
    expect(
      host.querySelector('[data-testid="onboarding-preference-review"]')?.textContent,
    ).toContain('4 người');
    await click(button('Bắt đầu với Takolio'));
    expect(mocks.familySave).toHaveBeenCalledWith(4, expect.objectContaining({ householdSize: 4 }));
    expect(mocks.completeOnboarding).toHaveBeenCalledWith(
      expect.objectContaining({ householdSize: 4 }),
    );
    expect(useAuthStore.getState().householdSize).toBe(4);
  });

  it('keeps the explicit household choice when a saved family profile arrives later', async () => {
    let resolve!: (value: unknown) => void;
    mocks.familyGet.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    await mount('/onboarding/household');
    await act(async () =>
      host.querySelector<HTMLInputElement>('input[name="household-size"][value="3"]')?.click(),
    );
    await act(async () => {
      resolve({ revision: 4, preferences: FamilyPreferencesSchema.parse({ householdSize: 4 }) });
      await Promise.resolve();
    });
    for (let index = 0; index < 5; index++)
      await act(async () => {
        await new Promise((done) => setTimeout(done, 5));
      });
    expect(
      host.querySelector<HTMLInputElement>('input[name="household-size"][value="3"]')?.checked,
    ).toBe(true);
    await click(button('Tiếp tục'));
    await click(button('Tiếp tục'));
    await click(button('Bắt đầu với Takolio'));
    expect(mocks.familySave).toHaveBeenCalledWith(4, expect.objectContaining({ householdSize: 3 }));
    expect(mocks.completeOnboarding).toHaveBeenCalledWith(
      expect.objectContaining({ householdSize: 3 }),
    );
  });

  it('uses the canonical 5 only when the user explicitly picks the 5+ choice', async () => {
    useAuthStore.setState({ householdSize: 7 });
    await mount('/onboarding/household');

    const radios = Array.from(
      host.querySelectorAll<HTMLInputElement>('input[type="radio"][name="household-size"]'),
    );
    await act(async () => radios[2].click());
    expect(radios[2].checked).toBe(true);
    await act(async () => radios[4].click());
    expect(radios[4].checked).toBe(true);

    await click(button('Tiếp tục'));
    await click(button('Tiếp tục'));
    await click(button('Bắt đầu với Takolio'));
    expect(mocks.completeOnboarding).toHaveBeenCalledWith(
      expect.objectContaining({ householdSize: 5 }),
    );
  });

  it('does not complete locally when the server response does not confirm completion', async () => {
    mocks.completeOnboarding.mockResolvedValueOnce({
      success: false,
      onboardingCompleted: false,
    });
    await mount('/onboarding/goals');
    await click(button('Bắt đầu với Takolio'));

    expect(location()).toBe('/onboarding/goals');
    expect(useAuthStore.getState().isOnboarded).toBe(false);
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Chưa thể lưu sở thích');
  });

  it('preserves western and other cuisine preferences in review and completion', async () => {
    useAuthStore.setState({ favoriteCuisines: ['western', 'other'] });
    await mount('/onboarding/goals');

    expect(host.textContent).toContain('western (hồ sơ cũ, chưa áp dụng)');
    expect(host.textContent).toContain('other (hồ sơ cũ, chưa áp dụng)');
    await click(button('Bắt đầu với Takolio'));
    expect(mocks.completeOnboarding).toHaveBeenCalledWith(
      expect.objectContaining({ favoriteCuisines: ['western', 'other'] }),
    );
  });

  it('keeps an empty cuisine selection empty instead of inventing a default', async () => {
    await mount('/onboarding/goals');

    expect(
      host.querySelector('[data-testid="onboarding-preference-review"]')?.textContent,
    ).toContain('Ẩm thực yêu thíchKhông có lựa chọn');
    await click(button('Bắt đầu với Takolio'));
    expect(mocks.completeOnboarding).toHaveBeenCalledWith(
      expect.objectContaining({ favoriteCuisines: [] }),
    );
  });

  it('preserves the canonical other dietary restriction in review and completion', async () => {
    useAuthStore.setState({ dietaryRestrictions: ['other'] });
    await mount('/onboarding/goals');

    expect(
      host.querySelector('[data-testid="onboarding-preference-review"]')?.textContent,
    ).toContain('Hạn chế từ hồ sơ cũKhác');
    await click(button('Bắt đầu với Takolio'));
    expect(mocks.completeOnboarding).toHaveBeenCalledWith(
      expect.objectContaining({ dietaryRestrictions: ['other'] }),
    );
  });

  it('round-trips persisted preferences outside the selectable chip vocabulary', async () => {
    useAuthStore.setState({
      favoriteCuisines: ['italian'],
      dietaryRestrictions: ['vegetarian'],
    });
    await mount('/onboarding/goals');

    const review = host.querySelector('[data-testid="onboarding-preference-review"]')?.textContent;
    expect(review).toContain('Ẩm thực yêu thíchÝ');
    expect(review).toContain('Hạn chế từ hồ sơ cũvegetarian');
    await click(button('Bắt đầu với Takolio'));
    expect(mocks.completeOnboarding).toHaveBeenCalledWith(
      expect.objectContaining({
        favoriteCuisines: ['italian'],
        dietaryRestrictions: ['vegetarian'],
      }),
    );
  });

  it.each([
    ['mild', 'Ít cay'],
    ['medium', 'Cay vừa'],
    ['hot', 'Cay nhiều'],
  ] as const)(
    'preserves stored %s spicy preference independently of the spicy restriction',
    async (spicyLevel, label) => {
      useAuthStore.setState({ spicyLevel, dietaryRestrictions: ['spicy'] });
      await mount('/onboarding/goals');

      expect(host.textContent).toContain(label);
      expect(host.textContent).toContain('Đồ cay');
      await click(button('Bắt đầu với Takolio'));
      expect(mocks.completeOnboarding).toHaveBeenCalledWith(
        expect.objectContaining({ spicyLevel, dietaryRestrictions: ['spicy'] }),
      );
    },
  );

  it('canonicalizes the legacy onboarding entry to screen 04', async () => {
    await mount('/onboarding');
    expect(location()).toBe('/onboarding/household');
    expect(host.textContent).toContain('Nhà mình thường có bao nhiêu người ăn?');
  });
  it('routes a week goal to the family planner when both planner flags are enabled', async () => {
    vi.stubEnv('VITE_MEAL_PLANNER_ENABLED', 'true');
    vi.stubEnv('VITE_MEAL_COMPOSITION_V2_ENABLED', 'true');
    await mount('/onboarding/goals');
    await act(async () =>
      host.querySelector<HTMLInputElement>('input[name="primary-goal"][value="week"]')?.click(),
    );
    await click(button('Bắt đầu với Takolio'));
    expect(location()).toBe('/planner/new');
  });

  it('keeps the captured profile revision across background refresh and requires conflict adoption', async () => {
    mocks.familyGet.mockResolvedValue({
      revision: 4,
      preferences: FamilyPreferencesSchema.parse({}),
    });
    await mount('/onboarding/preferences');
    const south = Array.from(
      host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
    ).find((input) => input.closest('label')?.textContent === 'Miền Nam');
    await act(async () => south?.click());
    await act(async () =>
      client.setQueryData(familyPreferencesKey(), {
        revision: 5,
        preferences: FamilyPreferencesSchema.parse({ preferredRegions: ['bac'] }),
      }),
    );
    await click(button('Tiếp tục'));
    expect(host.querySelector('[data-testid="family-preference-review"]')?.textContent).toContain(
      'Miền Nam',
    );
    mocks.familySave.mockRejectedValueOnce(
      new ApiError('http', 'HTTP 409: {"code":"REVISION_CONFLICT"}', 409),
    );
    await click(button('Bắt đầu với Takolio'));
    expect(mocks.familySave).toHaveBeenCalledWith(
      4,
      expect.objectContaining({ preferredRegions: ['nam'] }),
    );
    expect(mocks.completeOnboarding).not.toHaveBeenCalled();
    expect(button('Bắt đầu với Takolio')?.disabled).toBe(true);
    mocks.familyGet.mockResolvedValue({
      revision: 5,
      preferences: FamilyPreferencesSchema.parse({ preferredRegions: ['bac'] }),
    });
    await click(button('Tải lại và xem thói quen mới nhất'));
    expect(host.querySelector('[data-testid="family-preference-review"]')?.textContent).toContain(
      'Miền Bắc',
    );
    await click(button('Bắt đầu với Takolio'));
    expect(mocks.familySave).toHaveBeenLastCalledWith(
      5,
      expect.objectContaining({ preferredRegions: ['bac'] }),
    );
    expect(mocks.completeOnboarding).toHaveBeenCalledTimes(1);
  });
  it('reviews and completes using the authoritative family cuisines instead of an older legacy profile', async () => {
    useAuthStore.setState({ favoriteCuisines: ['japanese'] });
    mocks.familyGet.mockResolvedValue({
      revision: 3,
      preferences: FamilyPreferencesSchema.parse({ preferredCuisines: ['vietnamese', 'thai'] }),
    });
    await mount('/onboarding/goals');
    const review = host.querySelector('[data-testid="onboarding-preference-review"]')?.textContent;
    expect(review).toContain('Việt Nam, Thái Lan');
    expect(review).not.toContain('Nhật Bản');
    await click(button('Bắt đầu với Takolio'));
    expect(mocks.completeOnboarding).toHaveBeenCalledWith(
      expect.objectContaining({ favoriteCuisines: ['vietnamese', 'thai'] }),
    );
  });

  it('does not apply completion or navigate after the private session changes during completion', async () => {
    let resolve!: (value: unknown) => void;
    mocks.completeOnboarding.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    await mount('/onboarding/goals');
    await click(button('Bắt đầu với Takolio'));
    expect(mocks.completeOnboarding).toHaveBeenCalledTimes(1);
    await act(async () => {
      resetPrivateSession();
      localStorage.setItem('frigo_user_id', 'user-next');
      useAuthStore.setState({ userId: 'user-next', isOnboarded: false });
      resolve({ success: true, onboardingCompleted: true });
      await Promise.resolve();
    });
    expect(location()).toBe('/onboarding/goals');
    expect(useAuthStore.getState().isOnboarded).toBe(false);
  });
});
