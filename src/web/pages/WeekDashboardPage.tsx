import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { Share2, ArrowRight } from 'lucide-react';
import { useWeekStore } from '../stores/useWeekStore';
import { WeekWorkspace, weekDate, mealLabels } from '../features/week/WeekWorkspace';
import { WeekSummaryCards } from '../features/week/WeekSummaryCards';
import { MealCard } from '../features/week/MealCard';
import { MealSwapSheet } from '../features/week/MealSwapSheet';
import { WeekExportModal } from '../features/week/WeekExportModal';
import { InlineError, InlineLoading } from '../components/common/AsyncState';
import { BentoCard } from '../design-system/v4/AtelierPrimitives';
import {
  AiSousChefSparkIcon,
  CalendarMealCheckIcon,
  HouseholdTrayIcon,
  NavShoppingIcon,
} from '../design-system/icons';
import { api } from '../services/api';
import { queryKeys } from '../lib/queryKeys';

const statusLabels = {
  DRAFT: 'Bản nháp',
  GENERATING: 'Đang tạo',
  READY: 'Đã lên kế hoạch',
  ACTIVE: 'Đang thực hiện',
  COMPLETED: 'Đã hoàn tất',
  ARCHIVED: 'Đã lưu trữ',
  FAILED: 'Chưa tạo được',
};

