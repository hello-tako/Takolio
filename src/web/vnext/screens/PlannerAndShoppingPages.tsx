import React from 'react';
import { useParams } from 'react-router-dom';
import '../styles/tokens.css';
import '../styles/vnext-adapted.css';
import { PlannerPage } from '../../pages/PlannerPage';
import { ShoppingPage } from '../../pages/ShoppingPage';
import { vnextHref } from '../feature';
import { ConsumerStudioShell } from '../components/Shells';
import { BrandFeatureIcon } from '../components/VNextMedia';

/**
 * C24 — Lập thực đơn mới (`/planner/new`).
 * Official Takolio Brand Board v2 header banner + authoritative PlannerSetup form
 * (single `<h1>` owned by PlannerShell, deterministic server plan generation, revision-guarded family preferences).
 */
export const C24PlannerSetupVNext: React.FC = () => (
  <ConsumerStudioShell screenId="C24" title="Lập thực đơn mới" backTo={vnextHref('/planner')}>
    <div className="space-y-5">
      <div className="tkv-leaf-wave-band rounded-[var(--tkv-radius-card)] bg-[var(--tkv-surface,#FFFFFF)] border border-[var(--tkv-border-mint,#BDE0CC)] p-5 sm:p-6 text-[var(--tkv-ink,#152E2C)] shadow-soft flex items-start gap-4">
        <BrandFeatureIcon name="planner" size={48} className="mt-0.5" />
        <div>
          <p className="tkv-eyebrow inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[var(--tkv-primary,#196149)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--tkv-primary,#196149)]" aria-hidden="true" />
            <span>Kế hoạch tuần mới</span>
          </p>
          <p className="tkv-heading text-lg sm:text-xl font-bold text-[var(--tkv-ink,#152E2C)] mt-1">
            Thiết lập nhịp nấu tại nhà theo tồn kho thực tế
          </p>
          <p className="text-sm text-[var(--tkv-ink-soft,#3C5954)] mt-1 max-w-2xl leading-relaxed">
            Chọn số ngày, các bữa nấu tại nhà và khẩu phần gia đình để máy chủ tính toán thực đơn cân đối từ kho công thức thật.
          </p>
        </div>
      </div>

      <div className="tkv-adapted-surface takolio-rebuild" data-tkv-surface-adapt="1">
        <PlannerPage />
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
        <PlannerPage />
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
      <ShoppingPage />
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
      title="Đi chợ & nhập kho theo tuần"
      backTo={vnextHref(planId ? `/planner/${planId}` : '/planner')}
    >
      <div className="tkv-adapted-surface takolio-rebuild" data-tkv-surface-adapt="1">
        <PlannerPage />
      </div>
    </ConsumerStudioShell>
  );
};
