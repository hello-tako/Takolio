import {
  ApiError,
  BASE_URL,
  fetchJson,
  getCurrentScope,
  guardPrivateSession,
  handleUnauthorized,
  isOffline,
  readCachedInventory,
} from './http';
import { isOfflineGuestSession, privateCacheKey } from '../lib/private-session';

/* ============================================================================
 * TAKOLIO V6 — KITCHEN OS CLIENT & VIETNAMESE HEIRLOOM RECIPE ARCHITECT
 * Resilient D1 Edge Telemetry Client (Single-RTT Batch + ETag 304 SWR + Offline)
 * ============================================================================ */

export type WasteEventType =
  | 'rescued'
  | 'leftover_saved'
  | 'composted'
  | 'expired_discarded';

export type VietnameseRegion = 'bac' | 'trung' | 'nam' | 'all';

export interface KitchenTelemetryMeta {
  serverTimingMs: number | null;
  rawServerTiming: string | null;
  etag: string | null;
  cacheStatus: '200_LIVE' | '304_SWR' | 'OFFLINE_CACHE';
  batchMode: 'Single-RTT D1 Batch';
  fetchedAt: string;
}

export interface HouseholdActivityItem {
  id: string;
  actorName: string;
  actionType: 'waste_rescue' | 'waste_discard' | 'budget_log' | 'pantry_restock' | 'heirloom_save' | 'meal_cooked';
  titleVi: string;
  detailVi?: string;
  impactVnd?: number;
  co2Grams?: number;
  createdAt: string;
}

export interface KitchenPulseSnapshot {
  zeroWasteScore: number;
  savedValueVnd30d: number;
  co2PreventedGrams30d: number;
  cookedMeals30d: number;
  expiringSoonCount: number;
  lowStaplesCount: number;
  spentThisWeekVnd: number;
  weeklyTargetVnd: number;
  heirloomRecipesCount: number;
  recentActivities: HouseholdActivityItem[];
  telemetry: KitchenTelemetryMeta;
}

export interface KitchenWasteEvent {
  id: string;
  itemName: string;
  eventType: WasteEventType;
  quantity: number;
  unit: string;
  estimatedValueVnd: number;
  co2Grams: number;
  actorName: string;
  notes?: string;
  createdAt: string;
}

export interface KitchenBudgetEntry {
  id: string;
  amountVnd: number;
  category: string;
  categoryLabelVi: string;
  note?: string;
  actorName: string;
  createdAt: string;
}

export interface KitchenBudgetCategorySummary {
  category: string;
  labelVi: string;
  amountVnd: number;
  sharePercent: number;
}

export interface KitchenInsightsSnapshot {
  zeroWasteScore: number;
  savedValueVnd30d: number;
  discardedValueVnd30d: number;
  co2PreventedGrams30d: number;
  cookedMeals30d: number;
  rescuedCount30d: number;
  leftoverSavedCount30d: number;
  compostedCount30d: number;
  expiredDiscardedCount30d: number;
  budget: {
    weeklyTargetVnd: number;
    spentThisWeekVnd: number;
    remainingVnd: number;
    burnRatePercent: number;
    entries: KitchenBudgetEntry[];
    byCategory: KitchenBudgetCategorySummary[];
  };
  wasteEvents: KitchenWasteEvent[];
  activityFeed: HouseholdActivityItem[];
  telemetry: KitchenTelemetryMeta;
}

export interface LogWasteEventInput {
  itemName: string;
  eventType: WasteEventType;
  quantity?: number;
  unit?: string;
  estimatedValueVnd?: number;
  co2Grams?: number;
  notes?: string;
}

export interface AddBudgetEntryInput {
  amountVnd: number;
  category: string;
  note?: string;
  spentAt?: string;
}

export interface PantryThresholdItem {
  id: string;
  ingredientKey: string;
  ingredientId?: string | null;
  nameVi: string;
  unit: string;
  minQuantity: number;
  targetQuantity: number;
  currentQuantity: number;
  restockQuantity: number;
  category: string;
  storage: 'fridge' | 'freezer' | 'pantry';
  isLow: boolean;
  updatedAt?: string;
}

export interface UpsertPantryThresholdInput {
  id?: string;
  ingredientKey?: string;
  ingredientId?: string | null;
  nameVi: string;
  unit: string;
  minQuantity: number;
  targetQuantity?: number;
  restockQuantity?: number;
  currentQuantity?: number;
  category?: string;
  storage?: 'fridge' | 'freezer' | 'pantry';
}

export interface AutoRestockResult {
  restockedCount: number;
  addedItems: Array<{
    name: string;
    quantity: number;
    unit: string;
  }>;
  messageVi: string;
}

export interface HeirloomIngredientLine {
  name: string;
  quantity: number;
  unit: string;
  note?: string;
  category: 'protein' | 'produce' | 'aromatics' | 'seasoning';
}

export interface HeirloomStepPhase {
  stepNumber: number;
  phaseTitleVi: string;
  instruction: string;
  cookware: string;
  heatLevel: 'Sơ chế nguội' | 'Lửa liu riu' | 'Lửa vừa' | 'Lửa lớn';
  durationMinutes: number;
  timerSeconds: number;
  sensoryCue: string;
}

export interface HeirloomRecipeDraft {
  title: string;
  slug: string;
  description: string;
  familyStory: string;
  region: VietnameseRegion;
  cookTimeMinutes: number;
  servings: number;
  difficulty: 'easy' | 'medium' | 'hard';
  caloriesPerServing: number;
  proteinGrams: number;
  chefSecret: string;
  ingredients: HeirloomIngredientLine[];
  steps: HeirloomStepPhase[];
  tags: string[];
  sourceMode: 'ai_edge' | 'heritage_architect';
}

export interface HeirloomRecipeRecord extends HeirloomRecipeDraft {
  id: string;
  authorName: string;
  createdAt: string;
}

export interface SaveHeirloomRecipeInput extends Omit<HeirloomRecipeDraft, 'sourceMode'> {
  sourceMode?: 'ai_edge' | 'heritage_architect';
}

const BUDGET_CATEGORY_LABELS: Record<string, string> = {
  cho_truyen_thong: 'Chợ truyền thống',
  market: 'Chợ truyền thống',
  sieu_thi: 'Siêu thị',
  supermarket: 'Siêu thị',
  thit_ca: 'Thịt cá tươi',
  protein: 'Thịt cá tươi',
  rau_cu: 'Rau củ quả',
  produce: 'Rau củ quả',
  gia_vi_kho: 'Gia vị & Đồ khô',
  spices_dry: 'Gia vị & Đồ khô',
  pantry: 'Gia vị & Đồ khô',
  other: 'Chi tiêu bếp khác',
};

export const VIETNAMESE_PANTRY_STAPLES_SEED: ReadonlyArray<{
  ingredientKey: string;
  nameVi: string;
  unit: string;
  minQuantity: number;
  restockQuantity: number;
  category: string;
}> = [
  { ingredientKey: 'nuoc_mam_nhi', nameVi: 'Nước mắm nhĩ', unit: 'ml', minQuantity: 250, restockQuantity: 500, category: 'condiment' },
  { ingredientKey: 'gao_thom_st25', nameVi: 'Gạo thơm ST25', unit: 'kg', minQuantity: 2, restockQuantity: 5, category: 'grain' },
  { ingredientKey: 'dau_an', nameVi: 'Dầu ăn', unit: 'ml', minQuantity: 400, restockQuantity: 1000, category: 'condiment' },
  { ingredientKey: 'toi_kho', nameVi: 'Tỏi khô', unit: 'g', minQuantity: 100, restockQuantity: 250, category: 'aromatics' },
  { ingredientKey: 'hanh_tim', nameVi: 'Hành tím', unit: 'g', minQuantity: 100, restockQuantity: 250, category: 'aromatics' },
  { ingredientKey: 'trung_ga_ta', nameVi: 'Trứng gà ta', unit: 'quả', minQuantity: 6, restockQuantity: 10, category: 'dairy_egg' },
  { ingredientKey: 'duong_vang', nameVi: 'Đường vàng', unit: 'g', minQuantity: 200, restockQuantity: 500, category: 'condiment' },
  { ingredientKey: 'hat_nem', nameVi: 'Hạt nêm', unit: 'g', minQuantity: 150, restockQuantity: 400, category: 'condiment' },
] as const;

interface LocalLedgerState {
  weeklyTargetVnd: number;
  budgetEntries: KitchenBudgetEntry[];
  wasteEvents: KitchenWasteEvent[];
  pantryThresholds: PantryThresholdItem[];
  heirloomRecipes: HeirloomRecipeRecord[];
  activities: HouseholdActivityItem[];
  cookedMeals30d: number;
}

const etagMemoryCache = new Map<string, { etag: string; payload: unknown }>();

