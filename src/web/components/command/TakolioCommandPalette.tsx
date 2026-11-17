import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Clock, CornerDownLeft, Flame, Search, Sparkles, X } from 'lucide-react';
import { clsx } from 'clsx';
import { api } from '../../services/api';
import { getCurrentScope } from '../../services/http';
import { stripVietnameseAccents } from '../../services/kitchen-os';
import { recipeImageErrorHandler, resolveRecipeImageV4 } from '../../lib/recipe-media';
import { useModalFocus } from '../../design-system/use-modal-focus';
import {
  FreshnessShieldIcon,
  MortarPestleIcon,
  NavFridgeIcon,
  NavPlannerIcon,
  NavShoppingIcon,
  ReceiptScanIcon,
  type TakolioIconProps,
} from '../../design-system/icons';

export interface TakolioCommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

interface QuickStudioAction {
  id: string;
  label: string;
  subtitle: string;
  href: string;
  shortcutHint: string;
  keywords: string;
  tone: 'flame' | 'jade' | 'turmeric';
  Icon: React.FC<TakolioIconProps>;
}

const QUICK_STUDIO_ACTIONS: readonly QuickStudioAction[] = [
  {
    id: 'action-studio',
    label: 'Mở Sổ Tay Gia Truyền & Xưởng Sơ Chế Đầu Tuần',
    subtitle: 'AI chuẩn hóa công thức mẹ nấu & kịch bản sơ chế Chủ Nhật 90 phút',
    href: '/studio',
    shortcutHint: 'ATELIER',
    keywords: 'studio so tay gia truyen xuong so che dau tuan batch prep cong thuc me nau',
    tone: 'turmeric',
    Icon: MortarPestleIcon,
  },
  {
    id: 'action-insights',
    label: 'Mở Trung Tâm Phân Tích Bếp, Dinh Dưỡng & Chống Lãng Phí',
    subtitle: 'Điểm Zero-Waste, tự động bù 8 gia vị nền & ngân sách đi chợ tuần',
    href: '/insights',
    shortcutHint: 'PULSE',
    keywords: 'insights phan tich bep dinh duong chong lang phi zero waste ngan sach gia vi nen',
    tone: 'jade',
    Icon: FreshnessShieldIcon,
  },
  {
    id: 'action-scan',
    label: 'Quét Hóa Đơn / Kệ Tủ Lạnh AI',
    subtitle: 'Nhận diện thực phẩm tức thì từ ảnh chụp hóa đơn hoặc ngăn mát',
    href: '/scan',
    shortcutHint: 'VISION',
    keywords: 'scan quet hoa don ke tu lanh ai camera ocr nhap nhanh',
    tone: 'flame',
    Icon: ReceiptScanIcon,
  },
  {
    id: 'action-fridge',
    label: 'Mở Khoang Tủ Lạnh FEFO 3 Ngăn',
    subtitle: 'Kiểm kê ngăn mát, ngăn đông, tủ khô và ưu tiên dùng trước khi hết hạn',
    href: '/fridge',
    shortcutHint: 'FEFO',
    keywords: 'fridge khoang tu lanh fefo 3 ngan ton kho ngan mat ngan dong tu kho',
    tone: 'jade',
    Icon: NavFridgeIcon,
  },
  {
    id: 'action-planner',
    label: 'Lập Thực Đơn Mâm Cơm 7 Ngày',
    subtitle: 'Cân bằng món Mặn · Canh · Xào hợp khẩu vị và đồ sẵn trong tủ',
    href: '/planner',
    shortcutHint: '7 NGÀY',
    keywords: 'planner lap thuc don mam com 7 ngay ke hoach tuan bua toi',
    tone: 'turmeric',
    Icon: NavPlannerIcon,
  },
  {
    id: 'action-shopping',
    label: 'Mở Giỏ Đi Chợ Khép Kín',
    subtitle: 'Danh sách cần mua tự động trừ tồn kho và nhập thẳng về tủ lạnh',
    href: '/shopping',
    shortcutHint: 'ĐI CHỢ',
    keywords: 'shopping mo gio di cho khep kin danh sach mua sam sieu thi',
    tone: 'flame',
    Icon: NavShoppingIcon,
  },
] as const;

