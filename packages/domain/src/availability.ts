import { z } from 'zod';
import {
  CanonicalIngredientIdSchema, PositiveQuantitySchema, StandardUnitSchema, UNIT_DEFINITIONS,
} from './foundation';
import { areUnitsCompatible, type StandardUnit } from './units';
import { convertQuantity, Quantity, QuantityRangeError } from './quantity';

export type AvailabilityStatus = 'satisfied' | 'partial' | 'missing' | 'unresolved';
export type AvailabilityReason =
  | 'unknown_canonical' | 'invalid_inventory' | 'duplicate_lot' | 'incompatible_unit'
  | 'context_required' | 'expired' | 'unavailable' | 'expiry_review_required' | 'numeric_range';
export interface InventoryDiagnostic {
  rowIndex: number;
  lotId: string | null;
  ingredientId: string | null;
  code: AvailabilityReason | 'duplicate_ignored' | 'household_mismatch';
}
export interface IngredientDemand {
  ingredientId: string;
  requiredQuantity: number;
  unit: StandardUnit;
}
export interface LotAllocation {
  lotId: string;
  ingredientId: string;
  quantity: number;
  unit: StandardUnit;
  contributedQuantity: number;
  contributedUnit: StandardUnit;
  freshness: string | null;
  expiryDate: string | null;
  expiryKind: 'unknown' | 'best_before' | 'use_by' | 'estimated';
}
/** T02 defaults to lot IDs; T04 can explicitly request its documented FEFO witness. */
export type LotAllocationPolicy = 'lot_id' | 'expiry_first';
export interface IngredientAvailability extends IngredientDemand {
  status: AvailabilityStatus;
  availableQuantity: number;
  availableUnit: StandardUnit;
  availabilityComplete: boolean;
  missingQuantity: number | null;
  conversionStatus: 'physical' | 'count_identity' | 'unresolved' | 'none';
  reasons: AvailabilityReason[];
  unresolvedLotIds: string[];
  lotsUsed: LotAllocation[];
}

const LotSchema = z.object({
  id: z.string().min(1).max(200).refine((id) => id === id.trim() && !id.includes('\0')),
  ingredientId: CanonicalIngredientIdSchema,
  householdId: z.string().min(1).optional(),
  quantity: z.union([PositiveQuantitySchema, z.literal(0)]),
  unit: StandardUnitSchema,
  freshness: z.enum(['fresh', 'use_soon', 'expiring', 'out_of_stock']).optional(),
  expiryDate: z.string().date().nullish(),
  expiryKind: z.enum(['unknown', 'best_before', 'use_by', 'estimated']).default('unknown'),
}).refine((lot) => lot.expiryKind === 'unknown' || Boolean(lot.expiryDate), {
  message: 'Expiry evidence requires a date',
});
type Lot = z.infer<typeof LotSchema>;
interface IndexedLot extends Lot { baseUnit: StandardUnit; baseQuantity: Quantity }
interface IngredientStock {
  lots: IndexedLot[];
  uncertain: Array<{ lotId: string | null; reason: AvailabilityReason }>;
  unavailable: AvailabilityReason[];
}
export interface InventoryAvailabilityIndex {
  readonly ingredientIds: ReadonlySet<string>;
  readonly byIngredient: ReadonlyMap<string, IngredientStock>;
  readonly diagnostics: readonly InventoryDiagnostic[];
  readonly asOfDate: string;
}
const DemandSchema = z.object({
  ingredientId: CanonicalIngredientIdSchema,
  requiredQuantity: PositiveQuantitySchema,
  unit: StandardUnitSchema,
});
const ZERO = Quantity.from(0);
export const compareIds = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;

