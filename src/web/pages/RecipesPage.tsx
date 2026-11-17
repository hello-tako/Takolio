import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Clock,
  Heart,
  Minus,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { clsx } from 'clsx';
import { TopBar } from '../components/common/TopBar';
import { RecipeCard } from '../components/common/RecipeCard';
import { InlineError, InlineLoading } from '../components/common/AsyncState';
import {
  ActionButton,
  AtelierBadge,
  BentoCard,
  SegmentedTabs,
} from '../design-system/v4/AtelierPrimitives';
import {
  BambooSteamerIcon,
  ChopsticksBowlIcon,
  ClaypotBraiseIcon,
  HerbSprigIcon,
  HouseholdTrayIcon,
  NavRecipesIcon,
  PlatingSparkleIcon,
  PortionScaleIcon,
  StockpotSoupIcon,
  WokFlameIcon,
} from '../design-system/icons';
import { TakoChef3D } from '../components/3d';
import { api, ApiError } from '../services/api';
import { queryKeys } from '../lib/queryKeys';
import {
  readDiscoveryFilters,
  updateDiscoveryFilters,
  resetDiscoveryFilters,
  discoveryRequest,
  type DiscoveryFilters,
} from '../lib/recipe-discovery';
import { FavoritesCollection } from '../features/favorites/FavoritesCollection';
import { KitchenLoopStrip } from '../components/cooking/CookingTechniqueVisual';
import { useFamilyPreferences } from '../features/family/useFamilyPreferences';
import { useAuthStore } from '../stores/useAuthStore';

const CATEGORIES: ReadonlyArray<readonly [NonNullable<DiscoveryFilters['category']>, string]> = [
  ['mon_canh', 'Canh'],
  ['mon_kho', 'Kho / rim'],
  ['mon_xao', 'Xào'],
  ['mon_chien', 'Chiên / rán'],
  ['mon_hap_luoc', 'Hấp / luộc'],
  ['mon_cuon_nom', 'Cuốn / nộm'],
  ['mon_bun_pho', 'Bún / phở'],
  ['mon_chay', 'Chay'],
  ['mon_nhanh_sang', 'Ăn sáng'],
  ['mon_lau_tiec', 'Lẩu / tiệc'],
];

const VISUAL_CATEGORY_RIBBONS: ReadonlyArray<{
  id: DiscoveryFilters['category'];
  labelVi: string;
  subtitleVi: string;
  renderIcon: (active: boolean) => React.ReactNode;
}> = [
  {
    id: null,
    labelVi: 'Tất cả món ngon',
    subtitleVi: 'Trọn bộ bếp nhà',
    renderIcon: (active) => <NavRecipesIcon size={20} tone={active ? 'cream' : 'flame'} active={active} />,
  },
  {
    id: 'mon_kho',
    labelVi: 'Món Kho Đậm Đà',
    subtitleVi: 'Sánh màu đưa cơm',
    renderIcon: (active) => <ClaypotBraiseIcon size={20} tone={active ? 'cream' : 'flame'} active={active} />,
  },
  {
    id: 'mon_canh',
    labelVi: 'Canh Thanh Mát',
    subtitleVi: 'Ngọt lành giải nhiệt',
    renderIcon: (active) => <StockpotSoupIcon size={20} tone={active ? 'cream' : 'jade'} active={active} />,
  },
  {
    id: 'mon_xao',
    labelVi: 'Xào Nhanh Giòn',
    subtitleVi: 'Lửa vượng xanh mướt',
    renderIcon: (active) => <WokFlameIcon size={20} tone={active ? 'cream' : 'flame'} active={active} />,
  },
  {
    id: 'mon_bun_pho',
    labelVi: 'Bún/Phở Một Nồi',
    subtitleVi: 'Nước dùng thanh tao',
    renderIcon: (active) => <ChopsticksBowlIcon size={20} tone={active ? 'cream' : 'turmeric'} active={active} />,
  },
  {
    id: 'mon_chay',
    labelVi: 'Món Chay',
    subtitleVi: 'Thanh đạm nhẹ bụng',
    renderIcon: (active) => <HerbSprigIcon size={20} tone={active ? 'cream' : 'jade'} active={active} />,
  },
  {
    id: 'mon_hap_luoc',
    labelVi: 'Hấp & Luộc',
    subtitleVi: 'Giữ trọn vị ngọt',
    renderIcon: (active) => <BambooSteamerIcon size={20} tone={active ? 'cream' : 'turmeric'} active={active} />,
  },
  {
    id: 'mon_cuon_nom',
    labelVi: 'Gỏi & Cuốn',
    subtitleVi: 'Tươi giòn ít dầu',
    renderIcon: (active) => <PlatingSparkleIcon size={20} tone={active ? 'cream' : 'jade'} active={active} />,
  },
];

