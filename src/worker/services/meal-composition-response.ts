import type { MealCompositionDto, PlanCompositionsDto, SlotCompositionDto } from '../../../packages/domain/src/meal-composition-api';

import type { MealPlanDto } from '../../../packages/domain/src/meal-planning-api';

export function legacyMealPlan(dto: MealPlanDto) {
  return { ...dto, result: { ...dto.result, meals: dto.result.meals.map(({ contentFingerprint: _pin, ...meal }) => meal) } };
}

export function supportsRecipeContent(accept: string | undefined): boolean {
  return accept?.split(',').some((part) => /^\s*application\/json\s*;\s*recipe-content=1\s*$/i.test(part)) ?? false;
}

export function legacyComposition(composition: MealCompositionDto) {
  return { ...composition, components: composition.components.map(({ contentFingerprint, ...component }) => ({
    ...component, cookable: component.cookable && !contentFingerprint,
  })) };
}

export function legacyPlanCompositions(dto: PlanCompositionsDto) {
  return { ...dto, compositions: dto.compositions.map(legacyComposition) };
}

export function legacySlotComposition(dto: SlotCompositionDto) {
  return { ...dto, composition: legacyComposition(dto.composition) };
}