export function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `tkv6-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

export function stripVietnameseAccents(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .trim();
}

export function slugifyVietnamese(input: string): string {
  const base = stripVietnameseAccents(input)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 68);
  return base || `mon-gia-truyen-${Date.now().toString(36)}`;
}

export function parseServerTimingMs(headerValue: string | null): number | null {
  if (!headerValue) return null;
  const matches = [...headerValue.matchAll(/dur=([0-9]+(?:\.[0-9]+)?)/gi)];
  if (matches.length === 0) return null;
  const durations = matches
    .map((m) => Number(m[1]))
    .filter((n) => Number.isFinite(n) && n >= 0);
  if (durations.length === 0) return null;
  const totalMatch = /total[^,]*;dur=([0-9]+(?:\.[0-9]+)?)/i.exec(headerValue);
  if (totalMatch) {
    const parsed = Number(totalMatch[1]);
    if (Number.isFinite(parsed)) return Math.round(parsed * 10) / 10;
  }
  const sum = durations.reduce((acc, d) => acc + d, 0);
  return Math.round(sum * 10) / 10;
}

function getScopedStorageKey(suffix: string): string {
  try {
    return privateCacheKey(`kitchen_os_v6_${suffix}`);
  } catch {
    const scope = getCurrentScope();
    const owner = scope.userId || 'guest';
    const hh = scope.householdId || 'local';
    return `takolio_v6_kos:${owner}:${hh}:${suffix}`;
  }
}

function getActorDisplayName(): string {
  if (typeof window === 'undefined') return 'Thành viên bếp';
  try {
    return localStorage.getItem('frigo_display_name')?.trim() || 'Bếp trưởng gia đình';
  } catch {
    return 'Bếp trưởng gia đình';
  }
}

function defaultLocalLedger(): LocalLedgerState {
  const now = Date.now();
  const iso = (minsAgo: number) => new Date(now - minsAgo * 60_000).toISOString();
  const actor = getActorDisplayName();
  return {
    weeklyTargetVnd: 1_200_000,
    cookedMeals30d: 18,
    budgetEntries: [
      {
        id: 'b_seed_1',
        amountVnd: 245_000,
        category: 'cho_truyen_thong',
        categoryLabelVi: 'Chợ truyền thống',
        note: 'Cá trắm tươi, rau muống, hành hoa & riềng sả',
        actorName: actor,
        createdAt: iso(320),
      },
      {
        id: 'b_seed_2',
        amountVnd: 165_000,
        category: 'thit_ca',
        categoryLabelVi: 'Thịt cá tươi',
        note: 'Thịt ba chỉ rút sườn & trứng gà ta',
        actorName: actor,
        createdAt: iso(1480),
      },
      {
        id: 'b_seed_3',
        amountVnd: 95_000,
        category: 'rau_cu',
        categoryLabelVi: 'Rau củ quả',
        note: 'Cà chua chín cây, lá giang, nấm hương',
        actorName: actor,
        createdAt: iso(2840),
      },
    ],
    wasteEvents: [
      {
        id: 'w_seed_1',
        itemName: 'Rau cải ngọt & nấm đùi gà cuối tuần',
        eventType: 'rescued',
        quantity: 350,
        unit: 'g',
        estimatedValueVnd: 42_000,
        co2Grams: 680,
        actorName: actor,
        createdAt: iso(210),
      },
      {
        id: 'w_seed_2',
        itemName: 'Thịt kho trứng cất hộp thuỷ tinh bữa trưa mai',
        eventType: 'leftover_saved',
        quantity: 2,
        unit: 'khẩu phần',
        estimatedValueVnd: 65_000,
        co2Grams: 920,
        actorName: actor,
        createdAt: iso(980),
      },
      {
        id: 'w_seed_3',
        itemName: 'Gốc rau & vỏ hành tỏi ủ phân hữu cơ',
        eventType: 'composted',
        quantity: 200,
        unit: 'g',
        estimatedValueVnd: 15_000,
        co2Grams: 310,
        actorName: actor,
        createdAt: iso(2100),
      },
    ],
    pantryThresholds: [],
    heirloomRecipes: [],
    activities: [
      {
        id: 'act_seed_1',
        actorName: actor,
        actionType: 'waste_rescue',
        titleVi: 'Đã giải cứu kịp thời Rau cải ngọt & nấm đùi gà',
        detailVi: 'Tiết kiệm 42.000đ · Giảm 680g phát thải CO2e',
        impactVnd: 42_000,
        co2Grams: 680,
        createdAt: iso(210),
      },
      {
        id: 'act_seed_2',
        actorName: actor,
        actionType: 'budget_log',
        titleVi: 'Ghi sổ đi chợ truyền thống 245.000đ',
        detailVi: 'Cá trắm tươi, rau muống, hành hoa & riềng sả',
        impactVnd: 245_000,
        createdAt: iso(320),
      },
      {
        id: 'act_seed_3',
        actorName: actor,
        actionType: 'waste_rescue',
        titleVi: 'Cất hộp phần ăn dư Thịt kho trứng cho bữa trưa',
        detailVi: 'Bảo toàn 65.000đ · Ngăn mát 3°C có nhãn FEFO',
        impactVnd: 65_000,
        co2Grams: 920,
        createdAt: iso(980),
      },
    ],
  };
}

function readLocalLedger(): LocalLedgerState {
  if (typeof window === 'undefined') return defaultLocalLedger();
  try {
    const raw = localStorage.getItem(getScopedStorageKey('ledger'));
    if (!raw) {
      const seeded = defaultLocalLedger();
      localStorage.setItem(getScopedStorageKey('ledger'), JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw) as Partial<LocalLedgerState>;
    const fallback = defaultLocalLedger();
    return {
      weeklyTargetVnd: typeof parsed.weeklyTargetVnd === 'number' && parsed.weeklyTargetVnd > 0
        ? parsed.weeklyTargetVnd
        : fallback.weeklyTargetVnd,
      cookedMeals30d: typeof parsed.cookedMeals30d === 'number' ? parsed.cookedMeals30d : fallback.cookedMeals30d,
      budgetEntries: Array.isArray(parsed.budgetEntries) ? parsed.budgetEntries : fallback.budgetEntries,
      wasteEvents: Array.isArray(parsed.wasteEvents) ? parsed.wasteEvents : fallback.wasteEvents,
      pantryThresholds: Array.isArray(parsed.pantryThresholds) ? parsed.pantryThresholds : [],
      heirloomRecipes: Array.isArray(parsed.heirloomRecipes) ? parsed.heirloomRecipes : [],
      activities: Array.isArray(parsed.activities) ? parsed.activities : fallback.activities,
    };
  } catch {
    return defaultLocalLedger();
  }
}

function writeLocalLedger(next: LocalLedgerState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(getScopedStorageKey('ledger'), JSON.stringify(next));
  } catch {
    // Ignore storage quota errors in restricted browsing modes
  }
}

function buildTenantHeaders(extra?: Record<string, string>): Record<string, string> {
  const scope = getCurrentScope();
  const headers: Record<string, string> = {};
  if (scope.userId) headers['x-user-id'] = scope.userId;
  if (scope.householdId) headers['x-household-id'] = scope.householdId;
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v !== undefined) headers[k] = v;
    }
  }
  return headers;
}

function shouldFallbackToLocal(err: unknown): boolean {
  if (isOffline(err)) return true;
  if (err instanceof ApiError) {
    if (err.kind === 'offline') return true;
    if (err.status === 404 || err.status === 501 || err.status === 502 || err.status === 503) {
      return true;
    }
  }
  return false;
}

async function fetchKitchenOsWithMeta<T = Record<string, unknown>>(
  subpath: string,
  cacheSlot: 'pulse' | 'insights',
): Promise<{ data: T; telemetry: KitchenTelemetryMeta }> {
  const assertSessionCurrent = guardPrivateSession();
  const scope = getCurrentScope();
  if (!scope.userId || !scope.householdId) {
    throw new ApiError('auth', 'Vui lòng đăng nhập hoặc bắt đầu phiên khách.');
  }
  if (isOfflineGuestSession()) {
    throw new ApiError('offline', 'Phiên khách ngoại tuyến.', undefined, { retryable: false });
  }

  const cacheKey = `${scope.userId}:${scope.householdId}:${cacheSlot}`;
  const cachedEntry = etagMemoryCache.get(cacheKey);
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Frigo-Expected-User-Id': scope.userId,
    'X-Frigo-Expected-Household-Id': scope.householdId,
    ...buildTenantHeaders(),
  };
  if (cachedEntry?.etag) {
    headers['If-None-Match'] = cachedEntry.etag;
  }

  const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${subpath}`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });
  } catch {
    assertSessionCurrent();
    throw new ApiError('offline', `Không có kết nối mạng khi gọi ${subpath}`, undefined, { retryable: true });
  }

  assertSessionCurrent();
  const elapsedClientMs =
    Math.round(((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt) * 10) / 10;
  const rawServerTiming = res.headers.get('Server-Timing');
  const parsedServerTiming = parseServerTimingMs(rawServerTiming);
  const etag = res.headers.get('ETag');

  if (res.status === 304 && cachedEntry) {
    return {
      data: cachedEntry.payload as T,
      telemetry: {
        serverTimingMs: parsedServerTiming ?? elapsedClientMs,
        rawServerTiming,
        etag: etag ?? cachedEntry.etag,
        cacheStatus: '304_SWR',
        batchMode: 'Single-RTT D1 Batch',
        fetchedAt: new Date().toISOString(),
      },
    };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const requestId = res.headers.get('X-Request-Id') || undefined;
    if (res.status === 401) {
      handleUnauthorized();
      throw new ApiError('auth', `HTTP 401: ${text}`, 401, { requestId });
    }
    if (res.status === 403) {
      throw new ApiError('auth', `HTTP 403: ${text}`, 403, { requestId });
    }
    throw new ApiError('http', `HTTP ${res.status}: ${text}`, res.status, { requestId });
  }

  const json = (await res.json()) as T;
  assertSessionCurrent();
  if (etag) {
    etagMemoryCache.set(cacheKey, { etag, payload: json });
  }
  return {
    data: json,
    telemetry: {
      serverTimingMs: parsedServerTiming ?? elapsedClientMs,
      rawServerTiming,
      etag,
      cacheStatus: '200_LIVE',
      batchMode: 'Single-RTT D1 Batch',
      fetchedAt: new Date().toISOString(),
    },
  };
}

function matchInventoryStockForStaple(nameVi: string): number {
  const inventory = readCachedInventory();
  if (!Array.isArray(inventory) || inventory.length === 0) return 0;
  const target = stripVietnameseAccents(nameVi);
  let total = 0;
  for (const item of inventory) {
    if (!item || typeof item.name !== 'string') continue;
    const candidate = stripVietnameseAccents(item.name);
    if (
      candidate.includes(target) ||
      target.includes(candidate) ||
      (target.includes('nuoc mam') && candidate.includes('nuoc mam')) ||
      (target.includes('gao') && candidate.includes('gao')) ||
      (target.includes('trung') && candidate.includes('trung')) ||
      (target.includes('toi') && candidate.includes('toi')) ||
      (target.includes('hanh tim') && candidate.includes('hanh'))
    ) {
      const qty = Number(item.quantity);
      if (Number.isFinite(qty) && qty > 0) total += qty;
    }
  }
  return Math.round(total * 100) / 100;
}

function normalizePantryThreshold(raw: Record<string, unknown>, index = 0): PantryThresholdItem {
  const nameVi = String(
    raw.nameVi ?? raw.name ?? raw.ingredientName ?? raw.title ?? `Gia vị nền #${index + 1}`,
  ).trim();
  const ingredientKey = String(
    raw.ingredientKey ?? raw.key ?? raw.ingredientId ?? slugifyVietnamese(nameVi).replace(/-/g, '_'),
  );
  const unit = String(raw.unit ?? 'g').trim() || 'g';
  const minQuantity = Math.max(
    0.5,
    Number(raw.minQuantity ?? raw.thresholdQuantity ?? raw.minThreshold ?? 1) || 1,
  );
  const targetQuantity = Math.max(
    minQuantity,
    Number(raw.targetQuantity ?? raw.restockQuantity ?? minQuantity * 2) || minQuantity * 2,
  );
  const rawCurrent =
    raw.currentQuantity ?? raw.currentStock ?? raw.inStockQuantity ?? raw.availableQuantity;
  const currentQuantity =
    rawCurrent !== undefined && rawCurrent !== null && Number.isFinite(Number(rawCurrent))
      ? Math.max(0, Number(rawCurrent))
      : matchInventoryStockForStaple(nameVi);
  const restockQuantity = Math.max(
    0.5,
    Number(
      raw.restockQuantity !== undefined && Number(raw.restockQuantity) > 0
        ? raw.restockQuantity
        : raw.suggestedRestockQuantity ?? Math.max(1, targetQuantity - currentQuantity),
    ) || minQuantity,
  );
  const isLow =
    typeof raw.isLow === 'boolean'
      ? raw.isLow
      : typeof raw.isLowStock === 'boolean'
        ? raw.isLowStock
        : raw.status === 'low' || raw.needsRestock === true || currentQuantity < minQuantity;
  const rawStorage = String(raw.storage ?? 'pantry').toLowerCase();
  const storage: 'fridge' | 'freezer' | 'pantry' =
    rawStorage === 'fridge' || rawStorage === 'freezer' ? rawStorage : 'pantry';

  return {
    id: String(raw.id ?? `pt_${ingredientKey}`),
    ingredientKey,
    ingredientId: typeof raw.ingredientId === 'string' ? raw.ingredientId : null,
    nameVi,
    unit,
    minQuantity,
    targetQuantity,
    currentQuantity,
    restockQuantity,
    category: String(raw.category ?? 'seasoning'),
    storage,
    isLow,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined,
  };
}

function normalizeWasteEvent(raw: Record<string, unknown>, index = 0): KitchenWasteEvent {
  const rawType = String(raw.eventType ?? raw.type ?? raw.kind ?? 'rescued');
  const validTypes: WasteEventType[] = ['rescued', 'leftover_saved', 'composted', 'expired_discarded'];
  const eventType: WasteEventType = validTypes.includes(rawType as WasteEventType)
    ? (rawType as WasteEventType)
    : 'rescued';
  const estimatedValueVnd = Math.max(
    0,
    Math.round(Number(raw.estimatedValueVnd ?? raw.valueVnd ?? raw.amountVnd ?? 35_000) || 0),
  );
  const co2Grams = Math.max(
    0,
    Math.round(
      Number(
        raw.co2Grams ??
          raw.co2eGrams ??
          raw.co2PreventedGrams ??
          Math.round((estimatedValueVnd / 1_000) * 16),
      ) || 0,
    ),
  );
  return {
    id: String(raw.id ?? `we_${Date.now()}_${index}`),
    itemName: String(raw.itemName ?? raw.name ?? raw.ingredientName ?? 'Thực phẩm trong bếp').trim(),
    eventType,
    quantity: Math.max(0.1, Number(raw.quantity ?? 1) || 1),
    unit: String(raw.unit ?? 'phần'),
    estimatedValueVnd,
    co2Grams,
    actorName: String(raw.actorName ?? raw.memberName ?? raw.displayName ?? getActorDisplayName()),
    notes: typeof raw.notes === 'string' ? raw.notes : typeof raw.note === 'string' ? raw.note : undefined,
    createdAt:
      typeof raw.occurredAt === 'string'
        ? raw.occurredAt
        : typeof raw.createdAt === 'string'
          ? raw.createdAt
          : new Date().toISOString(),
  };
}

function resolveBudgetCategoryLabel(category: string): string {
  const clean = category.trim();
  if (BUDGET_CATEGORY_LABELS[clean]) return BUDGET_CATEGORY_LABELS[clean];
  return clean || 'Đi chợ gia đình';
}

