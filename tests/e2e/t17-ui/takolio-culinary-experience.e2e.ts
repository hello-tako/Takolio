import AxeBuilder from '@axe-core/playwright';
import { test, expect, reset, layout } from '../t13b/fixtures';

const RECIPE_SLUG = 'canh-chua-ca-loc-nam-bo';

async function assertAccessibleAndResponsive(page: import('@playwright/test').Page, surface: string) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(350);

  const metrics = await page.evaluate(() => ({
    width: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    h1Count: document.querySelectorAll('h1').length,
    hasMain: Boolean(document.querySelector('main, [role="main"]')),
    imagesWithoutAlt: document.querySelectorAll('img:not([alt])').length,
  }));

  expect(metrics.scrollWidth, `${surface}: no horizontal overflow`).toBeLessThanOrEqual(metrics.width + 1);
  expect(metrics.h1Count, `${surface}: exactly one h1`).toBe(1);
  expect(metrics.hasMain, `${surface}: main landmark present`).toBe(true);
  expect(metrics.imagesWithoutAlt, `${surface}: all img elements have alt`).toBe(0);

  const axe = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .exclude('iframe')
    .analyze();
  expect(
    axe.violations.map((v) => `${surface}: ${v.id} (${v.impact}) — ${v.help}`),
    `${surface}: zero axe WCAG A/AA violations across all severities`,
  ).toEqual([]);
}

