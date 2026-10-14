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

export function shoppingQuantity(quantity: number, unit: string) {
  const labels: Record<string, string> = {
    piece: 'cái / quả / bìa',
    bunch: 'bó',
    pack: 'gói',
    slice: 'lát',
  };
  const unitLabel = labels[unit] ?? unit;
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
  const displayed = new Intl.NumberFormat('vi-VN', options).format(quantity);
  const rounded = Number(new Intl.NumberFormat('en-US', options).format(quantity));
  return `${rounded === quantity ? '' : 'Khoảng '}${displayed} ${unitLabel}`;
}
