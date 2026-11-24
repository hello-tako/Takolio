import React, { lazy, Suspense, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import '../styles/tokens.css';
import '../styles/vnext-adapted.css';
import { api } from '../../services/api';
import { queryKeys } from '../../lib/queryKeys';
import { vnextHref } from '../feature';
import { useVNextSeo } from '../lib/seo';
import { ConsumerStudioShell } from '../components/Shells';
import { TkvBadge, TkvButton, TkvSearchField, TkvSurface } from '../components/Primitives';
import { VNextIcon } from '../components/VNextIcons';
import { FridgeInventorySkeleton, SettingsFormSkeleton } from '../components/Skeletons';
import {
  formatLocalizedMeasure,
  localizeIngredientName,
  localizeRecipeTitle,
  useLocaleText,
} from '../../i18n/app-i18n';

const LazyIngredientDetailPage = lazy(() =>
  import('../../pages/IngredientDetailPage').then((m) => ({ default: m.IngredientDetailPage })),
);
const LazyReconciliationPage = lazy(() =>
  import('../../pages/ReconciliationPage').then((m) => ({ default: m.ReconciliationPage })),
);
const LazyScanPage = lazy(() =>
  import('../../pages/ScanPage').then((m) => ({ default: m.ScanPage })),
);
const LazyScanResultPage = lazy(() =>
  import('../../pages/ScanResultPage').then((m) => ({ default: m.ScanResultPage })),
);
const LazyReceiptReviewPage = lazy(() =>
  import('../../pages/ReceiptReviewPage').then((m) => ({ default: m.ReceiptReviewPage })),
);

/**
 * C02 — Tìm nhanh (`/search` or `/?quick=1`).
 * Matches C02.png 1:1: search input, `Tất cả / Mới nhất / Đã lưu` filter chips,
 * real live query matches from `api.getInventory` & `api.getRecipeDiscovery`,
 * and 4 real Kitchen Studio action shortcuts (zero fabricated hits).
 */
export const C02QuickSearchPage: React.FC = () => {
  const { l, locale, unitSystem } = useLocaleText();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') ?? '';
  const [scope, setScope] = useState<'all' | 'recent' | 'saved'>('all');

  useVNextSeo({
    title: l('Tìm nhanh trong căn bếp', 'Quick Kitchen Search'),
    description: l(
      'Tra cứu nhanh nguyên liệu trong tủ lạnh, công thức món ăn và lối tắt thao tác.',
      'Quickly search fridge ingredients, recipes, and kitchen shortcuts.',
    ),
    canonicalPath: '/search',
    domainSurface: 'app',
    noindex: true,
  });

  const inventoryQuery = useQuery({
    queryKey: queryKeys.inventory(),
    queryFn: () => api.getInventory(),
  });

  const trimmed = q.trim();
  const discoveryQuery = useQuery({
    queryKey: queryKeys.recipeDiscovery({ q: trimmed, pageSize: 6 }),
    queryFn: () => api.getRecipeDiscovery({ q: trimmed, pageSize: 6 }),
    enabled: trimmed.length > 0,
  });

  const matchingStock = trimmed
    ? (inventoryQuery.data ?? [])
        .filter((it) => {
          if (it.quantity <= 0) return false;
          const needle = trimmed.toLowerCase();
          const localizedName = localizeIngredientName(it.ingredientId, it.name, locale).toLowerCase();
          return it.name.toLowerCase().includes(needle) || localizedName.includes(needle);
        })
        .slice(0, 5)
    : [];
  const matchingRecipes = trimmed ? (discoveryQuery.data?.items ?? []) : [];

  const updateQuery = (next: string) => {
    const p = new URLSearchParams(searchParams);
    if (next) p.set('q', next);
    else p.delete('q');
    setSearchParams(p, { replace: true });
  };

  const shortcuts = [
    {
      id: 'fridge-dishes',
      scope: 'all' as const,
      icon: 'recipes' as const,
      title: l('Tìm món trong tủ', 'Cook with fridge items'),
      subtitle: l(
        'Đối chiếu định lượng nguyên liệu đang có để gợi ý món khả thi',
        'Match your on-hand ingredients to find recipes you can cook now',
      ),
      to: vnextHref('/recipes?noBuy=true'),
    },
    {
      id: 'saved-recipes',
      scope: 'saved' as const,
      icon: 'bookmark' as const,
      title: l('Mở công thức đã lưu', 'Open saved recipes'),
      subtitle: l(
        'Truy cập bộ sưu tập món ăn yêu thích của tài khoản',
        'Access your collection of bookmarked favorite dishes',
      ),
      to: vnextHref('/recipes?view=saved'),
    },
    {
      id: 'shopping-list',
      scope: 'recent' as const,
      icon: 'shopping' as const,
      title: l('Đến danh sách đi chợ', 'Go to shopping list'),
      subtitle: l(
        'Xem các mục cần mua và trạng thái chờ đồng bộ ngoại tuyến',
        'Review items to buy and offline sync status',
      ),
      to: vnextHref('/shopping'),
    },
    {
      id: 'ai-scan',
      scope: 'recent' as const,
      icon: 'scan' as const,
      title: l('Quét nguyên liệu', 'Scan ingredients'),
      subtitle: l(
        'Chụp ảnh tủ lạnh hoặc hóa đơn và duyệt thủ công trước khi lưu',
        'Snap your fridge or receipt and review before saving',
      ),
      to: vnextHref('/scan'),
    },
  ].filter((s) => scope === 'all' || s.scope === scope);

  return (
    <ConsumerStudioShell screenId="C02" title={l('Tìm nhanh', 'Quick Search')} backTo={vnextHref('/')}>
      <div className="max-w-3xl space-y-6">
        <div className="space-y-1">
          <p className="tkv-eyebrow text-xs font-semibold uppercase tracking-widest text-[var(--tkv-ink-muted,#52706A)]">
            {l('Tra cứu tức thì', 'Instant lookup')}
          </p>
          <h1 className="tkv-heading text-2xl sm:text-3xl font-extrabold text-[var(--tkv-ink,#152E2C)]">
            {l('Tìm nhanh', 'Quick Search')}
          </h1>
          <p className="text-sm text-[var(--tkv-ink-soft,#3C5954)]">
            {l(
              'Tìm nguyên liệu trong tủ, công thức món ăn hoặc chuyển nhanh đến khu vực cần thao tác.',
              'Search fridge ingredients, recipes, or jump straight to key kitchen actions.',
            )}
          </p>
        </div>

        <TkvSearchField
          value={q}
          onChange={updateQuery}
          placeholder={l('Tìm kiếm món ăn hoặc nguyên liệu…', 'Search dishes or ingredients…')}
          label={l('Tìm kiếm trong căn bếp', 'Search in kitchen')}
        />

        {/* Scope Chips */}
        <div
          className="flex items-center gap-2 flex-wrap"
          role="tablist"
          aria-label={l('Bộ lọc tìm nhanh', 'Quick search filters')}
        >
          {[
            { id: 'all' as const, label: l('Tất cả', 'All') },
            { id: 'recent' as const, label: l('Thao tác nhanh', 'Quick actions') },
            { id: 'saved' as const, label: l('Đã lưu', 'Saved') },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={scope === tab.id}
              onClick={() => setScope(tab.id)}
              className={clsx(
                'tkv-focusable min-h-[44px] px-4 py-1.5 rounded-full text-sm font-semibold border transition-colors',
                scope === tab.id
                  ? 'bg-[var(--tkv-primary)] text-white border-[var(--tkv-primary)] shadow-xs'
                  : 'bg-[var(--tkv-surface)] text-[var(--tkv-ink)] border-[var(--tkv-border)] hover:border-[var(--tkv-border-strong)]',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {trimmed ? (
          <div className="space-y-5">
            <section className="space-y-2.5" aria-label={l('Kết quả trong tủ lạnh', 'Fridge results')}>
              <h2 className="tkv-heading text-base font-extrabold text-[var(--tkv-ink,#152E2C)] tabular-nums">
                {l(
                  `Nguyên liệu trong tủ lạnh (${matchingStock.length})`,
                  `Fridge ingredients (${matchingStock.length})`,
                )}
              </h2>
              {matchingStock.length === 0 ? (
                <TkvSurface className="p-4 text-sm text-[var(--tkv-ink-soft,#3C5954)] bg-[var(--tkv-surface-muted,#E7F4EC)] border-[var(--tkv-border,#DCE6DE)]">
                  {l(
                    `Không có lô nguyên liệu nào khớp từ khóa “${trimmed}”.`,
                    `No fridge lots match “${trimmed}”.`,
                  )}
                </TkvSurface>
              ) : (
                <div className="space-y-2">
                  {matchingStock.map((lot) => (
                    <Link
                      key={lot.id}
                      to={vnextHref(`/fridge/${lot.id}`)}
                      className="tkv-focusable block rounded-2xl bg-white border border-[var(--tkv-border,#DCE6DE)] p-4 hover:border-[var(--tkv-border-strong,#B8CABE)] transition-colors"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-bold text-sm text-[var(--tkv-ink)] min-w-0 flex-1 break-words">
                          {localizeIngredientName(lot.ingredientId, lot.name, locale)}
                        </span>
                        <TkvBadge tone="neutral" className="shrink-0">
                          <span className="tabular-nums">
                            {locale === 'vi'
                              ? `${lot.quantity} ${lot.unit}`
                              : formatLocalizedMeasure(lot.quantity, lot.unit, locale, unitSystem)}
                          </span>
                        </TkvBadge>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-2.5" aria-label={l('Kết quả công thức món ăn', 'Recipe results')}>
              <h2 className="tkv-heading text-base font-extrabold text-[var(--tkv-ink,#152E2C)] tabular-nums">
                {l(
                  `Công thức món ăn (${matchingRecipes.length})`,
                  `Recipes (${matchingRecipes.length})`,
                )}
              </h2>
              {discoveryQuery.isPending ? (
                <p className="text-sm text-[var(--tkv-ink-soft,#3C5954)]">
                  {l('Đang tìm trong kho công thức…', 'Searching recipe catalog…')}
                </p>
              ) : matchingRecipes.length === 0 ? (
                <TkvSurface className="p-4 text-sm text-[var(--tkv-ink-soft,#3C5954)] bg-[var(--tkv-surface-muted,#E7F4EC)] border-[var(--tkv-border,#DCE6DE)]">
                  {l(
                    `Không tìm thấy món ăn nào khớp từ khóa “${trimmed}”.`,
                    `No recipes match “${trimmed}”.`,
                  )}
                </TkvSurface>
              ) : (
                <div className="space-y-2">
                  {matchingRecipes.map(({ recipe, canCookWithoutBuying }) => (
                    <Link
                      key={recipe.id}
                      to={vnextHref(`/recipes/${recipe.slug || recipe.id}`)}
                      className="tkv-focusable block rounded-2xl bg-white border border-[var(--tkv-border,#DCE6DE)] p-4 hover:border-[var(--tkv-border-strong,#B8CABE)] transition-colors"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-sm text-[var(--tkv-ink)] break-words">
                            {localizeRecipeTitle(recipe, locale)}
                          </p>
                          <p className="text-xs text-[var(--tkv-ink-secondary)] tabular-nums">
                            {l(
                              `${recipe.cookTimeMinutes} phút · ${recipe.servings} người`,
                              `${recipe.cookTimeMinutes} min · ${recipe.servings} servings`,
                            )}
                          </p>
                        </div>
                        <TkvBadge tone={canCookWithoutBuying ? 'success' : 'neutral'} className="shrink-0 whitespace-nowrap">
                          {canCookWithoutBuying
                            ? l('Đủ nguyên liệu', 'Ready to cook')
                            : l('Xem chi tiết', 'View recipe')}
                        </TkvBadge>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : (
          <div className="space-y-3">
            {shortcuts.map((sc) => (
              <Link
                key={sc.id}
                to={sc.to}
                className="tkv-focusable block rounded-[var(--tkv-radius-card)] bg-white border border-[var(--tkv-border,#DCE6DE)] p-4 hover:border-[var(--tkv-border-strong,#B8CABE)] transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5">
                    <span className="w-11 h-11 rounded-xl bg-[var(--tkv-accent-soft,#FFF0E9)] border border-[var(--tkv-accent-border,#FAD0C4)] text-[var(--tkv-primary,#196149)] flex items-center justify-center shrink-0">
                      <VNextIcon name={sc.icon} size={20} />
                    </span>
                    <div>
                      <p className="tkv-heading text-base font-bold text-[var(--tkv-ink,#152E2C)]">
                        {sc.title}
                      </p>
                      <p className="text-xs text-[var(--tkv-ink-soft,#3C5954)]">{sc.subtitle}</p>
                    </div>
                  </div>
                  <VNextIcon name="chevron-right" size={18} className="text-[var(--tkv-ink-muted,#52706A)] shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="pt-2">
          <TkvButton variant="secondary" onClick={() => navigate(vnextHref('/'))}>
            {l('Quay về trang Hôm nay', 'Back to Today')}
          </TkvButton>
        </div>
      </div>
    </ConsumerStudioShell>
  );
};

/** C06 / C07 — Chi tiết nguyên liệu & Chỉnh sửa số lượng (wraps authoritative IngredientDetailPage). */
export const C06LotDetailVNext: React.FC = () => {
  const { l } = useLocaleText();
  return (
    <ConsumerStudioShell screenId="C06" title={l('Chi tiết nguyên liệu', 'Ingredient Details')} backTo={vnextHref('/fridge')}>
      <div className="tkv-adapted-surface takolio-rebuild" data-tkv-surface-adapt="1">
        <Suspense fallback={<FridgeInventorySkeleton label={l('Đang tải chi tiết nguyên liệu…', 'Loading ingredient details…')} />}>
          <LazyIngredientDetailPage />
        </Suspense>
      </div>
    </ConsumerStudioShell>
  );
};

/** C08 — Đối soát tồn kho (wraps authoritative T13 ReconciliationPage; single `<h1>` inside KitchenDetailPage). */
export const C08ReconciliationVNext: React.FC = () => {
  const { l } = useLocaleText();
  return (
    <ConsumerStudioShell screenId="C08" title={l('Đối soát tồn kho', 'Inventory Reconciliation')} backTo={vnextHref('/fridge')}>
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl bg-[var(--tkv-surface-muted,#E7F4EC)] border border-[var(--tkv-border,#DCE6DE)] p-4 sm:p-5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex flex-col gap-1">
            <p className="tkv-eyebrow inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--tkv-ink,#152E2C)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--tkv-primary,#196149)]" aria-hidden="true" />
              <span>{l('Đối soát dữ liệu máy chủ & quan sát thực tế', 'Reconcile server stock & scan observations')}</span>
            </p>
            <p className="text-sm text-[var(--tkv-ink-soft,#3C5954)]">
              {l(
                'Kiểm tra các chênh lệch số lượng, vị trí bảo quản hoặc hạn dùng trước khi gửi quyết định lên máy chủ.',
                'Review differences in quantity, storage location, or expiry before submitting your decision.',
              )}
            </p>
          </div>
        </div>
        <div className="tkv-adapted-surface takolio-rebuild" data-tkv-surface-adapt="1">
          <Suspense fallback={<FridgeInventorySkeleton label={l('Đang tải danh sách đối soát…', 'Loading reconciliation queue…')} />}>
            <LazyReconciliationPage />
          </Suspense>
        </div>
      </div>
    </ConsumerStudioShell>
  );
};

/** C09 / C10 — Quét nguyên liệu & Quyền camera / Tải ảnh dự phòng (Kitchen Studio Scan Frame). */
export const C09ScanStudioVNext: React.FC = () => {
  const { l } = useLocaleText();
  return (
    <ConsumerStudioShell screenId="C09" title={l('Quét nguyên liệu', 'Scan Ingredients')} backTo={vnextHref('/fridge')} showContextualScan={false}>
      <div className="tkv-adapted-surface takolio-rebuild" data-tkv-surface-adapt="1">
        <Suspense fallback={<SettingsFormSkeleton label={l('Đang mở máy quét AI…', 'Opening AI scanner…')} />}>
          <LazyScanPage />
        </Suspense>
      </div>
    </ConsumerStudioShell>
  );
};

/** C11 / C12 / C13 — AI đang xử lý · Duyệt kết quả AI · Kết quả đã xác nhận. */
export const C12ScanReviewVNext: React.FC = () => {
  const { l } = useLocaleText();
  return (
    <ConsumerStudioShell screenId="C12" title={l('Duyệt kết quả AI', 'Review AI Scan')} backTo={vnextHref('/scan')} showContextualScan={false}>
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl bg-[var(--tkv-sage-soft,#E7F4EC)] border border-[var(--tkv-sage-border,#BDE0CC)] p-4 text-xs sm:text-sm text-[var(--tkv-sage-ink,#134C39)] flex items-center gap-2.5">
          <VNextIcon name="shield" size={18} className="text-[var(--tkv-sage,#196149)] shrink-0" />
          <span>
            <strong>{l('Nguyên tắc duyệt trước khi lưu:', 'Review before saving:')}</strong>{' '}
            {l(
              'Vui lòng kiểm tra tên, số lượng, đơn vị và hạn dùng trước khi xác nhận nhập vào tủ lạnh.',
              'Please check the name, quantity, unit, and expiry date before confirming into your fridge.',
            )}
          </span>
        </div>
        <div className="tkv-adapted-surface takolio-rebuild" data-tkv-surface-adapt="1">
          <div className="tkv-review-host">
            <Suspense fallback={<FridgeInventorySkeleton label={l('Đang tải bảng duyệt kết quả AI…', 'Loading AI scan review…')} />}>
              <LazyScanResultPage />
            </Suspense>
          </div>
        </div>
      </div>
    </ConsumerStudioShell>
  );
};

/** C14 — Duyệt hóa đơn OCR (preserves raw OCR evidence, confidence, and PII notice). */
export const C14ReceiptReviewVNext: React.FC = () => {
  const { l } = useLocaleText();
  return (
    <ConsumerStudioShell screenId="C14" title={l('Duyệt hóa đơn', 'Review Receipt')} backTo={vnextHref('/scan')} showContextualScan={false}>
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl bg-[var(--tkv-honey-soft,#FFF5D6)] border border-[var(--tkv-honey-border,#F5DE93)] p-4 text-xs sm:text-sm text-[var(--tkv-honey-ink,#8A5205)] flex items-center gap-2.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--tkv-honey,#F6C453)] shrink-0" aria-hidden="true" />
          <VNextIcon name="info" size={18} className="text-[var(--tkv-honey,#F6C453)] shrink-0" />
          <span>
            <strong>{l('Bảo vệ thông tin hóa đơn:', 'Receipt data transparency:')}</strong>{' '}
            {l(
              'Hệ thống giữ nguyên bằng chứng OCR gốc, không tự điền giá tiền thiếu và chỉ nhập các dòng bạn xác nhận.',
              'Original OCR evidence is preserved, missing prices are never fabricated, and only lines you confirm enter your fridge.',
            )}
          </span>
        </div>
        <div className="tkv-adapted-surface takolio-rebuild" data-tkv-surface-adapt="1">
          <div className="tkv-review-host">
            <Suspense fallback={<FridgeInventorySkeleton label={l('Đang tải bảng duyệt hóa đơn…', 'Loading receipt review…')} />}>
              <LazyReceiptReviewPage plannerRoutePrefix="/planner" />
            </Suspense>
          </div>
        </div>
      </div>
    </ConsumerStudioShell>
  );
};
