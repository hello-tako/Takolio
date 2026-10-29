import { z } from 'zod';
import { compareIds, type LotAllocation } from '../../domain/src/availability';
import { OffsetDateTimeSchema, CanonicalIngredientIdSchema, PositiveQuantitySchema, StandardUnitSchema } from '../../domain/src/foundation';
import { Quantity, QuantityRangeError } from '../../domain/src/quantity';
import type { RecipeCandidate } from './candidates';

const QuantitySchema = z.union([PositiveQuantitySchema, z.literal(0)]);
const LotIdSchema = z.string().min(1).max(200).refine((value) => value === value.trim() && !value.includes('\0'));
const HouseholdIdSchema = z.string().min(1).max(200).refine((value) => value === value.trim() && !value.includes('\0'));
const ExpiryKindSchema = z.enum(['unknown', 'best_before', 'use_by', 'estimated']);
const LegacyDateTimeSchema = z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  .refine((value) => {
    const instant = new Date(`${value.replace(' ', 'T')}Z`);
    return Number.isFinite(instant.getTime()) && instant.toISOString().startsWith(value.slice(0, 10));
  }, 'Invalid legacy inventory datetime');
const CalendarOrDateTimeSchema = z.union([z.string().date(), OffsetDateTimeSchema, LegacyDateTimeSchema]);

/** Server-owned inventory snapshot used to seed a pure planner projection. */
export const InventoryLotSnapshotSchema = z.object({
  id: LotIdSchema,
  householdId: HouseholdIdSchema,
  version: z.number().int().safe().positive(),
  // Empty represents an explicitly unmapped lot; it is never a candidate allocation target.
  ingredientId: z.union([CanonicalIngredientIdSchema, z.literal('')]),
  quantity: QuantitySchema,
  unit: StandardUnitSchema,
  freshness: z.enum(['fresh', 'use_soon', 'expiring', 'out_of_stock']).nullable(),
  expiryDate: z.string().date().nullable(),
  expiryKind: ExpiryKindSchema,
  storage: z.enum(['fridge', 'freezer', 'pantry']).optional(),
  openedAt: OffsetDateTimeSchema.nullish(),
  expirySource: z.enum(['unknown', 'user', 'ocr', 'imported', 'estimated']).optional(),
  addedDate: CalendarOrDateTimeSchema.optional(),
  updatedAt: CalendarOrDateTimeSchema.optional(),
}).strict().superRefine((lot, context) => {
  if (lot.expiryKind !== 'unknown' && lot.expiryDate === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Known expiry kind requires an expiry date' });
  }
  if (lot.expirySource !== undefined && lot.expirySource !== 'unknown' && lot.expiryDate === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Known expiry source requires an expiry date' });
  }
});
export type InventoryLotSnapshot = z.infer<typeof InventoryLotSnapshotSchema>;

export interface ProjectedInventoryRow extends InventoryLotSnapshot {
  /** The remaining native quantity; suitable for the next T02 candidate regeneration. */
  quantity: number;
  initialQuantity: number;
  consumedQuantity: number;
}

export interface ProjectedInventoryDelta {
  lotId: string;
  ingredientId: string;
  householdId: string;
  version: number;
  unit: InventoryLotSnapshot['unit'];
  previousQuantity: number;
  consumedQuantity: number;
  remainingQuantity: number;
  freshness: InventoryLotSnapshot['freshness'];
  expiryDate: string | null;
  expiryKind: InventoryLotSnapshot['expiryKind'];
  storage?: InventoryLotSnapshot['storage'];
  openedAt?: InventoryLotSnapshot['openedAt'];
  expirySource?: InventoryLotSnapshot['expirySource'];
  addedDate?: InventoryLotSnapshot['addedDate'];
  updatedAt?: InventoryLotSnapshot['updatedAt'];
}

export class InventoryProjectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InventoryProjectionError';
  }
}

/** A projection cannot safely manufacture a zero for an unrepresentable exact quantity. */
export class InventoryProjectionNumericError extends InventoryProjectionError {
  constructor(message: string) {
    super(message);
    this.name = 'InventoryProjectionNumericError';
  }
}

interface LotBalance {
  readonly lot: InventoryLotSnapshot;
  readonly initial: Quantity;
  readonly consumed: Quantity;
}

declare const projectionBrand: unique symbol;
export interface ProjectedInventory {
  readonly [projectionBrand]: true;
  readonly householdId: string;
  readonly asOfDate: string;
  readonly lotCount: number;
}
const projectionData = new WeakMap<ProjectedInventory, ReadonlyMap<string, LotBalance>>();

function projection(householdId: string, asOfDate: string, lots: ReadonlyMap<string, LotBalance>): ProjectedInventory {
  const state = Object.freeze({ householdId, asOfDate, lotCount: lots.size }) as ProjectedInventory;
  projectionData.set(state, new Map(lots));
  return state;
}

function balancesFor(state: ProjectedInventory): ReadonlyMap<string, LotBalance> {
  const balances = projectionData.get(state);
  if (!balances) throw new InventoryProjectionError('Invalid projected inventory state');
  return balances;
}

