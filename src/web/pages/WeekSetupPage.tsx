import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { MealPlanSetupInput, WeeklyPriority, ShoppingFrequency } from '@frigo/domain';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useWeekStore } from '../stores/useWeekStore';
import { WeekWorkspace, weekCurrency } from '../features/week/WeekWorkspace';
import {
  WeekBudgetChoices,
  WeekFrequencyChoices,
  frequencyOptions,
} from '../features/week/WeekSetupChoices';
import { BentoCard } from '../design-system/v4/AtelierPrimitives';

const presets: { id: MealPlanSetupInput['mealSlotsPreset']; title: string; description: string }[] =
  [
    {
      id: 'dinner_only',
      title: 'Chỉ bữa tối',
      description: 'Bữa tối tại nhà từ thứ 2 đến chủ nhật.',
    },
    {
      id: 'working_people',
      title: 'Người đi làm bận rộn',
      description: 'Bữa tối ngày thường; bữa trưa và tối cuối tuần.',
    },
    { id: 'all', title: 'Sáng, trưa và tối', description: 'Lên kế hoạch cho cả ba bữa mỗi ngày.' },
  ];

const prioritiesOptions: { id: WeeklyPriority; label: string }[] = [
  { id: 'use_fridge', label: 'Dùng đồ trong tủ' },
  { id: 'budget', label: 'Tiết kiệm chi phí' },
  { id: 'quick', label: 'Ưu tiên nấu nhanh' },
  { id: 'variety', label: 'Ăn đa dạng, đổi món' },
  { id: 'more_veggies', label: 'Nhiều rau xanh hơn' },
  { id: 'high_protein', label: 'Giàu đạm hơn' },
  { id: 'low_oil', label: 'Ít dầu mỡ hơn' },
  { id: 'less_shopping', label: 'Ít mua thêm' },
  { id: 'meal_prep', label: 'Ưu tiên chuẩn bị sẵn' },
  { id: 'new_recipes', label: 'Thử món mới' },
];

const steps = ['Bữa ăn', 'Ngân sách', 'Ưu tiên', 'Đi chợ'];

