import { Quantity, areUnitsCompatible, convertQuantity, isStandardUnit } from '@frigo/domain';

export function inventoryQuantityStep(unit: string): number {
  if (unit === 'kg' || unit === 'l') return 0.05;
  if (unit === 'g' || unit === 'ml') return 50;
  return 1;
}

export function convertedInventoryQuantity(quantity: number, from: string, to: string): number | null {
  if (!Number.isFinite(quantity) || quantity <= 0 || !isStandardUnit(from) || !isStandardUnit(to)
    || !areUnitsCompatible(from, to)) return null;
  return convertQuantity(Quantity.from(quantity), from, to).toNumber();
}

export function adjustedInventoryQuantity(quantity: number, delta: number): number | null {
  const next = Quantity.from(quantity).add(Quantity.from(delta)).toNumber();
  return next > 0 && next <= 10000 ? next : null;
}
