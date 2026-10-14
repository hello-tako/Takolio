import { Info } from 'lucide-react';
import type { FamilyMealPlanDto } from '../../../../packages/domain/src/family-meal-planning-api';
import type { MealPlanDto } from '../../../../packages/domain/src/meal-planning-api';
import type { PlannerLocale } from './copy';
import { reasonLabel } from './presentation';

const capCode = 'PRESERVED_INTERNATIONAL_CAP_EXCEEDED';

export function FamilyPlanNotice({
  plan,
  familyPlan,
  warnings = [],
  locale,
}: {
  plan: MealPlanDto;
  familyPlan?: FamilyMealPlanDto;
  warnings?: readonly string[];
  locale: PlannerLocale;
}) {
  const current = familyPlan?.plan.id === plan.id && familyPlan.plan.revision === plan.revision;
  if (!warnings.includes(capCode) && !(current && familyPlan.diagnostics.reasons.includes(capCode)))
    return null;
  return (
    <p className="planning-notice planning-family-policy-note" role="status">
      <Info size={16} aria-hidden="true" />
      <span>{reasonLabel(capCode, locale)}</span>
    </p>
  );
}
