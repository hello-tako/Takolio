import {
  createRecipeAvailabilityIndex,
  type Recipe,
  type RecipeScoringContext,
} from '@frigo/recipes';
import {
  createAvailabilitySession,
  type IngredientAvailability,
  type StandardUnit,
} from '@frigo/domain';
import type { SupportedLocale } from '../../shared/locales';
import { getActiveAppLocale } from '../i18n/LocaleContext';
import { containsVietnameseDiacritics, localizeUnit, lSync } from '../i18n/app-i18n';
import { ApiError } from '../services/http';
import { presentDomainError } from './inventory-truth';

export interface DeductionDraft {
  ingredientId: string;
  name: string;
  currentQuantity: number;
  quantityDeducted: number;
  remainingQuantity: number;
  unit: StandardUnit;
}
export interface CookingDeduction {
  ingredientId: string;
  name?: string;
  quantityDeducted: number;
  unit: StandardUnit;
}
export const cookingUnitLabel = (unit: string, locale: SupportedLocale = getActiveAppLocale()) => {
  if (locale === 'vi') {
    if (unit === 'piece') return lSync('cái', 'pcs', locale);
    if (unit === 'pack') return lSync('gói', 'pack', locale);
    if (unit === 'bunch') return lSync('bó', 'bunch', locale);
    if (unit === 'slice') return lSync('lát', 'slice', locale);
    return unit;
  }
  return localizeUnit(unit, locale);
};
export const cookingQuantityText = (
  quantity: number,
  unit: string,
  locale: SupportedLocale = getActiveAppLocale(),
) =>
  `${new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US', { maximumSignificantDigits: 15 }).format(quantity)} ${cookingUnitLabel(unit, locale)}`;

export function reviewCookingDeductions(
  recipe: Recipe,
  inventory: RecipeScoringContext['inventory'],
  inputs: string[],
): { deductions: DeductionDraft[]; errors: Array<string | null> } {
  const errors: Array<string | null> = recipe.ingredients.map((_, index) => {
    const raw = inputs[index] ?? '';
    const value = Number(raw);
    return raw.trim() === ''
      ? lSync(
          'Nhập lượng đã dùng; nhập 0 nếu không dùng.',
          'Enter the amount used, or 0 if unused.',
        )
      : !Number.isFinite(value) || value < 0 || value > 100000
        ? lSync('Nhập số từ 0 đến 100.000.', 'Enter a number from 0 to 100,000.')
        : null;
  });
  const quantities = recipe.ingredients.map((_, index) =>
    errors[index] ? 0 : Number(inputs[index]),
  );
  const availability: IngredientAvailability[] = [];
  try {
    const session = createAvailabilitySession(createRecipeAvailabilityIndex([recipe], inventory));
    // Required rows retain priority; zero/blank rows inspect stock without reserving it.
    for (const optional of [false, true]) {
      recipe.ingredients.forEach((line, index) => {
        if (Boolean(line.isOptional) !== optional) return;
        const demand = { ...line, requiredQuantity: quantities[index] || 1 };
        availability[index] = quantities[index] > 0 ? session.take(demand) : session.peek(demand);
      });
    }
  } catch {
    return {
      deductions: recipe.ingredients.map((line) => ({
        ingredientId: line.ingredientId,
        name: line.name,
        unit: line.unit,
        currentQuantity: 0,
        quantityDeducted: 0,
        remainingQuantity: 0,
      })),
      errors: errors.map(
        (error) =>
          error ??
          lSync(
            'Lượng này chưa thể tính chính xác. Hãy kiểm tra lại số đã nhập.',
            'This quantity could not be calculated accurately. Please check your entry.',
          ),
      ),
    };
  }
  const deductions = recipe.ingredients.map((line, index) => {
    const available = availability[index].availableQuantity;
    const used = quantities[index];
    if (!errors[index] && used > available) {
      const availableText = cookingQuantityText(available, line.unit);
      errors[index] =
        available === 0 && availability[index].status === 'unresolved'
          ? lSync(
              'Chưa quy đổi được lượng trong tủ. Nhập 0 hoặc sửa đơn vị ở Tủ lạnh.',
              'Could not convert your fridge unit. Enter 0 or update the unit in your Fridge.',
            )
          : lSync(
              `Vượt lượng có thể dùng: ${availableText}. Hãy kiểm tra lại.`,
              `Exceeds available stock: ${availableText}. Please check again.`,
            );
    }
    return {
      ingredientId: line.ingredientId,
      name: line.name,
      unit: line.unit,
      currentQuantity: available,
      quantityDeducted: used,
      remainingQuantity: Math.max(0, available - used),
    };
  });
  return { deductions, errors };
}

