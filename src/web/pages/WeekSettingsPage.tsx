import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { ShoppingFrequency } from '@frigo/domain';
import { useWeekStore } from '../stores/useWeekStore';
import { WeekWorkspace } from '../features/week/WeekWorkspace';
import { WeekBudgetChoices, WeekFrequencyChoices } from '../features/week/WeekSetupChoices';
import { BentoCard } from '../design-system/v4/AtelierPrimitives';

export function WeekSettingsPage() {
  const { planId } = useParams<{ planId: string }>();
  const { setupDraft, updateSetupDraft } = useWeekStore();
  const [budget, setBudget] = useState<number | null>(
    setupDraft.budgetTargetVnd !== undefined ? setupDraft.budgetTargetVnd : 750000,
  );
  const [frequency, setFrequency] = useState<ShoppingFrequency>(
    setupDraft.shoppingFrequency || 'once',
  );
  const [applied, setApplied] = useState(false);
  const backTo = planId ? `/week/${planId}` : '/week';

  return (
    <WeekWorkspace
      title="Chuẩn bị cho thực đơn tiếp theo."
      backTo={backTo}
      narrow
      description="Thiết lập này chỉ dùng cho lần tạo tiếp theo trong phiên đang mở. Thực đơn hiện tại không thay đổi; tải lại trang sẽ đặt lại bản nháp."
    >
      <BentoCard tone="ceramic" padding="lg" className="week-paper week-settings space-y-5">
        <WeekBudgetChoices
          value={budget}
          onChange={(value) => {
            setBudget(value);
            setApplied(false);
          }}
        />
        <WeekFrequencyChoices
          value={frequency}
          onChange={(value) => {
            setFrequency(value);
            setApplied(false);
          }}
        />
        {applied && (
          <p
            className="week-note rounded-2xl border border-tk-jade/25 bg-tk-jade-soft p-4 text-sm font-bold text-tk-jade-deep"
            role="status"
          >
            Đã áp dụng vào bản nháp trong phiên này. Bạn có thể xem lại các bước trước khi tạo thực
            đơn mới.
          </p>
        )}
        <div className="week-actions flex flex-wrap items-center gap-3 border-t border-tk-stone/70 pt-4">
          <button
            type="button"
            className="week-button inline-flex min-h-11 items-center justify-center rounded-2xl bg-tk-flame px-5 py-2.5 text-sm font-extrabold text-white shadow-float transition-tap hover:bg-tk-flame-hover"
            onClick={() => {
              updateSetupDraft({ budgetTargetVnd: budget, shoppingFrequency: frequency });
              setApplied(true);
            }}
          >
            Áp dụng vào bản nháp
          </button>
          <Link
            className="week-button week-button-secondary inline-flex min-h-11 items-center justify-center rounded-2xl border border-tk-stone bg-white px-4 py-2.5 text-sm font-bold text-tk-ink transition-colors hover:bg-tk-sunken"
            to={backTo}
          >
            Về thực đơn hiện tại
          </Link>
          {applied && (
            <Link
              className="week-text-link inline-flex min-h-11 items-center px-2 text-sm font-extrabold text-tk-jade-deep underline"
              to="/week/setup"
            >
              Xem lại trước khi tạo mới
            </Link>
          )}
        </div>
      </BentoCard>
    </WeekWorkspace>
  );
}