test.describe('Takolio Culinary Visual System & Closed-Loop Experience', () => {
  test('recipes discovery, recipe detail culinary steps, and responsive breakpoints pass visual & a11y contracts', async ({
    page,
  }) => {
    await reset(page);

    await page.goto('/recipes');
    await expect(page.getByRole('heading', { name: 'Hôm nay nhà mình nấu gì?', level: 1 })).toBeVisible();
    const loopStrip = page.locator('.kitchen-loop-strip');
    await expect(loopStrip).toBeVisible();
    await expect(loopStrip.getByRole('link', { name: /2\. Chọn món/ })).toHaveAttribute('aria-current', 'step');
    await expect(page.locator('.kitchen-coverage-meter').first()).toBeVisible();
    await assertAccessibleAndResponsive(page, 'recipes-discovery');

    await page.goto(`/recipes/${RECIPE_SLUG}`);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Canh chua');
    await expect(page.locator('.kitchen-loop-strip')).toBeVisible();
    await expect(page.locator('.recipe-technique-summary')).toBeVisible();
    await expect(page.getByTestId('recipe-availability')).toBeVisible();
    await expect(page.locator('.recipe-readiness-bar')).toBeVisible();
    await assertAccessibleAndResponsive(page, 'recipe-detail-ingredients-tab');


    const ingredientsTab = page.getByRole('tab', { name: 'Nguyên liệu', exact: true });
    const stepsTab = page.getByRole('tab', { name: 'Cách nấu', exact: true });
    await ingredientsTab.focus();
    await page.keyboard.press('ArrowLeft');
    await expect(stepsTab).toBeFocused();
    await expect(stepsTab).toHaveAttribute('aria-selected', 'true');

    const stepsPanel = page.locator('#recipe-detail-panel-steps');
    await expect(stepsPanel).toBeVisible();
    await expect(stepsPanel.locator('.culinary-technique-visual').first()).toBeVisible();
    const firstStepChip = stepsPanel.locator('.recipe-step-ingredient-chip').first();
    await expect(firstStepChip).toBeVisible();
    await expect(firstStepChip).toContainText('(tổng:');
    await assertAccessibleAndResponsive(page, 'recipe-detail-steps-tab');


    const originalViewport = page.viewportSize() ?? { width: 390, height: 844 };
    for (const vp of [
      { width: 360, height: 800 },
      { width: 768, height: 1024 },
      { width: 1280, height: 800 },
    ]) {
      await page.setViewportSize(vp);
      await layout(page);
    }
    await page.setViewportSize(originalViewport);
  });

  test('cooking mode stage visuals, keyboard ingredient drawer, SVG timer ring, reduced motion, and completion mutation work end-to-end', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await reset(page);

    const seededTomato = await page.evaluate(async () => {
      const res = await fetch('/api/v1/inventory', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Frigo-Expected-User-Id': localStorage.getItem('frigo_user_id') ?? '',
          'X-Frigo-Expected-Household-Id': localStorage.getItem('frigo_household_id') ?? '',
        },
        body: JSON.stringify({
          id: 'e2e-tomato-lot',
          name: 'Cà chua',
          quantity: 4,
          unit: 'piece',
          category: 'vegetable',
          storage: 'fridge',
        }),
      });
      return { status: res.status, data: await res.json() };
    });
    expect(seededTomato.status).toBe(201);

    await page.goto(`/cook/${RECIPE_SLUG}`);

    await expect(page.locator('.cooking-chef-companion')).toBeVisible();
    await expect(page.locator('.cooking-stage .culinary-variant-stage')).toBeVisible();
    const firstCookingPill = page.locator('.cooking-step-ingredient-pill').first();
    await expect(firstCookingPill).toBeVisible();
    await expect(firstCookingPill).toContainText('Tổng:');

    const drawerSummary = page.locator('.cooking-ingredients-drawer summary');
    await expect(drawerSummary).toContainText('Nguyên liệu cần chuẩn bị');
    await drawerSummary.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.cooking-ingredients-mini-list')).toBeVisible();

    const runningAnimations = await page.evaluate(() => {
      const out: string[] = [];
      for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
        const style = getComputedStyle(el);
        if (style.animationName !== 'none' && style.animationDuration !== '0s' && !el.classList.contains('animate-spin')) {
          out.push(`${el.tagName.toLowerCase()}:${style.animationName}`);
        }
      }
      return out;
    });
    expect(runningAnimations, 'no CSS keyframe animation under reduced motion').toEqual([]);
    await assertAccessibleAndResponsive(page, 'cooking-mode-step-1');

    const totalSteps = await page.locator('.cooking-outline:not(.cooking-ingredients-drawer) ol li').count();
    expect(totalSteps).toBeGreaterThan(1);

    let testedTimerRing = false;
    for (let i = 0; i < totalSteps; i += 1) {
      const startTimerBtn = page.getByRole('button', { name: /^Bật hẹn giờ/ });
      if (!testedTimerRing && (await startTimerBtn.isVisible())) {
        await startTimerBtn.click();
        await expect(page.locator('.cooking-timer-ring')).toBeVisible();
        await expect(page.getByTestId('cooking-timer-status')).toHaveText('Đã bắt đầu hẹn giờ.');

        const pauseBtn = page.getByRole('button', { name: 'Tạm dừng hẹn giờ', exact: true });
        await expect(pauseBtn).toBeVisible();
        await pauseBtn.click();
        await expect(page.getByTestId('cooking-timer-status')).toHaveText('Đã tạm dừng hẹn giờ.');

        const resumeBtn = page.getByRole('button', { name: 'Tiếp tục hẹn giờ', exact: true });
        await expect(resumeBtn).toBeVisible();
        await resumeBtn.click();
        await expect(page.getByTestId('cooking-timer-status')).toHaveText('Đã tiếp tục hẹn giờ.');

        const resetBtn = page.getByRole('button', { name: 'Đặt lại hẹn giờ', exact: true });
        await resetBtn.click();
        await expect(page.getByTestId('cooking-timer-status')).toHaveText('Đã đặt lại hẹn giờ.');

        testedTimerRing = true;
      }
      if (i < totalSteps - 1) {
        await page.getByRole('button', { name: 'Bước tiếp theo', exact: true }).click();
      }
    }
    expect(testedTimerRing, 'must exercise the SVG timer ring on at least one cooking step').toBe(true);

    await page.getByRole('button', { name: 'Hoàn thành nấu', exact: true }).click();
    await expect(page.getByRole('heading', { name: /Món ăn hoàn tất/, level: 1 })).toBeVisible();
    await expect(page.locator('.cooking-chef-companion')).toBeVisible();
    await expect(page.locator('.cooking-use-item-icon').first()).toBeVisible();
    await assertAccessibleAndResponsive(page, 'cooking-complete-review');

    // Verify client-side over-stock guard disables submit immediately on unstocked line 0
    const submitBtn = page.getByRole('button', { name: 'Xác nhận & Cập nhật tủ lạnh', exact: true });
    const firstDeductionInput = page.locator('#cooking-use-0');
    await firstDeductionInput.fill('0.5');
    await expect(firstDeductionInput).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#cooking-use-hint-0')).toContainText('Vượt lượng có thể dùng');
    await expect(submitBtn).toBeDisabled();
    await firstDeductionInput.fill('0');
    await expect(firstDeductionInput).toHaveAttribute('aria-invalid', 'false');
    await expect(submitBtn).toBeEnabled();

    // Adjust stocked tomato line (#cooking-use-1) to fractional 1.5 piece and submit
    const tomatoInput = page.locator('#cooking-use-1');
    await tomatoInput.fill('1.5');

    const completeResponsePromise = page.waitForResponse((res) =>
      res.url().includes('/cook/complete') && res.request().method() === 'POST',
    );
    await submitBtn.click();
    const completeResponse = await completeResponsePromise;
    expect(completeResponse.status()).toBe(200);
    const completeUrl = new URL(completeResponse.url()).pathname;
    const postedBody = completeResponse.request().postDataJSON();
    expect(postedBody.deductions[1].quantityDeducted).toBe(1.5);
    expect(completeResponse.request().headers()['idempotency-key']).toBe(postedBody.commandId);

    const savedHeading = page.getByRole('heading', { name: 'Đã cập nhật tủ lạnh', exact: true });
    await expect(savedHeading).toBeVisible();
    await expect(savedHeading).toBeFocused();
    await assertAccessibleAndResponsive(page, 'cooking-complete-saved');

    // Verify idempotent replay does not double-deduct stock
    const replayCheck = await page.evaluate(
      async ({ path, body }) => {
        const replayRes = await fetch(path, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': body.commandId,
            'X-Frigo-Expected-User-Id': localStorage.getItem('frigo_user_id') ?? '',
            'X-Frigo-Expected-Household-Id': localStorage.getItem('frigo_household_id') ?? '',
          },
          body: JSON.stringify(body),
        });
        const invRes = await fetch('/api/v1/inventory', { credentials: 'include', cache: 'no-store' });
        const replayData = (await replayRes.json()) as { idempotentReplay?: boolean };
        const invData = (await invRes.json()) as {
          items: Array<{ id: string; quantity: number }>;
        };
        return {
          replayStatus: replayRes.status,
          replayData,
          inventory: invData.items,
        };
      },
      { path: completeUrl, body: postedBody },
    );
    expect(replayCheck.replayStatus).toBe(200);
    expect(replayCheck.replayData.idempotentReplay).toBe(true);
    const updatedTomatoLot = replayCheck.inventory.find((lot) => lot.id === 'e2e-tomato-lot');
    expect(updatedTomatoLot?.quantity).toBe(2.5);

    await page.getByRole('link', { name: 'Xem Tủ lạnh', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Tủ lạnh của tôi', level: 1 })).toBeVisible();
  });
});