const DOMAIN_ERRORS_EN: Readonly<Record<string, string>> = {
  INVENTORY_AUTHORITY_REQUIRED:
    'Lot-based inventory tracking is not enabled for this fridge yet. Enable it before using this feature.',
  CONFLICT: 'This ingredient was updated elsewhere, so your changes were not saved.',
  STALE_SNAPSHOT: 'Inventory changed since you opened this view, so the action was not applied.',
  ALREADY_DECIDED: 'This review item has already been handled.',
  UNIT_MISMATCH: 'Could not convert this unit to the unit stored in your fridge.',
  INSUFFICIENT_INVENTORY: 'Your fridge does not have enough stock for this action.',
  IDEMPOTENCY_CONFLICT:
    'This request key was already used for another operation, so nothing was applied.',
  NOT_ACTIONABLE: 'No action is available for this record.',
  REVIVE_REQUIRED: 'This lot has already ended. Restore it with a quantity before editing.',
  VALIDATION_ERROR: 'Invalid input. Please review your values and try again.',
  NOT_FOUND: 'This item could not be found.',
  FORBIDDEN: 'You do not have permission for this item.',
};

export function cookingFailure(error: unknown): { message: string; recoverable: boolean } {
  if (error instanceof ApiError) {
    if (error.code === 'HARD_CONSTRAINT_CONFLICT')
      return {
        message: lSync(
          'Món này không phù hợp với ràng buộc ăn uống hiện tại. Chưa ghi nhận bữa nấu; hãy kiểm tra lựa chọn món.',
          'This dish conflicts with your current dietary restrictions. Cooking was not recorded; please review your dish selection.',
        ),
        recoverable: false,
      };
    if (error.kind === 'auth')
      return {
        message: lSync(
          'Phiên hoặc quyền truy cập đã thay đổi. Hãy kiểm tra đăng nhập trước khi thử lại.',
          'Your session or access changed. Please check your sign-in status before trying again.',
        ),
        recoverable: false,
      };
    if (error.code === 'IDEMPOTENCY_CONFLICT')
      return {
        message: lSync(
          'Mã yêu cầu đã có dữ liệu khác. Hãy kiểm tra Tủ lạnh trước khi tiếp tục; không gửi một lần trừ mới.',
          'This request ID already matches different data. Check your Fridge before continuing; do not submit a new deduction.',
        ),
        recoverable: false,
      };
    if (error.code === 'RECIPE_VERSION_UNAVAILABLE' || error.code === 'RECIPE_VERSION_REQUIRED')
      return {
        message: lSync(
          'Chưa xác nhận được phiên bản công thức đã nấu. Giữ nguyên yêu cầu và kiểm tra lại trước khi tiếp tục.',
          'Could not confirm the cooked recipe version. Keep this request as-is and review before continuing.',
        ),
        recoverable: false,
      };
    if (error.kind === 'http' && [400, 409, 422].includes(error.status ?? 0)) {
      const locale = getActiveAppLocale();
      const fallback = lSync(
        'Yêu cầu chưa được chấp nhận. Hãy tải lại lượng trong tủ và kiểm tra số đã dùng.',
        'Request was not accepted. Reload your fridge quantities and check the amounts used.',
        locale,
      );
      if (locale === 'vi') {
        return {
          message: presentDomainError(error.code, fallback).message,
          recoverable: true,
        };
      }
      const mapped = error.code ? DOMAIN_ERRORS_EN[error.code] : undefined;
      const fromDomain = presentDomainError(error.code, fallback).message;
      return {
        message: mapped ?? (containsVietnameseDiacritics(fromDomain) ? fallback : fromDomain),
        recoverable: true,
      };
    }
  }
  return {
    message: lSync(
      'Chưa xác nhận được kết quả từ máy chủ. Lượng đã gửi được giữ nguyên; thử lại cùng yêu cầu để tránh trừ hai lần.',
      'Could not confirm the server response. Your submitted amounts are preserved; retry the same request to avoid deducting twice.',
    ),
    recoverable: false,
  };
}
