import React, { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { MascotIllustration } from './VNextMedia';
import { VNextIcon } from './VNextIcons';

/** Warm directional Brand Board v2 shimmer primitive (zero layout jump). */
export const TkvShimmerBlock: React.FC<{ className?: string }> = ({ className = 'h-6 w-full' }) => (
  <div aria-hidden="true" className={clsx('rounded-2xl tkv-shimmer border border-[var(--tkv-border)]/70', className)} />
);

/** Structural skeleton matching C01HomePilot bento grid (Hero + 4 pills + recipe grid + sidebar). */
export const HomeDashboardSkeleton: React.FC<{ label?: string }> = ({ label = 'Đang tải gợi ý hôm nay…' }) => (
  <div role="status" aria-live="polite" className="flex flex-col gap-5 tkv-enter-fade-up">
    <span className="sr-only">{label}</span>
    <div className="flex items-center gap-2 overflow-hidden">
      {[96, 86, 84, 88].map((w, i) => (
        <div key={i} style={{ width: w }} className="h-10 rounded-full tkv-shimmer shrink-0" />
      ))}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      <div className="lg:col-span-8 flex flex-col gap-5">
        <div className="rounded-[24px] border border-[var(--tkv-border)] bg-[var(--tkv-surface)] p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
          <div className="sm:col-span-7 flex flex-col gap-3">
            <TkvShimmerBlock className="h-6 w-40 rounded-full" />
            <TkvShimmerBlock className="h-9 w-4/5" />
            <TkvShimmerBlock className="h-4 w-full" />
            <div className="flex gap-2.5 pt-2">
              <TkvShimmerBlock className="h-11 w-36 rounded-full" />
              <TkvShimmerBlock className="h-11 w-32 rounded-full" />
            </div>
          </div>
          <div className="sm:col-span-5">
            <TkvShimmerBlock className="aspect-[4/3] w-full rounded-2xl" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className="rounded-[22px] border border-[var(--tkv-border)] bg-[var(--tkv-surface)] overflow-hidden flex flex-col"
            >
              <TkvShimmerBlock className="aspect-[4/3] w-full rounded-none border-0" />
              <div className="p-4 flex flex-col gap-2.5">
                <TkvShimmerBlock className="h-5 w-3/4 rounded-lg" />
                <TkvShimmerBlock className="h-4 w-1/2 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="lg:col-span-4 flex flex-col gap-4">
        <TkvShimmerBlock className="h-32 w-full rounded-[22px]" />
        <TkvShimmerBlock className="h-24 w-full rounded-[22px]" />
        <TkvShimmerBlock className="h-24 w-full rounded-[22px]" />
      </div>
    </div>
  </div>
);

/** Structural skeleton matching C03InventoryPilot (KPI strip + filter pills + grouped lot cards). */
export const FridgeInventorySkeleton: React.FC<{ label?: string }> = ({ label = 'Đang tải danh sách tủ lạnh…' }) => (
  <div role="status" aria-live="polite" className="flex flex-col gap-4 tkv-enter-fade-up">
    <span className="sr-only">{label}</span>
    <div className="grid grid-cols-3 gap-2.5">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-[20px] border border-[var(--tkv-border)] bg-[var(--tkv-surface)] p-3.5 flex flex-col gap-2">
          <TkvShimmerBlock className="h-3.5 w-16 rounded-md" />
          <TkvShimmerBlock className="h-7 w-12 rounded-lg" />
        </div>
      ))}
    </div>
    <div className="flex flex-col gap-3">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="rounded-[20px] border border-[var(--tkv-border)] bg-[var(--tkv-surface)] p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <TkvShimmerBlock className="w-11 h-11 rounded-2xl shrink-0" />
            <div className="flex flex-col gap-2 flex-1 min-w-0">
              <TkvShimmerBlock className="h-4 w-44 max-w-full rounded-md" />
              <TkvShimmerBlock className="h-3.5 w-28 rounded-md" />
            </div>
          </div>
          <TkvShimmerBlock className="h-7 w-20 rounded-full shrink-0" />
        </div>
      ))}
    </div>
  </div>
);