export function buildInventoryAvailability(
  rows: readonly unknown[],
  options: { ingredientIds: readonly string[]; asOfDate: string; householdId?: string; allocationPolicy?: LotAllocationPolicy },
): InventoryAvailabilityIndex {
  z.string().date().parse(options.asOfDate);
  const allocationPolicy = z.enum(['lot_id', 'expiry_first']).parse(options.allocationPolicy ?? 'lot_id');
  const ingredientIds = new Set(z.array(CanonicalIngredientIdSchema).parse(options.ingredientIds));
  const byIngredient = new Map<string, IngredientStock>();
  const diagnostics: InventoryDiagnostic[] = [];
  const groups = new Map<string, Array<{ rowIndex: number; row: Record<string, unknown> }>>();
  const stock = (id: string): IngredientStock => {
    let entry = byIngredient.get(id);
    if (!entry) { entry = { lots: [], uncertain: [], unavailable: [] }; byIngredient.set(id, entry); }
    return entry;
  };
  const report = (rowIndex: number, row: Record<string, unknown>, code: InventoryDiagnostic['code']) => {
    const ingredientId = typeof row.ingredientId === 'string' ? row.ingredientId : null;
    const lotId = typeof row.id === 'string' ? row.id : null;
    diagnostics.push({ rowIndex, ingredientId, lotId, code });
    if (ingredientId && ingredientIds.has(ingredientId) &&
        code !== 'duplicate_ignored' && code !== 'household_mismatch') {
      const entry = stock(ingredientId);
      if (code === 'expired' || code === 'unavailable') entry.unavailable.push(code);
      else entry.uncertain.push({ lotId, reason: code });
    }
  };
  const householdIds = new Set<string>();
  rows.forEach((raw, rowIndex) => {
    const parsed = z.record(z.string(), z.unknown()).safeParse(raw);
    if (!parsed.success) { report(rowIndex, {}, 'invalid_inventory'); return; }
    const row = parsed.data;
    if (options.householdId !== undefined && row.householdId !== options.householdId) {
      report(rowIndex, row, 'household_mismatch'); return;
    }
    if (typeof row.householdId === 'string') householdIds.add(row.householdId);
    if (typeof row.id !== 'string' || !row.id) { report(rowIndex, row, 'invalid_inventory'); return; }
    const group = groups.get(row.id) ?? [];
    group.push({ rowIndex, row });
    groups.set(row.id, group);
  });
  if (householdIds.size > 1) throw new Error('Inventory must be scoped to one authorized household');

  for (const [, group] of [...groups].sort(([a], [b]) => compareIds(a, b))) {
    const parsed = group.map(({ row }) => LotSchema.safeParse(row));
    if (group.length > 1 && (parsed.some((row) => !row.success) ||
        new Set(parsed.map((row) => row.success ? JSON.stringify(row.data) : '')).size > 1)) {
      group.forEach(({ rowIndex, row }) => report(rowIndex, row, 'duplicate_lot'));
      continue;
    }
    const first = parsed[0];
    const { rowIndex, row } = group[0];
    if (!first.success) { report(rowIndex, row, 'invalid_inventory'); continue; }
    const lot = first.data;
    if (!ingredientIds.has(lot.ingredientId)) { report(rowIndex, row, 'unknown_canonical'); continue; }
    group.slice(1).forEach(({ rowIndex: duplicateIndex, row: duplicate }) =>
      report(duplicateIndex, duplicate, 'duplicate_ignored'));
    if (lot.quantity === 0 || lot.freshness === 'out_of_stock') {
      report(rowIndex, row, 'unavailable'); continue;
    }
    if (lot.expiryDate && lot.expiryDate < options.asOfDate) {
      if (lot.expiryKind === 'use_by') { report(rowIndex, row, 'expired'); continue; }
      if (lot.expiryKind !== 'best_before') { report(rowIndex, row, 'expiry_review_required'); continue; }
    }
    const baseUnit = UNIT_DEFINITIONS[lot.unit].baseUnit;
    try {
      const baseQuantity = convertQuantity(Quantity.from(lot.quantity), lot.unit, baseUnit);
      baseQuantity.toNumber();
      stock(lot.ingredientId).lots.push({ ...lot, baseUnit, baseQuantity });
    } catch (error) {
      if (!(error instanceof QuantityRangeError)) throw error;
      report(rowIndex, row, 'numeric_range');
    }
  }
  const expiryOrder = (lot: IndexedLot): [number, string, string] => {
    if (lot.expiryKind === 'use_by' && lot.expiryDate) return [0, lot.expiryDate, lot.id];
    if (lot.expiryKind === 'best_before' && lot.expiryDate) return [1, lot.expiryDate, lot.id];
    if (lot.expiryKind === 'estimated' && lot.expiryDate) return [2, lot.expiryDate, lot.id];
    return [3, '', lot.id];
  };
  for (const entry of byIngredient.values()) {
    entry.lots.sort((a, b) => {
      if (allocationPolicy !== 'expiry_first') return compareIds(a.id, b.id);
      const left = expiryOrder(a);
      const right = expiryOrder(b);
      return left[0] - right[0] || compareIds(left[1], right[1]) || compareIds(left[2], right[2]);
    });
  }
  diagnostics.sort((a, b) => a.rowIndex - b.rowIndex || compareIds(a.code, b.code));
  return { ingredientIds, byIngredient, diagnostics, asOfDate: options.asOfDate };
}

