import { writeFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { test, expect, reset, getJson, navigate, layout } from '../t13b/fixtures';

const configurations = [[320, 420, 2], [390, 420, 1], [768, 420, 1], [390, 844, 1], [1440, 900, 1]] as const;
const routes = [['discovery', '/recipes', '.kitchen-page-body'], ['detail', '/recipes/canh-chua-ca-loc-nam-bo', '.recipe-preparation']] as const;

test('current discovery and detail keep short-viewport navigation and primary text readable', async ({ page }, info) => {
  test.setTimeout(240_000);
  if (process.env.PREVIEW_MEAL_PLANNER_ENABLED === 'false') {
    await page.goto('/__preview');
    await page.getByRole('button', { name: 'Đặt lại dữ liệu thử nghiệm và đăng nhập' }).click();
    await expect(page).toHaveURL(/\/week$/);
    await expect.poll(() => page.evaluate(() => localStorage.getItem('frigo_user_id'))).toBe('planner-preview-user');
  } else await reset(page);
  const before = await getJson(page, '/api/v1/inventory');
  const writes: string[] = [];
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method()))
      writes.push(`${request.method()} ${url.pathname}`);
  });
  const records = [];
  const failures: string[] = [];
  for (const [width, height, scale] of configurations) {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const [name, path] of routes) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      if (name === 'discovery') await expect(page.locator('.kitchen-recipe-card').first()).toBeVisible();
      else await expect(page.getByRole('tab', { name: 'Cách nấu', exact: true })).toBeVisible();
      await page.evaluate(scale => { document.documentElement.style.fontSize = `${scale * 100}%`; }, scale);
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await layout(page);
      const geometry = await page.evaluate(() => {
        const visible = (element: Element) => element.getBoundingClientRect().width > 0 && getComputedStyle(element).visibility !== 'hidden';
        const rect = (element: Element) => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom, right: r.right }; };
        const nav = [...document.querySelectorAll('.kitchen-bottom-nav, .kitchen-sidebar')].find(visible)!;
        const links = [...nav.querySelectorAll('.kitchen-nav-items a')].map(element => ({ href: element.getAttribute('href'), label: element.textContent?.trim(), current: element.getAttribute('aria-current'), rect: rect(element), labelRect: rect(element.querySelector('.kitchen-nav-label')!) }));
        const header = document.querySelector('.kitchen-header')!;
        return { viewport: { width: innerWidth, height: innerHeight }, header: { rect: rect(header), position: getComputedStyle(header).position }, navPosition: getComputedStyle(nav).position, bottomNav: nav.classList.contains('kitchen-bottom-nav'), nav: rect(nav), links, scanCount: [...document.querySelectorAll('.kitchen-scan-link')].filter(visible).length };
      });
      expect(geometry.links).toHaveLength(5);
      expect(geometry.links.filter(link => link.current === 'page')).toHaveLength(1);
      expect(geometry.scanCount).toBeGreaterThan(0);
      for (const link of geometry.links) {
        expect(link.rect.width).toBeGreaterThanOrEqual(44);
        expect(link.rect.height).toBeGreaterThanOrEqual(44);
        expect(link.labelRect.x).toBeGreaterThanOrEqual(link.rect.x - 1);
        expect(link.labelRect.right).toBeLessThanOrEqual(link.rect.right + 1);
        expect(link.labelRect.y).toBeGreaterThanOrEqual(link.rect.y - 1);
        expect(link.labelRect.bottom).toBeLessThanOrEqual(link.rect.bottom + 1);
      }
      for (let i = 0; i < geometry.links.length; i++) for (let j = i + 1; j < geometry.links.length; j++) {
        const a = geometry.links[i].labelRect, b = geometry.links[j].labelRect;
        expect(a.right <= b.x + 1 || b.right <= a.x + 1 || a.bottom <= b.y + 1 || b.bottom <= a.y + 1, 'full navigation labels do not intersect').toBe(true);
      }
      if (height === 420) expect(geometry.header.position).toBe('static');
      if (width < 640) {
        expect(geometry.navPosition).toBe(height === 420 ? 'static' : 'fixed');
        expect(height - (geometry.navPosition === 'fixed' ? geometry.nav.height : 0), 'reading viewport after the static header scrolls away').toBeGreaterThan(240);
      }
      const target = name === 'detail' ? page.getByRole('tab', { name: 'Cách nấu', exact: true }) : page.getByRole('searchbox');
      await target.focus();
      await page.keyboard.press('Tab');
      await page.keyboard.press('Shift+Tab');
      await expect(target).toBeFocused();
      await expect.poll(async () => {
        const r = await target.boundingBox();
        return !!r && r.y >= -1 && r.y + r.height <= (geometry.bottomNav && geometry.navPosition === 'fixed' ? geometry.nav.y : height) + 1;
      }, { message: 'keyboard target clears viewport chrome' }).toBe(true);
      const focused = await target.boundingBox();
      expect(focused).not.toBeNull();
      expect(focused!.y).toBeGreaterThanOrEqual(-1);
      expect(focused!.y + focused!.height).toBeLessThanOrEqual(geometry.bottomNav && geometry.navPosition === 'fixed' ? geometry.nav.y + 1 : height + 1);
      if (name === 'detail') {
        await page.keyboard.press('ArrowRight');
        await expect(page.getByRole('tab', { name: 'Nguyên liệu', exact: true })).toBeFocused();
        await page.keyboard.press('ArrowLeft');
        await expect(target).toBeFocused();
      }
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      await writeFile(info.outputPath(`${name}-${width}x${height}-text${scale}-axe.json`), JSON.stringify({ violations: axe.violations, incomplete: axe.incomplete }, null, 2));
      expect(axe.violations.map(v => ({ id: v.id, impact: v.impact }))).toEqual([]);
      const roots = page.locator('.kitchen-bottom-nav:visible .kitchen-nav-items a, .kitchen-sidebar:visible .kitchen-nav-items a');
      for (const link of await roots.all()) {
        await link.focus();
        await expect.poll(async () => {
          const r = await link.boundingBox();
          return !!r && r.y >= -1 && r.y + r.height <= height + 1;
        }, { message: 'each root destination remains keyboard reachable' }).toBe(true);
      }
      await page.screenshot({ path: info.outputPath(`${name}-${width}x${height}-text${scale}-navigation.png`), animations: 'disabled' });
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: info.outputPath(`${name}-${width}x${height}-text${scale}.png`), animations: 'disabled' });
      records.push({ name, scale, geometry, focused });
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const motion = [];
  for (const reducedMotion of ['no-preference', 'reduce'] as const) {
    await page.emulateMedia({ reducedMotion });
    for (const [name, path, selector] of routes) {
      await page.goto(path);
      await expect(page.locator(selector).first()).toBeVisible();
      const sample = await page.locator(selector).first().evaluate(element => {
        const ancestors = []; let parent: Element | null = element;
        while (parent) { ancestors.push(parent); parent = parent.parentElement; }
        const animations = ancestors.flatMap(ancestor => ancestor.getAnimations().filter(animation => animation.effect instanceof KeyframeEffect && animation.effect.target === ancestor));
        const snapshots = [];
        for (const progress of [0, 0.1, 0.25, 0.5, 0.75, 1]) {
          for (const animation of animations) { animation.pause(); animation.currentTime = Number(animation.effect!.getTiming().duration) * progress; }
          const opacity = ancestors.reduce((value, ancestor) => value * Number(getComputedStyle(ancestor).opacity), 1);
          snapshots.push({ progress, opacity });
        }
        return { animations: animations.map(animation => ({ duration: animation.effect!.getTiming().duration, keyframes: (animation.effect as KeyframeEffect).getKeyframes() })), snapshots };
      });
      motion.push({ name, reducedMotion, sample });
      if (sample.snapshots.some(snapshot => snapshot.opacity !== 1)) failures.push(`${name}/${reducedMotion}: primary text opacity falls below 1`);
    }
  }
  await writeFile(info.outputPath('motion-probe.json'), JSON.stringify(motion, null, 2));
  await page.goto('/recipes');
  const card = page.locator('.kitchen-recipe-card a').first();
  const href = await card.getAttribute('href');
  await card.click();
  await expect(page).toHaveURL(new URL(href!, page.url()).href);
  await page.goBack();
  await expect(page).toHaveURL(/\/recipes$/);
  await navigate(page, '/scan');
  await expect(page.locator('.kitchen-bottom-nav, .kitchen-sidebar')).toHaveCount(0);
  expect(await getJson(page, '/api/v1/inventory')).toEqual(before);
  expect(writes).toEqual([]);
  await writeFile(info.outputPath('short-motion-summary.json'), JSON.stringify({ records, motion, writes, inventoryUnchanged: true, limitations: ['Isolated Chromium/local Worker fixture', 'Root-font scaling is synthetic, not native browser zoom', 'Animation time seeking measures CSS behavior, not real device frame delivery', 'Owner usability/device/Safari/screen-reader acceptance remains pending'] }, null, 2));
  expect(failures).toEqual([]);
});