/** Structural skeleton matching C18RecipeDetailPilot. */
export const RecipeDetailSkeleton: React.FC<{ label?: string }> = ({ label = 'Đang tải công thức món ăn…' }) => (
  <div role="status" aria-live="polite" className="flex flex-col gap-5 tkv-enter-fade-up">
    <span className="sr-only">{label}</span>
    <TkvShimmerBlock className="aspect-[16/9] sm:aspect-[21/9] w-full rounded-[24px]" />
    <div className="flex flex-col gap-2.5">
      <TkvShimmerBlock className="h-8 w-2/3 rounded-xl" />
      <TkvShimmerBlock className="h-4 w-full max-w-xl rounded-lg" />
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      <div className="lg:col-span-5 rounded-[22px] border border-[var(--tkv-border)] bg-[var(--tkv-surface)] p-5 flex flex-col gap-3">
        <TkvShimmerBlock className="h-5 w-32 rounded-lg" />
        {[0, 1, 2, 3, 4].map((i) => (
          <TkvShimmerBlock key={i} className="h-9 w-full rounded-xl" />
        ))}
      </div>
      <div className="lg:col-span-7 rounded-[22px] border border-[var(--tkv-border)] bg-[var(--tkv-surface)] p-5 flex flex-col gap-3">
        <TkvShimmerBlock className="h-5 w-36 rounded-lg" />
        {[0, 1, 2].map((i) => (
          <TkvShimmerBlock key={i} className="h-20 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  </div>
);

/** Structural skeleton matching C23PlannerPilot 7-day planner. */
export const WeeklyPlannerSkeleton: React.FC<{ label?: string }> = ({ label = 'Đang tải thực đơn 7 ngày…' }) => (
  <div role="status" aria-live="polite" className="flex flex-col gap-4 tkv-enter-fade-up">
    <span className="sr-only">{label}</span>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-[22px] border border-[var(--tkv-border)] bg-[var(--tkv-surface)] p-4 flex flex-col gap-3">
          <TkvShimmerBlock className="h-4 w-20 rounded-full" />
          <TkvShimmerBlock className="aspect-[16/10] w-full rounded-2xl" />
          <TkvShimmerBlock className="h-5 w-4/5 rounded-lg" />
          <TkvShimmerBlock className="h-4 w-1/2 rounded-lg" />
        </div>
      ))}
    </div>
    <TkvShimmerBlock className="h-28 w-full rounded-[22px]" />
  </div>
);

/** Structural skeleton matching ShoppingPage category groups. */
export const ShoppingListSkeleton: React.FC<{ label?: string }> = ({ label = 'Đang tải danh sách đi chợ…' }) => (
  <div role="status" aria-live="polite" className="flex flex-col gap-4 tkv-enter-fade-up">
    <span className="sr-only">{label}</span>
    {[0, 1].map((group) => (
      <div key={group} className="rounded-[22px] border border-[var(--tkv-border)] bg-[var(--tkv-surface)] p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <TkvShimmerBlock className="h-4 w-32 rounded-md" />
          <TkvShimmerBlock className="h-4 w-12 rounded-md" />
        </div>
        {[0, 1, 2].map((row) => (
          <div key={row} className="flex items-center gap-3 py-1">
            <TkvShimmerBlock className="w-6 h-6 rounded-lg shrink-0" />
            <div className="flex flex-col gap-1.5 flex-1">
              <TkvShimmerBlock className="h-4 w-44 max-w-full rounded-md" />
              <TkvShimmerBlock className="h-3 w-24 rounded-md" />
            </div>
            <TkvShimmerBlock className="h-7 w-16 rounded-full shrink-0" />
          </div>
        ))}
      </div>
    ))}
  </div>
);

/** Structural skeleton matching Settings / Preferences / Form screens. */
export const SettingsFormSkeleton: React.FC<{ label?: string }> = ({ label = 'Đang tải cài đặt…' }) => (
  <div role="status" aria-live="polite" className="flex flex-col gap-4 tkv-enter-fade-up">
    <span className="sr-only">{label}</span>
    {[0, 1].map((section) => (
      <div key={section} className="rounded-[22px] border border-[var(--tkv-border)] bg-[var(--tkv-surface)] p-5 flex flex-col gap-3.5">
        <TkvShimmerBlock className="h-5 w-44 rounded-lg" />
        <TkvShimmerBlock className="h-4 w-2/3 rounded-md" />
        <div className="flex flex-wrap gap-2 pt-1">
          {[88, 102, 76, 94, 82].map((w, idx) => (
            <div key={idx} style={{ width: w }} className="h-10 rounded-full tkv-shimmer" />
          ))}
        </div>
      </div>
    ))}
  </div>
);

const AI_SCAN_STAGES = [
  'Đang đọc ảnh và nhận diện từng nguyên liệu…',
  'Đang chuẩn hóa định lượng & nhóm bảo quản…',
  'Đang chuẩn bị bảng kiểm duyệt an toàn trước khi lưu…',
] as const;

/**
 * Multi-stage animated AI Scan pending choreography:
 * Live photo preview + vertical Leaf Green scanning beam + Bé Mầm Bếp scanning aura + rotating stages.
 */
