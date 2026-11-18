import React, { useState } from 'react';
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
import { IngredientDetailPage } from '../../pages/IngredientDetailPage';
import { ReconciliationPage } from '../../pages/ReconciliationPage';
import { ScanPage } from '../../pages/ScanPage';
import { ScanResultPage } from '../../pages/ScanResultPage';
import { ReceiptReviewPage } from '../../pages/ReceiptReviewPage';

/**
 * C02 — Tìm nhanh (`/search` or `/?quick=1`).
 * Matches C02.png 1:1: search input, `Tất cả / Mới nhất / Đã lưu` filter chips,
 * real live query matches from `api.getInventory` & `api.getRecipeDiscovery`,
 * and 4 real Kitchen Studio action shortcuts (zero fabricated hits).
 */
export const C02QuickSearchPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') ?? '';
  const [scope, setScope] = useState<'all' | 'recent' | 'saved'>('all');

  useVNextSeo({
    title: 'Tìm nhanh trong căn bếp',
    description: 'Tra cứu nhanh nguyên liệu trong tủ lạnh, công thức món ăn và lối tắt thao tác.',
    canonicalPath: '/search',
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
        .filter(
          (it) =>
            it.quantity > 0 && it.name.toLowerCase().includes(trimmed.toLowerCase()),
        )
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
      title: 'Tìm món trong tủ',
      subtitle: 'Đối chiếu định lượng nguyên liệu đang có để gợi ý món khả thi',
      to: vnextHref('/recipes?noBuy=true'),
    },
    {
      id: 'saved-recipes',
      scope: 'saved' as const,
      icon: 'bookmark' as const,
      title: 'Mở công thức đã lưu',
      subtitle: 'Truy cập bộ sưu tập món ăn yêu thích của tài khoản',
      to: vnextHref('/recipes?view=saved'),
    },
    {
      id: 'shopping-list',
      scope: 'recent' as const,
      icon: 'shopping' as const,
      title: 'Đến danh sách đi chợ',
      subtitle: 'Xem các mục cần mua và trạng thái chờ đồng bộ ngoại tuyến',
      to: vnextHref('/shopping'),
    },
    {
      id: 'ai-scan',
      scope: 'recent' as const,
      icon: 'scan' as const,
      title: 'Quét nguyên liệu',
      subtitle: 'Chụp ảnh tủ lạnh hoặc hóa đơn và duyệt thủ công trước khi lưu',
      to: vnextHref('/scan'),
    },
  ].filter((s) => scope === 'all' || s.scope === scope);

  return (
    <ConsumerStudioShell screenId="C02" title="Tìm nhanh" backTo={vnextHref('/')}>
      <div className="max-w-3xl space-y-6">
        <div className="space-y-1">
          <h1 className="tkv-heading text-2xl sm:text-3xl font-extrabold text-[var(--tkv-ink)]">
            Tìm nhanh
          </h1>
          <p className="text-sm text-[var(--tkv-ink-secondary)]">
            Tìm nguyên liệu trong tủ, công thức món ăn hoặc chuyển nhanh đến khu vực cần thao tác.
          </p>
        </div>

        <TkvSearchField
          value={q}
          onChange={updateQuery}
          placeholder="Tìm kiếm món ăn hoặc nguyên liệu…"
          label="Tìm kiếm trong căn bếp"
        />

        {/* Scope Chips matching C02.png */}
        <div className="flex items-center gap-2 flex-wrap" role="tablist" aria-label="Bộ lọc tìm nhanh">
          {[
            { id: 'all' as const, label: 'Tất cả' },
            { id: 'recent' as const, label: 'Thao tác nhanh' },
            { id: 'saved' as const, label: 'Đã lưu' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={scope === tab.id}
              onClick={() => setScope(tab.id)}
              className={clsx(
                'tkv-focusable min-h-[42px] px-4 py-1.5 rounded-full text-sm font-bold border transition-colors',
                scope === tab.id
                  ? 'bg-[var(--tkv-primary)] text-white border-[var(--tkv-primary)]'
                  : 'bg-white text-[var(--tkv-ink-secondary)] border-[var(--tkv-border)] hover:border-[var(--tkv-primary)]',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {trimmed ? (
          <div className="space-y-5">
            <section className="space-y-2.5" aria-label="Kết quả trong tủ lạnh">
              <h2 className="tkv-heading text-base font-extrabold text-[var(--tkv-ink)]">
                Nguyên liệu trong tủ lạnh ({matchingStock.length})
              </h2>
              {matchingStock.length === 0 ? (
                <TkvSurface tone="mint" className="p-4 text-sm text-[var(--tkv-ink-secondary)]">
                  Không có lô nguyên liệu nào khớp từ khóa “{trimmed}”.
                </TkvSurface>
              ) : (
                <div className="space-y-2">
                  {matchingStock.map((lot) => (
                    <Link
                      key={lot.id}
                      to={vnextHref(`/fridge/${lot.id}`)}
                      className="tkv-focusable block rounded-2xl bg-white border border-[var(--tkv-border)] p-4 hover:border-[var(--tkv-primary)] transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-sm text-[var(--tkv-ink)]">{lot.name}</span>
                        <TkvBadge tone="neutral">
                          {lot.quantity} {lot.unit}
                        </TkvBadge>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-2.5" aria-label="Kết quả công thức món ăn">
              <h2 className="tkv-heading text-base font-extrabold text-[var(--tkv-ink)]">
                Công thức món ăn ({matchingRecipes.length})
              </h2>
              {discoveryQuery.isPending ? (
                <p className="text-sm text-[var(--tkv-ink-muted)]">Đang tìm trong kho công thức…</p>
              ) : matchingRecipes.length === 0 ? (
                <TkvSurface tone="mint" className="p-4 text-sm text-[var(--tkv-ink-secondary)]">
                  Không tìm thấy món ăn nào khớp từ khóa “{trimmed}”.
                </TkvSurface>
              ) : (
                <div className="space-y-2">
                  {matchingRecipes.map(({ recipe, canCookWithoutBuying }) => (
                    <Link
                      key={recipe.id}
                      to={vnextHref(`/recipes/${recipe.slug || recipe.id}`)}
                      className="tkv-focusable block rounded-2xl bg-white border border-[var(--tkv-border)] p-4 hover:border-[var(--tkv-primary)] transition-colors"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-extrabold text-sm text-[var(--tkv-ink)]">{recipe.title}</p>
                          <p className="text-xs text-[var(--tkv-ink-secondary)]">
                            {recipe.cookTimeMinutes} phút · {recipe.servings} người
                          </p>
                        </div>
                        <TkvBadge tone={canCookWithoutBuying ? 'success' : 'neutral'}>
                          {canCookWithoutBuying ? 'Đủ nguyên liệu' : 'Xem chi tiết'}
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
                className="tkv-focusable block rounded-[var(--tkv-radius-card)] bg-white border border-[var(--tkv-border)] p-4 hover:border-[var(--tkv-primary)] transition-colors shadow-[var(--tkv-shadow-card)]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5">
                    <span className="w-11 h-11 rounded-2xl bg-[var(--tkv-surface-mint)] text-[var(--tkv-primary)] flex items-center justify-center shrink-0">
                      <VNextIcon name={sc.icon} size={20} />
                    </span>
                    <div>
                      <p className="tkv-heading text-base font-extrabold text-[var(--tkv-ink)]">
                        {sc.title}
                      </p>
                      <p className="text-xs text-[var(--tkv-ink-secondary)]">{sc.subtitle}</p>
                    </div>
                  </div>
                  <VNextIcon name="chevron-right" size={18} className="text-[var(--tkv-ink-muted)] shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="pt-2">
          <TkvButton variant="secondary" onClick={() => navigate(vnextHref('/'))}>
            Quay về trang Hôm nay
          </TkvButton>
        </div>
      </div>
    </ConsumerStudioShell>
  );
};

/** C06 / C07 — Chi tiết nguyên liệu & Chỉnh sửa số lượng (wraps authoritative IngredientDetailPage). */
export const C06LotDetailVNext: React.FC = () => (
  <ConsumerStudioShell screenId="C06" title="Chi tiết nguyên liệu" backTo={vnextHref('/fridge')}>
    <div className="tkv-adapted-surface takosan-rebuild" data-tkv-surface-adapt="1">
      <IngredientDetailPage />
    </div>
  </ConsumerStudioShell>
);

/** C08 — Đối soát tồn kho (wraps authoritative T13 ReconciliationPage). */
export const C08ReconciliationVNext: React.FC = () => (
  <ConsumerStudioShell screenId="C08" title="Đối soát tồn kho" backTo={vnextHref('/fridge')}>
    <div className="space-y-4">
      <TkvSurface tone="mint" className="p-4 sm:p-5 flex items-center justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <p className="text-xs font-extrabold uppercase tracking-wider text-[var(--tkv-primary)]">
            C08 · Đối soát dữ liệu máy chủ & quan sát thực tế
          </p>
          <p className="text-sm text-[var(--tkv-ink-secondary)]">
            Kiểm tra các chênh lệch số lượng, vị trí bảo quản hoặc hạn dùng trước khi gửi quyết định lên máy chủ.
          </p>
        </div>
      </TkvSurface>
      <div className="tkv-adapted-surface takosan-rebuild" data-tkv-surface-adapt="1">
        <ReconciliationPage />
      </div>
    </div>
  </ConsumerStudioShell>
);

/** C09 / C10 — Quét nguyên liệu & Quyền camera / Tải ảnh dự phòng (Kitchen Studio Scan Frame). */
export const C09ScanStudioVNext: React.FC = () => (
  <ConsumerStudioShell screenId="C09" title="Quét nguyên liệu" backTo={vnextHref('/fridge')} showContextualScan={false}>
    <div className="tkv-adapted-surface takosan-rebuild" data-tkv-surface-adapt="1">
      <ScanPage />
    </div>
  </ConsumerStudioShell>
);

/** C11 / C12 / C13 — AI đang xử lý · Duyệt kết quả AI · Kết quả đã xác nhận. */
export const C12ScanReviewVNext: React.FC = () => (
  <ConsumerStudioShell screenId="C12" title="Duyệt kết quả AI" backTo={vnextHref('/scan')} showContextualScan={false}>
    <div className="space-y-4">
      <TkvSurface tone="mint" className="p-4 text-xs sm:text-sm text-[var(--tkv-ink)] flex items-center gap-2.5">
        <VNextIcon name="shield" size={18} className="text-[var(--tkv-primary)] shrink-0" />
        <span>
          <strong>Nguyên tắc duyệt trước khi lưu:</strong> Vui lòng kiểm tra tên, số lượng, đơn vị và hạn dùng trước khi xác nhận nhập vào tủ lạnh.
        </span>
      </TkvSurface>
      <div className="tkv-adapted-surface takosan-rebuild" data-tkv-surface-adapt="1">
        <ScanResultPage />
      </div>
    </div>
  </ConsumerStudioShell>
);

/** C14 — Duyệt hóa đơn OCR (preserves raw OCR evidence, confidence, and PII notice). */
export const C14ReceiptReviewVNext: React.FC = () => (
  <ConsumerStudioShell screenId="C14" title="Duyệt hóa đơn" backTo={vnextHref('/scan')} showContextualScan={false}>
    <div className="space-y-4">
      <TkvSurface tone="saffron" className="p-4 text-xs sm:text-sm text-[var(--tkv-ink)] flex items-center gap-2.5">
        <VNextIcon name="info" size={18} className="text-[var(--tkv-warning)] shrink-0" />
        <span>
          <strong>Bảo vệ thông tin hóa đơn:</strong> Hệ thống giữ nguyên bằng chứng OCR gốc, không tự điền giá tiền thiếu và chỉ nhập các dòng bạn xác nhận.
        </span>
      </TkvSurface>
      <div className="tkv-adapted-surface takosan-rebuild" data-tkv-surface-adapt="1">
        <ReceiptReviewPage />
      </div>
    </div>
  </ConsumerStudioShell>
);