function normalizeBudgetEntry(raw: Record<string, unknown>, index = 0): KitchenBudgetEntry {
  const category = String(raw.category ?? 'cho_truyen_thong');
  return {
    id: String(raw.id ?? `be_${Date.now()}_${index}`),
    amountVnd: Math.max(0, Math.round(Number(raw.amountVnd ?? raw.amount ?? 0) || 0)),
    category,
    categoryLabelVi: String(raw.categoryLabelVi ?? resolveBudgetCategoryLabel(category)),
    note: typeof raw.note === 'string' ? raw.note : typeof raw.description === 'string' ? raw.description : undefined,
    actorName: String(raw.actorName ?? raw.memberName ?? raw.displayName ?? getActorDisplayName()),
    createdAt:
      typeof raw.spentAt === 'string'
        ? raw.spentAt
        : typeof raw.createdAt === 'string'
          ? raw.createdAt
          : new Date().toISOString(),
  };
}

function normalizeActivityItem(raw: Record<string, unknown>, index = 0): HouseholdActivityItem {
  const rawType = String(raw.actionType ?? raw.eventKind ?? raw.type ?? raw.eventType ?? 'waste_rescue');
  const mappedType: HouseholdActivityItem['actionType'] =
    rawType.includes('expired_discarded') || rawType === 'waste_discard'
      ? 'waste_discard'
      : rawType.startsWith('budget_') || rawType === 'budget_log' || rawType === 'budget_entry'
        ? 'budget_log'
        : rawType.startsWith('pantry_') || rawType === 'auto_restock'
          ? 'pantry_restock'
          : rawType.startsWith('heirloom_') || rawType === 'heirloom_save'
            ? 'heirloom_save'
            : rawType === 'meal_cooked'
              ? 'meal_cooked'
              : 'waste_rescue';

  const meta =
    raw.metadata && typeof raw.metadata === 'object'
      ? (raw.metadata as Record<string, unknown>)
      : undefined;

  return {
    id: String(raw.id ?? `act_${Date.now()}_${index}`),
    actorName: String(raw.actorName ?? raw.memberName ?? raw.userName ?? getActorDisplayName()),
    actionType: mappedType,
    titleVi: String(
      raw.titleVi ?? raw.summaryVi ?? raw.title ?? raw.summary ?? raw.message ?? 'Cập nhật sổ cái bếp gia đình',
    ),
    detailVi: typeof raw.detailVi === 'string' ? raw.detailVi : typeof raw.detail === 'string' ? raw.detail : undefined,
    impactVnd: Number.isFinite(Number(raw.impactVnd ?? raw.amountVnd ?? meta?.estimatedValueVnd ?? meta?.amountVnd))
      ? Number(raw.impactVnd ?? raw.amountVnd ?? meta?.estimatedValueVnd ?? meta?.amountVnd)
      : undefined,
    co2Grams: Number.isFinite(Number(raw.co2Grams ?? meta?.co2Grams))
      ? Number(raw.co2Grams ?? meta?.co2Grams)
      : undefined,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
  };
}

function computeZeroWasteMetrics(events: KitchenWasteEvent[]) {
  let savedValueVnd30d = 0;
  let discardedValueVnd30d = 0;
  let co2PreventedGrams30d = 0;
  let rescuedCount30d = 0;
  let leftoverSavedCount30d = 0;
  let compostedCount30d = 0;
  let expiredDiscardedCount30d = 0;

  for (const ev of events) {
    if (ev.eventType === 'expired_discarded') {
      discardedValueVnd30d += ev.estimatedValueVnd;
      expiredDiscardedCount30d += 1;
    } else {
      savedValueVnd30d += ev.estimatedValueVnd;
      co2PreventedGrams30d += ev.co2Grams;
      if (ev.eventType === 'rescued') rescuedCount30d += 1;
      else if (ev.eventType === 'leftover_saved') leftoverSavedCount30d += 1;
      else if (ev.eventType === 'composted') compostedCount30d += 1;
    }
  }

  const positiveWeight = rescuedCount30d * 14 + leftoverSavedCount30d * 12 + compostedCount30d * 8;
  const penaltyWeight = expiredDiscardedCount30d * 16;
  const totalValue = savedValueVnd30d + discardedValueVnd30d;
  const valueRatioScore =
    totalValue > 0 ? Math.round((savedValueVnd30d / totalValue) * 100) : 88;
  const zeroWasteScore = Math.max(
    18,
    Math.min(100, Math.round(valueRatioScore * 0.75 + Math.min(100, 76 + positiveWeight - penaltyWeight) * 0.25)),
  );

  return {
    zeroWasteScore,
    savedValueVnd30d,
    discardedValueVnd30d,
    co2PreventedGrams30d,
    rescuedCount30d,
    leftoverSavedCount30d,
    compostedCount30d,
    expiredDiscardedCount30d,
  };
}

function computeBudgetBreakdown(
  entries: KitchenBudgetEntry[],
  weeklyTargetVnd: number,
  overrideSpentVnd?: number,
) {
  const sumEntries = entries.reduce((acc, item) => acc + item.amountVnd, 0);
  const spentThisWeekVnd =
    typeof overrideSpentVnd === 'number' && Number.isFinite(overrideSpentVnd) && overrideSpentVnd >= sumEntries
      ? Math.round(overrideSpentVnd)
      : sumEntries;
  const safeTarget = Math.max(100_000, Math.round(weeklyTargetVnd || 1_200_000));
  const remainingVnd = safeTarget - spentThisWeekVnd;
  const burnRatePercent = Math.max(0, Math.round((spentThisWeekVnd / safeTarget) * 100));

  const totalsByCat = new Map<string, number>();
  for (const entry of entries) {
    totalsByCat.set(entry.category, (totalsByCat.get(entry.category) ?? 0) + entry.amountVnd);
  }
  const denom = Math.max(1, sumEntries);
  const byCategory: KitchenBudgetCategorySummary[] = [...totalsByCat.entries()]
    .map(([category, amountVnd]) => ({
      category,
      labelVi: resolveBudgetCategoryLabel(category),
      amountVnd,
      sharePercent: Math.round((amountVnd / denom) * 100),
    }))
    .sort((a, b) => b.amountVnd - a.amountVnd);

  return {
    weeklyTargetVnd: safeTarget,
    spentThisWeekVnd,
    remainingVnd,
    burnRatePercent,
    entries,
    byCategory,
  };
}

function buildLocalPulseSnapshot(cacheStatus: KitchenTelemetryMeta['cacheStatus'] = 'OFFLINE_CACHE'): KitchenPulseSnapshot {
  const ledger = readLocalLedger();
  const metrics = computeZeroWasteMetrics(ledger.wasteEvents);
  const budget = computeBudgetBreakdown(ledger.budgetEntries, ledger.weeklyTargetVnd);
  const lowStaplesCount = ledger.pantryThresholds.filter((t) => t.isLow).length;
  const inventory = readCachedInventory();
  const expiringSoonCount = Array.isArray(inventory)
    ? inventory.filter((i) => i && (i.freshness === 'expiring_soon' || i.freshness === 'expired')).length
    : 0;

  return {
    zeroWasteScore: metrics.zeroWasteScore,
    savedValueVnd30d: metrics.savedValueVnd30d,
    co2PreventedGrams30d: metrics.co2PreventedGrams30d,
    cookedMeals30d: ledger.cookedMeals30d,
    expiringSoonCount,
    lowStaplesCount,
    spentThisWeekVnd: budget.spentThisWeekVnd,
    weeklyTargetVnd: budget.weeklyTargetVnd,
    heirloomRecipesCount: ledger.heirloomRecipes.length,
    recentActivities: ledger.activities.slice(0, 8),
    telemetry: {
      serverTimingMs: null,
      rawServerTiming: null,
      etag: null,
      cacheStatus,
      batchMode: 'Single-RTT D1 Batch',
      fetchedAt: new Date().toISOString(),
    },
  };
}

function buildLocalInsightsSnapshot(cacheStatus: KitchenTelemetryMeta['cacheStatus'] = 'OFFLINE_CACHE'): KitchenInsightsSnapshot {
  const ledger = readLocalLedger();
  const metrics = computeZeroWasteMetrics(ledger.wasteEvents);
  const budget = computeBudgetBreakdown(ledger.budgetEntries, ledger.weeklyTargetVnd);
  return {
    ...metrics,
    cookedMeals30d: ledger.cookedMeals30d,
    budget,
    wasteEvents: ledger.wasteEvents,
    activityFeed: ledger.activities,
    telemetry: {
      serverTimingMs: null,
      rawServerTiming: null,
      etag: null,
      cacheStatus,
      batchMode: 'Single-RTT D1 Batch',
      fetchedAt: new Date().toISOString(),
    },
  };
}

function normalizePulseResponse(
  raw: Record<string, unknown>,
  telemetry: KitchenTelemetryMeta,
): KitchenPulseSnapshot {
  const pulseObj =
    raw.pulse && typeof raw.pulse === 'object' ? (raw.pulse as Record<string, unknown>) : raw;
  const fallback = buildLocalPulseSnapshot(telemetry.cacheStatus);

  const serverTimingFromBody = Number(
    (raw.telemetry as Record<string, unknown> | undefined)?.durationMs ??
      (pulseObj.telemetry as Record<string, unknown> | undefined)?.durationMs,
  );
  const mergedTelemetry: KitchenTelemetryMeta = {
    ...telemetry,
    serverTimingMs:
      telemetry.serverTimingMs ??
      (Number.isFinite(serverTimingFromBody) ? Math.round(serverTimingFromBody * 10) / 10 : null),
  };

  const rawActivities =
    (Array.isArray(pulseObj.recentActivities) && pulseObj.recentActivities) ||
    (Array.isArray(pulseObj.recentActivity) && pulseObj.recentActivity) ||
    (Array.isArray(pulseObj.activities) && pulseObj.activities) ||
    (Array.isArray(raw.recentActivities) && raw.recentActivities) ||
    (Array.isArray(raw.recentActivity) && raw.recentActivity) ||
    null;

  const staplesObj =
    pulseObj.staples && typeof pulseObj.staples === 'object'
      ? (pulseObj.staples as Record<string, unknown>)
      : undefined;
  const invObj =
    pulseObj.inventory && typeof pulseObj.inventory === 'object'
      ? (pulseObj.inventory as Record<string, unknown>)
      : undefined;

  return {
    zeroWasteScore: Math.max(
      0,
      Math.min(
        100,
        Math.round(
          Number(
            pulseObj.zeroWasteScore ??
              pulseObj.wasteScore ??
              pulseObj.score ??
              fallback.zeroWasteScore,
          ) || fallback.zeroWasteScore,
        ),
      ),
    ),
    savedValueVnd30d: Math.max(
      0,
      Math.round(
        Number(
          pulseObj.savedValueVnd30d ??
            pulseObj.rescuedValueVnd30d ??
            pulseObj.vndSaved30d ??
            pulseObj.foodSavedVnd30d ??
            fallback.savedValueVnd30d,
        ) || 0,
      ),
    ),
    co2PreventedGrams30d: Math.max(
      0,
      Math.round(
        Number(
          pulseObj.co2PreventedGrams30d ??
            pulseObj.co2eSavedGrams30d ??
            pulseObj.co2SavedGrams30d ??
            pulseObj.co2Grams30d ??
            fallback.co2PreventedGrams30d,
        ) || 0,
      ),
    ),
    cookedMeals30d: Math.max(
      0,
      Math.round(
        Number(
          pulseObj.cookedMeals30d ??
            pulseObj.homeCookedMeals30d ??
            pulseObj.mealsCooked30d ??
            fallback.cookedMeals30d,
        ) || 0,
      ),
    ),
    expiringSoonCount: Math.max(
      0,
      Math.round(
        Number(
          pulseObj.expiringSoonCount ??
            invObj?.expiringWithin48hCount ??
            fallback.expiringSoonCount,
        ) || 0,
      ),
    ),
    lowStaplesCount: Math.max(
      0,
      Math.round(
        Number(
          pulseObj.lowStaplesCount ??
            pulseObj.lowPantryCount ??
            staplesObj?.lowStockCount ??
            fallback.lowStaplesCount,
        ) || 0,
      ),
    ),
    spentThisWeekVnd: Math.max(
      0,
      Math.round(
        Number(
          pulseObj.spentThisWeekVnd ??
            pulseObj.weeklySpentVnd ??
            (pulseObj.budget as Record<string, unknown> | undefined)?.spentThisWeekVnd ??
            fallback.spentThisWeekVnd,
        ) || 0,
      ),
    ),
    weeklyTargetVnd: Math.max(
      100_000,
      Math.round(
        Number(
          pulseObj.weeklyTargetVnd ??
            pulseObj.budgetTargetVnd ??
            (pulseObj.budget as Record<string, unknown> | undefined)?.weeklyTargetVnd ??
            fallback.weeklyTargetVnd,
        ) || fallback.weeklyTargetVnd,
      ),
    ),
    heirloomRecipesCount: Math.max(
      0,
      Math.round(Number(pulseObj.heirloomRecipesCount ?? pulseObj.heirloomCount ?? fallback.heirloomRecipesCount) || 0),
    ),
    recentActivities: rawActivities
      ? rawActivities.map((item, idx) =>
          normalizeActivityItem((item && typeof item === 'object' ? item : {}) as Record<string, unknown>, idx),
        )
      : fallback.recentActivities,
    telemetry: mergedTelemetry,
  };
}

