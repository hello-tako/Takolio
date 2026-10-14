import { MealPlanningIntentSchema } from '../../../../packages/domain/src/meal-planning-api';
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function buildPlanningIntent(input: {
  startDate: string;
  days: number;
  servings: number;
  meals: Array<'breakfast' | 'lunch' | 'dinner'>;
  mode: 'cook_now' | 'shopping_allowed';
  maxTime: string;
  offset: number;
  cookingDays?: number[];
  preferredTimeMinutes?: number;
}) {
  const start = new Date(`${input.startDate}T12:00:00Z`);
  return MealPlanningIntentSchema.parse({
    startDate: input.startDate,
    horizonDays: input.days,
    defaultServings: input.servings,
    utcOffsetMinutes: input.offset,
    mode: input.mode,
    slots: Array.from({ length: Math.min(14, Math.max(0, input.days)) }, (_, index) => {
      const date = new Date(start);
      date.setUTCDate(date.getUTCDate() + index);
      if (input.cookingDays && !input.cookingDays.includes(date.getUTCDay())) return [];
      return input.meals.map((mealType) => ({
        date: date.toISOString().slice(0, 10),
        mealType,
        ...(input.preferredTimeMinutes ? { preferredTimeMinutes: input.preferredTimeMinutes } : {}),
        ...(input.maxTime ? { hardMaxTimeMinutes: Number(input.maxTime) } : {}),
      }));
    }).flat(),
  });
}