export const AiScanPendingStage: React.FC<{
  previewUrl?: string | null;
  statusText?: string;
  modeLabel?: string;
}> = ({ previewUrl, statusText, modeLabel = 'AI Vision Takolio' }) => {
  const [stageIdx, setStageIdx] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setStageIdx((prev) => (prev + 1) % AI_SCAN_STAGES.length);
    }, 2200);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-[24px] border border-[var(--tkv-border-mint)] bg-gradient-to-br from-[var(--tkv-surface-mint)] via-[var(--tkv-surface)] to-[var(--tkv-bg)] p-5 sm:p-6 shadow-[var(--tkv-shadow-card)] tkv-enter-fade-up flex flex-col gap-5"
    >
      <div className="flex flex-col sm:flex-row items-center gap-5">
        <div className="relative w-36 h-36 sm:w-40 sm:h-40 rounded-2xl overflow-hidden border-2 border-[var(--tkv-primary)]/40 bg-[var(--tkv-surface)] shrink-0 shadow-[var(--tkv-shadow-card)] flex items-center justify-center">
          {previewUrl ? (
            <img src={previewUrl} alt="Ảnh đang được AI quét" className="w-full h-full object-cover" />
          ) : (
            <MascotIllustration pose="scanning" size={120} motion="scan" decorative />
          )}
          {/* Vertical Leaf Green laser beam */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-transparent via-[var(--tkv-primary)]/35 to-transparent border-b-2 border-[var(--tkv-primary)] tkv-scan-beam"
          />
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-3 text-center sm:text-left">
          <span className="inline-flex items-center justify-center sm:justify-start gap-2 self-center sm:self-start px-3 py-1 rounded-full bg-[var(--tkv-surface)] border border-[var(--tkv-border-mint)] text-xs font-extrabold text-[var(--tkv-primary)]">
            <span className="w-2 h-2 rounded-full bg-[var(--tkv-primary)] tkv-scan-aura" aria-hidden="true" />
            <span>{modeLabel}</span>
          </span>
          <h3 className="tkv-heading text-lg sm:text-xl font-extrabold text-[var(--tkv-ink)]">
            Bé Mầm Bếp đang phân tích ảnh của bạn
          </h3>
          <p className="text-sm font-semibold text-[var(--tkv-ink-secondary)]">
            {statusText || AI_SCAN_STAGES[stageIdx]}
          </p>

          <ol className="flex flex-col gap-2 pt-1 text-left">
            {AI_SCAN_STAGES.map((label, idx) => {
              const done = idx < stageIdx;
              const current = idx === stageIdx;
              return (
                <li
                  key={label}
                  className={clsx(
                    'flex items-center gap-2.5 text-xs font-semibold transition-opacity duration-300',
                    done && 'text-[var(--tkv-primary)]',
                    current && 'text-[var(--tkv-ink)]',
                    !done && !current && 'text-[var(--tkv-ink-muted)] opacity-60',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={clsx(
                      'w-5 h-5 rounded-full inline-flex items-center justify-center shrink-0 border text-[10px] font-extrabold',
                      done && 'bg-[var(--tkv-primary)] border-[var(--tkv-primary)] text-white',
                      current && 'bg-[var(--tkv-surface-mint)] border-[var(--tkv-primary)] text-[var(--tkv-primary)]',
                      !done && !current && 'bg-[var(--tkv-surface)] border-[var(--tkv-border)] text-[var(--tkv-ink-muted)]',
                    )}
                  >
                    {done ? <VNextIcon name="check" size={11} /> : idx + 1}
                  </span>
                  <span>{label}</span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </div>
  );
};

const PLANNER_DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'] as const;

/**
 * Multi-stage animated weekly meal planner generation indicator (7-day wave + Bé Mầm Bếp).
 */
export const PlannerGeneratingStage: React.FC<{ subtitle?: string }> = ({
  subtitle = 'Đang đối chiếu tủ lạnh, cân bằng dinh dưỡng 7 ngày và gom danh sách đi chợ…',
}) => {
  const [litDay, setLitDay] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setLitDay((prev) => (prev + 1) % PLANNER_DAYS.length);
    }, 420);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-[24px] border border-[var(--tkv-border-mint)] bg-gradient-to-br from-[var(--tkv-surface-mint)] via-[var(--tkv-surface)] to-[var(--tkv-surface-coral)]/50 p-6 text-center flex flex-col items-center gap-4 tkv-enter-fade-up"
    >
      <MascotIllustration pose="cooking" size={104} motion="idle" decorative />
      <div className="flex flex-col gap-1.5 max-w-md">
        <h3 className="tkv-heading text-lg sm:text-xl font-extrabold text-[var(--tkv-ink)]">
          Bé Mầm Bếp đang sắp xếp thực đơn tuần
        </h3>
        <p className="text-sm text-[var(--tkv-ink-secondary)] leading-relaxed">{subtitle}</p>
      </div>
      <div className="flex items-center justify-center gap-2 flex-wrap pt-1" aria-hidden="true">
        {PLANNER_DAYS.map((d, idx) => {
          const active = idx <= litDay;
          return (
            <span
              key={d}
              className={clsx(
                'w-10 h-10 rounded-full text-xs font-extrabold inline-flex items-center justify-center border transition-[transform,background-color,border-color,color] duration-200',
                active
                  ? 'bg-[var(--tkv-primary)] border-[var(--tkv-primary)] text-white scale-105 shadow-[var(--tkv-shadow-cta)]'
                  : 'bg-[var(--tkv-surface)] border-[var(--tkv-border)] text-[var(--tkv-ink-muted)]',
              )}
            >
              {d}
            </span>
          );
        })}
      </div>
    </div>
  );
};
