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
  const serious = axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(
    serious.map((v) => `${surface}: ${v.id} (${v.impact}) — ${v.help}`),
    `${surface}: zero serious/critical axe violations`,
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
    await expect(stepsPanel.locator('.recipe-step-ingredient-chip').first()).toBeVisible();
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

  test('cooking mode stage visuals, ingredient drawer, SVG timer ring, reduced motion, and completion review work end-to-end', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await reset(page);
    await page.goto(`/cook/${RECIPE_SLUG}`);

    await expect(page.locator('.cooking-chef-companion')).toBeVisible();
    await expect(page.locator('.cooking-stage .culinary-variant-stage')).toBeVisible();


    const drawerSummary = page.locator('.cooking-ingredients-drawer summary');
    await expect(drawerSummary).toContainText('Nguyên liệu cần chuẩn bị');
    await drawerSummary.click();
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
    for (let i = 1; i < totalSteps; i += 1) {
      const startTimerBtn = page.getByRole('button', { name: /^Bật hẹn giờ/ });
      if (!testedTimerRing && (await startTimerBtn.isVisible())) {
        await startTimerBtn.click();
        await expect(page.locator('.cooking-timer-ring')).toBeVisible();
        await expect(page.getByTestId('cooking-timer-status')).toHaveText('Đã bắt đầu hẹn giờ.');
        testedTimerRing = true;
      }
      await page.getByRole('button', { name: 'Bước tiếp theo', exact: true }).click();
    }

    await page.getByRole('button', { name: 'Hoàn thành nấu', exact: true }).click();
    await expect(page.getByRole('heading', { name: /Món ăn hoàn tất/, level: 1 })).toBeVisible();
    await expect(page.locator('.cooking-chef-companion')).toBeVisible();
    await expect(page.locator('.cooking-use-item-icon').first()).toBeVisible();
    await assertAccessibleAndResponsive(page, 'cooking-complete-review');

  });
});

