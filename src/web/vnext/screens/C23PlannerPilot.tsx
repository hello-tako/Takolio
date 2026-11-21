import React from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import type { PlannedMealDto } from '../../../../packages/domain/src/meal-planning-api';
import { useAuthStore } from '../../stores/useAuthStore';

const LEGACY_NAME_RE = /^Người dùng\s+Fri\w*$/i;
function sanitizeUserDisplayName(raw: string | undefined | null, isGuest = false): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return isGuest ? 'Khách ghé thăm' : 'Bếp trưởng';
  if (LEGACY_NAME_RE.test(trimmed)) return 'Bếp trưởng';
  return raw as string;
}
import { usePlanner } from '../../features/planner/usePlanner';
import { plannerStatusLabel } from '../../features/planner/presentation';
import { ConsumerStudioShell } from '../components/Shells';
import {
  TkvButton,
  TkvEmptyState,
  TkvErrorState,
  TkvSkeleton,
  TkvSurface,
} from '../components/Primitives';
import { VNextIcon } from '../components/VNextIcons';
import { VerifiedDishImage } from '../components/VNextMedia';

const MEAL_LABELS: Record<'breakfast' | 'lunch' | 'dinner', string> = {
  breakfast: 'Bữa sáng',
  lunch: 'Bữa trưa',
  dinner: 'Bữa tối',
};

function formatDayHeadingVi(isoDate: string): string {
  const parsed = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
  }).format(parsed);
}

