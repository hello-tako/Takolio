import type { ShoppingFrequency } from '@frigo/domain';
import { weekCurrency } from './WeekWorkspace';

export const frequencyOptions: { id: ShoppingFrequency; label: string; description: string }[] = [
  { id: 'once', label: '1 lần / tuần', description: 'Một chuyến mua sắm đầu tuần.' },
  { id: 'twice', label: '2 lần / tuần', description: 'Chia nhu cầu mua sắm thành hai chuyến.' },
  { id: 'three_plus', label: '3 lần trở lên', description: 'Mua bổ sung nhiều lần trong tuần.' },
  { id: 'flexible', label: 'Không cố định', description: 'Chọn thời điểm phù hợp với bạn.' },
];

export function WeekBudgetChoices({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <fieldset className="week-choices space-y-2.5">
      <legend className="text-sm font-extrabold text-tk-ink">Hạn mức mua thêm cho tuần</legend>
      <div className="week-choice-grid grid gap-2.5 sm:grid-cols-2">
        {[500000, 750000, 1000000, 1500000, null].map((budget) => {
          const selected = value === budget;
          return (
            <label
              key={budget ?? 'unlimited'}
              className={`week-choice flex cursor-pointer items-center gap-3 rounded-2xl border p-3.5 text-sm font-bold transition-colors ${
                selected
                  ? 'border-tk-jade bg-tk-jade-soft text-tk-jade-deep shadow-xs'
                  : 'border-tk-stone bg-white text-tk-ink hover:bg-tk-sunken'
              }`}
              data-selected={selected}
            >
              <input
                type="radio"
                name="week-budget"
                value={budget ?? 'unlimited'}
                checked={selected}
                onChange={() => onChange(budget)}
                className="h-4 w-4 accent-tk-jade"
              />
              <span>{budget === null ? 'Không giới hạn ngân sách' : weekCurrency(budget)}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function WeekFrequencyChoices({
  value,
  onChange,
}: {
  value: ShoppingFrequency;
  onChange: (value: ShoppingFrequency) => void;
}) {
  return (
    <fieldset className="week-choices space-y-2.5">
      <legend className="text-sm font-extrabold text-tk-ink">Tần suất đi chợ</legend>
      {frequencyOptions.map((option) => {
        const selected = value === option.id;
        return (
          <label
            key={option.id}
            className={`week-choice flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 transition-colors ${
              selected
                ? 'border-tk-jade bg-tk-jade-soft/75 text-tk-ink shadow-xs'
                : 'border-tk-stone bg-white text-tk-ink hover:bg-tk-sunken'
            }`}
            data-selected={selected}
          >
            <input
              type="radio"
              name="week-frequency"
              value={option.id}
              checked={selected}
              onChange={() => onChange(option.id)}
              className="mt-1 h-4 w-4 accent-tk-jade"
            />
            <span className="space-y-0.5">
              <strong className="block text-sm font-extrabold">{option.label}</strong>
              <span className="week-muted week-choice-description block text-xs text-tk-secondary">
                {option.description}
              </span>
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
