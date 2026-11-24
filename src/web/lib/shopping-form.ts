import type { SupportedLocale } from '../../shared/locales';
import { getActiveAppLocale } from '../i18n/LocaleContext';
import { getActiveBcp47, localizeUnit, lSync, translateEnForLocale } from '../i18n/app-i18n';

export const SHOPPING_UNITS = [
  { value: 'piece', label: 'Cái / quả / bìa' },
  { value: 'g', label: 'Gam (g)' },
  { value: 'kg', label: 'Kilôgam (kg)' },
  { value: 'ml', label: 'Mililít (ml)' },
  { value: 'l', label: 'Lít (l)' },
  { value: 'bunch', label: 'Bó' },
  { value: 'pack', label: 'Gói' },
  { value: 'slice', label: 'Lát' },
] as const;

export const SHOPPING_UNITS_EN = [
  { value: 'piece', label: 'Pieces' },
  { value: 'g', label: 'Grams (g)' },
  { value: 'kg', label: 'Kilograms (kg)' },
  { value: 'ml', label: 'Milliliters (ml)' },
  { value: 'l', label: 'Liters (L)' },
  { value: 'bunch', label: 'Bunches' },
  { value: 'pack', label: 'Packs' },
  { value: 'slice', label: 'Slices' },
] as const;

export function getShoppingUnits(locale: SupportedLocale = getActiveAppLocale()) {
  if (locale === 'vi') return SHOPPING_UNITS;
  if (locale === 'en') return SHOPPING_UNITS_EN;
  return SHOPPING_UNITS_EN.map((entry) => {
    const translated = translateEnForLocale(entry.label, locale);
    return {
      value: entry.value,
      label: translated !== entry.label ? translated : localizeUnit(entry.value, locale),
    };
  });
}

export function parseShoppingForm(name: string, quantity: string, unit: string) {
  const amount = quantity.trim() === '' ? NaN : Number(quantity);
  if (
    !name.trim() ||
    name.trim().length > 100 ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    !SHOPPING_UNITS.some((entry) => entry.value === unit)
  )
    return null;
  return {
    name: name.trim(),
    quantity: amount,
    unit: unit as (typeof SHOPPING_UNITS)[number]['value'],
  };
}

const countedUnits = new Set(['piece', 'bunch', 'pack', 'slice']);
const familiarFractions = [
  [1, 2],
  [1, 3],
  [2, 3],
  [1, 4],
  [3, 4],
  [1, 6],
  [5, 6],
] as const;

export function shoppingQuantity(
  quantity: number,
  unit: string,
  locale: SupportedLocale = getActiveAppLocale(),
) {
  const isVi = locale === 'vi';
  const viLabels: Record<string, string> = {
    piece: 'cái / quả / bìa',
    bunch: 'bó',
    pack: 'gói',
    slice: 'lát',
  };
  const unitLabel = isVi ? (viLabels[unit] ?? unit) : localizeUnit(unit, locale);
  if (countedUnits.has(unit)) {
    const whole = Math.floor(quantity);
    const remainder = quantity - whole;
    const fraction = familiarFractions.find(
      ([numerator, denominator]) =>
        remainder > 0 && Math.abs(remainder - numerator / denominator) <= 1e-12,
    );
    if (fraction) return `${whole ? `${whole} ` : ''}${fraction[0]}/${fraction[1]} ${unitLabel}`;
  }
  const digits = unit === 'kg' || unit === 'l' ? 3 : 2;
  // Preserve a visible positive value below the normal display precision.
  const options: Intl.NumberFormatOptions =
    quantity >= 10 ** -digits
      ? { maximumFractionDigits: digits, useGrouping: false }
      : {
          maximumSignificantDigits: 3,
          useGrouping: false,
          notation: quantity < 1e-6 ? 'scientific' : 'standard',
        };
  const displayed = new Intl.NumberFormat(getActiveBcp47(locale), options).format(quantity);
  const rounded = Number(new Intl.NumberFormat('en-US', options).format(quantity));
  const approxPrefix = `${lSync('Khoảng', 'About', locale)} `;
  return `${rounded === quantity ? '' : approxPrefix}${displayed} ${unitLabel}`;
}
