import React, { lazy, Suspense } from 'react';
import { useParams } from 'react-router-dom';
import '../styles/tokens.css';
import '../styles/vnext-adapted.css';
import { vnextHref } from '../feature';
import { ConsumerStudioShell } from '../components/Shells';
import { BrandFeatureIcon } from '../components/VNextMedia';
import { ShoppingListSkeleton, WeeklyPlannerSkeleton } from '../components/Skeletons';

const LazyPlannerPage = lazy(() =>
  import('../../pages/PlannerPage').then((m) => ({ default: m.PlannerPage })),
);
const LazyShoppingPage = lazy(() =>
  import('../../pages/ShoppingPage').then((m) => ({ default: m.ShoppingPage })),
);

/**
 * C24 — Lập thực đơn mới (`/planner/new`).
 * Official Takolio Brand Board v2 header banner + authoritative PlannerSetup form
 * (single `<h1>` owned by PlannerShell, deterministic server plan generation, revision-guarded family preferences).
 */
export const C24PlannerSetupVNext: React.FC = () => (
  <ConsumerStudioShell screenId="C24" title="Lập thực đơn mới" backTo={vnextHref('/planner')}>
    <div className="flex flex-col gap-5">
      <div className="tkv-leaf-wave-band rounded-[var(--tkv-radius-card)] bg-[var(--tkv-surface)] border border-[var(--tkv-border-mint)] p-4 sm:p-6 text-[var(--tkv-ink)] shadow-soft flex items-start gap-3.5 sm:gap-4 tkv-enter-fade-up">
        <BrandFeatureIcon name="planner" size={44} className="mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="tkv-eyebrow inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-[var(--tkv-primary)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--tkv-primary)] shrink-0" aria-hidden="true" />
            <span>Kế hoạch tuần mới</span>
          </p>
          <p className="tkv-heading text-base sm:text-xl font-bold text-[var(--tkv-ink)] mt-1">
            Thiết lập nhịp nấu tại nhà theo tồn kho thực tế
          </p>
          <p className="text-sm text-[var(--tkv-ink-secondary)] mt-1 max-w-2xl leading-relaxed">
            Chọn số ngày, các bữa nấu tại nhà và khẩu phần gia đình để máy chủ tính toán thực đơn cân đối từ kho công thức thật.
          </p>
        </div>
      </div>

      <div className="tkv-adapted-surface takolio-rebuild" data-tkv-surface-adapt="1">
        <Suspense fallback={<WeeklyPlannerSkeleton label="Đang tải công cụ lập thực đơn…" />}>
          <LazyPlannerPage />
        </Suspense>
      </div>
    </div>
  </ConsumerStudioShell>
);

/**
 * C25 / C26 — Chi tiết bữa ăn, Đổi món có xem trước chênh lệch & Chọn món vào lịch (`/planner/:planId/meal/:slotId`).
 */
export const C25C26PlannerMealVNext: React.FC = () => {
  const { planId } = useParams<{ planId: string }>();
  return (
    <ConsumerStudioShell
      screenId="C25"
      title="Chi tiết & đổi món"
      backTo={vnextHref(planId ? `/planner/${planId}` : '/planner')}
    >
      <div className="tkv-adapted-surface takolio-rebuild" data-tkv-surface-adapt="1">
        <Suspense fallback={<WeeklyPlannerSkeleton label="Đang tải chi tiết bữa ăn…" />}>
          <LazyPlannerPage />
        </Suspense>
      </div>
    </ConsumerStudioShell>
  );
};

/**
 * C27 / C28 — Danh sách đi chợ & Sửa mục mua hàng (`/shopping`).
 * Preserves offline outbox (`pendingSync`), stable idempotency keys, and needed vs acquired grouping.
 */
export const C27C28ShoppingVNext: React.FC = () => (
  <ConsumerStudioShell screenId="C27" title="Danh sách đi chợ">
    <div className="tkv-adapted-surface takolio-rebuild" data-tkv-surface-adapt="1">
      <Suspense fallback={<ShoppingListSkeleton />}>
        <LazyShoppingPage />
      </Suspense>
    </div>
  </ConsumerStudioShell>
);

/**
 * C29 — Nhập kho sau đi chợ (`/planner/:planId/shopping`).
 * Preserves server import ledger guard preventing duplicate stock additions.
 */
export const C29ShoppingImportVNext: React.FC = () => {
  const { planId } = useParams<{ planId: string }>();
  return (
    <ConsumerStudioShell
      screenId="C29"
      title="Đi chợ theo tuần"
      backTo={vnextHref(planId ? `/planner/${planId}` : '/planner')}
    >
      <div className="tkv-adapted-surface takolio-rebuild" data-tkv-surface-adapt="1">
        <Suspense fallback={<ShoppingListSkeleton label="Đang tải danh sách chợ theo tuần…" />}>
          <LazyPlannerPage />
        </Suspense>
      </div>
    </ConsumerStudioShell>
  );
};
