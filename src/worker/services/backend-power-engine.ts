import {
  areUnitsCompatible,
  convertUnit,
  findCanonicalIngredient,
  type StandardUnit,
} from '@frigo/domain';
import type { D1DatabaseBinding, D1PreparedStatement } from '@frigo/db';
import {
  resolveRecipeArtworkV4,
  type Recipe,
  type RecipeIngredient,
  type RecipeStep,
} from '@frigo/recipes';
import { sha256Hex } from '../utils/session';

export const DEFAULT_WEEKLY_BUDGET_VND = 1_200_000;
export const FALLBACK_HEIRLOOM_POSTER_URL = '/takolio/v5/posters/claypot-poster.webp';

const STANDARD_UNITS = new Set<StandardUnit>([
  'g',
  'kg',
  'ml',
  'l',
  'piece',
  'pack',
  'bunch',
  'slice',
]);

export interface EssentialVietnameseStapleSeed {
  name: string;
  ingredientId: string;
  category: string;
  storage: 'fridge' | 'freezer' | 'pantry';
  unit: StandardUnit;
  minQuantity: number;
  targetQuantity: number;
}

export const VIETNAMESE_ESSENTIAL_STAPLES: readonly EssentialVietnameseStapleSeed[] = Object.freeze([
  {
    name: 'Nước mắm nhĩ',
    ingredientId: 'FISH_SAUCE',
    category: 'seasoning',
    storage: 'pantry',
    unit: 'ml',
    minQuantity: 250,
    targetQuantity: 750,
  },
  {
    name: 'Gạo thơm ST25',
    ingredientId: 'RICE',
    category: 'grain',
    storage: 'pantry',
    unit: 'kg',
    minQuantity: 2,
    targetQuantity: 5,
  },
  {
    name: 'Dầu ăn thực vật',
    ingredientId: 'COOKING_OIL',
    category: 'seasoning',
    storage: 'pantry',
    unit: 'ml',
    minQuantity: 250,
    targetQuantity: 1000,
  },
  {
    name: 'Tỏi khô',
    ingredientId: 'GARLIC',
    category: 'spice',
    storage: 'pantry',
    unit: 'g',
    minQuantity: 100,
    targetQuantity: 300,
  },
  {
    name: 'Hành tím',
    ingredientId: 'SHALLOT',
    category: 'spice',
    storage: 'pantry',
    unit: 'g',
    minQuantity: 100,
    targetQuantity: 300,
  },
  {
    name: 'Trứng gà ta',
    ingredientId: 'CHICKEN_EGG',
    category: 'egg',
    storage: 'fridge',
    unit: 'piece',
    minQuantity: 4,
    targetQuantity: 10,
  },
  {
    name: 'Đường vàng',
    ingredientId: 'SUGAR',
    category: 'seasoning',
    storage: 'pantry',
    unit: 'g',
    minQuantity: 200,
    targetQuantity: 500,
  },
  {
    name: 'Hạt nêm xương',
    ingredientId: 'SEASONING_POWDER',
    category: 'seasoning',
    storage: 'pantry',
    unit: 'g',
    minQuantity: 150,
    targetQuantity: 400,
  },
]);

export interface HouseholdScope {
  householdId: string;
  userId: string;
}

export interface LiveStockRow {
  id: string;
  ingredientId: string | null;
  name: string;
  quantity: number;
  unit: StandardUnit;
  category: string;
  storage: 'fridge' | 'freezer' | 'pantry';
  expiryDate: string | null;
}

export interface ExpiringStockItemDto {
  id: string;
  name: string;
  quantity: number;
  unit: StandardUnit;
  category: string;
  storage: 'fridge' | 'freezer' | 'pantry';
  expiryDate: string;
  daysUntilExpiry: number;
}

export interface PantryThresholdStatusDto {
  id: string;
  householdId: string;
  ingredientId: string | null;
  name: string;
  category: string;
  storage: 'fridge' | 'freezer' | 'pantry';
  unit: string;
  minQuantity: number;
  targetQuantity: number;
  currentQuantity: number;
  restockQuantity: number;
  isLowStock: boolean;
  autoAddShopping: boolean;
  updatedAt: string;
}