type NavigableCommandEntry =
  | { kind: 'action'; action: QuickStudioAction; href: string }
  | {
      kind: 'recipe';
      slug: string;
      title: string;
      cookTimeMinutes: number;
      matchPercentage: number;
      canCookWithoutBuying: boolean;
      imageSrc: string;
      fallbackSrc: string;
      categoryLabelVi: string;
      href: string;
      cookHref: string;
    };

/**
 * Global keyboard listener for `⌘K` (macOS) / `Ctrl+K` (Windows/Linux).
 */
export function useGlobalCommandPaletteShortcut(onToggle: () => void): void {
  const callbackRef = useRef(onToggle);
  callbackRef.current = onToggle;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        callbackRef.current();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
}

export const TakolioCommandPalette: React.FC<TakolioCommandPaletteProps> = ({
  open,
  onClose,
}) => {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<Array<HTMLElement | null>>([]);

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  useModalFocus(open, containerRef, onClose, inputRef);

  // Reset search input & highlight index cleanly whenever opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setDebouncedQuery('');
      setSelectedIndex(0);
      const timer = window.setTimeout(() => {
        inputRef.current?.focus();
      }, 10);
      return () => window.clearTimeout(timer);
    }
  }, [open]);

  // Debounce recipe discovery query while open
  useEffect(() => {
    if (!open) return;
    const handle = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 180);
    return () => window.clearTimeout(handle);
  }, [open, query]);

  const scope = getCurrentScope();

  // STRICT RULE: Only runs when `open === true` (`enabled: open`), NEVER firing when closed!
  const discoveryQuery = useQuery({
    queryKey: [
      'takolio-command-palette-recipes',
      scope.userId,
      scope.householdId,
      debouncedQuery,
    ],
    queryFn: () => api.getRecipeDiscovery({ q: debouncedQuery, pageSize: 6 }),
    enabled: open,
    staleTime: 30_000,
    retry: false,
  });

  const filteredActions = useMemo(() => {
    const normalized = stripVietnameseAccents(query);
    if (!normalized) return [...QUICK_STUDIO_ACTIONS];
    return QUICK_STUDIO_ACTIONS.filter((item) => {
      const haystack = stripVietnameseAccents(
        `${item.label} ${item.subtitle} ${item.keywords}`,
      );
      return normalized.split(/\s+/).every((token) => haystack.includes(token));
    });
  }, [query]);

  const recipeEntries = useMemo(() => {
    const items = discoveryQuery.data?.items ?? [];
    return items.slice(0, 6).map((item) => {
      const resolvedImg = resolveRecipeImageV4(item.recipe);
      const slug = item.recipe.slug;
      return {
        kind: 'recipe' as const,
        slug,
        title: item.recipe.title,
        cookTimeMinutes: item.recipe.cookTimeMinutes,
        matchPercentage: item.matchPercentage,
        canCookWithoutBuying: item.canCookWithoutBuying,
        imageSrc: resolvedImg.src,
        fallbackSrc: resolvedImg.fallbackSrc,
        categoryLabelVi: resolvedImg.categoryLabelVi,
        href: `/recipes/${encodeURIComponent(slug)}`,
        cookHref: `/cook/${encodeURIComponent(slug)}`,
      };
    });
  }, [discoveryQuery.data]);

  const navigableEntries: NavigableCommandEntry[] = useMemo(() => {
    const actionItems: NavigableCommandEntry[] = filteredActions.map((action) => ({
      kind: 'action',
      action,
      href: action.href,
    }));
    return [...actionItems, ...recipeEntries];
  }, [filteredActions, recipeEntries]);

  // Keep selectedIndex within bounds when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [debouncedQuery, filteredActions.length, recipeEntries.length]);

  useEffect(() => {
    const activeEl = itemRefs.current[selectedIndex];
    if (activeEl && typeof activeEl.scrollIntoView === 'function') {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const executeNavigation = useCallback(
    (href: string) => {
      onClose();
      navigate(href);
    },
    [navigate, onClose],
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }

    if (navigableEntries.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % navigableEntries.length);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + navigableEntries.length) % navigableEntries.length);
      return;
    }

    if (event.key === 'Enter') {
      // Allow explicit buttons (e.g. direct "Nấu ngay" button) to handle their own Enter press
      if (
        document.activeElement instanceof HTMLButtonElement &&
        document.activeElement.dataset.commandSecondary === 'true'
      ) {
        return;
      }
      const chosen = navigableEntries[selectedIndex];
      if (chosen) {
        event.preventDefault();
        executeNavigation(chosen.href);
      }
    }
  };

  if (!open) return null;

  const actionCount = filteredActions.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-[#0B120F]/75 px-3 pt-[7vh] pb-6 backdrop-blur-md animate-fade-in sm:px-6 sm:pt-[11vh]"
      onClick={onClose}
      role="presentation"
      data-testid="takolio-command-palette-backdrop"
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Bảng lệnh nhanh Spotlight Takolio"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        className="tk-sanctuary-theme relative flex max-h-[82vh] w-full max-w-2xl flex-col overflow-hidden rounded-[28px] border border-white/14 shadow-2xl animate-slide-up"
      >
        {/* Top Specular Hearth Search Bar */}
        <div className="flex items-center gap-3 border-b border-white/12 bg-white/[0.03] px-4 py-3.5 sm:px-5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-tk-flame/20 text-tk-flame-glow ring-1 ring-tk-flame/35">
            <Search className="h-4.5 w-4.5" aria-hidden="true" />
          </div>

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm nhanh món 3 miền, nguyên liệu tủ lạnh, hoặc gõ lệnh bếp…"
            aria-label="Tìm nhanh món 3 miền, nguyên liệu tủ lạnh, hoặc gõ lệnh bếp"
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white placeholder:text-white/45 focus:outline-none sm:text-base"
          />

          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              aria-label="Xóa từ khóa tìm kiếm"
              className="rounded-lg px-2 py-1 text-xs font-bold text-white/60 transition-colors hover:bg-white/10 hover:text-white cursor-pointer"
            >
              Xóa
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng bảng lệnh nhanh"
            className="inline-flex h-8 items-center gap-1 rounded-xl border border-white/14 bg-white/8 px-2.5 text-[11px] font-extrabold text-white/75 transition-colors hover:bg-white/15 hover:text-white cursor-pointer"
          >
            <span>ESC</span>
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        {/* Scrollable Spotlight Results Stage */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4">
          {/* Group 1: Quick Studio Actions */}
          {filteredActions.length > 0 && (
            <section aria-label="Lệnh điều hướng nhanh Studio">
              <div className="mb-2 flex items-center justify-between px-2">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.1em] text-tk-jade-mint">
                  <Sparkles className="h-3.5 w-3.5 text-tk-turmeric" aria-hidden="true" />
                  Lệnh Bếp & Không Gian Studio
                </span>
                <span className="text-[11px] font-bold text-white/45 tk-tabular">
                  {filteredActions.length} lối tắt
                </span>
              </div>

              <div className="space-y-1">
                {filteredActions.map((action, idx) => {
                  const isSelected = selectedIndex === idx;
                  const IconComp = action.Icon;
                  return (
                    <div
                      key={action.id}
                      ref={(el) => {
                        itemRefs.current[idx] = el;
                      }}
                      role="option"
                      aria-selected={isSelected}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      onClick={() => executeNavigation(action.href)}
                      className={clsx(
                        'group flex items-center justify-between gap-3 rounded-2xl border px-3.5 py-2.5 transition-all cursor-pointer',
                        isSelected
                          ? 'border-tk-flame/55 bg-white/[0.11] shadow-sm'
                          : 'border-transparent bg-white/[0.03] hover:bg-white/[0.07]',
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className={clsx(
                            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors',
                            isSelected
                              ? 'border-white/25 bg-white/15'
                              : 'border-white/10 bg-tk-sanctuary-elevated',
                          )}
                        >
                          <IconComp size={20} tone="cream" active={isSelected} />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-extrabold text-white">
                            {action.label}
                          </p>
                          <p className="truncate text-xs text-white/60">
                            {action.subtitle}
                          </p>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <span
                          className={clsx(
                            'hidden sm:inline-flex rounded-full border px-2 py-0.5 text-[10px] font-extrabold tracking-wider',
                            action.tone === 'flame'
                              ? 'border-tk-flame/40 bg-tk-flame/20 text-tk-flame-glow'
                              : action.tone === 'turmeric'
                                ? 'border-tk-turmeric/40 bg-tk-turmeric/20 text-amber-300'
                                : 'border-tk-jade-mint/35 bg-tk-jade/35 text-tk-jade-mint',
                          )}
                        >
                          {action.shortcutHint}
                        </span>
                        <CornerDownLeft
                          className={clsx(
                            'h-4 w-4 transition-opacity',
                            isSelected ? 'text-tk-flame-glow opacity-100' : 'text-white/30 opacity-0 group-hover:opacity-75',
                          )}
                          aria-hidden="true"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Group 2: Live 3-Region Recipe Discovery */}
          <section aria-label="Món ăn 3 miền khớp từ khóa">
            <div className="mb-2 flex items-center justify-between px-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.1em] text-white/70">
                Khám Phá Món Ngon 3 Miền
              </span>
              {discoveryQuery.isFetching && (
                <span className="text-[11px] font-semibold text-tk-flame-glow animate-pulse">
                  Đang dò kho công thức…
                </span>
              )}
            </div>

            {recipeEntries.length > 0 ? (
              <div className="space-y-1.5">
                {recipeEntries.map((recipe, rIdx) => {
                  const globalIdx = actionCount + rIdx;
                  const isSelected = selectedIndex === globalIdx;
                  return (
                    <div
                      key={recipe.slug}
                      ref={(el) => {
                        itemRefs.current[globalIdx] = el;
                      }}
                      role="option"
                      aria-selected={isSelected}
                      onMouseEnter={() => setSelectedIndex(globalIdx)}
                      onClick={() => executeNavigation(recipe.href)}
                      className={clsx(
                        'group flex items-center justify-between gap-3 rounded-2xl border p-2.5 transition-all cursor-pointer',
                        isSelected
                          ? 'border-tk-flame/60 bg-white/[0.12] shadow-sm'
                          : 'border-white/8 bg-white/[0.03] hover:bg-white/[0.07]',
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-xl border border-white/15 bg-tk-sanctuary">
                          <img
                            src={recipe.imageSrc}
                            alt={recipe.title}
                            loading="lazy"
                            onError={recipeImageErrorHandler(recipe.fallbackSrc)}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-extrabold text-white">
                            {recipe.title}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                            <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 font-bold text-white/85 tk-tabular">
                              <Clock className="h-3 w-3 text-tk-turmeric" aria-hidden="true" />
                              {recipe.cookTimeMinutes} phút
                            </span>
                            <span
                              className={clsx(
                                'inline-flex items-center rounded-full px-2 py-0.5 font-bold tk-tabular',
                                recipe.canCookWithoutBuying
                                  ? 'bg-tk-jade/45 text-tk-jade-mint ring-1 ring-tk-jade-mint/30'
                                  : 'bg-white/8 text-white/65',
                              )}
                            >
                              {recipe.canCookWithoutBuying
                                ? 'Đủ đồ nấu ngay'
                                : `${recipe.matchPercentage}% khớp tủ`}
                            </span>
                            <span className="hidden md:inline text-white/45">
                              {recipe.categoryLabelVi}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          data-command-secondary="true"
                          onClick={(e) => {
                            e.stopPropagation();
                            executeNavigation(recipe.cookHref);
                          }}
                          className="inline-flex items-center gap-1 rounded-xl bg-tk-flame px-3 py-1.5 text-xs font-extrabold text-white shadow-xs transition-colors hover:bg-tk-flame-hover cursor-pointer"
                        >
                          <Flame className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Nấu ngay</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : !discoveryQuery.isFetching && filteredActions.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-8 text-center">
                <p className="text-sm font-bold text-white/85">
                  Không tìm thấy món ăn hoặc lệnh bếp khớp với “{query}”
                </p>
                <p className="mt-1 text-xs text-white/55">
                  Thử gõ “kho tộ”, “canh chua”, “gia truyền” hoặc mở Xưởng Sổ Tay Gia Truyền để AI tạo công thức mới.
                </p>
              </div>
            ) : null}
          </section>
        </div>

        {/* Obsidian Keyboard Telemetry Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-black/30 px-4 py-2.5 text-[11px] font-semibold text-white/60">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <kbd className="rounded bg-white/12 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">↑↓</kbd>
              Di chuyển
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="rounded bg-white/12 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">↵</kbd>
              Mở trang
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="rounded bg-white/12 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">ESC</kbd>
              Đóng
            </span>
          </div>
          <span className="font-bold tracking-wide text-tk-jade-mint/90">
            ⌘K · TAKOLIO KITCHEN OS V6
          </span>
        </div>
      </div>
    </div>
  );
};

export default TakolioCommandPalette;