const CUISINES = [
  ['vietnamese', 'Món Việt'],
  ['korean', 'Món Hàn'],
  ['japanese', 'Món Nhật'],
  ['chinese', 'Trung Hoa'],
  ['thai', 'Món Thái'],
  ['italian', 'Món Ý'],
] as const;

const REGIONS: ReadonlyArray<readonly [NonNullable<DiscoveryFilters['region']>, string]> = [
  ['bac', 'Miền Bắc'],
  ['trung', 'Miền Trung'],
  ['nam', 'Miền Nam'],
];

const REGIONAL_HERITAGE_TABS: ReadonlyArray<{
  id: DiscoveryFilters['region'];
  labelVi: string;
  taglineVi: string;
}> = [
  { id: null, labelVi: 'Tất cả vùng miền', taglineVi: 'Việt Nam & Á–Âu' },
  { id: 'bac', labelVi: 'Chuẩn vị Bắc', taglineVi: 'Thanh tao, dịu nhẹ' },
  { id: 'trung', labelVi: 'Đậm đà Miền Trung', taglineVi: 'Dậy hương sả ớt' },
  { id: 'nam', labelVi: 'Dân dã Miền Nam', taglineVi: 'Ngọt lành kho tộ' },
];

export const RecipesPage = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const savedView = params.get('view') === 'saved';
  const filters = readDiscoveryFilters(params);
  const isGuest = useAuthStore((state) => state.isGuest);
  const preferences = useFamilyPreferences(!isGuest);
  const servings = filters.servings ?? preferences.data?.preferences.householdSize ?? 2;

  const [filtersOpen, setFiltersOpen] = useState(
    () => (typeof window !== 'undefined' && window.matchMedia?.('(min-width: 1280px)').matches) ?? false,
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const media = window.matchMedia('(min-width: 1280px)');
    const updatePanel = () => setFiltersOpen(media.matches);
    media.addEventListener('change', updatePanel);
    return () => media.removeEventListener('change', updatePanel);
  }, []);

  const filterCount = [
    filters.cuisine,
    filters.category,
    filters.region,
    filters.noBuy,
    filters.fast,
  ].filter(Boolean).length;

  const inputRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusResults = useRef(false);

  const update = (patch: Partial<DiscoveryFilters>, replace = false) =>
    setParams(updateDiscoveryFilters(params, patch), { replace });

  const reset = () => {
    setParams(resetDiscoveryFilters(params));
    inputRef.current?.focus();
  };

  const [readySearch, setReadySearch] = useState(filters.q);
  useEffect(() => {
    const timer = window.setTimeout(() => setReadySearch(filters.q), 250);
    return () => window.clearTimeout(timer);
  }, [filters.q]);

  const request = discoveryRequest({ ...filters, servings });
  const query = useQuery({
    queryKey: queryKeys.recipeDiscovery(request),
    enabled: !savedView && readySearch === filters.q,
    queryFn: () => api.getRecipeDiscovery(request),
  });

  const result = query.data;
  const snapshotChanged =
    query.error instanceof ApiError && query.error.code === 'DISCOVERY_SNAPSHOT_CHANGED';
  const invalidCursor =
    query.error instanceof ApiError &&
    (query.error.code === 'DISCOVERY_CURSOR_INVALID' ||
      (!!filters.cursor && query.error.code === 'DISCOVERY_QUERY_INVALID'));

  useEffect(() => {
    if (query.isSuccess && result && filters.page !== result.page) {
      setParams(updateDiscoveryFilters(params, { page: result.page }), { replace: true });
    }
  }, [query.isSuccess, filters.page, result, params, setParams]);

  useEffect(() => {
    if (focusResults.current && !query.isFetching && (query.isSuccess || query.isError)) {
      focusResults.current = false;
      headingRef.current?.focus();
    }
  }, [result, query.isSuccess, query.isError, query.isFetching]);

  const restart = () => {
    focusResults.current = true;
    setParams(updateDiscoveryFilters(params, { page: 1 }));
  };

  const activeFilters: Array<{
    key: keyof DiscoveryFilters;
    label: string;
    clear: Partial<DiscoveryFilters>;
  }> = [];
  if (filters.q) activeFilters.push({ key: 'q', label: `Tìm: “${filters.q}”`, clear: { q: '' } });
  if (filters.cuisine) {
    const found = CUISINES.find(([id]) => id === filters.cuisine);
    if (found) activeFilters.push({ key: 'cuisine', label: found[1], clear: { cuisine: null } });
  }
  if (filters.category) {
    const found = CATEGORIES.find(([id]) => id === filters.category);
    if (found) activeFilters.push({ key: 'category', label: found[1], clear: { category: null } });
  }
  if (filters.region) {
    const found = REGIONS.find(([id]) => id === filters.region);
    if (found) activeFilters.push({ key: 'region', label: found[1], clear: { region: null } });
  }
  if (filters.noBuy) {
    activeFilters.push({ key: 'noBuy', label: 'Không mua thêm', clear: { noBuy: false } });
  }
  if (filters.fast) {
    activeFilters.push({ key: 'fast', label: 'Tối đa 20 phút', clear: { fast: false } });
  }

  const pagerHref = (page: number, cursor: string | null) =>
    `/recipes?${updateDiscoveryFilters(params, { page, cursor: cursor ?? undefined })}`;

  const handleTabChange = (nextTab: 'discover' | 'saved') => {
    if (nextTab === 'saved') {
      navigate(`/recipes?view=saved&servings=${servings}`);
    } else {
      navigate(`/recipes?servings=${servings}`);
    }
  };

  return (
    <div className="takosan-rebuild min-h-screen bg-tk-canvas pb-16">
      <TopBar kitchen />

      <div className="kitchen-page-body mx-auto w-full max-w-[1320px] px-4 sm:px-6 pt-4 space-y-5">
        {/* Obsidian Hearth Culinary Cinema Header */}
        <section
          aria-label="Không gian khám phá công thức"
          className="tk-cinema-stage tk-sanctuary-theme p-6 sm:p-7 text-white"
        >
          <img
            src="/takolio/v5/posters/wok-poster.webp"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-42"
          />
          <video
            ref={(el) => {
              if (!el) return;
              if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent ?? '')) return;
              if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
              try {
                const p = el.play?.();
                if (p && typeof p.catch === 'function') p.catch(() => {});
              } catch {
                // Ignore autoplay restrictions
              }
            }}
            src="/takolio/v5/videos/cook-wok-fire.mp4"
            poster="/takolio/v5/posters/wok-poster.webp"
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-50"
          />
          <div
            aria-hidden="true"
            className="tk-cinema-vignette pointer-events-none absolute inset-0"
          />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="space-y-2.5 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                <AtelierBadge tone="dark" icon={<HouseholdTrayIcon size={13} tone="flame" active />}>
                  {query.isSuccess && result?.total
                    ? `${result.total} công thức chuẩn hóa`
                    : '580+ công thức chuẩn vị'}
                </AtelierBadge>
                <AtelierBadge tone="dark" icon={<PortionScaleIcon size={13} tone="cream" active />}>
                  Khẩu phần chuẩn {servings} người
                </AtelierBadge>
              </div>
              <h1 className="font-heading text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                {savedView ? 'Bộ sưu tập món ngon đã lưu' : 'Hôm nay nhà mình nấu gì?'}
              </h1>
              <p className="text-sm sm:text-base text-white/78 leading-relaxed">
                {savedView
                  ? 'Những món tủ gia đình yêu thích — chạm một lần để xếp vào thực đơn tuần hoặc vào bếp ngay.'
                  : 'Khám phá kho tàng mâm cơm Việt Nam Bắc – Trung – Nam & Á–Âu được đối chiếu trực tiếp với nguyên liệu sẵn có trong tủ lạnh.'}
              </p>

              {/* Segmented Tabs: Khám phá món ngon vs Bộ sưu tập đã lưu */}
              <div className="pt-1.5 flex flex-wrap items-center gap-3">
                <SegmentedTabs<'discover' | 'saved'>
                  value={savedView ? 'saved' : 'discover'}
                  onChange={handleTabChange}
                  layoutId="recipes-atelier-tabs"
                  dark
                  options={[
                    {
                      value: 'discover',
                      label: 'Khám phá món ngon',
                      icon: <NavRecipesIcon size={15} tone={!savedView ? 'flame' : 'cream'} />,
                    },
                    {
                      value: 'saved',
                      label: 'Bộ sưu tập đã lưu',
                      icon: <Heart size={14} className={clsx(savedView && 'text-tk-berry fill-current')} />,
                    },
                  ]}
                />
              </div>
            </div>

            <div className="hidden sm:flex shrink-0 items-center justify-center">
              <TakoChef3D pose={savedView ? 'wave' : 'cook'} size={112} interactive={false} />
            </div>
          </div>
        </section>

        <KitchenLoopStrip
          activeStage="recipes"
          summaryText={`Đang tính định lượng thông minh theo khẩu phần ${servings} người`}
        />

        {savedView ? (
          <FavoritesCollection servings={servings} />
        ) : (
          <>
            {/* Regional Heritage Quick-Filter Tabs (Tất cả · Chuẩn vị Bắc · Đậm đà Miền Trung · Dân dã Miền Nam) */}
            <div
              role="group"
              aria-label="Bản đồ vị giác vùng miền"
              className="grid grid-cols-2 lg:grid-cols-4 gap-2.5"
            >
              {REGIONAL_HERITAGE_TABS.map((regTab) => {
                const isSelected = filters.region === regTab.id;
                return (
                  <button
                    key={regTab.id ?? 'all-regions'}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() =>
                      update({
                        region: isSelected && regTab.id !== null ? null : regTab.id,
                      })
                    }
                    className={clsx(
                      'flex flex-col items-start justify-center rounded-2xl border px-4 py-2.5 text-left transition-tap cursor-pointer min-h-[54px]',
                      isSelected
                        ? 'border-tk-sanctuary bg-tk-sanctuary text-white shadow-card'
                        : 'border-tk-stone bg-tk-surface text-tk-ink shadow-2xs hover:border-tk-ink/35 hover:bg-tk-sunken/60',
                    )}
                  >
                    <span className="text-xs sm:text-sm font-extrabold">{regTab.labelVi}</span>
                    <span
                      className={clsx(
                        'text-[11px] font-medium',
                        isSelected ? 'text-tk-jade-mint' : 'text-tk-muted',
                      )}
                    >
                      {regTab.taglineVi}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Visual Category Ribbons */}
            <div aria-label="Nhóm món tiêu biểu" className="overflow-x-auto pb-1 -mx-1 px-1">
              <div className="flex items-center gap-2.5 min-w-max">
                {VISUAL_CATEGORY_RIBBONS.map((ribbon) => {
                  const isActive = filters.category === ribbon.id;
                  return (
                    <button
                      key={ribbon.id ?? 'all'}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => update({ category: isActive && ribbon.id !== null ? null : ribbon.id })}
                      className={clsx(
                        'flex items-center gap-2.5 rounded-2xl border px-3.5 py-2.5 text-left transition-tap cursor-pointer min-h-[54px]',
                        isActive
                          ? 'border-tk-flame bg-tk-flame text-white shadow-float'
                          : 'border-tk-stone/85 bg-white text-tk-ink shadow-xs hover:border-tk-ink/25 hover:bg-tk-sunken/50',
                      )}
                    >
                      <span
                        className={clsx(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                          isActive ? 'bg-white/20' : 'bg-tk-sunken',
                        )}
                      >
                        {ribbon.renderIcon(isActive)}
                      </span>
                      <span className="flex flex-col leading-tight">
                        <span className="text-xs sm:text-sm font-extrabold">{ribbon.labelVi}</span>
                        <span
                          className={clsx(
                            'text-[11px] font-medium mt-0.5',
                            isActive ? 'text-white/85' : 'text-tk-muted',
                          )}
                        >
                          {ribbon.subtitleVi}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="discovery-workspace grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              {/* Left Discovery Studio Filter Rail */}
              <aside
                className="discovery-controls xl:col-span-3 rounded-[24px] border border-tk-stone/85 bg-white p-5 shadow-card space-y-4 xl:sticky xl:top-20"
                aria-label="Tìm và lọc công thức"
              >
                <div>
                  <label
                    htmlFor="recipe-search"
                    className="block text-xs font-extrabold uppercase tracking-wider text-tk-secondary mb-2"
                  >
                    Tìm món hoặc nguyên liệu
                  </label>
                  <div className="relative">
                    <Search
                      size={17}
                      aria-hidden="true"
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-tk-muted"
                    />
                    <input
                      id="recipe-search"
                      ref={inputRef}
                      type="search"
                      name="q"
                      autoComplete="off"
                      maxLength={160}
                      value={filters.q}
                      onChange={(event) => update({ q: event.target.value }, true)}
                      placeholder="Ví dụ: thịt kho, trứng, canh chua…"
                      className="kitchen-search-input w-full min-h-[46px] rounded-2xl border border-tk-stone bg-tk-canvas pl-10 pr-4 py-2.5 text-sm font-semibold text-tk-ink placeholder:font-normal placeholder:text-tk-muted focus:border-tk-flame focus:bg-white focus:outline-none focus:ring-3 focus:ring-tk-flame/20"
                    />
                  </div>
                </div>

                {/* Interactive Servings Adjuster + Accessible Select */}
                <div className="rounded-2xl border border-tk-stone/75 bg-tk-canvas p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-tk-ink">
                      <PortionScaleIcon size={16} tone="jade" active />
                      Khẩu phần nấu
                    </span>
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        aria-label="Giảm số người ăn"
                        disabled={servings <= 1}
                        onClick={() => update({ servings: Math.max(1, servings - 1) })}
                        className="flex h-8 w-8 items-center justify-center rounded-xl border border-tk-stone bg-white text-tk-ink hover:bg-tk-sunken disabled:opacity-40 cursor-pointer"
                      >
                        <Minus size={14} aria-hidden="true" />
                      </button>
                      <select
                        aria-label="Nấu cho bao nhiêu người?"
                        value={servings}
                        onChange={(event) => update({ servings: Number(event.target.value) })}
                        className="h-8 rounded-xl border border-tk-stone bg-white px-2.5 text-xs font-extrabold text-tk-ink tk-tabular focus:border-tk-flame focus:outline-none cursor-pointer"
                      >
                        {Array.from({ length: 20 }, (_, index) => index + 1).map((value) => (
                          <option key={value} value={value}>
                            {value} người
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        aria-label="Tăng số người ăn"
                        disabled={servings >= 20}
                        onClick={() => update({ servings: Math.min(20, servings + 1) })}
                        className="flex h-8 w-8 items-center justify-center rounded-xl border border-tk-stone bg-white text-tk-ink hover:bg-tk-sunken disabled:opacity-40 cursor-pointer"
                      >
                        <Plus size={14} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] leading-relaxed text-tk-muted">
                    Định lượng nguyên liệu tự động quy đổi chuẩn cho {servings} người ăn.
                  </p>
                </div>

                {/* Smart Quick-Toggles */}
                <div className="space-y-2">
                  <span className="block text-xs font-extrabold uppercase tracking-wider text-tk-secondary">
                    Lọc nhanh thông minh
                  </span>
                  <div className="flex flex-wrap xl:flex-col gap-2">
                    <button
                      type="button"
                      aria-pressed={filters.noBuy}
                      onClick={() => update({ noBuy: !filters.noBuy })}
                      className={clsx(
                        'discovery-toggle flex items-center gap-2 rounded-2xl border px-3.5 py-2.5 text-xs sm:text-sm font-bold transition-tap cursor-pointer min-h-[44px]',
                        filters.noBuy
                          ? 'discovery-toggle-active border-tk-jade bg-tk-jade text-white shadow-jade'
                          : 'border-tk-stone bg-tk-canvas text-tk-ink hover:border-tk-jade/40 hover:bg-tk-jade-soft/50',
                      )}
                    >
                      <CheckCircle size={16} aria-hidden="true" />
                      <span>Không mua thêm</span>
                    </button>

                    <button
                      type="button"
                      aria-pressed={filters.fast}
                      onClick={() => update({ fast: !filters.fast })}
                      className={clsx(
                        'discovery-toggle flex items-center gap-2 rounded-2xl border px-3.5 py-2.5 text-xs sm:text-sm font-bold transition-tap cursor-pointer min-h-[44px]',
                        filters.fast
                          ? 'discovery-toggle-active border-tk-flame bg-tk-flame text-white shadow-float'
                          : 'border-tk-stone bg-tk-canvas text-tk-ink hover:border-tk-flame/40 hover:bg-tk-flame-soft/60',
                      )}
                    >
                      <Clock size={16} aria-hidden="true" />
                      <span>Tối đa 20 phút</span>
                    </button>
                  </div>

                  {/* Regional Taste Pills (Chuẩn vị Bắc / Trung / Nam) */}
                  <div className="pt-1">
                    <span className="block text-[11px] font-bold text-tk-muted mb-1.5">
                      Hương vị vùng miền:
                    </span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {REGIONS.map(([regId, regLabel]) => {
                        const activeReg = filters.region === regId;
                        return (
                          <button
                            key={regId}
                            type="button"
                            aria-pressed={activeReg}
                            onClick={() => update({ region: activeReg ? null : regId })}
                            className={clsx(
                              'rounded-xl border px-2 py-2 text-xs font-bold transition-tap cursor-pointer text-center',
                              activeReg
                                ? 'border-tk-turmeric bg-tk-turmeric-soft text-tk-turmeric-deep'
                                : 'border-tk-stone/80 bg-white text-tk-secondary hover:bg-tk-sunken',
                            )}
                          >
                            {regLabel}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <details
                  className="discovery-filter-panel rounded-2xl border border-tk-stone/75 bg-tk-canvas/70 p-3.5"
                  open={filtersOpen}
                  onToggle={(event) => setFiltersOpen(event.currentTarget.open)}
                >
                  <summary className="flex items-center justify-between gap-2 text-xs font-extrabold text-tk-ink cursor-pointer list-none">
                    <span className="inline-flex items-center gap-1.5">
                      <SlidersHorizontal size={14} aria-hidden="true" className="text-tk-flame" />
                      Bộ lọc nâng cao{filterCount ? ` · ${filterCount} đang dùng` : ''}
                    </span>
                    <span className="text-[11px] text-tk-muted">{filtersOpen ? 'Thu gọn' : 'Mở'}</span>
                  </summary>
                  <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-3">
                    <label className="discovery-select-label block space-y-1 text-xs font-bold text-tk-secondary">
                      <span>Ẩm thực</span>
                      <select
                        name="cuisine"
                        autoComplete="off"
                        value={filters.cuisine ?? ''}
                        onChange={(event) => update({ cuisine: event.target.value || null })}
                        className="w-full min-h-[40px] rounded-xl border border-tk-stone bg-white px-3 py-1.5 text-xs font-semibold text-tk-ink"
                      >
                        <option value="">Tất cả ẩm thực</option>
                        {CUISINES.map(([id, label]) => (
                          <option value={id} key={id}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="discovery-select-label block space-y-1 text-xs font-bold text-tk-secondary">
                      <span>Cách nấu chi tiết</span>
                      <select
                        name="category"
                        autoComplete="off"
                        value={filters.category ?? ''}
                        onChange={(event) =>
                          update({
                            category: (event.target.value as DiscoveryFilters['category']) || null,
                          })
                        }
                        className="w-full min-h-[40px] rounded-xl border border-tk-stone bg-white px-3 py-1.5 text-xs font-semibold text-tk-ink"
                      >
                        <option value="">Tất cả cách nấu</option>
                        {CATEGORIES.map(([id, label]) => (
                          <option value={id} key={id}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <p className="mt-3 text-[11px] text-tk-muted leading-relaxed">
                    “Không mua thêm” đối chiếu trực tiếp lượng tồn kho khả dụng trong tủ lạnh.
                  </p>
                </details>

                {activeFilters.length > 0 && (
                  <ActionButton variant="ceramic" fullWidth onClick={reset}>
                    Xóa tìm kiếm và bộ lọc
                  </ActionButton>
                )}
              </aside>

              {/* Main Discovery Results Grid */}
              <section
                aria-labelledby="recipes-results-heading"
                className="xl:col-span-9 min-w-0 space-y-4"
              >
                <div className="kitchen-section-heading flex flex-wrap items-baseline justify-between gap-2">
                  <h2
                    id="recipes-results-heading"
                    ref={headingRef}
                    tabIndex={-1}
                    className="text-xl sm:text-2xl font-extrabold tracking-tight text-tk-ink focus:outline-none"
                  >
                    {filters.q.trim() ? `Kết quả cho “${filters.q.trim()}”` : 'Công thức phù hợp'}
                  </h2>
                  {query.isSuccess && !query.isFetching && (
                    <p role="status" className="text-sm font-bold text-tk-secondary tk-tabular shrink-0">
                      {result?.total} món
                    </p>
                  )}
                </div>

                {activeFilters.length > 0 && (
                  <ul
                    className="discovery-active-filters flex flex-wrap items-center gap-2"
                    aria-label="Điều kiện đang dùng"
                  >
                    {activeFilters.map(({ key, label, clear }) => (
                      <li key={key}>
                        <button
                          type="button"
                          aria-label={`Bỏ ${label}`}
                          onClick={() => {
                            update(clear);
                            headingRef.current?.focus();
                          }}
                          className="inline-flex items-center gap-1.5 rounded-full border border-tk-flame/25 bg-tk-flame-soft px-3 py-1 text-xs font-bold text-tk-flame-deep hover:bg-tk-flame hover:text-white transition-colors cursor-pointer"
                        >
                          <span>{label}</span>
                          <X size={14} aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {result?.source === 'device' && (
                  <p
                    role="status"
                    className="rounded-2xl border border-tk-turmeric/30 bg-tk-turmeric-soft px-4 py-2.5 text-xs sm:text-sm font-semibold text-tk-turmeric-deep"
                  >
                    Đang dùng công thức và nguyên liệu lưu trên thiết bị. Kết nối lại để xem danh sách đầy đủ.
                  </p>
                )}

                {query.isPending || query.isFetching ? (
                  <InlineLoading label="Đang tìm món phù hợp…" />
                ) : snapshotChanged || invalidCursor ? (
                  <BentoCard tone="turmeric" role="alert" className="kitchen-neutral-panel space-y-3">
                    <h3 className="text-lg font-extrabold text-tk-ink">Danh sách món cần tải lại</h3>
                    <p className="text-sm text-tk-secondary">
                      {snapshotChanged
                        ? 'Nguyên liệu hoặc công thức đã thay đổi. Tải lại từ trang đầu để xem các món phù hợp hiện tại.'
                        : 'Liên kết phân trang không còn hợp lệ. Tải lại danh sách với bộ lọc đang dùng.'}
                    </p>
                    <div>
                      <ActionButton variant="flame" onClick={restart}>
                        Tải lại từ trang đầu
                      </ActionButton>
                    </div>
                  </BentoCard>
                ) : query.isError ? (
                  <InlineError error={query.error} onRetry={() => void query.refetch()} />
                ) : !result?.total ? (
                  <BentoCard tone="sunken" padding="lg" className="kitchen-neutral-panel text-center space-y-3 py-12" role="status">
                    <h3 className="text-lg font-extrabold text-tk-ink">Không tìm thấy món phù hợp</h3>
                    <p className="text-sm text-tk-secondary max-w-md mx-auto">
                      Thử tìm với tên nguyên liệu khác hoặc xóa bộ lọc hiện tại để khám phá toàn bộ thực đơn.
                    </p>
                    <div className="pt-1">
                      <ActionButton variant="flame" onClick={reset}>
                        Xóa bộ lọc
                      </ActionButton>
                    </div>
                  </BentoCard>
                ) : (
                  <>
                    <p className="text-xs sm:text-sm font-medium text-tk-muted tk-tabular">
                      Đang xem {(result.page - 1) * result.pageSize + 1}–
                      {(result.page - 1) * result.pageSize + result.items.length} trong {result.total} món
                    </p>

                    <div
                      data-testid="recipe-discovery-grid"
                      className="discovery-grid grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-5"
                    >
                      {result.items.map((item) => (
                        <RecipeCard
                          kitchen
                          key={item.recipe.id}
                          matchResult={item}
                          detailHref={`/recipes/${item.recipe.slug}?servings=${servings}`}
                          variant="grid"
                          headingLevel={3}
                          onClick={() =>
                            navigate(`/recipes/${item.recipe.slug}?servings=${servings}`, {
                              state: { discoveryReturn: `/recipes?${params}` },
                            })
                          }
                        />
                      ))}
                    </div>

                    {result.pages > 1 && (
                      <nav
                        aria-label="Phân trang công thức"
                        className="discovery-pager flex items-center justify-between rounded-2xl border border-tk-stone/85 bg-white px-4 py-3 shadow-xs"
                      >
                        {result.page > 1 ? (
                          <Link
                            to={pagerHref(result.page - 1, result.previousCursor)}
                            onClick={(event) => {
                              if (
                                event.button === 0 &&
                                !event.metaKey &&
                                !event.ctrlKey &&
                                !event.shiftKey &&
                                !event.altKey
                              ) {
                                focusResults.current = true;
                              }
                            }}
                            className="kitchen-text-link inline-flex items-center gap-1.5 rounded-xl border border-tk-stone bg-tk-canvas px-3.5 py-2 text-sm font-bold text-tk-ink hover:bg-tk-sunken transition-colors"
                          >
                            <ArrowLeft size={16} aria-hidden="true" />
                            Trước
                          </Link>
                        ) : (
                          <span />
                        )}

                        <span className="text-xs sm:text-sm font-extrabold text-tk-secondary tk-tabular">
                          Trang {result.page}/{result.pages}
                        </span>

                        {result.page < result.pages ? (
                          <Link
                            to={pagerHref(result.page + 1, result.nextCursor)}
                            onClick={(event) => {
                              if (
                                event.button === 0 &&
                                !event.metaKey &&
                                !event.ctrlKey &&
                                !event.shiftKey &&
                                !event.altKey
                              ) {
                                focusResults.current = true;
                              }
                            }}
                            className="kitchen-text-link inline-flex items-center gap-1.5 rounded-xl bg-tk-flame px-4 py-2 text-sm font-bold text-white shadow-xs hover:bg-tk-flame-hover transition-colors"
                          >
                            Tiếp <ArrowRight size={16} aria-hidden="true" />
                          </Link>
                        ) : (
                          <span />
                        )}
                      </nav>
                    )}
                  </>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
