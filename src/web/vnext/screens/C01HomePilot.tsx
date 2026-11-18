import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/useAuthStore';
import { api } from '../../services/api';
import { queryKeys } from '../../lib/queryKeys';
import { daysUntil } from '../../lib/format';
import { presentExpiry } from '../../lib/inventory-truth';
import { calendarLabel } from '../../lib/home-plan';
import { useHomePlan } from '../../lib/use-home-plan';
import { isMealPlannerEnabled } from '../../features/planner/feature';
import { resolveRecipeImage } from '../../lib/recipe-media';
import { ConsumerStudioShell } from '../components/Shells';
import {
  TkvBadge,
  TkvButton,
  TkvChip,
  TkvErrorState,
  TkvSkeleton,
  TkvSurface,
} from '../components/Primitives';
import { VNextIcon } from '../components/VNextIcons';
import { VerifiedDishImage } from '../components/VNextMedia';

const MEAL_LABELS = {
  breakfast: 'Bữa sáng',
  lunch: 'Bữa trưa',
  dinner: 'Bữa tối',
} as const;

/**
 * C01 — Hôm nay ăn gì? (G02 Live Pilot).
 * Faithfully implements `C01.png` on mobile (390×844) and Desktop Workbench (1440×900)
 * over 100% real API queries (`useHomePlan`, `api.getInventory`, `api.getRecipeDiscovery`).
 * Preserves independent loading/empty/error widgets and `presentExpiry` estimated labels.
 */
