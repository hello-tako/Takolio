import type { MealCompositionDto } from '../../../../packages/domain/src/meal-composition-api';

const hardWarnings = new Set([
  'COMPONENT_UNAVAILABLE',
  'HARD_CONSTRAINT_CONFLICT',
  'MEAL_TIME_REQUIRES_REVALIDATION',
  'LOCKED_MEAL_TIME_REQUIRES_REVALIDATION',
  'DUPLICATE_ITEM',
  'MULTIPLE_MAINS',
  'MULTIPLE_SOUPS',
  'STAPLE_CONFLICT',
]);

export function compositionState(composition: MealCompositionDto) {
  if (composition.source === 'v1_projection') return 'legacy';
  if (!composition.components.length) return 'empty';
  if (composition.missingRoles.length) return 'partial';
  if (
    composition.components.some(
      (component) => !component.resolvable || component.projection?.status === 'unavailable',
    ) ||
    composition.warnings.some(
      (code) => hardWarnings.has(code) || code.startsWith('LOCKED_COMPONENT_'),
    )
  )
    return 'review';
  return 'complete';
}

export const compositionStateCopy = {
  vi: {
    complete: 'Đã đủ nhóm món',
    partial: 'Còn thiếu nhóm món',
    empty: 'Bữa này chưa có món',
    review: 'Cần kiểm tra lại bữa ăn: có món chưa đáp ứng điều kiện hiện tại.',
    legacy: 'Bữa này đang theo chế độ món chính',
  },
  en: {
    complete: 'All required dish groups are present',
    partial: 'Dish groups still missing',
    empty: 'This meal has no dishes',
    review: 'Review this meal: some dishes need checking against the current conditions.',
    legacy: 'This meal uses the main-dish mode',
  },
} as const;
