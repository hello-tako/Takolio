import type { PlannerLocale } from './copy';
import { reasonLabel } from './presentation';

export function MealStyleNotice({
  warnings,
  locale,
}: {
  warnings: readonly string[];
  locale: PlannerLocale;
}) {
  if (!warnings.includes('MANUAL_ONE_DISH_MEAL')) return null;
  return (
    <p className="planning-note planning-meal-style-note mt-2 rounded-xl bg-tk-sunken px-3 py-1.5 text-xs font-medium text-tk-secondary">
      {reasonLabel('MANUAL_ONE_DISH_MEAL', locale)}
    </p>
  );
}