export function WeekDashboardPage() {
  const { planId } = useParams<{ planId?: string }>();
  const { openSwap, error: workflowError } = useWeekStore();
  const planQuery = useQuery({
    queryKey: planId ? queryKeys.weekPlan(planId) : queryKeys.currentWeekPlan(),
    queryFn: () => (planId ? api.getWeekPlan(planId) : api.getCurrentWeekPlan()),
  });
  const currentPlan = planQuery.data ?? null;
  const [isExportOpen, setIsExportOpen] = useState(false);

  useEffect(() => {
    useWeekStore.setState({ currentPlan });
  }, [currentPlan]);

  return (
    <WeekWorkspace
      title="Tuần này, mình ăn gì?"
      backTo="/"
      description={
        currentPlan
          ? `${weekDate(currentPlan.startDate)} – ${weekDate(currentPlan.endDate)} · ${statusLabels[currentPlan.status]}`
          : 'Từ nguyên liệu trong tủ đến những bữa ăn trong tuần.'
      }
      action={
        currentPlan && (
          <Link
            to={`/week/${currentPlan.id}/shopping`}
            className="week-button inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-tk-jade px-4 py-2.5 text-sm font-extrabold text-white shadow-jade transition-tap hover:bg-tk-jade-hover"
          >
            <NavShoppingIcon size={18} tone="jade" active />
            Đi chợ ({currentPlan.shoppingItems.length})
          </Link>
        )
      }
    >
      {planQuery.isPending ? (
        <InlineLoading label="Đang tải thực đơn tuần…" />
      ) : planQuery.isError ? (
        <InlineError error={planQuery.error} onRetry={() => planQuery.refetch()} />
      ) : !currentPlan ? (
        <BentoCard tone="jade" padding="lg" className="week-paper week-empty text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-white text-tk-jade-deep shadow-xs">
            <HouseholdTrayIcon size={32} tone="jade" active />
          </div>
          <p className="week-eyebrow text-xs font-extrabold uppercase tracking-wider text-tk-jade-deep">
            BẮT ĐẦU TỪ BẾP NHÀ
          </p>
          <h2 className="mt-1 font-heading text-2xl font-extrabold text-tk-ink">
            Chưa có thực đơn tuần
          </h2>
          <p className="week-muted mx-auto mt-2 max-w-md text-sm leading-relaxed text-tk-secondary">
            Chọn bữa cần nấu, ngân sách và ưu tiên. Takolio sẽ đề xuất thực đơn để bạn xem lại.
          </p>
          <Link
            to="/week/setup"
            className="week-button mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-tk-flame px-6 py-3 text-sm font-extrabold text-white shadow-float transition-tap hover:bg-tk-flame-hover"
          >
            Lên thực đơn tuần
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </BentoCard>
      ) : (
        <>
          {workflowError && <InlineError message={workflowError} />}
          <WeekSummaryCards plan={currentPlan} />

          <BentoCard
            tone="sunken"
            padding="sm"
            className="week-toolbar flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="week-muted text-xs leading-relaxed text-tk-secondary">
              Kế hoạch dự kiến theo dữ liệu lúc tạo. Kiểm tra lại tủ trước khi nấu; giá mua thực tế
              có thể khác.
            </p>
            <div className="week-actions flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                className="week-button week-button-secondary inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-tk-stone bg-white px-3.5 py-2 text-xs font-extrabold text-tk-ink shadow-xs transition-colors hover:bg-tk-canvas"
                onClick={() => setIsExportOpen(true)}
              >
                <Share2 size={16} aria-hidden="true" />
                Chia sẻ thực đơn
              </button>
              <Link
                className="week-text-link inline-flex min-h-10 items-center px-2 text-xs font-bold text-tk-jade-deep underline"
                to={`/week/${currentPlan.id}/settings`}
              >
                Thiết lập lần tiếp theo
              </Link>
              <Link
                className="week-text-link inline-flex min-h-10 items-center px-2 text-xs font-bold text-tk-jade-deep underline"
                to="/week/setup"
              >
                Xem lại để tạo mới
              </Link>
            </div>
          </BentoCard>

          {currentPlan.aiExplanation && (
            <aside className="week-note rounded-[24px] border border-tk-jade/25 bg-tk-jade-soft/65 p-5">
              <div className="flex items-center gap-2">
                <AiSousChefSparkIcon size={18} tone="flame" active />
                <h2 className="font-heading text-base font-extrabold text-tk-ink">
                  Gợi ý cho tuần
                </h2>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-tk-secondary">
                {currentPlan.aiExplanation}
              </p>
            </aside>
          )}

          <section aria-labelledby="week-days-title" className="week-days-section space-y-4">
            <h2 id="week-days-title" className="font-heading text-xl font-extrabold text-tk-ink">
              Bữa ăn từng ngày
            </h2>
            <div className="week-day-board grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {currentPlan.days.map((day) => (
                <section
                  key={day.id}
                  className="week-day space-y-3 rounded-[26px] border border-tk-stone/85 bg-gradient-to-b from-white via-tk-canvas to-tk-sunken/55 p-4 shadow-card"
                >
                  <div className="week-day-heading flex items-center justify-between border-b border-tk-stone/70 pb-2.5">
                    <h3 className="flex items-center gap-2 font-heading text-base font-extrabold text-tk-ink">
                      <CalendarMealCheckIcon size={16} tone="jade" active />
                      {day.dayNameVi}
                    </h3>
                    <time
                      dateTime={day.date}
                      className="rounded-full bg-tk-sunken px-2.5 py-0.5 text-xs font-bold text-tk-secondary tk-tabular"
                    >
                      {weekDate(day.date)}
                    </time>
                  </div>
                  {day.dayType !== 'cooking' && (
                    <p className="week-muted text-xs font-semibold text-tk-turmeric-deep">
                      {
                        {
                          eat_out: 'Ăn ngoài',
                          flexible: 'Linh hoạt',
                          away: 'Vắng nhà',
                          leftover: 'Dùng món còn lại',
                        }[day.dayType]
                      }
                    </p>
                  )}
                  {day.slots.length ? (
                    day.slots.map((slot) => (
                      <div key={slot.id} className="week-day-slot space-y-1.5">
                        <p className="week-slot-label text-xs font-extrabold uppercase tracking-wide text-tk-jade-deep">
                          {mealLabels[slot.slotType]}
                        </p>
                        <MealCard
                          slot={slot}
                          to={`/week/${currentPlan.id}/meal/${slot.id}`}
                          onSwapClick={() => {
                            void openSwap(slot.id);
                          }}
                        />
                      </div>
                    ))
                  ) : (
                    <p className="week-muted text-xs text-tk-muted">
                      Chưa có bữa nào trong ngày này.
                    </p>
                  )}
                </section>
              ))}
            </div>
            {!currentPlan.days.length && (
              <p className="week-note rounded-2xl border border-tk-stone bg-white p-4 text-sm text-tk-secondary">
                Thực đơn này chưa có bữa ăn. Bạn có thể xem lại thiết lập để tạo kế hoạch mới.
              </p>
            )}
          </section>

          <MealSwapSheet />
          <WeekExportModal
            isOpen={isExportOpen}
            onClose={() => setIsExportOpen(false)}
            plan={currentPlan}
            shoppingItems={currentPlan.shoppingItems}
          />
        </>
      )}
    </WeekWorkspace>
  );
}