export function WeekSetupPage() {
  const navigate = useNavigate();
  const { setupDraft, updateSetupDraft } = useWeekStore();
  const [currentStep, setCurrentStep] = useState(1);
  const [mealPreset, setMealPreset] = useState(setupDraft.mealSlotsPreset || 'dinner_only');
  const [budget, setBudget] = useState<number | null>(
    setupDraft.budgetTargetVnd !== undefined ? setupDraft.budgetTargetVnd : 750000,
  );
  const [priorities, setPriorities] = useState<WeeklyPriority[]>(
    setupDraft.priorities || ['use_fridge'],
  );
  const [frequency, setFrequency] = useState<ShoppingFrequency>(
    setupDraft.shoppingFrequency || 'once',
  );
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    stepHeading.current?.focus();
  }, [currentStep]);

  function togglePriority(priority: WeeklyPriority) {
    setPriorities((selected) =>
      selected.includes(priority)
        ? selected.length > 1
          ? selected.filter((value) => value !== priority)
          : selected
        : selected.length < 3
          ? [...selected, priority]
          : selected,
    );
  }

  function next() {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
      return;
    }
    updateSetupDraft({
      mealSlotsPreset: mealPreset,
      budgetTargetVnd: budget,
      priorities,
      shoppingFrequency: frequency,
    });
    navigate('/week/generating');
  }

  return (
    <WeekWorkspace
      title="Một tuần ăn uống, có kế hoạch."
      narrow
      description="Chọn bữa ăn và các ưu tiên của bạn. Bạn sẽ xem lại thực đơn trước khi đi chợ hoặc nấu."
    >
      <ol
        className="week-step-list grid grid-cols-4 gap-2 rounded-2xl border border-tk-stone/80 bg-tk-sunken/85 p-2"
        aria-label="Các bước thiết lập"
      >
        {steps.map((label, index) => {
          const active = currentStep === index + 1;
          const complete = currentStep > index + 1;
          return (
            <li
              key={label}
              aria-current={active ? 'step' : undefined}
              data-complete={complete}
              className={`flex flex-col items-center justify-center rounded-xl px-2 py-2 text-center text-xs font-bold transition-colors sm:flex-row sm:gap-1.5 ${
                active
                  ? 'bg-white text-tk-ink shadow-xs'
                  : complete
                    ? 'text-tk-jade-deep'
                    : 'text-tk-muted'
              }`}
            >
              <span
                aria-hidden="true"
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-extrabold tk-tabular ${
                  active
                    ? 'bg-tk-flame text-white'
                    : complete
                      ? 'bg-tk-jade-soft text-tk-jade-deep'
                      : 'bg-tk-stone/70 text-tk-secondary'
                }`}
              >
                0{index + 1}
              </span>
              <span>{label}</span>
            </li>
          );
        })}
      </ol>

      <BentoCard
        tone="ceramic"
        padding="lg"
        className="week-paper week-setup-stage space-y-5"
        aria-labelledby="week-step-heading"
      >
        <div>
          <p className="week-eyebrow text-xs font-extrabold uppercase tracking-wider text-tk-jade-deep">
            Bước {currentStep} / 4
          </p>
          <h2
            id="week-step-heading"
            ref={stepHeading}
            tabIndex={-1}
            className="mt-1 font-heading text-xl font-extrabold text-tk-ink sm:text-2xl focus:outline-none"
          >
            {
              [
                'Bạn muốn lên kế hoạch cho những bữa nào?',
                'Bạn muốn dành bao nhiêu cho việc mua thêm?',
                'Tuần này bạn ưu tiên điều gì?',
                'Bạn muốn đi chợ mấy lần?',
              ][currentStep - 1]
            }
          </h2>
        </div>

        {currentStep === 1 && (
          <fieldset className="week-choices space-y-2.5">
            <legend className="sr-only">Bữa ăn cần lên kế hoạch</legend>
            {presets.map((option) => {
              const selected = mealPreset === option.id;
              return (
                <label
                  key={option.id}
                  className={`week-choice flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors ${
                    selected
                      ? 'border-tk-jade bg-tk-jade-soft/75 text-tk-ink shadow-xs'
                      : 'border-tk-stone bg-tk-canvas/70 text-tk-ink hover:bg-tk-sunken'
                  }`}
                  data-selected={selected}
                >
                  <input
                    type="radio"
                    name="week-preset"
                    value={option.id}
                    checked={selected}
                    onChange={() => setMealPreset(option.id)}
                    className="mt-1 h-4 w-4 accent-tk-jade"
                  />
                  <span className="space-y-0.5">
                    <strong className="block text-sm font-extrabold">{option.title}</strong>
                    <span className="week-muted week-choice-description block text-xs text-tk-secondary">
                      {option.description}
                    </span>
                  </span>
                </label>
              );
            })}
          </fieldset>
        )}

        {currentStep === 2 && (
          <div className="space-y-4">
            <p className="week-muted text-sm text-tk-secondary">
              Chi phí trong thực đơn là ước tính, có thể khác giá thực tế khi mua.
            </p>
            <WeekBudgetChoices value={budget} onChange={setBudget} />
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-4">
            <p className="week-muted text-sm font-semibold text-tk-secondary" aria-live="polite">
              Chọn từ 1 đến 3 ưu tiên. Đang chọn {priorities.length}/3.
            </p>
            <fieldset className="week-choices">
              <legend className="sr-only">Ưu tiên cho thực đơn</legend>
              <div className="week-choice-grid grid gap-2.5 sm:grid-cols-2">
                {prioritiesOptions.map((option) => {
                  const selected = priorities.includes(option.id);
                  return (
                    <label
                      key={option.id}
                      className={`week-choice flex cursor-pointer items-center gap-3 rounded-2xl border p-3.5 text-sm font-bold transition-colors ${
                        selected
                          ? 'border-tk-jade bg-tk-jade-soft text-tk-jade-deep shadow-xs'
                          : 'border-tk-stone bg-white text-tk-ink hover:bg-tk-sunken'
                      }`}
                      data-selected={selected}
                    >
                      <input
                        type="checkbox"
                        name="week-priority"
                        value={option.id}
                        checked={selected}
                        disabled={selected ? priorities.length === 1 : priorities.length === 3}
                        onChange={() => togglePriority(option.id)}
                        className="h-4 w-4 accent-tk-jade"
                      />
                      <span>{option.label}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </div>
        )}

        {currentStep === 4 && (
          <div className="space-y-4">
            <WeekFrequencyChoices value={frequency} onChange={setFrequency} />
            <div className="week-note space-y-1.5 rounded-2xl border border-tk-jade/25 bg-tk-jade-soft/65 p-4 text-sm">
              <h3 className="font-heading font-extrabold text-tk-ink">Kiểm tra trước khi tạo</h3>
              <p className="font-bold text-tk-jade-deep">
                {presets.find((p) => p.id === mealPreset)?.title} ·{' '}
                {budget === null ? 'Không giới hạn ngân sách' : weekCurrency(budget)} ·{' '}
                {frequencyOptions.find((f) => f.id === frequency)?.label}
              </p>
              <p className="text-xs font-semibold text-tk-secondary">
                {priorities
                  .map((priority) => prioritiesOptions.find((p) => p.id === priority)?.label)
                  .join(' · ')}
              </p>
              <p className="week-muted text-xs text-tk-muted">
                Tạo thực đơn chưa mua thêm hay trừ nguyên liệu trong tủ.
              </p>
            </div>
          </div>
        )}

        <div className="week-actions week-setup-actions flex items-center justify-between gap-3 border-t border-tk-stone/70 pt-4">
          <button
            type="button"
            className="week-button week-button-secondary inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-tk-stone bg-white px-4 py-2.5 text-sm font-bold text-tk-ink transition-colors hover:bg-tk-sunken"
            onClick={() => (currentStep > 1 ? setCurrentStep(currentStep - 1) : navigate('/week'))}
          >
            <ArrowLeft size={18} aria-hidden="true" />
            {currentStep === 1 ? 'Về thực đơn' : 'Bước trước'}
          </button>
          <button
            type="button"
            className="week-button inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-tk-flame px-5 py-2.5 text-sm font-extrabold text-white shadow-float transition-tap hover:bg-tk-flame-hover"
            onClick={next}
          >
            {currentStep === 4 ? 'Tạo thực đơn tuần' : 'Tiếp tục'}
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </div>
      </BentoCard>
    </WeekWorkspace>
  );
}