// Reservations are per-candidate feasibility witnesses, never persisted consumption or FEFO plans.
export function createAvailabilitySession(index: InventoryAvailabilityIndex) {
  const reserved = new Map<string, Quantity>();
  const evaluate = (input: IngredientDemand, reserve: boolean): IngredientAvailability => {
    const demand = DemandSchema.parse(input);
    const required = Quantity.from(demand.requiredQuantity);
    const entry = index.byIngredient.get(demand.ingredientId);
    const reasons = new Set<AvailabilityReason>(entry?.unavailable ?? []);
    const unresolvedIds = new Set<string>();
    let uncertain = false;
    for (const issue of entry?.uncertain ?? []) {
      uncertain = true; reasons.add(issue.reason);
      if (issue.lotId) unresolvedIds.add(issue.lotId);
    }
    if (!index.ingredientIds.has(demand.ingredientId)) {
      uncertain = true; reasons.add('unknown_canonical');
    }
    const usable: Array<{ lot: IndexedLot; remaining: Quantity; converted: Quantity }> = [];
    let available = ZERO;
    for (const lot of entry?.lots ?? []) {
      const remaining = lot.baseQuantity.subtract(reserved.get(lot.id) ?? ZERO);
      if (remaining.isZero()) continue;
      const contextual = UNIT_DEFINITIONS[lot.unit].dimension === 'contextual' ||
        UNIT_DEFINITIONS[demand.unit].dimension === 'contextual';
      if (contextual || !areUnitsCompatible(lot.baseUnit, demand.unit)) {
        uncertain = true;
        reasons.add(contextual ? 'context_required' : 'incompatible_unit');
        unresolvedIds.add(lot.id);
        continue;
      }
      const converted = convertQuantity(remaining, lot.baseUnit, demand.unit);
      available = available.add(converted);
      usable.push({ lot, remaining, converted });
    }
    let availableQuantity: number;
    try { availableQuantity = available.toNumber(); }
    catch (error) {
      if (!(error instanceof QuantityRangeError)) throw error;
      return { ...demand, availableQuantity: 0, availableUnit: demand.unit, availabilityComplete: false,
        status: 'unresolved', missingQuantity: null, conversionStatus: 'unresolved',
        reasons: [...reasons, 'numeric_range'], unresolvedLotIds: (entry?.lots ?? []).map((lot) => lot.id), lotsUsed: [] };
    }
    const satisfied = available.compare(required) >= 0;
    const status: AvailabilityStatus = satisfied ? 'satisfied' : uncertain ? 'unresolved'
      : available.isZero() ? 'missing' : 'partial';
    let remainingDemand = required;
    const lotsUsed: LotAllocation[] = [];
    const reservations: Array<[string, Quantity]> = [];
    for (const { lot, converted } of usable) {
      if (remainingDemand.isZero()) break;
      const taken = converted.min(remainingDemand);
      const baseTaken = convertQuantity(taken, demand.unit, lot.baseUnit);
      lotsUsed.push({ lotId: lot.id, ingredientId: lot.ingredientId,
        quantity: convertQuantity(taken, demand.unit, lot.unit).toNumber(), unit: lot.unit,
        contributedQuantity: taken.toNumber(), contributedUnit: demand.unit,
        freshness: lot.freshness ?? null, expiryDate: lot.expiryDate ?? null, expiryKind: lot.expiryKind });
      reservations.push([lot.id, baseTaken]);
      remainingDemand = remainingDemand.subtract(taken);
    }
    const missingQuantity = satisfied ? 0 : uncertain ? null : required.subtract(available).toNumber();
    if (reserve) for (const [id, amount] of reservations) reserved.set(id, (reserved.get(id) ?? ZERO).add(amount));
    return { ...demand, status, availableQuantity, availableUnit: demand.unit,
      availabilityComplete: !uncertain, missingQuantity,
      conversionStatus: status === 'unresolved' ? 'unresolved' : usable.length === 0 ? 'none'
        : UNIT_DEFINITIONS[demand.unit].dimension === 'count' ? 'count_identity' : 'physical',
      reasons: [...reasons].sort(compareIds), unresolvedLotIds: [...unresolvedIds].sort(compareIds), lotsUsed };
  };
  return {
    peek: (demand: IngredientDemand) => evaluate(demand, false),
    take: (demand: IngredientDemand) => evaluate(demand, true),
  };
}

export function evaluateIngredientAvailability(
  index: InventoryAvailabilityIndex, demand: IngredientDemand,
): IngredientAvailability {
  return createAvailabilitySession(index).peek(demand);
}
