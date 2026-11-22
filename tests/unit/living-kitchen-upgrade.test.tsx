// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { RouteFallback } from '../../src/web/components/common/RouteFallback';
import {
  AiScanPendingStage,
  FridgeInventorySkeleton,
  HomeDashboardSkeleton,
  PlannerGeneratingStage,
  RecipeDetailSkeleton,
  SettingsFormSkeleton,
  ShoppingListSkeleton,
  WeeklyPlannerSkeleton,
} from '../../src/web/vnext/components/Skeletons';
import { TkvConfettiBurst } from '../../src/web/vnext/components/LivingMotion';
import { VNextOnboardingFlow } from '../../src/web/vnext/screens/OnboardingFlowPages';

const REPO_ROOT = path.resolve(__dirname, '../..');

describe('Living Kitchen Studio Upgrade (Phases 1–5)', () => {
  it('eliminates motion/react dependency from design-system primitives to drop 128KB bloat', () => {
    const primitivesSrc = readFileSync(
      path.join(REPO_ROOT, 'src/web/design-system/primitives.tsx'),
      'utf8',
    );
    expect(primitivesSrc).not.toContain("from 'motion/react'");
    expect(primitivesSrc).not.toContain('framer-motion');
    expect(primitivesSrc).toContain('tkv-sheet-enter');
  });

  it('defines GPU-composited motion tokens, keyframes, and prefers-reduced-motion guard in tokens.css', () => {
    const css = readFileSync(path.join(REPO_ROOT, 'src/web/vnext/styles/tokens.css'), 'utf8');
    for (const token of [
      '--tkv-ease-spring',
      '--tkv-ease-pop',
      '@keyframes tkv-shimmer-wave',
      '@keyframes tkv-mascot-float',
      '@keyframes tkv-scan-beam',
      '@keyframes tkv-slide-next',
      '@media (prefers-reduced-motion: reduce)',
    ]) {
      expect(css).toContain(token);
    }
  });

  it('splits heavy legacy screens lazily inside persistent vNext shells', () => {
    for (const rel of [
      'src/web/vnext/screens/PlannerAndShoppingPages.tsx',
      'src/web/vnext/screens/FridgeAndScanWrappers.tsx',
      'src/web/vnext/screens/AccountAndSystemPages.tsx',
    ]) {
      const src = readFileSync(path.join(REPO_ROOT, rel), 'utf8');
      expect(src).toContain('lazy(');
      expect(src).toContain('<Suspense');
    }
  });

  it('renders branded structural skeletons, AI scan pending stage, planner wave, and route fallback cleanly', () => {
    const fallbackHtml = renderToStaticMarkup(<RouteFallback />);
    expect(fallbackHtml).toContain('tkv-top-bar-track');
    expect(fallbackHtml).toContain('tkv-shimmer');
    expect(fallbackHtml).toContain('role="status"');

    for (const el of [
      <HomeDashboardSkeleton key="home" />,
      <FridgeInventorySkeleton key="fridge" />,
      <RecipeDetailSkeleton key="recipe" />,
      <WeeklyPlannerSkeleton key="planner" />,
      <ShoppingListSkeleton key="shopping" />,
      <SettingsFormSkeleton key="settings" />,
      <AiScanPendingStage key="scan" />,
      <PlannerGeneratingStage key="gen" />,
    ]) {
      const html = renderToStaticMarkup(el);
      expect(html).toContain('role="status"');
    }

    const scanHtml = renderToStaticMarkup(<AiScanPendingStage modeLabel="AI Vision Takolio" />);
    expect(scanHtml).toContain('tkv-scan-beam');
    expect(scanHtml).toContain('Bé Mầm Bếp đang phân tích');

    const confettiHtml = renderToStaticMarkup(<TkvConfettiBurst />);
    expect(confettiHtml).toContain('tkv-confetti-piece');
  });

  it('renders upgraded Onboarding O01–O06 with mobile live scaling, O04 live recipe preview, and O06 celebration', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const renderStep = (pathUrl: string) =>
      renderToStaticMarkup(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={[pathUrl]}>
            <VNextOnboardingFlow />
          </MemoryRouter>
        </QueryClientProvider>,
      );

    const o01 = renderStep('/onboarding/welcome');
    expect(o01).toContain('Chào mừng đến Takolio');
    expect(o01).toContain('Thiết lập nhanh ~45 giây');

    const o03 = renderStep('/onboarding/household');
    expect(o03).toContain('data-testid="o03-bucket-2"');
    expect(o03).toContain('data-testid="o03-continue-btn"');
    expect(o03).toContain('Quy đổi mẫu · Thịt kho trứng');
    expect(o03).toContain('Khẩu phần hiện chọn: 2 người');

    const o04 = renderStep('/onboarding/preferences');
    expect(o04).toContain('Món hợp gu nhà bạn');
    expect(o04).toContain('Thịt kho tàu nước dừa trứng');

    const o06 = renderStep('/onboarding/ready');
    expect(o06).toContain('Sẵn sàng vào bếp');
    expect(o06).toContain('Hồ sơ căn bếp đã sẵn sàng');
    expect(o06).toContain('tkv-confetti-piece');
  });
});
