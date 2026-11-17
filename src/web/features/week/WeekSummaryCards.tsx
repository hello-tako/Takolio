import type { MealPlan } from '@frigo/domain';
import {
  BudgetCoinJarIcon,
  CalendarMealCheckIcon,
  ExpiryRescueBellIcon,
  FreshnessShieldIcon,
} from '../../design-system/icons';
import { weekCurrency } from './WeekWorkspace';

export function WeekSummaryCards({ plan }: { plan: MealPlan }) {
  const meals = plan.days
    .flatMap((day) => day.slots)
    .filter((slot) => slot.status === 'PLANNED' || slot.status === 'COOKED').length;

  return (
    <dl className="week-summary grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="week-summary-budget rounded-[24px] border border-tk-turmeric/25 bg-gradient-to-br from-tk-turmeric-soft via-white to-tk-canvas p-4 shadow-card">
        <dt className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-tk-turmeric-deep">
          <BudgetCoinJarIcon size={15} tone="turmeric" active />
          Mua thêm · ước tính
        </dt>
        <dd className="mt-1.5 font-heading text-lg font-extrabold text-tk-ink tk-tabular">
          {plan.budget.displayText || 'Chưa có ước tính giá'}
        </dd>
        <dd className="week-summary-detail mt-1 text-xs text-tk-secondary">
          {plan.budget.targetVnd !== null
            ? `Hạn mức ${weekCurrency(plan.budget.targetVnd)}`
            : 'Không giới hạn ngân sách'}
        </dd>
      </div>

      <div className="rounded-[24px] border border-tk-jade/25 bg-gradient-to-br from-tk-jade-soft via-white to-tk-canvas p-4 shadow-card">
        <dt className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-tk-jade-deep">
          <FreshnessShieldIcon size={15} tone="jade" active />
          Dự kiến tận dụng tủ
        </dt>
        <dd className="mt-1.5 font-heading text-lg font-extrabold text-tk-ink tk-tabular">
          {plan.utilization.utilizationPercent}%
        </dd>
        <dd className="week-summary-detail mt-1 text-xs text-tk-secondary">
          {plan.utilization.plannedItemsCount}/{plan.utilization.totalUsableItemsCount} nguyên liệu
          sẵn có
        </dd>
      </div>

      <div className="rounded-[24px] border border-tk-stone/80 bg-white p-4 shadow-card">
        <dt className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-tk-secondary">
          <CalendarMealCheckIcon size={15} tone="jade" />
          Bữa có món
        </dt>
        <dd className="mt-1.5 font-heading text-lg font-extrabold text-tk-ink tk-tabular">
          {meals}
        </dd>
        <dd className="week-summary-detail mt-1 text-xs text-tk-secondary">
          {plan.shoppingItems.length} nguyên liệu cần mua thêm
        </dd>
      </div>

      <div className="rounded-[24px] border border-tk-flame/20 bg-gradient-to-br from-tk-flame-soft/75 via-white to-tk-canvas p-4 shadow-card">
        <dt className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-tk-flame-deep">
          <ExpiryRescueBellIcon size={15} tone="flame" />
          Nguy cơ bỏ phí · dự kiến
        </dt>
        <dd className="mt-1.5 font-heading text-lg font-extrabold text-tk-ink">
          {{ LOW: 'Thấp', MEDIUM: 'Vừa', HIGH: 'Cao' }[plan.wasteRisk.level]}
        </dd>
        <dd className="week-summary-detail mt-1 text-xs text-tk-secondary">
          {plan.wasteRisk.rescuedItemsCount}/{plan.wasteRisk.expiringItemsCount} nguyên liệu sắp hết
          hạn được xếp vào kế hoạch
        </dd>
      </div>
    </dl>
  );
}