function slugifyDishTitle(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function resolvePlannedMealSlug(meal: PlannedMealDto): string {
  if (meal.source.kind === 'recipe' && !meal.source.id.startsWith('rec_')) {
    return meal.source.id;
  }
  return slugifyDishTitle(meal.title);
}

/**
 * C23 — Thực đơn tuần (Sunlit Ceramic & Terracotta Herb Live Pilot).
 * Sunlit Ceramic & Linen weekly workbench (`#FCF9F5` / `#FFFFFF` / `#D86A43` + `tabular-nums`),
 * resolving every planned dish's real recipe slug/image without hardcoded dish fallbacks.
 * Preserves guest RegisteredAccountPrompt, `usePlanner` server truth, and `/week` compatibility.
 */
export const C23PlannerPilot: React.FC = () => {
  const { planId } = useParams<{ planId?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const isGuest = useAuthStore((s) => s.isGuest);
  const displayName = useAuthStore((s) => s.displayName);
  const cleanName = sanitizeUserDisplayName(displayName, isGuest);
  const returnTo = `${location.pathname}${location.search}`;

  const model = usePlanner(planId, !isGuest);
  const plan = model.plan;

  // Group planned meals by date for clean mobile stack & desktop calendar grid
  const mealsByDate = new Map<string, PlannedMealDto[]>();
  if (plan) {
    for (const meal of plan.result.meals) {
      const list = mealsByDate.get(meal.date) ?? [];
      list.push(meal);
      mealsByDate.set(meal.date, list);
    }
  }
  const orderedDates = Array.from(mealsByDate.keys()).sort();
  const featuredMeal = plan?.result.meals[0];
  const featuredSlug = featuredMeal ? resolvePlannedMealSlug(featuredMeal) : '';

  return (
    <ConsumerStudioShell screenId="C23" title="Thực đơn tuần">
      <div className="space-y-6">
        {/* Page Heading */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <p className="tkv-eyebrow text-xs font-semibold uppercase tracking-widest text-[var(--tkv-ink-muted,#87776E)]">
              {isGuest ? 'Hoạch định bữa ăn gia đình' : `Bếp của ${cleanName} · Hoạch định tuần`}
            </p>
            <h1 className="tkv-heading text-2xl sm:text-3xl font-extrabold text-[var(--tkv-ink,#2C221E)] mt-0.5">
              Thực đơn tuần
            </h1>
          </div>
          {!isGuest && (
            <div className="flex flex-wrap items-center gap-2.5">
              <TkvButton
                variant="primary"
                size="sm"
                iconLeft="plus"
                onClick={() => navigate('/planner/new')}
              >
                Lập thực đơn mới
              </TkvButton>
              {plan && (
                <Link
                  to={`/planner/${plan.id}/shopping`}
                  className="tkv-focusable min-h-[44px] px-4 py-2 rounded-[var(--tkv-radius-btn)] bg-white border border-[var(--tkv-border,#EAE0D5)] hover:border-[var(--tkv-border-strong,#D5C3B3)] text-[var(--tkv-ink,#2C221E)] text-sm font-semibold inline-flex items-center gap-1.5 transition-colors"
                >
                  <VNextIcon name="shopping" size={16} />
                  <span>Đi chợ theo tuần</span>
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Guest Gate — preserves exact PlannerPage contract */}
        {isGuest ? (
          <TkvEmptyState
            pose="guide"
            eyebrow="Yêu cầu tài khoản đã đăng ký"
            title="Đăng nhập để tạo và lưu thực đơn tuần"
            description="Thực đơn tuần được đồng bộ theo tài khoản hộ gia đình đã xác thực. Trong phiên khách, bạn vẫn có thể quản lý tủ lạnh và xem kho công thức."
            primaryAction={
              <Link
                data-testid="planner-login-cta"
                to={`/auth?mode=login&returnTo=${encodeURIComponent(returnTo)}`}
                className="tkv-focusable min-h-[48px] px-5 py-2.5 rounded-[var(--tkv-radius-btn)] bg-[var(--tkv-primary,#D86A43)] hover:bg-[var(--tkv-primary-hover,#C25731)] text-white shadow-xs font-semibold text-sm inline-flex items-center gap-2 transition-colors"
              >
                <span>Đăng nhập để tiếp tục</span>
                <VNextIcon name="arrow-right" size={16} />
              </Link>
            }
          />
        ) : model.query.isPending ? (
          <div className="space-y-4">
            <TkvSkeleton className="h-36" label="Đang tải thực đơn tuần…" />
            <TkvSkeleton className="h-24" label="Đang tải các bữa ăn…" />
            <TkvSkeleton className="h-24" label="Đang tải các bữa ăn…" />
          </div>
        ) : model.query.isError ? (
          <TkvErrorState
            title="Chưa tải được thực đơn tuần"
            message="Không thể đọc dữ liệu kế hoạch bữa ăn từ máy chủ. Vui lòng thử lại."
            onRetry={() => void model.query.refetch()}
          />
        ) : !plan ? (
          <div className="space-y-5">
            {/* Airy Sunlit Warm Ceramic & Linen Hero Banner before first plan is generated */}
            <div className="rounded-[var(--tkv-radius-card)] bg-gradient-to-br from-[var(--tkv-hero-from,#FFFDFB)] via-[var(--tkv-hero-via,#FFF6F0)] to-[var(--tkv-hero-to,#F8EAE0)] border border-[var(--tkv-hero-border,#ECD5C5)] p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 text-[var(--tkv-ink,#2C221E)] shadow-soft">
              <div className="space-y-2 max-w-xl">
                <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[var(--tkv-sage-soft,#EEF5F0)] border border-[var(--tkv-sage-border,#CFE2D5)] text-xs font-semibold text-[var(--tkv-sage-ink,#355940)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--tkv-sage,#4E7A5B)]" aria-hidden="true" />
                  <span>Chưa có kế hoạch tuần đang mở</span>
                </span>
                <h2 className="tkv-heading text-xl sm:text-2xl font-extrabold text-[var(--tkv-ink,#2C221E)]">
                  Thực đơn tuần này
                </h2>
                <p className="text-sm text-[var(--tkv-ink-soft,#5F524A)] leading-relaxed">
                  Hộ gia đình bạn chưa có kế hoạch bữa ăn đang hoạt động. Tạo lịch ăn mới để Takolio đối chiếu nguyên liệu sẵn có trong tủ lạnh và tính phần cần mua thêm.
                </p>
                <div className="pt-1">
                  <Link
                    to="/planner/new"
                    className="tkv-focusable min-h-[46px] px-5 py-2.5 rounded-[var(--tkv-radius-btn)] bg-[var(--tkv-primary,#D86A43)] hover:bg-[var(--tkv-primary-hover,#C25731)] text-white shadow-xs font-bold text-sm inline-flex items-center gap-2 transition-colors"
                  >
                    <VNextIcon name="plus" size={16} />
                    <span>Tạo kế hoạch tuần mới</span>
                  </Link>
                </div>
              </div>
              <div className="w-24 h-24 shrink-0 hidden sm:block">
                <VerifiedDishImage
                  slug=""
                  title="Mâm cơm tuần"
                  aspectClass="aspect-square"
                  className="rounded-2xl border border-[var(--tkv-border,#EAE0D5)] bg-white"
                />
              </div>
            </div>

            <TkvEmptyState
              pose="welcome"
              eyebrow="Sẵn sàng lập lịch"
              title="Bắt đầu thực đơn 7 ngày đầu tiên"
              description="Chọn số ngày, số bữa và khẩu phần tại màn hình thiết lập kế hoạch — toàn bộ tính toán định lượng do miền nghiệp vụ máy chủ đảm nhiệm."
              primaryAction={
                <TkvButton onClick={() => navigate('/planner/new')} iconRight="arrow-right">
                  Mở thiết lập thực đơn
                </TkvButton>
              }
            />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Active Week Sunlit Warm Ceramic & Linen Hero Banner */}
            <div className="rounded-[var(--tkv-radius-card)] bg-gradient-to-br from-[var(--tkv-hero-from,#FFFDFB)] via-[var(--tkv-hero-via,#FFF6F0)] to-[var(--tkv-hero-to,#F8EAE0)] border border-[var(--tkv-hero-border,#ECD5C5)] p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 text-[var(--tkv-ink,#2C221E)] shadow-soft">
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap tabular-nums">
                  <span className="px-2.5 py-1 rounded-full bg-white/90 border border-[var(--tkv-border,#EAE0D5)] text-xs font-semibold text-[var(--tkv-ink,#2C221E)]">
                    Phiên bản v{plan.revision}
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--tkv-sage-soft,#EEF5F0)] border border-[var(--tkv-sage-border,#CFE2D5)] text-xs font-semibold text-[var(--tkv-sage-ink,#355940)]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--tkv-sage,#4E7A5B)]" aria-hidden="true" />
                    <span>{plannerStatusLabel(plan.result.status, 'vi')}</span>
                  </span>
                  {plan.freshness.status === 'requires_revalidation' && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--tkv-honey-soft,#FCF5E6)] border border-[var(--tkv-honey-border,#EDD9B4)] text-[var(--tkv-honey-ink,#8C5B18)] text-xs font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--tkv-honey,#C68634)]" aria-hidden="true" />
                      <span>Tủ lạnh vừa đổi · Nên kiểm tra lại lượng</span>
                    </span>
                  )}
                </div>
                <h2 className="tkv-heading text-xl sm:text-2xl font-extrabold text-[var(--tkv-ink,#2C221E)] tabular-nums">
                  Thực đơn tuần này ({plan.result.meals.length} bữa đã xếp)
                </h2>
                <p className="text-sm text-[var(--tkv-ink-soft,#5F524A)] tabular-nums">
                  Bắt đầu từ {plan.intent.startDate} · Khẩu phần mặc định {plan.intent.defaultServings} người.
                </p>
              </div>
              <div className="w-24 h-24 shrink-0 hidden sm:block">
                <VerifiedDishImage
                  slug={featuredSlug}
                  title={featuredMeal?.title ?? 'Thực đơn tuần'}
                  aspectClass="aspect-square"
                  className="rounded-2xl border border-[var(--tkv-border,#EAE0D5)] bg-white"
                />
              </div>
            </div>

            {/* Mobile 1-Col Day Cards & Desktop Multi-Day Workbench Grid */}
            <section aria-labelledby="c23-schedule-heading" className="space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <h2 id="c23-schedule-heading" className="tkv-heading text-lg font-extrabold text-[var(--tkv-ink,#2C221E)]">
                  Thực đơn của tuần
                </h2>
                <Link
                  to="/planner/new"
                  className="tkv-focusable min-h-[44px] inline-flex items-center text-sm font-semibold text-[var(--tkv-accent-ink,#9E4322)] hover:text-[var(--tkv-primary,#D86A43)] underline underline-offset-4"
                >
                  Chỉnh sửa cấu hình
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {orderedDates.map((dateKey) => {
                  const dayMeals = mealsByDate.get(dateKey) ?? [];
                  return (
                    <TkvSurface key={dateKey} className="p-4 space-y-3 flex flex-col justify-between bg-white border-[var(--tkv-border,#EAE0D5)]">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between border-b border-[var(--tkv-border,#EAE0D5)] pb-2">
                          <h3 className="tkv-heading text-base font-extrabold text-[var(--tkv-ink,#2C221E)] capitalize">
                            {formatDayHeadingVi(dateKey)}
                          </h3>
                          <span className="text-xs font-semibold text-[var(--tkv-ink-muted,#87776E)] tabular-nums">
                            {dayMeals.length} bữa
                          </span>
                        </div>

                        <ul className="space-y-2.5">
                          {dayMeals.map((slot) => {
                            const missingReqs = slot.requirements.filter(
                              (r) => !r.optional && r.status !== 'satisfied',
                            ).length;
                            const slotSlug = resolvePlannedMealSlug(slot);
                            return (
                              <li key={slot.slotId}>
                                <Link
                                  to={`/planner/${plan.id}/meal/${encodeURIComponent(slot.slotId)}`}
                                  className="tkv-focusable p-3 rounded-xl bg-[var(--tkv-bg,#FCF9F5)] border border-[var(--tkv-border,#EAE0D5)] hover:border-[var(--tkv-border-strong,#D5C3B3)] flex items-center justify-between gap-3 transition-colors"
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <VerifiedDishImage
                                      slug={slotSlug}
                                      title={slot.title}
                                      aspectClass="aspect-square"
                                      compact
                                      className="w-12 h-12 rounded-lg shrink-0"
                                    />
                                    <div className="min-w-0">
                                      <p className="text-xs font-semibold text-[var(--tkv-ink-muted,#87776E)] tabular-nums">
                                        {MEAL_LABELS[slot.mealType]} · {slot.servings} người
                                      </p>
                                      <p className="text-sm font-bold text-[var(--tkv-ink,#2C221E)] truncate mt-0.5">
                                        {slot.title}
                                      </p>
                                      <p className="text-xs text-[var(--tkv-ink-soft,#5F524A)] mt-0.5 inline-flex items-center gap-1.5 tabular-nums">
                                        <span
                                          className={
                                            missingReqs > 0
                                              ? 'w-1.5 h-1.5 rounded-full bg-[var(--tkv-primary,#D86A43)] shrink-0'
                                              : 'w-1.5 h-1.5 rounded-full bg-[var(--tkv-sage,#4E7A5B)] shrink-0'
                                          }
                                          aria-hidden="true"
                                        />
                                        <span>
                                          {missingReqs === 0
                                            ? 'Đủ nguyên liệu dự kiến'
                                            : `Thiếu / cần mua ${missingReqs} mục`}
                                        </span>
                                      </p>
                                    </div>
                                  </div>
                                  <VNextIcon name="chevron-right" size={16} className="text-[var(--tkv-ink-muted,#87776E)] shrink-0" />
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    </TkvSurface>
                  );
                })}
              </div>
            </section>
          </div>
        )}
      </div>
    </ConsumerStudioShell>
  );
};