function normalizeInsightsResponse(
  raw: Record<string, unknown>,
  telemetry: KitchenTelemetryMeta,
): KitchenInsightsSnapshot {
  const root =
    raw.insights && typeof raw.insights === 'object'
      ? (raw.insights as Record<string, unknown>)
      : raw;
  const wasteSummary =
    root.zeroWaste && typeof root.zeroWaste === 'object'
      ? (root.zeroWaste as Record<string, unknown>)
      : root;
  const budgetObj =
    root.budget && typeof root.budget === 'object'
      ? (root.budget as Record<string, unknown>)
      : root;

  const rawWasteArr =
    (Array.isArray(root.wasteEvents) && root.wasteEvents) ||
    (Array.isArray(wasteSummary.events) && wasteSummary.events) ||
    (Array.isArray(raw.wasteEvents) && raw.wasteEvents) ||
    [];
  const wasteEvents = rawWasteArr.map((item, idx) =>
    normalizeWasteEvent((item && typeof item === 'object' ? item : {}) as Record<string, unknown>, idx),
  );

  const computedWaste = computeZeroWasteMetrics(wasteEvents);

  const rawEntriesArr =
    (Array.isArray(budgetObj.entries) && budgetObj.entries) ||
    (Array.isArray(root.budgetEntries) && root.budgetEntries) ||
    (Array.isArray(raw.budgetEntries) && raw.budgetEntries) ||
    [];
  const budgetEntries = rawEntriesArr.map((item, idx) =>
    normalizeBudgetEntry((item && typeof item === 'object' ? item : {}) as Record<string, unknown>, idx),
  );

  const weeklyTargetVnd = Math.max(
    100_000,
    Math.round(
      Number(
        budgetObj.weeklyTargetVnd ??
          budgetObj.targetVnd ??
          budgetObj.amountVnd ??
          root.weeklyTargetVnd ??
          1_200_000,
      ) || 1_200_000,
    ),
  );
  const overrideSpent = Number(
    budgetObj.spentThisWeekVnd ?? budgetObj.weeklySpentVnd ?? root.spentThisWeekVnd,
  );
  const budget = computeBudgetBreakdown(
    budgetEntries,
    weeklyTargetVnd,
    Number.isFinite(overrideSpent) ? overrideSpent : undefined,
  );

  const rawActivities =
    (Array.isArray(root.activityTimeline) && root.activityTimeline) ||
    (Array.isArray(root.activityFeed) && root.activityFeed) ||
    (Array.isArray(root.recentActivities) && root.recentActivities) ||
    (Array.isArray(root.recentActivity) && root.recentActivity) ||
    (Array.isArray(root.activities) && root.activities) ||
    null;

  const synthesizedFeed: HouseholdActivityItem[] = rawActivities
    ? rawActivities.map((item, idx) =>
        normalizeActivityItem((item && typeof item === 'object' ? item : {}) as Record<string, unknown>, idx),
      )
    : [
        ...wasteEvents.slice(0, 6).map((ev) => ({
          id: `act_w_${ev.id}`,
          actorName: ev.actorName,
          actionType: (ev.eventType === 'expired_discarded' ? 'waste_discard' : 'waste_rescue') as HouseholdActivityItem['actionType'],
          titleVi:
            ev.eventType === 'rescued'
              ? `Đã giải cứu kịp thời ${ev.itemName}`
              : ev.eventType === 'leftover_saved'
                ? `Cất hộp bảo quản phần ăn dư: ${ev.itemName}`
                : ev.eventType === 'composted'
                  ? `Ủ phân hữu cơ tuần hoàn: ${ev.itemName}`
                  : `Ghi nhận thực phẩm quá hạn: ${ev.itemName}`,
          detailVi: `${ev.quantity} ${ev.unit} · ${ev.estimatedValueVnd.toLocaleString('vi-VN')}đ`,
          impactVnd: ev.estimatedValueVnd,
          co2Grams: ev.co2Grams,
          createdAt: ev.createdAt,
        })),
        ...budgetEntries.slice(0, 5).map((be) => ({
          id: `act_b_${be.id}`,
          actorName: be.actorName,
          actionType: 'budget_log' as const,
          titleVi: `Chi tiêu ${be.categoryLabelVi}: ${be.amountVnd.toLocaleString('vi-VN')}đ`,
          detailVi: be.note,
          impactVnd: be.amountVnd,
          createdAt: be.createdAt,
        })),
      ].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  return {
    zeroWasteScore: Math.max(
      0,
      Math.min(
        100,
        Math.round(
          Number(
            wasteSummary.zeroWasteScore ??
              root.zeroWasteScore ??
              wasteSummary.score ??
              (wasteEvents.length > 0 ? computedWaste.zeroWasteScore : 90),
          ),
        ),
      ),
    ),
    savedValueVnd30d: Math.max(
      0,
      Math.round(
        Number(
          wasteSummary.savedValueVnd30d ??
            wasteSummary.vndSaved30d ??
            wasteSummary.rescuedValueVnd30d ??
            root.savedValueVnd30d ??
            root.vndSaved30d ??
            computedWaste.savedValueVnd30d,
        ) || 0,
      ),
    ),
    discardedValueVnd30d: Math.max(
      0,
      Math.round(
        Number(
          wasteSummary.discardedValueVnd30d ??
            wasteSummary.vndWasted30d ??
            wasteSummary.wastedValueVnd30d ??
            root.discardedValueVnd30d ??
            computedWaste.discardedValueVnd30d,
        ) || 0,
      ),
    ),
    co2PreventedGrams30d: Math.max(
      0,
      Math.round(
        Number(
          wasteSummary.co2PreventedGrams30d ??
            wasteSummary.co2SavedGrams30d ??
            wasteSummary.co2eSavedGrams30d ??
            root.co2PreventedGrams30d ??
            computedWaste.co2PreventedGrams30d,
        ) || 0,
      ),
    ),
    cookedMeals30d: Math.max(
      0,
      Math.round(
        Number(
          root.cookedMeals30d ??
            (root.cookingStreak as Record<string, unknown> | undefined)?.cookedMeals30d ??
            root.homeCookedMeals30d ??
            wasteSummary.cookedMeals30d ??
            16,
        ) || 0,
      ),
    ),
    rescuedCount30d: Math.max(
      0,
      Math.round(Number(wasteSummary.rescuedCount30d ?? computedWaste.rescuedCount30d) || 0),
    ),
    leftoverSavedCount30d: Math.max(
      0,
      Math.round(Number(wasteSummary.leftoverSavedCount30d ?? computedWaste.leftoverSavedCount30d) || 0),
    ),
    compostedCount30d: Math.max(
      0,
      Math.round(Number(wasteSummary.compostedCount30d ?? computedWaste.compostedCount30d) || 0),
    ),
    expiredDiscardedCount30d: Math.max(
      0,
      Math.round(
        Number(
          wasteSummary.expiredDiscardedCount30d ??
            wasteSummary.discardedCount30d ??
            computedWaste.expiredDiscardedCount30d,
        ) || 0,
      ),
    ),
    budget,
    wasteEvents,
    activityFeed: synthesizedFeed,
    telemetry,
  };
}

function normalizeHeirloomRecipe(raw: Record<string, unknown>, index = 0): HeirloomRecipeRecord {
  const title = String(raw.title ?? raw.name ?? `Món Gia Truyền #${index + 1}`).trim();
  const slug = String(raw.slug ?? slugifyVietnamese(title));
  const rawRegion = String(raw.region ?? 'all').toLowerCase();
  const region: VietnameseRegion =
    rawRegion === 'bac' || rawRegion === 'trung' || rawRegion === 'nam' ? rawRegion : 'all';

  const rawIngredients = Array.isArray(raw.ingredients) ? raw.ingredients : [];
  const ingredients: HeirloomIngredientLine[] = rawIngredients.map((ing) => {
    const obj = (ing && typeof ing === 'object' ? ing : {}) as Record<string, unknown>;
    const cat = String(obj.category ?? 'seasoning');
    return {
      name: String(obj.name ?? obj.ingredientName ?? 'Nguyên liệu').trim(),
      quantity: Math.max(
        0.1,
        Number(obj.quantity ?? obj.requiredQuantity ?? obj.amount ?? 1) || 1,
      ),
      unit: String(obj.unit ?? 'g').trim(),
      note: typeof obj.note === 'string' ? obj.note : undefined,
      category:
        cat === 'protein' || cat === 'produce' || cat === 'aromatics' ? cat : 'seasoning',
    };
  });

  const rawSteps = Array.isArray(raw.steps) ? raw.steps : [];
  const steps: HeirloomStepPhase[] = rawSteps.map((st, idx) => {
    const obj = (st && typeof st === 'object' ? st : {}) as Record<string, unknown>;
    const durationMinutes = Math.max(
      1,
      Math.round(Number(obj.durationMinutes ?? obj.timerMinutes ?? 8) || 8),
    );
    const heatRaw = String(obj.heatLevel ?? 'Lửa vừa');
    const heatLevel: HeirloomStepPhase['heatLevel'] =
      heatRaw === 'Sơ chế nguội' || heatRaw === 'Lửa liu riu' || heatRaw === 'Lửa lớn'
        ? heatRaw
        : 'Lửa vừa';
    return {
      stepNumber: Number(obj.stepNumber ?? idx + 1) || idx + 1,
      phaseTitleVi: String(obj.phaseTitleVi ?? obj.title ?? `Công đoạn ${idx + 1}`),
      instruction: String(obj.instruction ?? obj.text ?? obj.description ?? ''),
      cookware: String(obj.cookware ?? 'Nồi bếp gia đình'),
      heatLevel,
      durationMinutes,
      timerSeconds: Math.max(30, Math.round(Number(obj.timerSeconds ?? durationMinutes * 60) || durationMinutes * 60)),
      sensoryCue: String(
        obj.sensoryCue ?? obj.tip ?? 'Dậy mùi thơm hài hòa, màu sắc tươi tắn chuẩn vị nhà.',
      ),
    };
  });

  const difficultyRaw = String(raw.difficulty ?? 'medium');
  const difficulty: 'easy' | 'medium' | 'hard' =
    difficultyRaw === 'easy' || difficultyRaw === 'hard' ? difficultyRaw : 'medium';

  return {
    id: String(raw.id ?? `hr_${slug}_${index}`),
    title,
    slug,
    description: String(raw.description ?? 'Công thức gia truyền lưu giữ hương vị mâm cơm nhà.'),
    familyStory: String(raw.familyStory ?? raw.story ?? 'Ký ức bếp ấm gia đình qua nhiều thế hệ.'),
    region,
    cookTimeMinutes: Math.max(5, Math.round(Number(raw.cookTimeMinutes ?? 35) || 35)),
    servings: Math.max(1, Math.min(16, Math.round(Number(raw.servings ?? 4) || 4))),
    difficulty,
    caloriesPerServing: Math.max(80, Math.round(Number(raw.caloriesPerServing ?? raw.calories ?? 420) || 420)),
    proteinGrams: Math.max(4, Math.round(Number(raw.proteinGrams ?? raw.protein ?? 26) || 26)),
    chefSecret: String(
      raw.chefSecret ??
        'Canh lửa ổn định và nêm nước mắm nhĩ ở phút cuối để giữ trọn hậu vị thơm sâu.',
    ),
    ingredients,
    steps,
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : ['gia-truyen', region],
    sourceMode: raw.sourceMode === 'ai_edge' ? 'ai_edge' : 'heritage_architect',
    authorName: String(raw.authorName ?? getActorDisplayName()),
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
  };
}