export function createProjectedInventory(
  rows: readonly unknown[],
  options: { householdId?: string; asOfDate: string },
): ProjectedInventory {
  const asOfDate = z.string().date().parse(options.asOfDate);
  const lots = z.array(InventoryLotSnapshotSchema).parse(rows);
  const householdIds = new Set(lots.map((lot) => lot.householdId));
  if (householdIds.size > 1) throw new InventoryProjectionError('Inventory projection must contain one household');
  const householdId = lots[0]?.householdId ?? options.householdId;
  if (!householdId) throw new InventoryProjectionError('Inventory projection requires an authorized household');
  if (options.householdId !== undefined && householdId !== options.householdId) {
    throw new InventoryProjectionError('Inventory projection household does not match authorized household');
  }
  const balances = new Map<string, LotBalance>();
  for (const lot of lots) {
    if (balances.has(lot.id)) throw new InventoryProjectionError(`Duplicate inventory lot ${lot.id}`);
    balances.set(lot.id, Object.freeze({ lot: Object.freeze({ ...lot }), initial: Quantity.from(lot.quantity), consumed: Quantity.from(0) }));
  }
  return projection(householdId, asOfDate, balances);
}

function numberFor(quantity: Quantity): number {
  try {
    return quantity.toNumber();
  } catch (error) {
    if (error instanceof QuantityRangeError) throw new InventoryProjectionNumericError(error.message);
    throw error;
  }
}

function remainingFor(balance: LotBalance): Quantity {
  return balance.initial.subtract(balance.consumed);
}

function unavailableForProjection(lot: InventoryLotSnapshot, asOfDate: string): boolean {
  if (lot.quantity === 0 || lot.freshness === 'out_of_stock') return true;
  if (!lot.expiryDate || lot.expiryDate >= asOfDate) return false;
  // Match T02 availability: old best-before lots are not automatically discarded,
  // while expired use-by and unreviewed estimated expiry may not be allocated.
  return lot.expiryKind !== 'best_before';
}

export function projectInventoryRows(state: ProjectedInventory): readonly ProjectedInventoryRow[] {
  return [...balancesFor(state).values()]
    .sort((left, right) => compareIds(left.lot.id, right.lot.id))
    .map((balance) => Object.freeze({
      ...balance.lot,
      quantity: numberFor(remainingFor(balance)),
      initialQuantity: numberFor(balance.initial),
      consumedQuantity: numberFor(balance.consumed),
    }));
}

function sameWitnessMetadata(allocation: LotAllocation, lot: InventoryLotSnapshot): boolean {
  return (allocation.freshness ?? null) === lot.freshness && allocation.expiryDate === lot.expiryDate &&
    allocation.expiryKind === lot.expiryKind;
}

/** Applies the exact native-unit T02 witness; it never reallocates or estimates consumption. */
export function applyProjectedConsumption(
  state: ProjectedInventory,
  candidate: Pick<RecipeCandidate, 'lotAllocations'>,
  asOfDate: string = state.asOfDate,
): { state: ProjectedInventory; deltas: readonly ProjectedInventoryDelta[] } {
  z.string().date().parse(asOfDate);
  if (asOfDate < state.asOfDate) throw new InventoryProjectionError('Projected consumption cannot travel backwards in time');
  const requested = new Map<string, Quantity>();
  for (const allocation of candidate.lotAllocations) {
    if (!Number.isFinite(allocation.quantity) || allocation.quantity <= 0) {
      throw new InventoryProjectionError(`Invalid projected allocation for lot ${allocation.lotId}`);
    }
    const balance = balancesFor(state).get(allocation.lotId);
    if (!balance || balance.lot.ingredientId !== allocation.ingredientId || balance.lot.unit !== allocation.unit ||
        !sameWitnessMetadata(allocation, balance.lot)) {
      throw new InventoryProjectionError(`Allocation witness does not match projected lot ${allocation.lotId}`);
    }
    if (unavailableForProjection(balance.lot, asOfDate)) {
      throw new InventoryProjectionError(`Allocation witness targets unavailable lot ${allocation.lotId}`);
    }
    const amount = Quantity.from(allocation.quantity);
    requested.set(allocation.lotId, (requested.get(allocation.lotId) ?? Quantity.from(0)).add(amount));
  }

  const current = balancesFor(state);
  const next = new Map(current);
  const deltas: ProjectedInventoryDelta[] = [];
  for (const [lotId, amount] of [...requested].sort(([left], [right]) => compareIds(left, right))) {
    const balance = current.get(lotId);
    if (!balance) throw new InventoryProjectionError(`Unknown projected lot ${lotId}`);
    const previous = remainingFor(balance);
    if (previous.compare(amount) < 0) {
      if (Quantity.from(numberFor(previous)).compare(amount) >= 0) {
        throw new InventoryProjectionNumericError(`Rounded T02 boundary would overconsume lot ${lotId}`);
      }
      throw new InventoryProjectionError(`Allocation would overconsume lot ${lotId}`);
    }
    const consumed = balance.consumed.add(amount);
    const remaining = balance.initial.subtract(consumed);
    next.set(lotId, Object.freeze({ ...balance, consumed }));
    deltas.push(Object.freeze({
      lotId,
      ingredientId: balance.lot.ingredientId,
      householdId: balance.lot.householdId,
      version: balance.lot.version,
      unit: balance.lot.unit,
      previousQuantity: numberFor(previous),
      consumedQuantity: numberFor(amount),
      remainingQuantity: numberFor(remaining),
      freshness: balance.lot.freshness,
      expiryDate: balance.lot.expiryDate,
      expiryKind: balance.lot.expiryKind,
      ...(balance.lot.storage === undefined ? {} : { storage: balance.lot.storage }),
      ...(balance.lot.openedAt === undefined ? {} : { openedAt: balance.lot.openedAt }),
      ...(balance.lot.expirySource === undefined ? {} : { expirySource: balance.lot.expirySource }),
      ...(balance.lot.addedDate === undefined ? {} : { addedDate: balance.lot.addedDate }),
      ...(balance.lot.updatedAt === undefined ? {} : { updatedAt: balance.lot.updatedAt }),
    }));
  }
  return { state: projection(state.householdId, asOfDate, next), deltas };
}