export const C01HomePilot: React.FC = () => {
  const navigate = useNavigate();
  const { displayName, isGuest } = useAuthStore();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const update = () => setNow(new Date());
    const timer = window.setInterval(update, 60_000);
    window.addEventListener('focus', update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', update);
    };
  }, []);

  const home = useHomePlan(now);
  const inventoryQuery = useQuery({
    queryKey: queryKeys.inventory(),
    queryFn: () => api.getInventory(),
  });
  const recommendationsQuery = useQuery({
    queryKey: queryKeys.recipeDiscovery({ pageSize: 3 }),
    queryFn: () => api.getRecipeDiscovery({ pageSize: 3 }),
  });

  const activeItems = (inventoryQuery.data ?? []).filter((item) => item.quantity > 0);
  const useSoonItems = activeItems
    .filter((item) => item.freshness === 'use_soon' || item.freshness === 'expiring')
    .sort(
      (a, b) =>
        (daysUntil(presentExpiry(a).date ?? undefined) ?? 99) -
        (daysUntil(presentExpiry(b).date ?? undefined) ?? 99),
    )
    .slice(0, 4);

  const recommendations = recommendationsQuery.data?.items ?? [];
  const topRecommendation = recommendations[0];
  const plannerBase = isMealPlannerEnabled() ? '/planner' : '/week';
  const firstName = displayName?.trim().split(/\s+/).at(-1);
  const plan = home.plan;
  const meal = plan?.meal ?? null;

  return (
    <ConsumerStudioShell screenId="C01">
      <div className="space-y-6">
        {/* Page Heading */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wider text-[var(--tkv-primary)]">
              {firstName ? `Chào ${firstName}` : isGuest ? 'Phiên dùng thử khách' : 'Căn bếp gia đình'}
            </p>
            <h1 className="tkv-heading text-2xl sm:text-3xl font-extrabold text-[var(--tkv-ink)] mt-0.5">
              Hôm nay ăn gì?
            </h1>
          </div>

          {/* Quick Shortcuts matching C01.png ("Lối tắt nhanh: Quét AI · Thêm món · Đi chợ") */}
          <div aria-label="Lối tắt nhanh" className="flex items-center gap-2 overflow-x-auto pb-1">
            <TkvChip active icon="scan" onClick={() => navigate('/scan')}>
              Quét AI
            </TkvChip>
            <TkvChip icon="plus" onClick={() => navigate('/fridge')}>
              Thêm nguyên liệu
            </TkvChip>
            <TkvChip icon="shopping" onClick={() => navigate('/shopping')}>
              Đi chợ
            </TkvChip>
          </div>
        </div>

        {/* Desktop 12-Col Workbench / Mobile 1-Col Stack */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Primary Column (8 cols on Desktop) */}
          <div data-testid="tkv-c01-primary" className="lg:col-span-7 space-y-6 min-w-0">
            {/* Hero Task Card — Deep Leaf Green #196149 matching C01.png */}
            {home.query.isPending ? (
              <TkvSkeleton className="h-48" label="Đang tải bữa ăn tiếp theo…" />
            ) : home.query.isError ? (
              <TkvErrorState
                title="Chưa kiểm tra được lịch bữa ăn"
                message="Không thể tải thực đơn hiện tại. Bạn có thể thử tải lại hoặc xem gợi ý món bên dưới."
                onRetry={() => void home.retry()}
              />
            ) : (
              <TkvSurface tone="hero" className="p-5 sm:p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
                  <div className="space-y-2.5 flex-1 min-w-0">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 text-xs font-bold text-white">
                      <VNextIcon name="sparkles" size={14} />
                      {meal && plan
                        ? `${MEAL_LABELS[meal.mealType]} · ${calendarLabel(meal.date, plan.today)}`
                        : 'Gợi ý trọng tâm hôm nay'}
                    </span>

                    <h2 className="tkv-heading text-xl sm:text-2xl font-extrabold text-white">
                      {home.requiresAccount
                        ? 'Gợi ý món từ tủ lạnh của bạn'
                        : meal?.state === 'ready' && meal.dishes.length > 0
                          ? meal.dishes[0]
                          : topRecommendation
                            ? topRecommendation.recipe.title
                            : 'Bắt đầu bữa ngon từ nguyên liệu sẵn có'}
                    </h2>

                    <p className="text-sm text-white/90 leading-relaxed">
                      {home.requiresAccount
                        ? 'Bạn đang ở phiên khách. Xem ngay món khớp nguyên liệu hoặc đăng nhập để lưu thực đơn tuần.'
                        : meal?.state === 'ready'
                          ? `Khẩu phần ${meal.servings} người${meal.cookTimeMinutes ? ` · ${meal.cookTimeMinutes} phút chuẩn bị` : ''}.`
                          : topRecommendation
                            ? `${topRecommendation.recipe.cookTimeMinutes} phút · Khớp tình trạng tủ lạnh hiện tại của hộ.`
                            : 'Thêm nguyên liệu vào tủ hoặc mở kho công thức để chọn bữa tối nay.'}
                    </p>

                    <div className="pt-1 flex flex-wrap gap-2.5">
                      <Link
                        to={
                          meal?.href
                            ? `${meal.href}`
                            : topRecommendation
                              ? `/recipes/${topRecommendation.recipe.slug || topRecommendation.recipe.id}`
                              : `/recipes`
                        }
                        className="tkv-focusable min-h-[46px] px-4.5 py-2.5 rounded-[var(--tkv-radius-btn)] bg-white text-[var(--tkv-primary)] font-extrabold text-sm inline-flex items-center gap-2 shadow-xs"
                      >
                        <span>{meal ? 'Xem bữa ăn' : 'Xem món gợi ý'}</span>
                        <VNextIcon name="arrow-right" size={16} />
                      </Link>
                      {home.requiresAccount && (
                        <Link
                          to={`/auth?mode=login&returnTo=${encodeURIComponent(plannerBase)}`}
                          className="tkv-focusable min-h-[46px] px-4 py-2.5 rounded-[var(--tkv-radius-btn)] border border-white/40 text-white font-bold text-sm inline-flex items-center"
                        >
                          Đăng nhập lập tuần
                        </Link>
                      )}
                    </div>
                  </div>

                  <div className="hidden sm:block sm:w-36 shrink-0">
                    <VerifiedDishImage
                      slug={meal?.recipe?.slug ?? topRecommendation?.recipe.slug ?? 'thit-kho-trung'}
                      title={meal?.dishes[0] ?? topRecommendation?.recipe.title ?? 'Món gợi ý'}
                      canonicalFallbackSrc={
                        meal?.recipe
                          ? resolveRecipeImage(meal.recipe)
                          : topRecommendation
                            ? resolveRecipeImage(topRecommendation.recipe)
                            : undefined
                      }
                      aspectClass="aspect-square"
                      priority
                      className="rounded-2xl border-2 border-white/25 shadow-md"
                    />
                  </div>
                </div>
              </TkvSurface>
            )}

            {/* "Dành cho bạn" Action Stack matching C01.png */}
            <section aria-labelledby="c01-for-you-heading" className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 id="c01-for-you-heading" className="tkv-heading text-lg font-extrabold text-[var(--tkv-ink)]">
                  Dành cho bạn hôm nay
                </h2>
                <Link
                  to="/recipes"
                  className="tkv-focusable min-h-[44px] inline-flex items-center text-sm font-bold text-[var(--tkv-primary)] hover:underline"
                >
                  Xem tất cả món
                </Link>
              </div>

              <div className="space-y-3">
                <Link
                  to="/fridge"
                  className="tkv-focusable block rounded-[var(--tkv-radius-card)] bg-[var(--tkv-surface)] border border-[var(--tkv-border)] p-4 hover:border-[var(--tkv-primary)] transition-colors shadow-[var(--tkv-shadow-card)]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <span className="w-11 h-11 rounded-2xl bg-[var(--tkv-surface-mint)] text-[var(--tkv-primary)] flex items-center justify-center shrink-0">
                        <VNextIcon name="fridge" size={22} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-base font-extrabold text-[var(--tkv-ink)]">
                          Nguyên liệu nên dùng sớm
                        </p>
                        <p className="text-sm text-[var(--tkv-ink-secondary)] truncate">
                          {inventoryQuery.isPending
                            ? 'Đang kiểm tra tủ lạnh…'
                            : inventoryQuery.isError
                              ? 'Chưa tải được tồn kho — chạm để mở tủ lạnh'
                              : useSoonItems.length > 0
                                ? `${useSoonItems.length} lô cần ưu tiên dùng trước (có gắn nhãn ước tính nếu chưa rõ ngày)`
                                : activeItems.length > 0
                                  ? `Tủ đang có ${activeItems.length} nguyên liệu ổn định`
                                  : 'Tủ lạnh đang trống — thêm nguyên liệu để gợi ý sát hơn'}
                        </p>
                      </div>
                    </div>
                    <VNextIcon name="chevron-right" size={18} className="text-[var(--tkv-ink-muted)] shrink-0" />
                  </div>
                </Link>

                <Link
                  to="/recipes"
                  className="tkv-focusable block rounded-[var(--tkv-radius-card)] bg-[var(--tkv-surface)] border border-[var(--tkv-border)] p-4 hover:border-[var(--tkv-primary)] transition-colors shadow-[var(--tkv-shadow-card)]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <span className="w-11 h-11 rounded-2xl bg-[var(--tkv-surface-saffron)] text-[var(--tkv-warning)] flex items-center justify-center shrink-0">
                        <VNextIcon name="recipes" size={22} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-base font-extrabold text-[var(--tkv-ink)]">
                          Bữa hôm nay từ nguyên liệu có sẵn
                        </p>
                        <p className="text-sm text-[var(--tkv-ink-secondary)] truncate">
                          {recommendationsQuery.isPending
                            ? 'Đang đối chiếu định lượng công thức…'
                            : recommendations.length > 0
                              ? `${recommendations.length} món gợi ý hàng đầu sẵn sàng kiểm tra khẩu phần`
                              : 'Khám phá kho công thức gia đình Việt'}
                        </p>
                      </div>
                    </div>
                    <VNextIcon name="chevron-right" size={18} className="text-[var(--tkv-ink-muted)] shrink-0" />
                  </div>
                </Link>

                <Link
                  to={`${plannerBase}`}
                  className="tkv-focusable block rounded-[var(--tkv-radius-card)] bg-[var(--tkv-surface)] border border-[var(--tkv-border)] p-4 hover:border-[var(--tkv-primary)] transition-colors shadow-[var(--tkv-shadow-card)]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <span className="w-11 h-11 rounded-2xl bg-[var(--tkv-surface-coral)] text-[var(--tkv-coral-cta)] flex items-center justify-center shrink-0">
                        <VNextIcon name="calendar" size={22} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-base font-extrabold text-[var(--tkv-ink)]">
                          {plan ? 'Thực đơn tuần hiện tại' : 'Lập thực đơn tuần'}
                        </p>
                        <p className="text-sm text-[var(--tkv-ink-secondary)] truncate">
                          {home.requiresAccount
                            ? 'Yêu cầu tài khoản đã đăng ký để lưu lịch tuần'
                            : plan
                              ? 'Nhấn để xem lịch 7 ngày, đổi món và tính danh sách mua thiếu'
                              : 'Tạo kế hoạch bữa ăn cân đối và tự động trừ tồn kho'}
                        </p>
                      </div>
                    </div>
                    <VNextIcon name="chevron-right" size={18} className="text-[var(--tkv-ink-muted)] shrink-0" />
                  </div>
                </Link>
              </div>
            </section>
          </div>

          {/* Right Workbench Column (5 cols on Desktop — FEFO Stock + Recommended Dishes) */}
          <div className="lg:col-span-5 space-y-6 min-w-0">
            <section aria-labelledby="c01-use-soon-heading" className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 id="c01-use-soon-heading" className="tkv-heading text-lg font-extrabold text-[var(--tkv-ink)]">
                  Chi tiết nguyên liệu ưu tiên
                </h2>
                <Link
                  to="/fridge"
                  className="tkv-focusable min-h-[44px] inline-flex items-center text-xs font-bold text-[var(--tkv-primary)] hover:underline"
                >
                  Mở tủ lạnh
                </Link>
              </div>

              {inventoryQuery.isPending ? (
                <TkvSkeleton className="h-32" label="Đang tải danh sách tồn kho…" />
              ) : inventoryQuery.isError ? (
                <TkvErrorState
                  message="Chưa đọc được dữ liệu tủ lạnh từ máy chủ."
                  onRetry={() => void inventoryQuery.refetch()}
                />
              ) : useSoonItems.length === 0 ? (
                <TkvSurface tone="mint" className="p-4 text-sm text-[var(--tkv-ink-secondary)] flex items-center justify-between gap-3">
                  <span>
                    {activeItems.length === 0
                      ? 'Chưa có nguyên liệu nào trong tủ lạnh.'
                      : 'Chưa có nguyên liệu nào ở ngưỡng sắp hết hạn.'}
                  </span>
                  <TkvButton size="sm" variant="secondary" onClick={() => navigate('/fridge')}>
                    {activeItems.length === 0 ? 'Thêm ngay' : 'Xem tủ'}
                  </TkvButton>
                </TkvSurface>
              ) : (
                <TkvSurface padded={false} className="divide-y divide-[var(--tkv-border)]">
                  {useSoonItems.map((item) => {
                    const exp = presentExpiry(item);
                    const remDays = daysUntil(exp.date ?? undefined);
                    return (
                      <Link
                        key={item.id}
                        to={`/fridge/${item.id}`}
                        className="tkv-focusable min-h-[56px] p-4 flex items-center justify-between gap-3 hover:bg-[var(--tkv-surface-mint)]/45 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-extrabold text-[var(--tkv-ink)] truncate">
                            {item.name}
                          </p>
                          <p className="text-xs text-[var(--tkv-ink-secondary)]">
                            {item.quantity} {item.unit}
                          </p>
                        </div>
                        <TkvBadge tone="warning" icon="timer">
                          {exp.estimated
                            ? remDays !== null
                              ? `Ước tính còn ${remDays} ngày`
                              : 'Hạn dùng ước tính'
                            : remDays !== null
                              ? `Còn ${remDays} ngày`
                              : 'Nên dùng sớm'}
                        </TkvBadge>
                      </Link>
                    );
                  })}
                </TkvSurface>
              )}
            </section>

            <section aria-labelledby="c01-recs-heading" className="space-y-3">
              <h2 id="c01-recs-heading" className="tkv-heading text-lg font-extrabold text-[var(--tkv-ink)]">
                Món gợi ý cho bữa tới
              </h2>
              {recommendationsQuery.isPending ? (
                <TkvSkeleton className="h-44" label="Đang tải món gợi ý…" />
              ) : recommendationsQuery.isError ? (
                <TkvErrorState
                  message="Chưa tải được danh sách gợi ý món ăn."
                  onRetry={() => void recommendationsQuery.refetch()}
                />
              ) : (
                <div className="space-y-3">
                  {recommendations.map(({ recipe, canCookWithoutBuying, missingRequiredIngredientCount }) => (
                    <Link
                      key={recipe.id}
                      to={`/recipes/${recipe.slug || recipe.id}`}
                      className="tkv-focusable rounded-[var(--tkv-radius-card)] bg-[var(--tkv-surface)] border border-[var(--tkv-border)] p-3 flex items-center gap-3.5 hover:border-[var(--tkv-primary)] shadow-[var(--tkv-shadow-card)]"
                    >
                      <VerifiedDishImage
                        slug={recipe.slug}
                        title={recipe.title}
                        canonicalFallbackSrc={resolveRecipeImage(recipe)}
                        aspectClass="aspect-square"
                        compact
                        className="w-20 h-20 rounded-2xl shrink-0"
                      />
                      <div className="min-w-0 flex-1 space-y-1">
                        <h3 className="tkv-heading text-base font-extrabold text-[var(--tkv-ink)] truncate">
                          {recipe.title}
                        </h3>
                        <p className="text-xs text-[var(--tkv-ink-secondary)]">
                          {recipe.cookTimeMinutes} phút · {recipe.servings} người
                        </p>
                        <TkvBadge
                          tone={canCookWithoutBuying ? 'success' : 'neutral'}
                          icon={canCookWithoutBuying ? 'check' : 'shopping'}
                        >
                          {canCookWithoutBuying
                            ? 'Đủ nguyên liệu theo lượng'
                            : `Cần kiểm tra / mua thêm ${missingRequiredIngredientCount} mục`}
                        </TkvBadge>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </ConsumerStudioShell>
  );
};