/* ============================================================================
 * AUTHENTIC VIETNAMESE HEIRLOOM RECIPE ARCHITECT (CLIENT + EDGE HYBRID)
 * ============================================================================ */

type CulinaryTechnique = 'kho' | 'canh' | 'xao' | 'nuong' | 'hap' | 'bun_pho' | 'nhoi_sot';

function buildVietnameseHeirloomLocally(
  promptVi: string,
  options?: {
    familyStory?: string;
    region?: VietnameseRegion;
    servings?: number;
  },
): HeirloomRecipeDraft {
  const cleanPrompt = promptVi.trim() || 'Thịt ba chỉ kho trứng cút nước dừa chuẩn cơm mẹ nấu';
  const norm = stripVietnameseAccents(cleanPrompt);
  const servings = Math.max(1, Math.min(12, Math.round(options?.servings ?? 4)));
  const scale = (baseForFour: number) => {
    const val = (baseForFour * servings) / 4;
    return val >= 20 ? Math.round(val / 5) * 5 : Math.round(val * 10) / 10;
  };

  // 1. Detect region
  let region: VietnameseRegion = options?.region ?? 'all';
  if (region === 'all') {
    if (/\b(kieu bac|mien bac|ha noi|rieng me|nuoc hang|ca tram)\b/.test(norm)) {
      region = 'bac';
    } else if (/\b(mien trung|hue|quang|ot hiem|nen|mam ruoc)\b/.test(norm)) {
      region = 'trung';
    } else if (/\b(mien nam|sai gon|nuoc dua|la giang|kho to|ca loc)\b/.test(norm)) {
      region = 'nam';
    }
  }

  // 2. Detect cooking technique
  let technique: CulinaryTechnique = 'kho';
  if (/\b(bun|pho|mien|chao|hu tieu)\b/.test(norm)) {
    technique = 'bun_pho';
  } else if (/\b(nhoi|sot ca chua|xot ca chua)\b/.test(norm)) {
    technique = 'nhoi_sot';
  } else if (/\b(canh|sup|lau|la giang)\b/.test(norm)) {
    technique = 'canh';
  } else if (/\b(nuong|ap chao|quay)\b/.test(norm)) {
    technique = 'nuong';
  } else if (/\b(hap|luoc|chung)\b/.test(norm)) {
    technique = 'hap';
  } else if (/\b(xao|dao)\b/.test(norm)) {
    technique = 'xao';
  } else if (/\b(kho|rim|om|ram)\b/.test(norm)) {
    technique = 'kho';
  }

  // 3. Detect explicit duration if mentioned (e.g. "50 phút")
  const minuteMatch = /(\d{1,3})\s*(?:phut|p\b)/i.exec(norm);
  const defaultMinutesByTech: Record<CulinaryTechnique, number> = {
    kho: 50,
    canh: 25,
    xao: 18,
    nuong: 35,
    hap: 25,
    bun_pho: 65,
    nhoi_sot: 30,
  };
  const cookTimeMinutes = minuteMatch
    ? Math.max(10, Math.min(180, Number(minuteMatch[1])))
    : defaultMinutesByTech[technique];

  // 4. Detect primary protein & signature aromatics
  interface ProteinProfile {
    nameVi: string;
    baseGrams: number;
    unit: string;
    kcalBase: number;
    proteinBase: number;
    prepNote: string;
  }

  let protein: ProteinProfile = {
    nameVi: 'Thịt ba chỉ heo tươi rút sườn',
    baseGrams: 500,
    unit: 'g',
    kcalBase: 465,
    proteinBase: 28,
    prepNote: 'Thái quân cờ dày 2.5cm, chần sơ nước sôi với lát gừng để thịt trong và thơm',
  };

  if (/\bca tram\b/.test(norm)) {
    protein = {
      nameVi: 'Cá trắm đen cắt khúc giữa',
      baseGrams: 650,
      unit: 'g',
      kcalBase: 390,
      proteinBase: 34,
      prepNote: 'Cạo sạch màng đen trong bụng cá bằng muối hạt & nước chè xanh để khử tanh triệt để',
    };
  } else if (/\b(ca loc|ca bong|ca thu|ca)\b/.test(norm)) {
    protein = {
      nameVi: 'Cá tươi cắt khúc dày',
      baseGrams: 600,
      unit: 'g',
      kcalBase: 365,
      proteinBase: 32,
      prepNote: 'Rửa nhanh với nước muối loãng và gừng đập dập, thấm thật khô mặt cá',
    };
  } else if (/\bdau phu|dau hu\b/.test(norm)) {
    protein = {
      nameVi: 'Đậu phụ làng Mơ trắng mềm & thịt nạc vai băm',
      baseGrams: 450,
      unit: 'g',
      kcalBase: 340,
      proteinBase: 24,
      prepNote: 'Đậu phụ rạch khéo giữa miếng, múc nhẹ ruột trộn cùng thịt nạc vai và mộc nhĩ thái chỉ',
    };
  } else if (/\bga\b/.test(norm)) {
    protein = {
      nameVi: 'Thịt gà ta thả vườn chặt miếng vừa ăn',
      baseGrams: 650,
      unit: 'g',
      kcalBase: 380,
      proteinBase: 35,
      prepNote: 'Xát muối hạt cùng chút gừng tươi ngoài da giúp da gà săn giòn, nước dùng trong vắt',
    };
  } else if (/\bsuon\b/.test(norm)) {
    protein = {
      nameVi: 'Sườn non thăn heo chặt khúc 4cm',
      baseGrams: 550,
      unit: 'g',
      kcalBase: 430,
      proteinBase: 29,
      prepNote: 'Ngâm nước muối loãng 10 phút rồi trụng nhanh qua nước sôi để sườn mềm rục không hôi',
    };
  } else if (/\bbo\b/.test(norm)) {
    protein = {
      nameVi: 'Thịt thăn / bắp bò tươi thái lát ngang thớ',
      baseGrams: 450,
      unit: 'g',
      kcalBase: 375,
      proteinBase: 33,
      prepNote: 'Thái thật mỏng ngang thớ, áo 1 thìa dầu ăn trước khi ướp để giữ nước ngọt tự nhiên',
    };
  } else if (/\btom\b/.test(norm)) {
    protein = {
      nameVi: 'Tôm đất / tôm sú tươi bóc nõn chừa đuôi',
      baseGrams: 400,
      unit: 'g',
      kcalBase: 310,
      proteinBase: 30,
      prepNote: 'Rút chỉ lưng, để thật ráo nước để khi rim hoặc xào vỏ tôm bóng giòn đỏ au',
    };
  }

  // Title formatting: turn raw memory into refined editorial Vietnamese dish title
  const cleanedTitleSource = cleanPrompt
    .split(/[,.;–—]/)[0]
    .replace(/\b\d+\s*(?:phút|phut)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  const formattedTitle =
    cleanedTitleSource.charAt(0).toUpperCase() + cleanedTitleSource.slice(1);
  const slug = slugifyVietnamese(formattedTitle);

  const ingredients: HeirloomIngredientLine[] = [
    {
      name: protein.nameVi,
      quantity: scale(protein.baseGrams),
      unit: protein.unit,
      note: protein.prepNote,
      category: 'protein',
    },
  ];

  // Add secondary heritage ingredients detected from prompt & technique
  if (/\bca tram\b/.test(norm) && /\bba chi\b/.test(norm)) {
    ingredients.push({
      name: 'Thịt ba chỉ xắt con chì lót đáy nồi',
      quantity: scale(180),
      unit: 'g',
      note: 'Mỡ ba chỉ tiết ra thấm vào thớ cá giúp cá trắm bùi béo không khô',
      category: 'protein',
    });
  }
  if (/\brieng\b/.test(norm) || (technique === 'kho' && /\bca\b/.test(norm))) {
    ingredients.push({
      name: 'Củ riềng bánh tẻ (1 nửa thái lát, 1 nửa giã vắt nước)',
      quantity: scale(80),
      unit: 'g',
      note: 'Lót kín đáy nồi chống bén khét và tạo hương thơm trầm ấm',
      category: 'aromatics',
    });
  }
  if (/\bsa\b/.test(norm)) {
    ingredients.push({
      name: 'Sả cây tươi đập dập cắt khúc',
      quantity: scale(4),
      unit: 'cây',
      category: 'aromatics',
    });
  }
  if (/\bme\b/.test(norm)) {
    ingredients.push({
      name: 'Mẻ ngấu lọc mịn qua rây',
      quantity: scale(2.5),
      unit: 'thìa canh',
      note: 'Vị chua thanh dịu nâng mùi thơm đặc trưng miền Bắc',
      category: 'seasoning',
    });
  }
  if (/\btieu xanh\b/.test(norm)) {
    ingredients.push({
      name: 'Tiêu xanh Phú Quốc nguyên nhánh đập nhẹ',
      quantity: scale(25),
      unit: 'g',
      note: 'Tạo vị cay thơm nồng ấm mà không gắt cổ',
      category: 'aromatics',
    });
  }
  if (/\bla giang\b/.test(norm)) {
    ingredients.push({
      name: 'Lá giang tươi vò nhẹ trước khi thả nồi',
      quantity: scale(150),
      unit: 'g',
      note: 'Vò sơ tay để tiết vị chua thanh tự nhiên không bị chát',
      category: 'produce',
    });
  }
  if (/\bca chua\b/.test(norm) || technique === 'nhoi_sot') {
    ingredients.push({
      name: 'Cà chua chín đỏ khía chữ thập băm nhuyễn',
      quantity: scale(300),
      unit: 'g',
      note: 'Xào kỹ với chút dầu điều hoặc mỡ hành để lên sốt đỏ sánh tự nhiên',
      category: 'produce',
    });
  }

  // Always include foundational Vietnamese kitchen aromatics & condiments
  ingredients.push(
    {
      name: 'Hành tím & tỏi khô ta băm nhỏ',
      quantity: scale(35),
      unit: 'g',
      category: 'aromatics',
    },
    {
      name: 'Nước mắm nhĩ truyền thống 40°N',
      quantity: scale(technique === 'canh' || technique === 'bun_pho' ? 2 : 3),
      unit: 'thìa canh',
      note: 'Giữ lại 1/2 thìa rưới sát thành nồi lúc tắt bếp để dậy hương',
      category: 'seasoning',
    },
    {
      name:
        technique === 'kho'
          ? 'Nước hàng thắng đường vàng cánh gián (hoặc nước dừa tươi)'
          : 'Đường vàng / Hạt nêm xương hầm thanh vị',
      quantity: scale(2),
      unit: 'thìa canh',
      category: 'seasoning',
    },
    {
      name: 'Hành hoa, rau mùi & ớt hiểm chín đỏ',
      quantity: scale(30),
      unit: 'g',
      category: 'produce',
    },
  );

  // Build authentic 4-Phase Culinary Steps
  const steps: HeirloomStepPhase[] =
    technique === 'canh'
      ? [
          {
            stepNumber: 1,
            phaseTitleVi: 'Sơ chế sạch & chuẩn bị rau gia vị',
            instruction: `${protein.prepNote}. Rau thơm, hành tím lột vỏ đập dập; nguyên liệu tạo chua / rau ăn kèm nhặt rửa sạch để thật ráo trong rổ thưa.`,
            cookware: 'Thớt gỗ nghiến & Rổ inox thưa',
            heatLevel: 'Sơ chế nguội',
            durationMinutes: 6,
            timerSeconds: 360,
            sensoryCue: 'Nguyên liệu ráo sạch, không còn mùi ngái sống hay nhớt bề mặt.',
          },
          {
            stepNumber: 2,
            phaseTitleVi: 'Phi thơm hành tím & xào săn cốt ngọt',
            instruction:
              'Làm nóng nồi đáy dày với 1 thìa dầu ăn, phi thơm hành tím rồi trút phần đạm vào đảo đều cùng 1 thìa nước mắm nhĩ cho thịt săn lại và rút vị đậm đà vào lõi.',
            cookware: 'Nồi canh đáy 3 lớp',
            heatLevel: 'Lửa vừa',
            durationMinutes: 5,
            timerSeconds: 300,
            sensoryCue: 'Thịt săn chắc chuyển màu trắng ngà, dậy mùi hành phi quyện nước mắm thơm lừng.',
          },
          {
            stepNumber: 3,
            phaseTitleVi: 'Châm nước sôi & hớt bọt giữ nước trong',
            instruction: `Châm khoảng ${scale(1.1)} lít nước đun sôi vào nồi. Khi sôi bùng, hạ lửa vừa, hớt sạch lớp bọt đầu để nước canh thanh trong tự nhiên.`,
            cookware: 'Nồi canh đáy 3 lớp',
            heatLevel: 'Lửa vừa',
            durationMinutes: Math.max(8, cookTimeMinutes - 14),
            timerSeconds: Math.max(480, (cookTimeMinutes - 14) * 60),
            sensoryCue: 'Mặt nước canh sôi lăn tăn trong trẻo, điểm ánh vàng nhẹ hấp dẫn.',
          },
          {
            stepNumber: 4,
            phaseTitleVi: 'Thả lá gia vị, cân vị cuối & bày mâm nóng',
            instruction:
              'Cho lá giang / rau canh vào đảo nhẹ 1–2 phút vừa chín tới. Nêm lại chút mắm nhĩ cho tròn vị thanh mát, rắc hành ngò và ớt lát rồi múc ra tô sứ sâu lòng.',
            cookware: 'Tô sứ Bát Tràng giữ nhiệt',
            heatLevel: 'Lửa liu riu',
            durationMinutes: 3,
            timerSeconds: 180,
            sensoryCue: 'Hương thơm thanh khiết bốc lên theo làn khói nóng, vị chua ngọt dịu nhẹ mở vị giác.',
          },
        ]
      : technique === 'nhoi_sot'
        ? [
            {
              stepNumber: 1,
              phaseTitleVi: 'Sơ chế & quết nhân thịt dẻo kết dính',
              instruction: `${protein.prepNote}. Quết đều nhân với hành tím băm, tiêu xay và 1 thìa nước mắm trong 3 phút để nhân dai ngọt không bị rời khi sốt.`,
              cookware: 'Âu thuỷ tinh & Thìa bản rộng',
              heatLevel: 'Sơ chế nguội',
              durationMinutes: 8,
              timerSeconds: 480,
              sensoryCue: 'Khối nhân dẻo quánh, bám chắc vào lòng đậu phụ mà không rỉ nước.',
            },
            {
              stepNumber: 2,
              phaseTitleVi: 'Áp chảo vàng mặt khoá form nhân',
              instruction:
                'Đặt mặt có nhân úp xuống chảo dầu nóng vừa, áp chảo tĩnh 3–4 phút cho mặt thịt xém vàng thơm rồi lật nhẹ sang các mặt đậu cho vàng giòn.',
              cookware: 'Chảo gang / Chảo chống dính đáy phẳng',
              heatLevel: 'Lửa vừa',
              durationMinutes: 7,
              timerSeconds: 420,
              sensoryCue: 'Lớp nhân se vàng ruộm, vỏ đậu phồng nhẹ nghe tiếng xèo êm tai.',
            },
            {
              stepNumber: 3,
              phaseTitleVi: 'Nấu sốt cà chua sánh mịn chuẩn cơm nhà',
              instruction:
                'Phi thơm tỏi hành ở chảo sạch, cho cà chua băm cùng chút muối vào dầm nhuyễn trên lửa vừa đến khi cà chua tan thành sốt đỏ cam sánh mịn, thêm 120ml nước ấm.',
              cookware: 'Chảo sâu lòng',
              heatLevel: 'Lửa vừa',
              durationMinutes: 6,
              timerSeconds: 360,
              sensoryCue: 'Sốt cà chua lên màu đỏ hồng tự nhiên, bóng mượt không tách nước.',
            },
            {
              stepNumber: 4,
              phaseTitleVi: 'Om thấm sốt & rắc hành hoa dậy hương',
              instruction:
                'Xếp nhẹ từng miếng đậu nhồi thịt vào chảo sốt, đậy vung om lửa nhỏ 8–9 phút, rưới sốt đều lên mặt rồi rắc thật nhiều hành hoa thái nhỏ và tiêu xay.',
              cookware: 'Chảo sâu lòng có nắp kính',
              heatLevel: 'Lửa liu riu',
              durationMinutes: Math.max(8, cookTimeMinutes - 21),
              timerSeconds: Math.max(480, (cookTimeMinutes - 21) * 60),
              sensoryCue: 'Sốt áo đều quanh miếng đậu mềm béo, thơm nức mùi cà chua chín quyện hành lá.',
            },
          ]
        : [
            {
              stepNumber: 1,
              phaseTitleVi: 'Sơ chế chuẩn bếp & khử mùi tự nhiên',
              instruction: `${protein.prepNote}. Đập dập riềng, sả, hành tím và tỏi ta để tinh dầu thơm bung tỏa tối đa khi gặp nhiệt.`,
              cookware: 'Thớt gỗ & Âu sơ chế inox',
              heatLevel: 'Sơ chế nguội',
              durationMinutes: 8,
              timerSeconds: 480,
              sensoryCue: 'Thớ nguyên liệu khô ráo, săn chắc, thoang thoảng mùi gừng riềng thanh sạch.',
            },
            {
              stepNumber: 2,
              phaseTitleVi: 'Ướp thấm cốt mắm nhĩ & nước hàng cánh gián',
              instruction:
                'Ướp nguyên liệu chính cùng nước mắm nhĩ, nước hàng thắng đường vàng, hành tím băm và hạt tiêu giã dập tối thiểu 15–20 phút cho gia vị ngấm sâu từ ngoài vào trong.',
              cookware: 'Âu sứ / Hộp thuỷ tinh kín khí',
              heatLevel: 'Sơ chế nguội',
              durationMinutes: 12,
              timerSeconds: 720,
              sensoryCue: 'Bề mặt nguyên liệu ánh màu hổ phách nhạt, nước ướp sánh quyện bám đều.',
            },
            {
              stepNumber: 3,
              phaseTitleVi: 'Xếp đáy nồi & đảo săn khoá hương lửa đầu',
              instruction:
                'Lót riềng sả (và thịt ba chỉ nếu có) dưới đáy nồi đất/nồi gang, xếp nguyên liệu đã ướp lên trên. Đun lửa vừa cho sôi sùng sục 5 phút để khoá trọn vị ngọt tự nhiên.',
              cookware: 'Nồi đất Bát Tràng / Nồi gang đúc đáy dày',
              heatLevel: 'Lửa lớn',
              durationMinutes: 7,
              timerSeconds: 420,
              sensoryCue: 'Tiếng sôi lục bục giòn giã, hương mắm gặp nhiệt bốc lên thơm nức gian bếp.',
            },
            {
              stepNumber: 4,
              phaseTitleVi: 'Kho / rim liu riu hai lửa đến khi sánh kẹo',
              instruction: `Châm nước sôi xâm xấp mặt, hạ lửa liu riu kho mở hé vung trong ${Math.max(15, cookTimeMinutes - 27)} phút đến khi nước sốt rút sánh bóng màu cánh gián. Rưới 1/2 thìa mắm nhĩ cuối cùng cùng tiêu xanh / ớt đỏ rồi tắt bếp.`,
              cookware: 'Nồi đất giữ nhiệt âm ỉ',
              heatLevel: 'Lửa liu riu',
              durationMinutes: Math.max(15, cookTimeMinutes - 27),
              timerSeconds: Math.max(900, (cookTimeMinutes - 27) * 60),
              sensoryCue: 'Nước kho sánh óng như mật, thớ thịt/cá mềm rục mà vẫn nguyên miếng đẹp mắt.',
            },
          ];

  const regionSecrets: Record<VietnameseRegion, string> = {
    bac: 'Bí quyết chuẩn vị Bắc: Tuyệt đối chỉ châm nước ĐANG SÔI khi kho/hầm và thắng nước hàng tới đúng độ bọt cua cánh gián để vị mặn thanh, hậu dịu mà không đắng.',
    trung: 'Bí quyết chuẩn vị Trung: Giã nhuyễn củ nén / hành tím cùng gốc ớt hiểm phi đầu dầu trước khi rim để tạo tầng hương cay thơm sâu lắng rất đưa cơm.',
    nam: 'Bí quyết chuẩn vị Nam: Dùng nước dừa tươi xiêm thay một nửa lượng nước lọc khi rim lửa nhỏ, giúp món ăn lên màu nâu đỏ óng mượt và ngọt hậu tự nhiên.',
    all: 'Bí quyết gia truyền: Chia nước mắm nhĩ làm 2 lần — 80% lúc ướp thấm thớ và 20% rưới quanh thành nồi nóng ở 60 giây cuối để giữ trọn hương đạm tự nhiên.',
  };

  const regionDescriptions: Record<VietnameseRegion, string> = {
    bac: 'Công thức chuẩn vị Bắc thanh tao, cân bằng tinh tế giữa vị mặn đằm của mắm nhĩ và hương thơm mộc mạc của gia vị vườn nhà.',
    trung: 'Công thức đậm đà phong vị miền Trung, dậy hương nồng ấm của sả ớt và kỹ thuật canh lửa liu riu thấm đẫm từng thớ nguyên liệu.',
    nam: 'Công thức phóng khoáng miền Nam với sắc màu cánh gián óng ả, vị mặn ngọt hài hòa khiến nồi cơm nóng vơi lúc nào không hay.',
    all: 'Công thức gia truyền gìn giữ trọn vẹn hơi ấm mâm cơm gia đình Việt với định lượng chuẩn xác và kỹ thuật canh lửa từng công đoạn.',
  };

  return {
    title: formattedTitle,
    slug,
    description: regionDescriptions[region],
    familyStory:
      options?.familyStory?.trim() ||
      'Món ăn gắn liền với tiếng lục bục bên bếp chiều và hương thơm gọi cả nhà quây quần bên mâm cơm nóng.',
    region,
    cookTimeMinutes,
    servings,
    difficulty: cookTimeMinutes >= 45 ? 'medium' : 'easy',
    caloriesPerServing: protein.kcalBase,
    proteinGrams: protein.proteinBase,
    chefSecret: regionSecrets[region],
    ingredients,
    steps,
    tags: ['gia-truyen', technique, region],
    sourceMode: 'heritage_architect',
  };
}

export async function synthesizeHeirloomDraft(
  promptVi: string,
  options?: {
    familyStory?: string;
    region?: VietnameseRegion;
    servings?: number;
    signal?: AbortSignal;
  },
): Promise<HeirloomRecipeDraft> {
  const localDraft = buildVietnameseHeirloomLocally(promptVi, options);
  const scope = getCurrentScope();
  if (!scope.userId || !scope.householdId || isOfflineGuestSession()) {
    return localDraft;
  }

  try {
    const assertCurrent = guardPrivateSession();
    const res = await fetchJson<Record<string, unknown>>('/ai-copilot/craft-recipe', {
      method: 'POST',
      headers: buildTenantHeaders({ 'Idempotency-Key': generateIdempotencyKey() }),
      body: JSON.stringify({
        prompt: promptVi.trim(),
        familyStory: options?.familyStory?.trim() || undefined,
        region: options?.region && options.region !== 'all' ? options.region : undefined,
        servings: options?.servings ?? 4,
      }),
      signal: options?.signal,
    });
    assertCurrent();
    const payload =
      res.recipe && typeof res.recipe === 'object'
        ? (res.recipe as Record<string, unknown>)
        : res.draft && typeof res.draft === 'object'
          ? (res.draft as Record<string, unknown>)
          : res;
    const normalized = normalizeHeirloomRecipe(payload);
    return {
      title: normalized.title || localDraft.title,
      slug: normalized.slug || localDraft.slug,
      description: normalized.description || localDraft.description,
      familyStory: options?.familyStory?.trim() || normalized.familyStory || localDraft.familyStory,
      region: options?.region ?? normalized.region ?? localDraft.region,
      cookTimeMinutes: normalized.cookTimeMinutes || localDraft.cookTimeMinutes,
      servings: options?.servings ?? normalized.servings ?? localDraft.servings,
      difficulty: normalized.difficulty,
      caloriesPerServing: normalized.caloriesPerServing || localDraft.caloriesPerServing,
      proteinGrams: normalized.proteinGrams || localDraft.proteinGrams,
      chefSecret: normalized.chefSecret || localDraft.chefSecret,
      ingredients: normalized.ingredients.length > 0 ? normalized.ingredients : localDraft.ingredients,
      steps: normalized.steps.length > 0 ? normalized.steps : localDraft.steps,
      tags: normalized.tags.length > 0 ? normalized.tags : localDraft.tags,
      sourceMode: 'ai_edge',
    };
  } catch {
    // Seamlessly fall back to deterministic Vietnamese culinary architect
    return localDraft;
  }
}

/* ============================================================================
 * KITCHEN OS TYPED API CLIENT
 * ============================================================================ */

export const kitchenOsApi = {
  getPulse: async (): Promise<KitchenPulseSnapshot> => {
    try {
      const { data, telemetry } = await fetchKitchenOsWithMeta<Record<string, unknown>>(
        '/kitchen-os/pulse',
        'pulse',
      );
      return normalizePulseResponse(data, telemetry);
    } catch (err) {
      if (shouldFallbackToLocal(err)) {
        return buildLocalPulseSnapshot('OFFLINE_CACHE');
      }
      throw err;
    }
  },

  getInsights: async (): Promise<KitchenInsightsSnapshot> => {
    try {
      const { data, telemetry } = await fetchKitchenOsWithMeta<Record<string, unknown>>(
        '/kitchen-os/insights',
        'insights',
      );
      return normalizeInsightsResponse(data, telemetry);
    } catch (err) {
      if (shouldFallbackToLocal(err)) {
        return buildLocalInsightsSnapshot('OFFLINE_CACHE');
      }
      throw err;
    }
  },

  logWasteEvent: async (input: LogWasteEventInput): Promise<KitchenWasteEvent> => {
    const cleanInput = {
      itemName: input.itemName.trim(),
      eventType: input.eventType,
      quantity: input.quantity ?? 1,
      unit: input.unit?.trim() || 'phần',
      estimatedValueVnd: Math.max(0, Math.round(input.estimatedValueVnd ?? 35_000)),
      co2Grams: Math.max(
        0,
        Math.round(input.co2Grams ?? Math.round(((input.estimatedValueVnd ?? 35_000) / 1_000) * 16)),
      ),
      ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
    };

    const recordLocally = (): KitchenWasteEvent => {
      const ledger = readLocalLedger();
      const created: KitchenWasteEvent = {
        id: `we_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        ...cleanInput,
        actorName: getActorDisplayName(),
        createdAt: new Date().toISOString(),
      };
      const actTitle =
        created.eventType === 'rescued'
          ? `Đã giải cứu kịp thời ${created.itemName}`
          : created.eventType === 'leftover_saved'
            ? `Cất hộp phần ăn dư: ${created.itemName}`
            : created.eventType === 'composted'
              ? `Ủ phân hữu cơ: ${created.itemName}`
              : `Bỏ đi do quá hạn: ${created.itemName}`;
      const activity: HouseholdActivityItem = {
        id: `act_${created.id}`,
        actorName: created.actorName,
        actionType: created.eventType === 'expired_discarded' ? 'waste_discard' : 'waste_rescue',
        titleVi: actTitle,
        detailVi: `${created.estimatedValueVnd.toLocaleString('vi-VN')}đ · ${created.co2Grams}g CO2e`,
        impactVnd: created.estimatedValueVnd,
        co2Grams: created.co2Grams,
        createdAt: created.createdAt,
      };
      writeLocalLedger({
        ...ledger,
        wasteEvents: [created, ...ledger.wasteEvents],
        activities: [activity, ...ledger.activities].slice(0, 40),
      });
      return created;
    };

    try {
      const assertCurrent = guardPrivateSession();
      const res = await fetchJson<Record<string, unknown>>('/kitchen-os/waste-events', {
        method: 'POST',
        headers: buildTenantHeaders({ 'Idempotency-Key': generateIdempotencyKey() }),
        body: JSON.stringify(cleanInput),
      });
      assertCurrent();
      etagMemoryCache.clear();
      const eventPayload =
        res.event && typeof res.event === 'object'
          ? (res.event as Record<string, unknown>)
          : res.wasteEvent && typeof res.wasteEvent === 'object'
            ? (res.wasteEvent as Record<string, unknown>)
            : { ...cleanInput, ...res };
      recordLocally();
      return normalizeWasteEvent(eventPayload);
    } catch (err) {
      if (shouldFallbackToLocal(err)) {
        return recordLocally();
      }
      throw err;
    }
  },

  addBudgetEntry: async (input: AddBudgetEntryInput): Promise<KitchenBudgetEntry> => {
    const cleanPayload = {
      amountVnd: Math.max(1_000, Math.round(input.amountVnd)),
      category: input.category.trim() || 'cho_truyen_thong',
      ...(input.note?.trim() ? { note: input.note.trim() } : {}),
      ...(input.spentAt ? { spentAt: input.spentAt } : {}),
    };

    const recordLocally = (): KitchenBudgetEntry => {
      const ledger = readLocalLedger();
      const created: KitchenBudgetEntry = {
        id: `be_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        amountVnd: cleanPayload.amountVnd,
        category: cleanPayload.category,
        categoryLabelVi: resolveBudgetCategoryLabel(cleanPayload.category),
        note: cleanPayload.note,
        actorName: getActorDisplayName(),
        createdAt: cleanPayload.spentAt ?? new Date().toISOString(),
      };
      const activity: HouseholdActivityItem = {
        id: `act_${created.id}`,
        actorName: created.actorName,
        actionType: 'budget_log',
        titleVi: `Ghi chi tiêu ${created.categoryLabelVi}: ${created.amountVnd.toLocaleString('vi-VN')}đ`,
        detailVi: created.note,
        impactVnd: created.amountVnd,
        createdAt: created.createdAt,
      };
      writeLocalLedger({
        ...ledger,
        budgetEntries: [created, ...ledger.budgetEntries],
        activities: [activity, ...ledger.activities].slice(0, 40),
      });
      return created;
    };

    try {
      const assertCurrent = guardPrivateSession();
      const res = await fetchJson<Record<string, unknown>>('/kitchen-os/budget-entries', {
        method: 'POST',
        headers: buildTenantHeaders({ 'Idempotency-Key': generateIdempotencyKey() }),
        body: JSON.stringify(cleanPayload),
      });
      assertCurrent();
      etagMemoryCache.clear();
      const entryObj =
        res.entry && typeof res.entry === 'object'
          ? (res.entry as Record<string, unknown>)
          : res.budgetEntry && typeof res.budgetEntry === 'object'
            ? (res.budgetEntry as Record<string, unknown>)
            : { ...cleanPayload, ...res };
      recordLocally();
      return normalizeBudgetEntry(entryObj);
    } catch (err) {
      if (shouldFallbackToLocal(err)) {
        return recordLocally();
      }
      throw err;
    }
  },

  updateWeeklyBudgetTarget: async (amountVnd: number): Promise<{ weeklyTargetVnd: number }> => {
    const safeAmount = Math.max(100_000, Math.round(amountVnd));
    const saveLocally = () => {
      const ledger = readLocalLedger();
      writeLocalLedger({ ...ledger, weeklyTargetVnd: safeAmount });
      return { weeklyTargetVnd: safeAmount };
    };

    try {
      const assertCurrent = guardPrivateSession();
      let res: Record<string, unknown>;
      try {
        res = await fetchJson<Record<string, unknown>>('/kitchen-os/budget-target', {
          method: 'PUT',
          headers: buildTenantHeaders({ 'Idempotency-Key': generateIdempotencyKey() }),
          body: JSON.stringify({ amountVnd: safeAmount, weeklyTargetVnd: safeAmount }),
        });
      } catch (innerErr) {
        if (innerErr instanceof ApiError && (innerErr.status === 400 || innerErr.status === 422)) {
          res = await fetchJson<Record<string, unknown>>('/kitchen-os/budget-target', {
            method: 'PUT',
            headers: buildTenantHeaders({ 'Idempotency-Key': generateIdempotencyKey() }),
            body: JSON.stringify({ amountVnd: safeAmount }),
          });
        } else {
          throw innerErr;
        }
      }
      assertCurrent();
      etagMemoryCache.clear();
      saveLocally();
      const resolved = Number(res.weeklyTargetVnd ?? res.amountVnd ?? res.targetVnd ?? safeAmount);
      return { weeklyTargetVnd: Number.isFinite(resolved) && resolved > 0 ? resolved : safeAmount };
    } catch (err) {
      if (shouldFallbackToLocal(err)) {
        return saveLocally();
      }
      throw err;
    }
  },

  getPantryThresholds: async (): Promise<PantryThresholdItem[]> => {
    try {
      const assertCurrent = guardPrivateSession();
      const res = await fetchJson<Record<string, unknown> | unknown[]>('/kitchen-os/pantry-thresholds', {
        method: 'GET',
        headers: buildTenantHeaders(),
      });
      assertCurrent();
      const list = Array.isArray(res)
        ? res
        : (Array.isArray(res.items) && res.items) ||
          (Array.isArray(res.thresholds) && res.thresholds) ||
          (Array.isArray(res.staples) && res.staples) ||
          [];
      return list.map((raw, idx) =>
        normalizePantryThreshold((raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>, idx),
      );
    } catch (err) {
      if (shouldFallbackToLocal(err)) {
        const ledger = readLocalLedger();
        return ledger.pantryThresholds.map((item, idx) =>
          normalizePantryThreshold(item as unknown as Record<string, unknown>, idx),
        );
      }
      throw err;
    }
  },

  seedVietnamesePantryStaples: async (): Promise<PantryThresholdItem[]> => {
    const seedLocally = (): PantryThresholdItem[] => {
      const ledger = readLocalLedger();
      const seeded = VIETNAMESE_PANTRY_STAPLES_SEED.map((s, idx) =>
        normalizePantryThreshold(
          {
            id: `pt_${s.ingredientKey}`,
            ingredientKey: s.ingredientKey,
            nameVi: s.nameVi,
            unit: s.unit,
            minQuantity: s.minQuantity,
            restockQuantity: s.restockQuantity,
            category: s.category,
          },
          idx,
        ),
      );
      const activity: HouseholdActivityItem = {
        id: `act_seed_pantry_${Date.now()}`,
        actorName: getActorDisplayName(),
        actionType: 'pantry_restock',
        titleVi: 'Đã khởi tạo 8 Gia Vị Nền Chuẩn Bếp Việt',
        detailVi: 'Nước mắm nhĩ, Gạo ST25, Dầu ăn, Tỏi khô, Hành tím, Trứng gà ta, Đường vàng, Hạt nêm',
        createdAt: new Date().toISOString(),
      };
      writeLocalLedger({
        ...ledger,
        pantryThresholds: seeded,
        activities: [activity, ...ledger.activities].slice(0, 40),
      });
      return seeded;
    };

    try {
      const assertCurrent = guardPrivateSession();
      const res = await fetchJson<Record<string, unknown> | unknown[]>(
        '/kitchen-os/pantry-thresholds/seed-vietnamese',
        {
          method: 'POST',
          headers: buildTenantHeaders({ 'Idempotency-Key': generateIdempotencyKey() }),
          body: JSON.stringify({}),
        },
      );
      assertCurrent();
      etagMemoryCache.clear();
      const list = Array.isArray(res)
        ? res
        : (Array.isArray(res.items) && res.items) ||
          (Array.isArray(res.thresholds) && res.thresholds) ||
          (Array.isArray(res.staples) && res.staples) ||
          null;
      if (list && list.length > 0) {
        return list.map((raw, idx) =>
          normalizePantryThreshold((raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>, idx),
        );
      }
      return seedLocally();
    } catch (err) {
      if (shouldFallbackToLocal(err)) {
        return seedLocally();
      }
      throw err;
    }
  },

  upsertPantryThreshold: async (input: UpsertPantryThresholdInput): Promise<PantryThresholdItem> => {
    const ingredientKey =
      input.ingredientKey?.trim() || slugifyVietnamese(input.nameVi).replace(/-/g, '_');
    const cleanMin = Math.max(0.5, Math.round(input.minQuantity * 10) / 10);
    const cleanRestock = Math.max(0.5, Math.round((input.restockQuantity ?? cleanMin * 2) * 10) / 10);
    const cleanTarget = Math.max(
      cleanMin,
      Math.round((input.targetQuantity ?? Math.max(cleanMin * 2, cleanRestock)) * 10) / 10,
    );
    const payload = {
      ...(input.id ? { id: input.id } : {}),
      ingredientKey,
      ...(input.ingredientId !== undefined ? { ingredientId: input.ingredientId } : {}),
      name: input.nameVi.trim(),
      nameVi: input.nameVi.trim(),
      unit: input.unit.trim() || 'g',
      minQuantity: cleanMin,
      targetQuantity: cleanTarget,
      restockQuantity: cleanRestock,
      category: input.category ?? 'seasoning',
      storage: input.storage ?? 'pantry',
      autoAddShopping: true,
    };

    const upsertLocally = (): PantryThresholdItem => {
      const ledger = readLocalLedger();
      const normalized = normalizePantryThreshold({
        ...payload,
        currentQuantity: input.currentQuantity,
        updatedAt: new Date().toISOString(),
      });
      const exists = ledger.pantryThresholds.some(
        (item) => item.id === normalized.id || item.ingredientKey === normalized.ingredientKey,
      );
      const nextList = exists
        ? ledger.pantryThresholds.map((item) =>
            item.id === normalized.id || item.ingredientKey === normalized.ingredientKey
              ? normalized
              : item,
          )
        : [...ledger.pantryThresholds, normalized];
      writeLocalLedger({ ...ledger, pantryThresholds: nextList });
      return normalized;
    };

    try {
      const assertCurrent = guardPrivateSession();
      const res = await fetchJson<Record<string, unknown>>('/kitchen-os/pantry-thresholds', {
        method: 'PUT',
        headers: buildTenantHeaders({ 'Idempotency-Key': generateIdempotencyKey() }),
        body: JSON.stringify(payload),
      });
      assertCurrent();
      etagMemoryCache.clear();
      upsertLocally();
      const itemObj =
        res.staple && typeof res.staple === 'object'
          ? (res.staple as Record<string, unknown>)
          : res.item && typeof res.item === 'object'
            ? (res.item as Record<string, unknown>)
            : res.threshold && typeof res.threshold === 'object'
              ? (res.threshold as Record<string, unknown>)
              : { ...payload, ...res };
      return normalizePantryThreshold(itemObj);
    } catch (err) {
      if (shouldFallbackToLocal(err)) {
        return upsertLocally();
      }
      throw err;
    }
  },

  autoRestockLowStaples: async (): Promise<AutoRestockResult> => {
    const restockLocally = (): AutoRestockResult => {
      const ledger = readLocalLedger();
      const refreshed = ledger.pantryThresholds.map((item, idx) =>
        normalizePantryThreshold(item as unknown as Record<string, unknown>, idx),
      );
      const lowItems = refreshed.filter((item) => item.isLow);
      const addedItems = lowItems.map((item) => ({
        name: item.nameVi,
        quantity: Math.max(1, Math.round((item.minQuantity - item.currentQuantity) * 10) / 10 || item.restockQuantity),
        unit: item.unit,
      }));
      if (addedItems.length > 0) {
        const activity: HouseholdActivityItem = {
          id: `act_restock_${Date.now()}`,
          actorName: getActorDisplayName(),
          actionType: 'pantry_restock',
          titleVi: `Tự động bù ${addedItems.length} gia vị nền sắp cạn vào Giỏ Đi Chợ`,
          detailVi: addedItems.map((i) => `${i.name} (${i.quantity} ${i.unit})`).join(', '),
          createdAt: new Date().toISOString(),
        };
        writeLocalLedger({
          ...ledger,
          activities: [activity, ...ledger.activities].slice(0, 40),
        });
      }
      return {
        restockedCount: addedItems.length,
        addedItems,
        messageVi:
          addedItems.length > 0
            ? `Đã tự động thêm ${addedItems.length} gia vị nền sắp cạn vào Giỏ Đi Chợ!`
            : 'Tất cả gia vị nền trong bếp đều đang đủ dùng.',
      };
    };

    try {
      const assertCurrent = guardPrivateSession();
      const res = await fetchJson<Record<string, unknown>>(
        '/kitchen-os/pantry-thresholds/auto-restock',
        {
          method: 'POST',
          headers: buildTenantHeaders({ 'Idempotency-Key': generateIdempotencyKey() }),
          body: JSON.stringify({}),
        },
      );
      assertCurrent();
      etagMemoryCache.clear();
      const rawAdded =
        (Array.isArray(res.addedItems) && res.addedItems) ||
        (Array.isArray(res.items) && res.items) ||
        (Array.isArray(res.restockedItems) && res.restockedItems) ||
        [];
      const addedItems = rawAdded.map((entry) => {
        const obj = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>;
        return {
          name: String(obj.name ?? obj.nameVi ?? 'Gia vị nền'),
          quantity: Math.max(1, Number(obj.quantity ?? 1) || 1),
          unit: String(obj.unit ?? 'g'),
        };
      });
      const restockedCount = Math.max(
        addedItems.length,
        Math.round(Number(res.restockedCount ?? res.addedCount ?? addedItems.length) || 0),
      );
      return {
        restockedCount,
        addedItems,
        messageVi:
          typeof res.message === 'string' && res.message.trim()
            ? res.message
            : restockedCount > 0
              ? `Đã tự động bù ${restockedCount} gia vị nền sắp cạn vào Giỏ Đi Chợ!`
              : 'Tất cả gia vị nền trong bếp đều đang đủ dùng.',
      };
    } catch (err) {
      if (shouldFallbackToLocal(err)) {
        return restockLocally();
      }
      throw err;
    }
  },

  getHeirloomRecipes: async (): Promise<HeirloomRecipeRecord[]> => {
    try {
      const assertCurrent = guardPrivateSession();
      const res = await fetchJson<Record<string, unknown> | unknown[]>('/kitchen-os/heirloom-recipes', {
        method: 'GET',
        headers: buildTenantHeaders(),
      });
      assertCurrent();
      const list = Array.isArray(res)
        ? res
        : (Array.isArray(res.recipes) && res.recipes) ||
          (Array.isArray(res.items) && res.items) ||
          (Array.isArray(res.heirloomRecipes) && res.heirloomRecipes) ||
          [];
      return list.map((raw, idx) =>
        normalizeHeirloomRecipe((raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>, idx),
      );
    } catch (err) {
      if (shouldFallbackToLocal(err)) {
        return readLocalLedger().heirloomRecipes;
      }
      throw err;
    }
  },

  saveHeirloomRecipe: async (input: SaveHeirloomRecipeInput): Promise<HeirloomRecipeRecord> => {
    const cleanSlug = input.slug?.trim() || slugifyVietnamese(input.title);
    const backendPayload = {
      title: input.title.trim(),
      slug: cleanSlug,
      description: input.description.trim(),
      familyStory: input.familyStory.trim(),
      region: input.region,
      cookTimeMinutes: Math.max(5, Math.round(input.cookTimeMinutes)),
      servings: Math.max(1, Math.min(16, Math.round(input.servings))),
      difficulty: input.difficulty,
      caloriesPerServing: Math.max(50, Math.round(input.caloriesPerServing)),
      proteinGrams: Math.max(1, Math.round(input.proteinGrams)),
      chefSecret: input.chefSecret.trim(),
      ingredients: input.ingredients.map((ing) => ({
        name: ing.name,
        quantity: ing.quantity,
        requiredQuantity: ing.quantity,
        unit: ing.unit,
      })),
      steps: input.steps.map((st) => ({
        stepNumber: st.stepNumber,
        instruction: st.instruction.startsWith(st.phaseTitleVi)
          ? st.instruction
          : `${st.phaseTitleVi}: ${st.instruction}`,
        tip: `${st.cookware} · ${st.heatLevel} — ${st.sensoryCue}`,
        timerMinutes: st.durationMinutes,
      })),
      tags: input.tags,
    };

    const localPayload = {
      title: input.title.trim(),
      slug: cleanSlug,
      description: input.description.trim(),
      familyStory: input.familyStory.trim(),
      region: input.region,
      cookTimeMinutes: Math.max(5, Math.round(input.cookTimeMinutes)),
      servings: Math.max(1, Math.min(16, Math.round(input.servings))),
      difficulty: input.difficulty,
      caloriesPerServing: Math.max(50, Math.round(input.caloriesPerServing)),
      proteinGrams: Math.max(1, Math.round(input.proteinGrams)),
      chefSecret: input.chefSecret.trim(),
      ingredients: input.ingredients,
      steps: input.steps,
      tags: input.tags,
    };

    const saveLocally = (overrideId?: string, overrideSlug?: string): HeirloomRecipeRecord => {
      const ledger = readLocalLedger();
      const record: HeirloomRecipeRecord = {
        id: overrideId ?? `hr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        ...localPayload,
        slug: overrideSlug ?? localPayload.slug,
        sourceMode: input.sourceMode ?? 'heritage_architect',
        authorName: getActorDisplayName(),
        createdAt: new Date().toISOString(),
      };
      const activity: HouseholdActivityItem = {
        id: `act_hr_${record.id}`,
        actorName: record.authorName,
        actionType: 'heirloom_save',
        titleVi: `Lưu công thức gia truyền: ${record.title}`,
        detailVi: record.familyStory,
        createdAt: record.createdAt,
      };
      writeLocalLedger({
        ...ledger,
        heirloomRecipes: [record, ...ledger.heirloomRecipes.filter((r) => r.id !== record.id)],
        activities: [activity, ...ledger.activities].slice(0, 40),
      });
      return record;
    };

    try {
      const assertCurrent = guardPrivateSession();
      const res = await fetchJson<Record<string, unknown>>('/kitchen-os/heirloom-recipes', {
        method: 'POST',
        headers: buildTenantHeaders({ 'Idempotency-Key': generateIdempotencyKey() }),
        body: JSON.stringify(backendPayload),
      });
      assertCurrent();
      etagMemoryCache.clear();
      const recipeObj =
        res.recipe && typeof res.recipe === 'object'
          ? (res.recipe as Record<string, unknown>)
          : res.item && typeof res.item === 'object'
            ? (res.item as Record<string, unknown>)
            : { ...localPayload, ...res };
      const normalized = normalizeHeirloomRecipe(recipeObj);
      saveLocally(normalized.id, normalized.slug);
      return normalized;
    } catch (err) {
      if (shouldFallbackToLocal(err)) {
        return saveLocally();
      }
      throw err;
    }
  },

  deleteHeirloomRecipe: async (id: string): Promise<{ deleted: boolean; id: string }> => {
    const removeLocally = () => {
      const ledger = readLocalLedger();
      writeLocalLedger({
        ...ledger,
        heirloomRecipes: ledger.heirloomRecipes.filter((item) => item.id !== id),
      });
      return { deleted: true, id };
    };

    try {
      const assertCurrent = guardPrivateSession();
      await fetchJson<Record<string, unknown>>(
        `/kitchen-os/heirloom-recipes/${encodeURIComponent(id)}`,
        {
          method: 'DELETE',
          headers: buildTenantHeaders({ 'Idempotency-Key': generateIdempotencyKey() }),
        },
      );
      assertCurrent();
      etagMemoryCache.clear();
      return removeLocally();
    } catch (err) {
      if (shouldFallbackToLocal(err)) {
        return removeLocally();
      }
      throw err;
    }
  },

  synthesizeHeirloomDraft,
};

export const {
  getPulse,
  getInsights,
  logWasteEvent,
  addBudgetEntry,
  updateWeeklyBudgetTarget,
  getPantryThresholds,
  seedVietnamesePantryStaples,
  upsertPantryThreshold,
  autoRestockLowStaples,
  getHeirloomRecipes,
  saveHeirloomRecipe,
  deleteHeirloomRecipe,
} = kitchenOsApi;

