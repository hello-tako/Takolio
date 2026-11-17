import { Clock } from 'lucide-react';
import type { PlannerLocale } from './copy';
import { reasonLabel } from './presentation';

const warningPriority = [
  'MEAL_TIME_REQUIRES_REVALIDATION',
  'LOCKED_MEAL_TIME_REQUIRES_REVALIDATION',
  'MEAL_TIME_UNKNOWN',
  'MEAL_TIME_ABOVE_PREFERENCE',
] as const;

export function MealTimeNotice({
  warnings,
  locale,
}: {
  warnings: readonly string[];
  locale: PlannerLocale;
}) {
  const warning = warningPriority.find((code) => warnings.includes(code));
  if (!warning) return null;
  return (
    <p className="planning-meal-time-note mt-2 flex items-center gap-1.5 rounded-xl bg-tk-turmeric-soft/75 px-3 py-1.5 text-xs font-semibold text-tk-turmeric-deep">
      <Clock size={14} aria-hidden="true" className="shrink-0" />
      <span>{reasonLabel(warning, locale)}</span>
    </p>
  );
}
