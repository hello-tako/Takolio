import React from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import type { PlannedMealDto } from '../../../../packages/domain/src/meal-planning-api';
import { useAuthStore } from '../../stores/useAuthStore';
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

/**
 * C23 — Thực đơn tuần (G02 Live Pilot).
 * Faithfully matches `C23.png` on mobile (390×844: Green hero banner + stacked day cards)
 * and Desktop 7-Day Weekly Workbench (1440×900: multi-day calendar grid + shopping summary).
 * Preserves guest RegisteredAccountPrompt, `usePlanner` server truth, and `/week` compatibility.
 */
export const C23PlannerPilot: React.FC = () => {
  const { planId } = useParams<{ planId?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const isGuest = useAuthStore((s) => s.isGuest);
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

  return (
    <ConsumerStudioShell screenId="C23" title="Thực đơn tuần">
      <div className="space-y-6">
        {/* Page Heading */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wider text-[var(--tkv-primary)]">
              Hoạch định bữa ăn gia đình
            </p>
            <h1 className="tkv-heading text-2xl sm:text-3xl font-extrabold text-[var(--tkv-ink)] mt-0.5">
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
                Lập thực đơn mới (C24)
              </TkvButton>
              {plan && (
                <Link
                  to={`/planner/${plan.id}/shopping`}
                  className="tkv-focusable min-h-[44px] px-4 py-2 rounded-[var(--tkv-radius-btn)] bg-[var(--tkv-surface)] border border-[var(--tkv-primary)] text-[var(--tkv-primary)] text-sm font-bold inline-flex items-center gap-1.5 hover:bg-[var(--tkv-surface-mint)]"
                >
                  <VNextIcon name="shopping" size={16} />
                  <span>Đi chợ theo tuần (C29)</span>
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
                className="tkv-focusable min-h-[48px] px-5 py-2.5 rounded-[var(--tkv-radius-btn)] bg-[var(--tkv-primary)] text-white font-bold text-sm inline-flex items-center gap-2"
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
            {/* Hero Banner matching C23.png even before first plan is generated */}
            <TkvSurface tone="hero" className="p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
              <div className="space-y-2 max-w-xl">
                <h2 className="tkv-heading text-xl sm:text-2xl font-extrabold text-white">
                  Thực đơn tuần này
                </h2>
                <p className="text-sm text-white/90 leading-relaxed">
                  Hộ gia đình bạn chưa có kế hoạch bữa ăn đang hoạt động. Tạo lịch ăn mới để Takolio đối chiếu nguyên liệu sẵn có trong tủ lạnh và tính phần cần mua thêm.
                </p>
                <div className="pt-1">
                  <Link
                    to="/planner/new"
                    className="tkv-focusable min-h-[46px] px-5 py-2.5 rounded-[var(--tkv-radius-btn)] bg-white text-[var(--tkv-primary)] font-extrabold text-sm inline-flex items-center gap-2"
                  >
                    <VNextIcon name="plus" size={16} />
                    <span>Tạo kế hoạch tuần mới</span>
                  </Link>
                </div>
              </div>
              <div className="w-28 h-28 shrink-0 hidden sm:block">
                <VerifiedDishImage
                  slug="thit-kho-trung"
                  title="Mâm cơm tuần"
                  aspectClass="aspect-square"
                  className="rounded-full border-2 border-white/30"
                />
              </div>
            </TkvSurface>

            <TkvEmptyState
              pose="welcome"
              eyebrow="Sẵn sàng lập lịch"
              title="Bắt đầu thực đơn 7 ngày đầu tiên"
              description="Chọn số ngày, số bữa và khẩu phần tại màn hình thiết lập kế hoạch — toàn bộ tính toán định lượng do miền nghiệp vụ máy chủ đảm nhiệm."
              primaryAction={
                <TkvButton onClick={() => navigate('/planner/new')} iconRight="arrow-right">
                  Mở thiết lập thực đơn (C24)
                </TkvButton>
              }
            />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Active Week Hero Banner matching C23.png */}
            <TkvSurface tone="hero" className="p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-1 rounded-full bg-white/15 text-xs font-bold text-white">
                    Phiên bản v{plan.revision}
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-white/15 text-xs font-bold text-white">
                    {plannerStatusLabel(plan.result.status, 'vi')}
                  </span>
                  {plan.freshness.status === 'requires_revalidation' && (
                    <span className="px-2.5 py-1 rounded-full bg-[var(--tkv-saffron)] text-[var(--tkv-ink)] text-xs font-extrabold">
                      Tủ lạnh vừa đổi · Nên kiểm tra lại lượng
                    </span>
                  )}
                </div>
                <h2 className="tkv-heading text-xl sm:text-2xl font-extrabold text-white">
                  Thực đơn tuần này ({plan.result.meals.length} bữa đã xếp)
                </h2>
                <p className="text-sm text-white/90">
                  Bắt đầu từ {plan.intent.startDate} · Khẩu phần mặc định {plan.intent.defaultServings} người.
                </p>
              </div>
              <div className="w-24 h-24 shrink-0 hidden sm:block">
                <VerifiedDishImage
                  slug="canh-chua-ca-loc-nam-bo"
                  title="Thực đơn tuần"
                  aspectClass="aspect-square"
                  className="rounded-full border-2 border-white/30"
                />
              </div>
            </TkvSurface>

            {/* Mobile 1-Col Day Cards (matching C23.png) & Desktop Multi-Day Workbench Grid */}
            <section aria-labelledby="c23-schedule-heading" className="space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <h2 id="c23-schedule-heading" className="tkv-heading text-lg font-extrabold text-[var(--tkv-ink)]">
                  Thực đơn của tuần
                </h2>
                <Link
                  to="/planner/new"
                  className="tkv-focusable min-h-[44px] inline-flex items-center text-sm font-bold text-[var(--tkv-primary)] hover:underline"
                >
                  Chỉnh sửa cấu hình
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {orderedDates.map((dateKey) => {
                  const dayMeals = mealsByDate.get(dateKey) ?? [];
                  return (
                    <TkvSurface key={dateKey} className="p-4 space-y-3 flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between border-b border-[var(--tkv-border)] pb-2">
                          <h3 className="tkv-heading text-base font-extrabold text-[var(--tkv-ink)] capitalize">
                            {formatDayHeadingVi(dateKey)}
                          </h3>
                          <span className="text-xs font-bold text-[var(--tkv-ink-muted)]">
                            {dayMeals.length} bữa
                          </span>
                        </div>

                        <ul className="space-y-2.5">
                          {dayMeals.map((slot) => {
                            const missingReqs = slot.requirements.filter(
                              (r) => !r.optional && r.status !== 'satisfied',
                            ).length;
                            return (
                              <li key={slot.slotId}>
                                <Link
                                  to={`/planner/${plan.id}/meal/${encodeURIComponent(slot.slotId)}`}
                                  className="tkv-focusable p-3 rounded-2xl bg-[var(--tkv-bg)] hover:bg-[var(--tkv-surface-mint)] flex items-center justify-between gap-3 transition-colors"
                                >
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold text-[var(--tkv-primary)]">
                                      {MEAL_LABELS[slot.mealType]} · {slot.servings} người
                                    </p>
                                    <p className="text-sm font-extrabold text-[var(--tkv-ink)] truncate mt-0.5">
                                      {slot.title}
                                    </p>
                                    <p className="text-xs text-[var(--tkv-ink-muted)] mt-0.5">
                                      {missingReqs === 0
                                        ? 'Đủ nguyên liệu dự kiến'
                                        : `Thiếu / cần mua ${missingReqs} mục`}
                                    </p>
                                  </div>
                                  <VNextIcon name="chevron-right" size={16} className="text-[var(--tkv-ink-muted)] shrink-0" />
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