export interface ActivityEventDto {
  id: string;
  householdId: string;
  actorId: string;
  actorName: string;
  eventKind: string;
  summaryVi: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface HeirloomRecipeRow {
  id: string;
  household_id: string;
  author_user_id: string;
  slug: string;
  title: string;
  description: string;
  region: 'bac' | 'trung' | 'nam' | 'all';
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  prep_time_minutes: number;
  cook_time_minutes: number;
  servings: number;
  ingredients_json: string;
  steps_json: string;
  chef_secret: string | null;
  family_story: string | null;
  is_pinned: number;
  cooked_count: number;
  created_at: string;
  updated_at: string;
}

export function normalizeViText(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function slugifyVietnameseTitle(title: string): string {
  const base = normalizeViText(title)
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 44)
    .replace(/-$/g, '');
  return base || 'mon-gia-truyen';
}

export function toStandardUnit(rawUnit: string | undefined, fallback: StandardUnit = 'piece'): StandardUnit {
  const cleaned = (rawUnit || '').trim().toLowerCase();
  if (STANDARD_UNITS.has(cleaned as StandardUnit)) {
    return cleaned as StandardUnit;
  }
  const normalized = normalizeViText(cleaned);
  if (normalized === 'gram' || normalized === 'gr' || normalized === 'gam') return 'g';
  if (normalized === 'kilogram' || normalized === 'ky') return 'kg';
  if (normalized === 'lit') return 'l';
  if (normalized === 'ml' || normalized.includes('muong') || normalized.includes('thia')) return 'ml';
  if (['qua', 'trai', 'cu', 'con', 'cai', 'phan', 'chen', 'bat'].includes(normalized)) return 'piece';
  if (['bo', 'mo', 'nhanh', 'tep'].includes(normalized)) return 'bunch';
  if (['goi', 'hop', 'vi', 'chai', 'lon', 'tui', 'hu'].includes(normalized)) return 'pack';
  if (['lat', 'mieng', 'khuc'].includes(normalized)) return 'slice';
  return fallback;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .filter((k) => record[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableJson(record[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function matchesIfNoneMatch(headerValue: string | undefined, currentEtag: string): boolean {
  if (!headerValue) return false;
  const trimmed = headerValue.trim();
  if (trimmed === '*') return true;
  const stripWeak = (tag: string) => tag.trim().replace(/^W\//i, '');
  const target = stripWeak(currentEtag);
  return trimmed
    .split(',')
    .map((candidate) => stripWeak(candidate))
    .some((candidate) => candidate === target);
}

function parseExpiryEpochMs(expiryDate: string | null | undefined): number | null {
  if (!expiryDate) return null;
  const raw = expiryDate.trim();
  if (!raw) return null;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00.000Z` : raw;
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapRawLotsAndItems(
  isAdoptedFlag: boolean,
  lotRows: Array<{
    id: string;
    ingredient_id: string | null;
    name: string;
    quantity_milli: number;
    canonical_unit: string;
    category: string | null;
    storage: string | null;
    expiry_date: string | null;
  }>,
  itemRows: Array<{
    id: string;
    ingredient_id: string | null;
    name: string;
    quantity: number;
    unit: string;
    category: string | null;
    storage: string | null;
    expiry_date: string | null;
  }>,
): { isAdopted: boolean; liveStock: LiveStockRow[] } {
  const useLots = isAdoptedFlag || lotRows.length > 0;
  if (useLots) {
    return {
      isAdopted: true,
      liveStock: lotRows.map((row) => ({
        id: row.id,
        ingredientId: row.ingredient_id,
        name: row.name,
        quantity: Number((Number(row.quantity_milli) / 1000).toFixed(3)),
        unit: toStandardUnit(row.canonical_unit, 'piece'),
        category: row.category || 'other',
        storage: (['fridge', 'freezer', 'pantry'].includes((row.storage || '').toLowerCase())
          ? (row.storage || 'fridge').toLowerCase()
          : 'fridge') as 'fridge' | 'freezer' | 'pantry',
        expiryDate: row.expiry_date ?? null,
      })),
    };
  }

  return {
    isAdopted: false,
    liveStock: itemRows.map((row) => ({
      id: row.id,
      ingredientId: row.ingredient_id,
      name: row.name,
      quantity: Number(row.quantity) || 0,
      unit: toStandardUnit(row.unit, 'piece'),
      category: row.category || 'other',
      storage: (['fridge', 'freezer', 'pantry'].includes((row.storage || '').toLowerCase())
        ? (row.storage || 'fridge').toLowerCase()
        : 'fridge') as 'fridge' | 'freezer' | 'pantry',
      expiryDate: row.expiry_date ?? null,
    })),
  };
}

function findExpiringWithin48h(liveStock: readonly LiveStockRow[], nowMs: number): ExpiringStockItemDto[] {
  const horizonMs = nowMs + 48 * 3_600_000;
  const todayMidnightMs = Date.parse(`${new Date(nowMs).toISOString().slice(0, 10)}T00:00:00.000Z`);
  const recentFloorMs = todayMidnightMs - 7 * 86_400_000;
  const out: ExpiringStockItemDto[] = [];

  for (const item of liveStock) {
    if (!item.expiryDate || item.quantity <= 0) continue;
    const expiryMs = parseExpiryEpochMs(item.expiryDate);
    if (expiryMs === null) continue;
    if (expiryMs >= recentFloorMs && expiryMs <= horizonMs) {
      const daysUntilExpiry = Math.round((expiryMs - todayMidnightMs) / 86_400_000);
      out.push({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        category: item.category,
        storage: item.storage,
        expiryDate: item.expiryDate,
        daysUntilExpiry,
      });
    }
  }

  return out.sort((a, b) => a.expiryDate.localeCompare(b.expiryDate) || a.id.localeCompare(b.id));
}

interface PantryThresholdRow {
  id: string;
  household_id: string;
  ingredient_id: string | null;
  name: string;
  category: string;
  storage: 'fridge' | 'freezer' | 'pantry';
  unit: string;
  min_quantity: number;
  target_quantity: number;
  auto_add_shopping: number;
  updated_at: string;
}

export function computeStapleStockStatuses(
  thresholds: readonly PantryThresholdRow[],
  liveStock: readonly LiveStockRow[],
): PantryThresholdStatusDto[] {
  return thresholds.map((staple) => {
    const stapleNorm = normalizeViText(staple.name);
    const stapleCanonicalId = staple.ingredient_id || findCanonicalIngredient(staple.name)?.id || null;
    const stapleStdUnit = toStandardUnit(staple.unit, 'piece');

    let currentQuantity = 0;
    for (const stock of liveStock) {
      if (stock.quantity <= 0) continue;
      const stockNorm = normalizeViText(stock.name);
      const stockCanonicalId = stock.ingredientId || findCanonicalIngredient(stock.name)?.id || null;

      const matchesById = Boolean(
        stapleCanonicalId && stockCanonicalId && stapleCanonicalId === stockCanonicalId,
      );
      const matchesByExactName = stapleNorm.length > 0 && stapleNorm === stockNorm;
      const matchesBySubstring =
        stapleNorm.length >= 4 &&
        stockNorm.length >= 4 &&
        (stockNorm.includes(stapleNorm) || stapleNorm.includes(stockNorm));

      if (!matchesById && !matchesByExactName && !matchesBySubstring) continue;

      if (areUnitsCompatible(stock.unit, stapleStdUnit)) {
        const converted = convertUnit(stock.quantity, stock.unit, stapleStdUnit);
        if (Number.isFinite(converted) && converted > 0) {
          currentQuantity += converted;
        }
      } else if (normalizeViText(stock.unit) === normalizeViText(staple.unit)) {
        currentQuantity += stock.quantity;
      }
    }

    const roundedCurrent = Number(currentQuantity.toFixed(2));
    const minQty = Number(staple.min_quantity);
    const targetQty = Math.max(minQty, Number(staple.target_quantity));
    const isLowStock = roundedCurrent < minQty;
    const restockQuantity = isLowStock
      ? Math.max(0.01, Number((targetQty - roundedCurrent).toFixed(2)))
      : 0;

    return {
      id: staple.id,
      householdId: staple.household_id,
      ingredientId: staple.ingredient_id ?? null,
      name: staple.name,
      category: staple.category,
      storage: staple.storage,
      unit: staple.unit,
      minQuantity: minQty,
      targetQuantity: targetQty,
      currentQuantity: roundedCurrent,
      restockQuantity,
      isLowStock,
      autoAddShopping: Boolean(staple.auto_add_shopping),
      updatedAt: staple.updated_at,
    };
  });
}

interface WasteEventRow {
  id: string;
  actor_id?: string;
  item_name: string;
  category: string;
  event_type: 'rescued' | 'expired_discarded' | 'composted' | 'leftover_saved';
  quantity: number;
  unit: string;
  estimated_value_vnd: number;
  co2_grams: number;
  occurred_at: string;
}

function summarizeZeroWaste(wasteRows: readonly WasteEventRow[], cookedMeals30d: number) {
  let vndSaved30d = 0;
  let vndWasted30d = 0;
  let co2SavedGrams30d = 0;
  let rescuedCount30d = 0;
  let discardedCount30d = 0;
  let compostedCount30d = 0;
  let leftoverSavedCount30d = 0;

  for (const row of wasteRows) {
    const value = Math.max(0, Number(row.estimated_value_vnd) || 0);
    const co2 = Math.max(0, Number(row.co2_grams) || 0);
    if (row.event_type === 'rescued') {
      vndSaved30d += value;
      co2SavedGrams30d += co2;
      rescuedCount30d += 1;
    } else if (row.event_type === 'leftover_saved') {
      vndSaved30d += value;
      co2SavedGrams30d += co2;
      leftoverSavedCount30d += 1;
    } else if (row.event_type === 'composted') {
      co2SavedGrams30d += Math.round(co2 * 0.5);
      compostedCount30d += 1;
    } else if (row.event_type === 'expired_discarded') {
      vndWasted30d += value;
      discardedCount30d += 1;
    }
  }

  const positiveImpact = vndSaved30d + cookedMeals30d * 25_000 + compostedCount30d * 10_000;
  const negativeImpact = vndWasted30d;
  const zeroWasteScore =
    positiveImpact === 0 && negativeImpact === 0
      ? 80
      : Math.max(
          0,
          Math.min(100, Math.round((positiveImpact / (positiveImpact + negativeImpact * 1.25)) * 100)),
        );

  return {
    zeroWasteScore,
    vndSaved30d,
    vndWasted30d,
    co2SavedGrams30d,
    cookedMeals30d,
    rescuedCount30d,
    discardedCount30d,
    compostedCount30d,
    leftoverSavedCount30d,
  };
}

interface BudgetEntryRow {
  id: string;
  actor_id?: string;
  entry_kind: 'expense' | 'weekly_target';
  amount_vnd: number;
  category: string;
  note: string;
  source: 'manual' | 'receipt_scan' | 'shopping_import';
  spent_at: string;
  created_at: string;
}

function summarizeBudget(entries: readonly BudgetEntryRow[], sevenDayFloorMs?: number) {
  const targetRow = entries.find((row) => row.entry_kind === 'weekly_target');
  const weeklyTargetVnd =
    targetRow && Number.isFinite(Number(targetRow.amount_vnd)) && Number(targetRow.amount_vnd) > 0
      ? Number(targetRow.amount_vnd)
      : DEFAULT_WEEKLY_BUDGET_VND;

  const expenseRows = entries.filter((row) => row.entry_kind === 'expense');
  const weeklyExpenseRows =
    sevenDayFloorMs !== undefined
      ? expenseRows.filter((row) => {
          const ts = Date.parse(row.spent_at);
          return !Number.isFinite(ts) || ts >= sevenDayFloorMs;
        })
      : expenseRows;

  let spentThisWeekVnd = 0;
  const byCategory = new Map<string, { amountVnd: number; entryCount: number }>();

  for (const row of weeklyExpenseRows) {
    const amount = Math.max(0, Number(row.amount_vnd) || 0);
    spentThisWeekVnd += amount;
    const cat = row.category || 'market';
    const prev = byCategory.get(cat) ?? { amountVnd: 0, entryCount: 0 };
    byCategory.set(cat, { amountVnd: prev.amountVnd + amount, entryCount: prev.entryCount + 1 });
  }

  const spent30dVnd = expenseRows.reduce((sum, row) => sum + Math.max(0, Number(row.amount_vnd) || 0), 0);
  const burnRatePct =
    weeklyTargetVnd > 0 ? Math.round((spentThisWeekVnd / weeklyTargetVnd) * 1000) / 10 : 0;
  const remainingVnd = Math.max(0, weeklyTargetVnd - spentThisWeekVnd);
  const isOverBudget = spentThisWeekVnd > weeklyTargetVnd;

  const categoryBreakdown = Array.from(byCategory.entries())
    .map(([category, stats]) => ({
      category,
      amountVnd: stats.amountVnd,
      entryCount: stats.entryCount,
      sharePct:
        spentThisWeekVnd > 0 ? Math.round((stats.amountVnd / spentThisWeekVnd) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.amountVnd - a.amountVnd || a.category.localeCompare(b.category));

  return {
    weeklyTargetVnd,
    spentThisWeekVnd,
    spent30dVnd,
    remainingVnd,
    burnRatePct,
    isOverBudget,
    categoryBreakdown,
  };
}

function mapActivityRow(row: {
  id: string;
  household_id: string;
  actor_id: string;
  actor_name: string;
  event_kind: string;
  summary_vi: string;
  metadata_json: string;
  created_at: string;
}): ActivityEventDto {
  let metadata: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(row.metadata_json || '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      metadata = parsed as Record<string, unknown>;
    }
  } catch {
    metadata = {};
  }
  return {
    id: row.id,
    householdId: row.household_id,
    actorId: row.actor_id,
    actorName: row.actor_name || 'Thành viên',
    eventKind: row.event_kind,
    summaryVi: row.summary_vi,
    metadata,
    createdAt: row.created_at,
  };
}

function buildLiveInventoryBatchStatements(db: D1DatabaseBinding, householdId: string): D1PreparedStatement[] {
  return [
    db
      .prepare(
        `SELECT (
           EXISTS (SELECT 1 FROM inventory_lots WHERE household_id = ? AND legacy_item_id IS NOT NULL)
           OR EXISTS (SELECT 1 FROM inventory_adoption_receipts WHERE household_id = ?)
         ) AS is_adopted`,
      )
      .bind(householdId, householdId),
    db
      .prepare(
        `SELECT il.id, il.ingredient_id, il.raw_name AS name,
                il.quantity_milli, il.canonical_unit,
                COALESCE(il.display_category, ing.category, 'other') AS category,
                LOWER(COALESCE(sl.type, 'fridge')) AS storage,
                COALESCE(il.expiry_at, il.estimated_expiry_at) AS expiry_date
           FROM inventory_lots il
           LEFT JOIN storage_locations sl ON sl.id = il.storage_location_id AND sl.household_id = il.household_id
           LEFT JOIN ingredients ing ON ing.id = il.ingredient_id
          WHERE il.household_id = ? AND il.state = 'ACTIVE' AND il.quantity_milli > 0
          ORDER BY COALESCE(il.expiry_at, il.estimated_expiry_at, '9999-12-31') ASC, il.id ASC
          LIMIT 500`,
      )
      .bind(householdId),
    db
      .prepare(
        `SELECT id, ingredient_id, name, quantity, unit, category, storage, expiry_date
           FROM inventory_items
          WHERE household_id = ? AND quantity > 0
          ORDER BY COALESCE(expiry_date, '9999-12-31') ASC, id ASC
          LIMIT 500`,
      )
      .bind(householdId),
  ];
}

/**
 * Executes a single parallelized `db.batch([...])` round-trip to compute the full
 * Takolio V6 Kitchen OS Pulse + deterministic weak ETag.
 */
export async function computeKitchenOsPulse(db: D1DatabaseBinding, scope: HouseholdScope) {
  const startedMs = performance.now();
  const [
    adoptedRes,
    lotsRes,
    itemsRes,
    thresholdsRes,
    wasteRes,
    cookedRes,
    budgetRes,
    countsRes,
    activityRes,
  ] = await db.batch([
    ...buildLiveInventoryBatchStatements(db, scope.householdId),
    db
      .prepare(
        `SELECT id, household_id, ingredient_id, name, category, storage, unit,
                min_quantity, target_quantity, auto_add_shopping, updated_at
           FROM pantry_staple_thresholds
          WHERE household_id = ?
          ORDER BY name ASC`,
      )
      .bind(scope.householdId),
    db
      .prepare(
        `SELECT id, item_name, category, event_type, quantity, unit, estimated_value_vnd, co2_grams, occurred_at
           FROM household_waste_events
          WHERE household_id = ? AND datetime(occurred_at) >= datetime('now', '-30 days')
          ORDER BY occurred_at DESC
          LIMIT 250`,
      )
      .bind(scope.householdId),
    db
      .prepare(
        `SELECT COUNT(*) AS cnt
           FROM cooked_meals
          WHERE household_id = ? AND datetime(completed_at) >= datetime('now', '-30 days')`,
      )
      .bind(scope.householdId),
    db
      .prepare(
        `SELECT id, entry_kind, amount_vnd, category, note, source, spent_at, created_at
           FROM household_budget_entries
          WHERE household_id = ?
            AND (entry_kind = 'weekly_target' OR datetime(spent_at) >= datetime('now', '-7 days'))
          ORDER BY CASE WHEN entry_kind = 'weekly_target' THEN 0 ELSE 1 END, spent_at DESC, created_at DESC
          LIMIT 250`,
      )
      .bind(scope.householdId),
    db
      .prepare(
        `SELECT
           (SELECT COUNT(*) FROM custom_household_recipes WHERE household_id = ?) AS heirloom_count,
           (SELECT COUNT(*) FROM user_notifications WHERE household_id = ? AND (user_id IS NULL OR user_id = ?) AND is_read = 0) AS unread_notifications`,
      )
      .bind(scope.householdId, scope.householdId, scope.userId),
    db
      .prepare(
        `SELECT id, household_id, actor_id, actor_name, event_kind, summary_vi, metadata_json, created_at
           FROM household_activity_events
          WHERE household_id = ?
          ORDER BY created_at DESC
          LIMIT 8`,
      )
      .bind(scope.householdId),
  ]);
  const d1BatchDurationMs = Math.max(0.01, Number((performance.now() - startedMs).toFixed(2)));

  const nowMs = Date.now();
  const isAdoptedFlag = Number((adoptedRes.results?.[0] as { is_adopted?: number } | undefined)?.is_adopted ?? 0) === 1;
  const { isAdopted, liveStock } = mapRawLotsAndItems(
    isAdoptedFlag,
    (lotsRes.results ?? []) as any[],
    (itemsRes.results ?? []) as any[],
  );

  const expiringWithin48h = findExpiringWithin48h(liveStock, nowMs);
  const stapleStatuses = computeStapleStockStatuses(
    (thresholdsRes.results ?? []) as PantryThresholdRow[],
    liveStock,
  );
  const lowStockStaples = stapleStatuses.filter((staple) => staple.isLowStock);

  const cookedMeals30d = Number((cookedRes.results?.[0] as { cnt?: number } | undefined)?.cnt ?? 0);
  const zeroWaste = summarizeZeroWaste((wasteRes.results ?? []) as WasteEventRow[], cookedMeals30d);
  const budgetSummary = summarizeBudget((budgetRes.results ?? []) as BudgetEntryRow[]);

  const countsRow = (countsRes.results?.[0] ?? {}) as {
    heirloom_count?: number;
    unread_notifications?: number;
  };
  const heirloomRecipesCount = Number(countsRow.heirloom_count ?? 0);
  const unreadNotificationsCount = Number(countsRow.unread_notifications ?? 0);
  const recentActivity = ((activityRes.results ?? []) as any[]).map(mapActivityRow);

  const payload = {
    householdId: scope.householdId,
    inventory: {
      authorityMode: isAdopted ? ('native' as const) : ('legacy' as const),
      totalActiveItems: liveStock.length,
      expiringWithin48hCount: expiringWithin48h.length,
      expiringWithin48h,
    },
    staples: {
      configuredCount: stapleStatuses.length,
      lowStockCount: lowStockStaples.length,
      lowStockStaples,
    },
    zeroWaste: {
      zeroWasteScore: zeroWaste.zeroWasteScore,
      vndSaved30d: zeroWaste.vndSaved30d,
      vndWasted30d: zeroWaste.vndWasted30d,
      co2SavedGrams30d: zeroWaste.co2SavedGrams30d,
      cookedMeals30d: zeroWaste.cookedMeals30d,
      rescuedCount30d: zeroWaste.rescuedCount30d,
      discardedCount30d: zeroWaste.discardedCount30d,
    },
    budget: {
      weeklyTargetVnd: budgetSummary.weeklyTargetVnd,
      spentThisWeekVnd: budgetSummary.spentThisWeekVnd,
      remainingVnd: budgetSummary.remainingVnd,
      burnRatePct: budgetSummary.burnRatePct,
      isOverBudget: budgetSummary.isOverBudget,
      categoryBreakdown: budgetSummary.categoryBreakdown,
    },
    heirloomRecipesCount,
    unreadNotificationsCount,
    recentActivity,
    // Flat convenience fields for direct client/dashboard destructuring:
    zeroWasteScore: zeroWaste.zeroWasteScore,
    vndSaved30d: zeroWaste.vndSaved30d,
    savedValueVnd30d: zeroWaste.vndSaved30d,
    vndWasted30d: zeroWaste.vndWasted30d,
    co2SavedGrams30d: zeroWaste.co2SavedGrams30d,
    co2PreventedGrams30d: zeroWaste.co2SavedGrams30d,
    cookedMeals30d: zeroWaste.cookedMeals30d,
    expiringSoonCount: expiringWithin48h.length,
    lowStaplesCount: lowStockStaples.length,
    weeklyTargetVnd: budgetSummary.weeklyTargetVnd,
    spentThisWeekVnd: budgetSummary.spentThisWeekVnd,
    burnRatePct: budgetSummary.burnRatePct,
    lowStockStaples,
  };

  const hashHex = await sha256Hex(stableJson(payload));
  const etag = `W/"pulse-${hashHex.slice(0, 16)}"`;

  return {
    payload,
    etag,
    d1BatchDurationMs,
  };
}

function computeCookingStreak(completedDatesIso: readonly string[], nowMs: number) {
  const uniqueDays = Array.from(
    new Set(
      completedDatesIso
        .map((raw) => raw?.trim().slice(0, 10))
        .filter((d): d is string => Boolean(d && /^\d{4}-\d{2}-\d{2}$/.test(d))),
    ),
  ).sort();

  const daySet = new Set(uniqueDays);
  const todayStr = new Date(nowMs).toISOString().slice(0, 10);
  const yesterdayStr = new Date(nowMs - 86_400_000).toISOString().slice(0, 10);

  let currentStreakDays = 0;
  let cursorMs: number | null = daySet.has(todayStr)
    ? Date.parse(`${todayStr}T00:00:00.000Z`)
    : daySet.has(yesterdayStr)
      ? Date.parse(`${yesterdayStr}T00:00:00.000Z`)
      : null;

  while (cursorMs !== null) {
    const key = new Date(cursorMs).toISOString().slice(0, 10);
    if (!daySet.has(key)) break;
    currentStreakDays += 1;
    cursorMs -= 86_400_000;
  }

  let longestStreakDays30d = 0;
  let run = 0;
  let prevDayMs: number | null = null;
  for (const day of uniqueDays) {
    const ms = Date.parse(`${day}T00:00:00.000Z`);
    if (prevDayMs !== null && ms - prevDayMs === 86_400_000) {
      run += 1;
    } else {
      run = 1;
    }
    if (run > longestStreakDays30d) longestStreakDays30d = run;
    prevDayMs = ms;
  }

  return {
    currentStreakDays,
    longestStreakDays30d,
    activeCookDates30d: uniqueDays,
  };
}

/**
 * Full 30-day Kitchen OS analytics breakdown (waste events, budget ledger, category spend,
 * daily cooking streak, pantry staple health, and household activity timeline).
 */
export async function computeKitchenOsInsights(db: D1DatabaseBinding, scope: HouseholdScope) {
  const [
    adoptedRes,
    lotsRes,
    itemsRes,
    thresholdsRes,
    wasteRes,
    cookedRes,
    budgetRes,
    activityRes,
  ] = await db.batch([
    ...buildLiveInventoryBatchStatements(db, scope.householdId),
    db
      .prepare(
        `SELECT id, household_id, ingredient_id, name, category, storage, unit,
                min_quantity, target_quantity, auto_add_shopping, updated_at
           FROM pantry_staple_thresholds
          WHERE household_id = ?
          ORDER BY name ASC`,
      )
      .bind(scope.householdId),
    db
      .prepare(
        `SELECT id, actor_id, item_name, category, event_type, quantity, unit, estimated_value_vnd, co2_grams, occurred_at
           FROM household_waste_events
          WHERE household_id = ? AND datetime(occurred_at) >= datetime('now', '-30 days')
          ORDER BY occurred_at DESC
          LIMIT 200`,
      )
      .bind(scope.householdId),
    db
      .prepare(
        `SELECT id, recipe_id, servings_cooked, completed_at
           FROM cooked_meals
          WHERE household_id = ? AND datetime(completed_at) >= datetime('now', '-30 days')
          ORDER BY completed_at DESC
          LIMIT 300`,
      )
      .bind(scope.householdId),
    db
      .prepare(
        `SELECT id, actor_id, entry_kind, amount_vnd, category, note, source, spent_at, created_at
           FROM household_budget_entries
          WHERE household_id = ?
            AND (entry_kind = 'weekly_target' OR datetime(spent_at) >= datetime('now', '-30 days'))
          ORDER BY CASE WHEN entry_kind = 'weekly_target' THEN 0 ELSE 1 END, spent_at DESC, created_at DESC
          LIMIT 300`,
      )
      .bind(scope.householdId),
    db
      .prepare(
        `SELECT id, household_id, actor_id, actor_name, event_kind, summary_vi, metadata_json, created_at
           FROM household_activity_events
          WHERE household_id = ?
          ORDER BY created_at DESC
          LIMIT 30`,
      )
      .bind(scope.householdId),
  ]);

  const nowMs = Date.now();
  const isAdoptedFlag = Number((adoptedRes.results?.[0] as { is_adopted?: number } | undefined)?.is_adopted ?? 0) === 1;
  const { liveStock } = mapRawLotsAndItems(
    isAdoptedFlag,
    (lotsRes.results ?? []) as any[],
    (itemsRes.results ?? []) as any[],
  );

  const stapleStatuses = computeStapleStockStatuses(
    (thresholdsRes.results ?? []) as PantryThresholdRow[],
    liveStock,
  );
  const lowStockCount = stapleStatuses.filter((s) => s.isLowStock).length;
  const healthyCount = stapleStatuses.length - lowStockCount;
  const healthPct =
    stapleStatuses.length > 0 ? Math.round((healthyCount / stapleStatuses.length) * 100) : 100;

  const cookedRows = (cookedRes.results ?? []) as Array<{
    id: string;
    recipe_id: string;
    servings_cooked: number;
    completed_at: string;
  }>;
  const streak = computeCookingStreak(
    cookedRows.map((r) => r.completed_at),
    nowMs,
  );

  const wasteRows = (wasteRes.results ?? []) as WasteEventRow[];
  const zeroWaste = summarizeZeroWaste(wasteRows, cookedRows.length);

  const budgetRows = (budgetRes.results ?? []) as BudgetEntryRow[];
  const budget = summarizeBudget(budgetRows, nowMs - 7 * 86_400_000);

  // 30-day category spend breakdown across all expense entries in the 30d window
  const expenseRows30d = budgetRows.filter((r) => r.entry_kind === 'expense');
  const cat30dMap = new Map<string, { amountVnd: number; entryCount: number }>();
  for (const row of expenseRows30d) {
    const amt = Math.max(0, Number(row.amount_vnd) || 0);
    const cat = row.category || 'market';
    const prev = cat30dMap.get(cat) ?? { amountVnd: 0, entryCount: 0 };
    cat30dMap.set(cat, { amountVnd: prev.amountVnd + amt, entryCount: prev.entryCount + 1 });
  }
  const categorySpendBreakdown = Array.from(cat30dMap.entries())
    .map(([category, stats]) => ({
      category,
      amountVnd: stats.amountVnd,
      entryCount: stats.entryCount,
      sharePct:
        budget.spent30dVnd > 0 ? Math.round((stats.amountVnd / budget.spent30dVnd) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.amountVnd - a.amountVnd || a.category.localeCompare(b.category));

  return {
    householdId: scope.householdId,
    windowDays: 30,
    zeroWaste,
    wasteEvents: wasteRows.map((row) => ({
      id: row.id,
      actorId: row.actor_id ?? scope.userId,
      itemName: row.item_name,
      category: row.category,
      eventType: row.event_type,
      quantity: Number(row.quantity),
      unit: row.unit,
      estimatedValueVnd: Number(row.estimated_value_vnd),
      co2Grams: Number(row.co2_grams),
      occurredAt: row.occurred_at,
    })),
    budget,
    budgetEntries: expenseRows30d.map((row) => ({
      id: row.id,
      actorId: row.actor_id ?? scope.userId,
      entryKind: row.entry_kind,
      amountVnd: Number(row.amount_vnd),
      category: row.category,
      note: row.note,
      source: row.source,
      spentAt: row.spent_at,
      createdAt: row.created_at,
    })),
    categorySpendBreakdown,
    cookingStreak: {
      ...streak,
      cookedMeals30d: cookedRows.length,
    },
    pantryStapleHealth: {
      totalConfigured: stapleStatuses.length,
      healthyCount,
      lowStockCount,
      healthPct,
      staples: stapleStatuses,
    },
    activityTimeline: ((activityRes.results ?? []) as any[]).map(mapActivityRow),
  };
}

async function resolveActorDisplayName(db: D1DatabaseBinding, userId: string): Promise<string> {
  const row = await db
    .prepare('SELECT display_name FROM profiles WHERE user_id = ? LIMIT 1')
    .bind(userId)
    .first<{ display_name: string | null }>();
  return row?.display_name?.trim() || 'Thành viên';
}

function createActivityStatement(
  db: D1DatabaseBinding,
  params: {
    id: string;
    householdId: string;
    actorId: string;
    actorName: string;
    eventKind: string;
    summaryVi: string;
    metadata?: Record<string, unknown>;
    createdAt: string;
  },
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO household_activity_events
         (id, household_id, actor_id, actor_name, event_kind, summary_vi, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      params.id,
      params.householdId,
      params.actorId,
      params.actorName,
      params.eventKind,
      params.summaryVi,
      JSON.stringify(params.metadata ?? {}),
      params.createdAt,
    );
}

export function estimateWasteImpact(params: {
  quantity: number;
  unit: string;
  category: string;
  estimatedValueVnd?: number;
  co2Grams?: number;
}): { estimatedValueVnd: number; co2Grams: number } {
  const normUnit = normalizeViText(params.unit);
  let portions = params.quantity;
  if (normUnit === 'g' || normUnit === 'gram' || normUnit === 'ml') {
    portions = Math.max(0.2, params.quantity / 250);
  } else if (normUnit === 'kg' || normUnit === 'l' || normUnit === 'lit') {
    portions = Math.max(0.5, params.quantity * 3);
  }

  const cat = normalizeViText(params.category);
  const unitVnd = cat.includes('meat') || cat.includes('seafood') || cat.includes('thit') || cat.includes('ca')
    ? 55_000
    : 35_000;
  const unitCo2 = cat.includes('meat') || cat.includes('seafood') || cat.includes('thit')
    ? 850
    : 450;

  return {
    estimatedValueVnd:
      params.estimatedValueVnd !== undefined
        ? Math.max(0, Math.round(params.estimatedValueVnd))
        : Math.max(5_000, Math.round(portions * unitVnd)),
    co2Grams:
      params.co2Grams !== undefined
        ? Math.max(0, Math.round(params.co2Grams))
        : Math.max(50, Math.round(portions * unitCo2)),
  };
}

export async function recordWasteEvent(
  db: D1DatabaseBinding,
  scope: HouseholdScope,
  input: {
    itemName: string;
    category: string;
    eventType: 'rescued' | 'expired_discarded' | 'composted' | 'leftover_saved';
    quantity: number;
    unit: string;
    estimatedValueVnd?: number;
    co2Grams?: number;
    occurredAt?: string;
  },
) {
  const actorName = await resolveActorDisplayName(db, scope.userId);
  const nowIso = new Date().toISOString();
  const occurredAt = input.occurredAt?.trim() || nowIso;
  const impact = estimateWasteImpact({
    quantity: input.quantity,
    unit: input.unit,
    category: input.category,
    estimatedValueVnd: input.estimatedValueVnd,
    co2Grams: input.co2Grams,
  });

  const wasteId = `waste_${crypto.randomUUID()}`;
  const activityId = `act_${crypto.randomUUID()}`;
  const actionLabel =
    input.eventType === 'rescued'
      ? `đã giải cứu ${input.quantity} ${input.unit} ${input.itemName} trước hạn`
      : input.eventType === 'leftover_saved'
        ? `đã cất gọn ${input.quantity} ${input.unit} ${input.itemName} cho bữa sau`
        : input.eventType === 'composted'
          ? `đã ủ hữu cơ ${input.quantity} ${input.unit} ${input.itemName}`
          : `đã ghi nhận hủy ${input.quantity} ${input.unit} ${input.itemName} quá hạn`;

  const summaryVi = `${actorName} ${actionLabel}`;

  await db.batch([
    db
      .prepare(
        `INSERT INTO household_waste_events
           (id, household_id, actor_id, item_name, category, event_type, quantity, unit, estimated_value_vnd, co2_grams, occurred_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        wasteId,
        scope.householdId,
        scope.userId,
        input.itemName.trim(),
        input.category.trim(),
        input.eventType,
        input.quantity,
        input.unit.trim(),
        impact.estimatedValueVnd,
        impact.co2Grams,
        occurredAt,
      ),
    createActivityStatement(db, {
      id: activityId,
      householdId: scope.householdId,
      actorId: scope.userId,
      actorName,
      eventKind: `waste_${input.eventType}`,
      summaryVi,
      metadata: {
        wasteEventId: wasteId,
        itemName: input.itemName.trim(),
        eventType: input.eventType,
        estimatedValueVnd: impact.estimatedValueVnd,
        co2Grams: impact.co2Grams,
      },
      createdAt: nowIso,
    }),
  ]);

  return {
    id: wasteId,
    householdId: scope.householdId,
    actorId: scope.userId,
    itemName: input.itemName.trim(),
    category: input.category.trim(),
    eventType: input.eventType,
    quantity: input.quantity,
    unit: input.unit.trim(),
    estimatedValueVnd: impact.estimatedValueVnd,
    co2Grams: impact.co2Grams,
    occurredAt,
  };
}

export async function recordBudgetExpense(
  db: D1DatabaseBinding,
  scope: HouseholdScope,
  input: {
    amountVnd: number;
    category: string;
    note: string;
    source: 'manual' | 'receipt_scan' | 'shopping_import';
    spentAt?: string;
  },
) {
  const actorName = await resolveActorDisplayName(db, scope.userId);
  const createdAt = new Date().toISOString();
  const spentAt = input.spentAt?.trim() || createdAt;
  const entryId = `bdg_${crypto.randomUUID()}`;
  const activityId = `act_${crypto.randomUUID()}`;
  const formattedVnd = new Intl.NumberFormat('vi-VN').format(input.amountVnd);

  await db.batch([
    db
      .prepare(
        `INSERT INTO household_budget_entries
           (id, household_id, actor_id, entry_kind, amount_vnd, category, note, source, spent_at, created_at)
         VALUES (?, ?, ?, 'expense', ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        entryId,
        scope.householdId,
        scope.userId,
        input.amountVnd,
        input.category.trim(),
        input.note.trim(),
        input.source,
        spentAt,
        createdAt,
      ),
    createActivityStatement(db, {
      id: activityId,
      householdId: scope.householdId,
      actorId: scope.userId,
      actorName,
      eventKind: 'budget_expense_logged',
      summaryVi: `${actorName} ghi nhận khoản đi chợ ${formattedVnd}₫ (${input.category.trim()})`,
      metadata: {
        budgetEntryId: entryId,
        amountVnd: input.amountVnd,
        category: input.category.trim(),
        source: input.source,
      },
      createdAt,
    }),
  ]);

  return {
    id: entryId,
    householdId: scope.householdId,
    actorId: scope.userId,
    entryKind: 'expense' as const,
    amountVnd: input.amountVnd,
    category: input.category.trim(),
    note: input.note.trim(),
    source: input.source,
    spentAt,
    createdAt,
  };
}

export async function upsertWeeklyBudgetTarget(
  db: D1DatabaseBinding,
  scope: HouseholdScope,
  input: { amountVnd: number; note?: string },
) {
  const actorName = await resolveActorDisplayName(db, scope.userId);
  const nowIso = new Date().toISOString();
  const entryId = `bdg_target_${scope.householdId}`;
  const activityId = `act_${crypto.randomUUID()}`;
  const note = (input.note || 'Định mức chi tiêu đi chợ tuần').trim();
  const formattedVnd = new Intl.NumberFormat('vi-VN').format(input.amountVnd);

  await db.batch([
    db
      .prepare(
        `DELETE FROM household_budget_entries
          WHERE household_id = ? AND entry_kind = 'weekly_target'`,
      )
      .bind(scope.householdId),
    db
      .prepare(
        `INSERT INTO household_budget_entries
           (id, household_id, actor_id, entry_kind, amount_vnd, category, note, source, spent_at, created_at)
         VALUES (?, ?, ?, 'weekly_target', ?, 'weekly_target', ?, 'manual', ?, ?)`,
      )
      .bind(entryId, scope.householdId, scope.userId, input.amountVnd, note, nowIso, nowIso),
    createActivityStatement(db, {
      id: activityId,
      householdId: scope.householdId,
      actorId: scope.userId,
      actorName,
      eventKind: 'budget_target_updated',
      summaryVi: `${actorName} đặt ngân sách đi chợ tuần ở mức ${formattedVnd}₫`,
      metadata: { weeklyTargetVnd: input.amountVnd },
      createdAt: nowIso,
    }),
  ]);

  return {
    id: entryId,
    householdId: scope.householdId,
    actorId: scope.userId,
    entryKind: 'weekly_target' as const,
    amountVnd: input.amountVnd,
    note,
    spentAt: nowIso,
    createdAt: nowIso,
  };
}

export async function listPantryThresholdsWithStock(db: D1DatabaseBinding, householdId: string) {
  const [adoptedRes, lotsRes, itemsRes, thresholdsRes] = await db.batch([
    ...buildLiveInventoryBatchStatements(db, householdId),
    db
      .prepare(
        `SELECT id, household_id, ingredient_id, name, category, storage, unit,
                min_quantity, target_quantity, auto_add_shopping, updated_at
           FROM pantry_staple_thresholds
          WHERE household_id = ?
          ORDER BY name ASC`,
      )
      .bind(householdId),
  ]);

  const isAdoptedFlag = Number((adoptedRes.results?.[0] as { is_adopted?: number } | undefined)?.is_adopted ?? 0) === 1;
  const { liveStock } = mapRawLotsAndItems(
    isAdoptedFlag,
    (lotsRes.results ?? []) as any[],
    (itemsRes.results ?? []) as any[],
  );

  const staples = computeStapleStockStatuses(
    (thresholdsRes.results ?? []) as PantryThresholdRow[],
    liveStock,
  );
  return {
    staples,
    lowStockCount: staples.filter((s) => s.isLowStock).length,
  };
}

export async function seedVietnamesePantryStaples(db: D1DatabaseBinding, scope: HouseholdScope) {
  const actorName = await resolveActorDisplayName(db, scope.userId);
  const nowIso = new Date().toISOString();

  const insertStatements = await Promise.all(
    VIETNAMESE_ESSENTIAL_STAPLES.map(async (seed) => {
      const digest = await sha256Hex(`${scope.householdId}:${seed.name}`);
      const id = `pst_${digest.slice(0, 24)}`;
      return db
        .prepare(
          `INSERT OR IGNORE INTO pantry_staple_thresholds
             (id, household_id, ingredient_id, name, category, storage, unit, min_quantity, target_quantity, auto_add_shopping, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        )
        .bind(
          id,
          scope.householdId,
          seed.ingredientId,
          seed.name,
          seed.category,
          seed.storage,
          seed.unit,
          seed.minQuantity,
          seed.targetQuantity,
          nowIso,
        );
    }),
  );

  const batchRes = await db.batch(insertStatements);
  const seededCount = batchRes.reduce(
    (sum, r) => sum + (typeof r.meta?.changes === 'number' ? r.meta.changes : 0),
    0,
  );

  if (seededCount > 0) {
    await createActivityStatement(db, {
      id: `act_${crypto.randomUUID()}`,
      householdId: scope.householdId,
      actorId: scope.userId,
      actorName,
      eventKind: 'pantry_staples_seeded',
      summaryVi: `${actorName} đã kích hoạt bộ định mức ${seededCount} gia vị & nhu yếu phẩm bếp Việt`,
      metadata: { seededCount },
      createdAt: nowIso,
    }).run();
  }

  const { staples, lowStockCount } = await listPantryThresholdsWithStock(db, scope.householdId);
  return {
    seededCount,
    totalCount: staples.length,
    lowStockCount,
    staples,
  };
}

export async function upsertPantryThreshold(
  db: D1DatabaseBinding,
  scope: HouseholdScope,
  input: {
    name: string;
    ingredientId?: string | null;
    category: string;
    storage: 'fridge' | 'freezer' | 'pantry';
    unit: string;
    minQuantity: number;
    targetQuantity: number;
    autoAddShopping: boolean;
  },
) {
  const nowIso = new Date().toISOString();
  const cleanName = input.name.trim();
  const resolvedIngredientId =
    input.ingredientId?.trim() || findCanonicalIngredient(cleanName)?.id || null;
  const digest = await sha256Hex(`${scope.householdId}:${cleanName}`);
  const id = `pst_${digest.slice(0, 24)}`;

  await db
    .prepare(
      `INSERT INTO pantry_staple_thresholds
         (id, household_id, ingredient_id, name, category, storage, unit, min_quantity, target_quantity, auto_add_shopping, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(household_id, name) DO UPDATE SET
         ingredient_id = COALESCE(excluded.ingredient_id, pantry_staple_thresholds.ingredient_id),
         category = excluded.category,
         storage = excluded.storage,
         unit = excluded.unit,
         min_quantity = excluded.min_quantity,
         target_quantity = excluded.target_quantity,
         auto_add_shopping = excluded.auto_add_shopping,
         updated_at = excluded.updated_at`,
    )
    .bind(
      id,
      scope.householdId,
      resolvedIngredientId,
      cleanName,
      input.category.trim(),
      input.storage,
      input.unit.trim(),
      input.minQuantity,
      Math.max(input.minQuantity, input.targetQuantity),
      input.autoAddShopping ? 1 : 0,
      nowIso,
    )
    .run();

  const { staples } = await listPantryThresholdsWithStock(db, scope.householdId);
  const staple = staples.find((s) => s.name === cleanName) ?? staples[0];
  return staple;
}

export async function autoRestockLowStaples(db: D1DatabaseBinding, scope: HouseholdScope) {
  const { staples } = await listPantryThresholdsWithStock(db, scope.householdId);
  const lowAutoStaples = staples.filter((s) => s.isLowStock && s.autoAddShopping && s.restockQuantity > 0);

  if (lowAutoStaples.length === 0) {
    return {
      addedCount: 0,
      items: [] as Array<{
        id: string;
        name: string;
        quantity: number;
        unit: StandardUnit;
        ingredientId: string | null;
      }>,
    };
  }

  // Ensure household shopping list exists (same contract as shopping.ts).
  const existingList = await db
    .prepare('SELECT id FROM shopping_lists WHERE household_id = ? LIMIT 1')
    .bind(scope.householdId)
    .first<{ id: string }>();
  const listId = existingList?.id || `list_${scope.householdId}`;
  if (!existingList) {
    await db
      .prepare('INSERT OR IGNORE INTO shopping_lists (id, household_id, name) VALUES (?, ?, ?)')
      .bind(listId, scope.householdId, 'Đi chợ cho gia đình')
      .run();
  }

  // Validate candidate canonical ingredient IDs against `ingredients` FK table.
  const candidateIngredientIds = Array.from(
    new Set(
      lowAutoStaples
        .map((s) => s.ingredientId || findCanonicalIngredient(s.name)?.id)
        .filter((v): v is string => typeof v === 'string' && v.length > 0),
    ),
  );
  const validIngredientIds = new Set<string>();
  if (candidateIngredientIds.length > 0) {
    const placeholders = candidateIngredientIds.map(() => '?').join(',');
    const found = await db
      .prepare(`SELECT id FROM ingredients WHERE id IN (${placeholders})`)
      .bind(...candidateIngredientIds)
      .all<{ id: string }>();
    for (const row of found.results ?? []) {
      validIngredientIds.add(row.id);
    }
  }

  const openShoppingRes = await db
    .prepare(
      `SELECT id, ingredient_id, name, quantity, unit
         FROM shopping_items
        WHERE list_id = ? AND is_checked = 0`,
    )
    .bind(listId)
    .all<{ id: string; ingredient_id: string | null; name: string; quantity: number; unit: string }>();
  const openShopping = openShoppingRes.results ?? [];

  const statements: D1PreparedStatement[] = [];
  const restockedItems: Array<{
    id: string;
    name: string;
    quantity: number;
    unit: StandardUnit;
    ingredientId: string | null;
  }> = [];

  for (const staple of lowAutoStaples) {
    const candidateId = staple.ingredientId || findCanonicalIngredient(staple.name)?.id || null;
    const fkIngredientId = candidateId && validIngredientIds.has(candidateId) ? candidateId : null;
    const shoppingUnit = toStandardUnit(staple.unit, 'piece');
    const stapleNorm = normalizeViText(staple.name);

    const existingOpen = openShopping.find(
      (item) =>
        normalizeViText(item.name) === stapleNorm ||
        (fkIngredientId !== null && item.ingredient_id === fkIngredientId),
    );

    if (existingOpen) {
      const nextQty = Math.max(Number(existingOpen.quantity) || 0, staple.restockQuantity);
      statements.push(
        db
          .prepare(
            `UPDATE shopping_items
                SET quantity = ?, unit = ?, updated_at = datetime('now')
              WHERE id = ? AND list_id = ?`,
          )
          .bind(nextQty, shoppingUnit, existingOpen.id, listId),
      );
      restockedItems.push({
        id: existingOpen.id,
        name: staple.name,
        quantity: nextQty,
        unit: shoppingUnit,
        ingredientId: candidateId,
      });
    } else {
      const digest = await sha256Hex(`${listId}:staple:${staple.id}`);
      const shopItemId = `shop_staple_${digest.slice(0, 20)}`;
      statements.push(
        db
          .prepare(
            `INSERT INTO shopping_items
               (id, list_id, ingredient_id, name, quantity, unit, is_checked)
             VALUES (?, ?, ?, ?, ?, ?, 0)
             ON CONFLICT(id) DO UPDATE SET
               quantity = excluded.quantity,
               unit = excluded.unit,
               is_checked = 0,
               updated_at = datetime('now')`,
          )
          .bind(shopItemId, listId, fkIngredientId, staple.name, staple.restockQuantity, shoppingUnit),
        db
          .prepare(
            `INSERT INTO shopping_item_metadata (item_id, ingredient_identity, recipe_identity, recipe_title)
             VALUES (?, ?, NULL, 'Bù định mức tủ gia vị')
             ON CONFLICT(item_id) DO UPDATE SET
               ingredient_identity = excluded.ingredient_identity,
               recipe_title = excluded.recipe_title`,
          )
          .bind(shopItemId, candidateId),
      );
      restockedItems.push({
        id: shopItemId,
        name: staple.name,
        quantity: staple.restockQuantity,
        unit: shoppingUnit,
        ingredientId: candidateId,
      });
    }
  }

  const actorName = await resolveActorDisplayName(db, scope.userId);
  const nowIso = new Date().toISOString();
  statements.push(
    createActivityStatement(db, {
      id: `act_${crypto.randomUUID()}`,
      householdId: scope.householdId,
      actorId: scope.userId,
      actorName,
      eventKind: 'pantry_auto_restocked',
      summaryVi: `${actorName} tự động thêm ${restockedItems.length} nhu yếu phẩm sắp cạn vào danh sách đi chợ`,
      metadata: {
        addedCount: restockedItems.length,
        itemNames: restockedItems.map((i) => i.name),
      },
      createdAt: nowIso,
    }),
  );

  await db.batch(statements);

  return {
    addedCount: restockedItems.length,
    items: restockedItems,
  };
}

function parseHeirloomIngredients(rawJson: string): RecipeIngredient[] {
  try {
    const parsed = JSON.parse(rawJson);
    if (!Array.isArray(parsed)) return [];
    const out: RecipeIngredient[] = [];
    for (let idx = 0; idx < parsed.length; idx++) {
      const entry = parsed[idx];
      if (!entry || typeof entry !== 'object') continue;
      const name = String(entry.name || '').trim();
      if (!name) continue;
      const rawQty = Number(entry.requiredQuantity ?? entry.quantity ?? 1);
      const requiredQuantity = Number.isFinite(rawQty) && rawQty > 0 ? rawQty : 1;
      const canonical = findCanonicalIngredient(name);
      const fallbackId = `CUSTOM_${normalizeViText(name).replace(/\s+/g, '_').toUpperCase() || idx + 1}`;
      const ingredientId = String(entry.ingredientId || canonical?.id || fallbackId).trim();
      const unit = toStandardUnit(entry.unit, canonical?.defaultUnit ?? 'piece');
      out.push({
        ingredientId,
        name,
        requiredQuantity,
        unit,
        ...(typeof entry.isOptional === 'boolean' ? { isOptional: entry.isOptional } : {}),
      });
    }
    return out;
  } catch {
    return [];
  }
}

function parseHeirloomSteps(rawJson: string, chefSecret: string | null): RecipeStep[] {
  try {
    const parsed = JSON.parse(rawJson);
    if (!Array.isArray(parsed)) return [];
    const out: RecipeStep[] = [];
    for (let idx = 0; idx < parsed.length; idx++) {
      const entry = parsed[idx];
      if (typeof entry === 'string' && entry.trim()) {
        out.push({
          stepNumber: idx + 1,
          instruction: entry.trim(),
        });
        continue;
      }
      if (!entry || typeof entry !== 'object') continue;
      const instruction = String(entry.instruction || entry.text || '').trim();
      if (!instruction) continue;
      const timerRaw = entry.timerMinutes !== undefined ? Number(entry.timerMinutes) : undefined;
      const tipRaw = typeof entry.tip === 'string' && entry.tip.trim() ? entry.tip.trim() : undefined;
      out.push({
        stepNumber: idx + 1,
        instruction,
        ...(tipRaw ? { tip: tipRaw } : {}),
        ...(timerRaw !== undefined && Number.isFinite(timerRaw) && timerRaw > 0
          ? { timerMinutes: timerRaw }
          : {}),
      });
    }
    if (chefSecret?.trim() && out.length > 0) {
      const last = out[out.length - 1];
      if (!last.tip) {
        last.tip = `Bí quyết gia truyền: ${chefSecret.trim()}`;
      }
    }
    return out;
  } catch {
    return [];
  }
}

export function mapHeirloomRowToRuntimeRecipe(row: HeirloomRecipeRow): Recipe {
  const tags = ['Gia truyền', row.region];
  const artwork = resolveRecipeArtworkV4({
    id: row.id,
    slug: row.slug,
    title: row.title,
    cuisine: 'vietnamese',
    category: row.category,
    tags,
  });
  const ingredients = parseHeirloomIngredients(row.ingredients_json);
  const steps = parseHeirloomSteps(row.steps_json, row.chef_secret);

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description || `Công thức gia truyền của gia đình: ${row.title}`,
    cuisine: 'vietnamese',
    category: row.category || 'braise',
    region: row.region === 'all' ? 'toan_quoc' : row.region,
    cookTimeMinutes: Math.max(1, Number(row.cook_time_minutes) || 25),
    servings: Math.max(1, Number(row.servings) || 4),
    difficulty: row.difficulty || 'medium',
    imageUrl: artwork?.url || FALLBACK_HEIRLOOM_POSTER_URL,
    ingredients:
      ingredients.length > 0
        ? ingredients
        : [{ ingredientId: 'CUSTOM_MAIN', name: row.title, requiredQuantity: 1, unit: 'piece' }],
    steps:
      steps.length > 0
        ? steps
        : [{ stepNumber: 1, instruction: `Chế biến món ${row.title} theo khẩu vị gia đình.` }],
    tags,
  };
}

export function mapHeirloomRowToDto(row: HeirloomRecipeRow) {
  const runtime = mapHeirloomRowToRuntimeRecipe(row);
  return {
    id: row.id,
    householdId: row.household_id,
    authorUserId: row.author_user_id,
    slug: row.slug,
    title: row.title,
    description: runtime.description,
    cuisine: runtime.cuisine,
    region: row.region,
    runtimeRegion: runtime.region,
    category: row.category,
    difficulty: row.difficulty,
    prepTimeMinutes: Number(row.prep_time_minutes) || 15,
    cookTimeMinutes: runtime.cookTimeMinutes,
    servings: runtime.servings,
    imageUrl: runtime.imageUrl,
    ingredients: runtime.ingredients,
    steps: runtime.steps,
    tags: runtime.tags,
    chefSecret: row.chef_secret ?? null,
    familyStory: row.family_story ?? null,
    isPinned: Boolean(row.is_pinned),
    cookedCount: Number(row.cooked_count) || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    recipeUrl: `/recipes/${row.slug}`,
    cookUrl: `/cook/${row.slug}`,
  };
}

export async function findHouseholdHeirloomRecipeAsRuntime(
  db: D1DatabaseBinding,
  householdId: string,
  idOrSlug: string,
): Promise<Recipe | null> {
  const row = await db
    .prepare(
      `SELECT * FROM custom_household_recipes
        WHERE household_id = ? AND (id = ? OR slug = ?)
        LIMIT 1`,
    )
    .bind(householdId, idOrSlug, idOrSlug)
    .first<HeirloomRecipeRow>();
  return row ? mapHeirloomRowToRuntimeRecipe(row) : null;
}

export async function listHeirloomRecipes(db: D1DatabaseBinding, householdId: string) {
  const res = await db
    .prepare(
      `SELECT * FROM custom_household_recipes
        WHERE household_id = ?
        ORDER BY is_pinned DESC, updated_at DESC
        LIMIT 100`,
    )
    .bind(householdId)
    .all<HeirloomRecipeRow>();
  return ((res.results ?? []) as HeirloomRecipeRow[]).map(mapHeirloomRowToDto);
}

export async function getHeirloomRecipeByIdOrSlug(
  db: D1DatabaseBinding,
  householdId: string,
  idOrSlug: string,
) {
  const row = await db
    .prepare(
      `SELECT * FROM custom_household_recipes
        WHERE household_id = ? AND (id = ? OR slug = ?)
        LIMIT 1`,
    )
    .bind(householdId, idOrSlug, idOrSlug)
    .first<HeirloomRecipeRow>();
  return row ? mapHeirloomRowToDto(row) : null;
}

export async function saveHeirloomRecipe(
  db: D1DatabaseBinding,
  scope: HouseholdScope,
  input: {
    id?: string;
    title: string;
    description: string;
    region: 'bac' | 'trung' | 'nam' | 'all';
    category: string;
    difficulty: 'easy' | 'medium' | 'hard';
    prepTimeMinutes: number;
    cookTimeMinutes: number;
    servings: number;
    ingredients: Array<{
      ingredientId?: string;
      name: string;
      requiredQuantity: number;
      unit: string;
      isOptional?: boolean;
    }>;
    steps: Array<{
      stepNumber?: number;
      instruction: string;
      tip?: string;
      timerMinutes?: number;
    }>;
    chefSecret?: string | null;
    familyStory?: string | null;
    isPinned?: boolean;
  },
) {
  const actorName = await resolveActorDisplayName(db, scope.userId);
  const nowIso = new Date().toISOString();

  const normalizedIngredients: RecipeIngredient[] = input.ingredients.map((ing, idx) => {
    const cleanName = ing.name.trim();
    const canonical = findCanonicalIngredient(cleanName);
    const fallbackId = `CUSTOM_${normalizeViText(cleanName).replace(/\s+/g, '_').toUpperCase() || idx + 1}`;
    return {
      ingredientId: ing.ingredientId?.trim() || canonical?.id || fallbackId,
      name: cleanName,
      requiredQuantity: ing.requiredQuantity,
      unit: toStandardUnit(ing.unit, canonical?.defaultUnit ?? 'piece'),
      ...(ing.isOptional !== undefined ? { isOptional: ing.isOptional } : {}),
    };
  });

  const normalizedSteps: RecipeStep[] = input.steps.map((step, idx) => ({
    stepNumber: idx + 1,
    instruction: step.instruction.trim(),
    ...(step.tip?.trim() ? { tip: step.tip.trim() } : {}),
    ...(step.timerMinutes !== undefined && step.timerMinutes > 0
      ? { timerMinutes: step.timerMinutes }
      : {}),
  }));

  const existing = input.id
    ? await db
        .prepare(
          `SELECT * FROM custom_household_recipes
            WHERE id = ? AND household_id = ?
            LIMIT 1`,
        )
        .bind(input.id.trim(), scope.householdId)
        .first<HeirloomRecipeRow>()
    : null;

  if (existing) {
    await db.batch([
      db
        .prepare(
          `UPDATE custom_household_recipes
              SET title = ?,
                  description = ?,
                  region = ?,
                  category = ?,
                  difficulty = ?,
                  prep_time_minutes = ?,
                  cook_time_minutes = ?,
                  servings = ?,
                  ingredients_json = ?,
                  steps_json = ?,
                  chef_secret = ?,
                  family_story = ?,
                  is_pinned = ?,
                  updated_at = ?
            WHERE id = ? AND household_id = ?`,
        )
        .bind(
          input.title.trim(),
          input.description.trim(),
          input.region,
          input.category.trim(),
          input.difficulty,
          input.prepTimeMinutes,
          input.cookTimeMinutes,
          input.servings,
          JSON.stringify(normalizedIngredients),
          JSON.stringify(normalizedSteps),
          input.chefSecret?.trim() || null,
          input.familyStory?.trim() || null,
          input.isPinned !== undefined ? (input.isPinned ? 1 : 0) : existing.is_pinned,
          nowIso,
          existing.id,
          scope.householdId,
        ),
      createActivityStatement(db, {
        id: `act_${crypto.randomUUID()}`,
        householdId: scope.householdId,
        actorId: scope.userId,
        actorName,
        eventKind: 'heirloom_recipe_updated',
        summaryVi: `${actorName} đã cập nhật công thức gia truyền "${input.title.trim()}"`,
        metadata: { recipeId: existing.id, slug: existing.slug },
        createdAt: nowIso,
      }),
    ]);

    const updated = await getHeirloomRecipeByIdOrSlug(db, scope.householdId, existing.id);
    return { created: false, recipe: updated! };
  }

  const shortId = crypto.randomUUID().replace(/-/g, '').slice(0, 6).toLowerCase();
  const slug = `custom-${slugifyVietnameseTitle(input.title)}-${shortId}`;
  const id = `custom_${shortId}_${crypto.randomUUID().replace(/-/g, '').slice(0, 6).toLowerCase()}`;

  await db.batch([
    db
      .prepare(
        `INSERT INTO custom_household_recipes
           (id, household_id, author_user_id, slug, title, description, region, category,
            difficulty, prep_time_minutes, cook_time_minutes, servings,
            ingredients_json, steps_json, chef_secret, family_story, is_pinned, cooked_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      )
      .bind(
        id,
        scope.householdId,
        scope.userId,
        slug,
        input.title.trim(),
        input.description.trim(),
        input.region,
        input.category.trim(),
        input.difficulty,
        input.prepTimeMinutes,
        input.cookTimeMinutes,
        input.servings,
        JSON.stringify(normalizedIngredients),
        JSON.stringify(normalizedSteps),
        input.chefSecret?.trim() || null,
        input.familyStory?.trim() || null,
        input.isPinned ? 1 : 0,
        nowIso,
        nowIso,
      ),
    createActivityStatement(db, {
      id: `act_${crypto.randomUUID()}`,
      householdId: scope.householdId,
      actorId: scope.userId,
      actorName,
      eventKind: 'heirloom_recipe_created',
      summaryVi: `${actorName} vừa lưu công thức gia truyền mới: "${input.title.trim()}"`,
      metadata: { recipeId: id, slug },
      createdAt: nowIso,
    }),
  ]);

  const created = await getHeirloomRecipeByIdOrSlug(db, scope.householdId, id);
  return { created: true, recipe: created! };
}

export async function deleteHeirloomRecipe(
  db: D1DatabaseBinding,
  scope: HouseholdScope,
  idOrSlug: string,
): Promise<{ deleted: boolean; deletedId: string | null }> {
  const existing = await db
    .prepare(
      `SELECT id, title, slug FROM custom_household_recipes
        WHERE household_id = ? AND (id = ? OR slug = ?)
        LIMIT 1`,
    )
    .bind(scope.householdId, idOrSlug, idOrSlug)
    .first<{ id: string; title: string; slug: string }>();

  if (!existing) {
    return { deleted: false, deletedId: null };
  }

  const actorName = await resolveActorDisplayName(db, scope.userId);
  const nowIso = new Date().toISOString();

  await db.batch([
    db
      .prepare('DELETE FROM custom_household_recipes WHERE id = ? AND household_id = ?')
      .bind(existing.id, scope.householdId),
    createActivityStatement(db, {
      id: `act_${crypto.randomUUID()}`,
      householdId: scope.householdId,
      actorId: scope.userId,
      actorName,
      eventKind: 'heirloom_recipe_deleted',
      summaryVi: `${actorName} đã xóa công thức gia truyền "${existing.title}"`,
      metadata: { recipeId: existing.id, slug: existing.slug },
      createdAt: nowIso,
    }),
  ]);

  return { deleted: true, deletedId: existing.id };
}
