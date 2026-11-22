import {
  readCachedBarcodeProduct,
  upsertBarcodeProduct,
  type BarcodeNutritionFacts,
  type BarcodeProductRecord,
  type BarcodeSymbology,
  type D1DatabaseBinding,
} from '@frigo/db';
import {
  SUPPORTED_LOCALES,
  deriveAllergensFromIngredients,
  findCanonicalIngredient,
  kcalToKj,
  localizeAllergenLabel,
  mapOpenFoodFactsAllergens,
  parseLocalizedCulinaryUnit,
  recommendedStorageZoneForIngredient,
  saltGramsToSodiumMg,
  sodiumMgToSaltGrams,
  type SupportedLocale,
} from '@frigo/domain';

const DEFAULT_OFF_BASE_URL = 'https://world.openfoodfacts.org';
const BARCODE_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const OFF_TIMEOUT_MS = 5_000;

export class BarcodeValidationError extends Error {
  constructor(
    readonly code: 'INVALID_BARCODE_FORMAT' | 'INVALID_BARCODE_CHECK_DIGIT',
    message: string,
  ) {
    super(message);
    this.name = 'BarcodeValidationError';
  }
}

/**
 * Computes GS1 Modulo-10 check digit across GTIN-8 (EAN-8), GTIN-12 (UPC-A),
 * GTIN-13 (EAN-13 / JAN-13), and GTIN-14.
 */
export function verifyGs1CheckDigit(digits: string): boolean {
  if (!/^\d+$/.test(digits) || ![8, 12, 13, 14].includes(digits.length)) {
    return false;
  }
  let sum = 0;
  // Moving right-to-left starting from the digit immediately left of the check digit:
  // weights alternate 3, 1, 3, 1...
  const body = digits.slice(0, -1);
  for (let i = body.length - 1, pos = 0; i >= 0; i -= 1, pos += 1) {
    const d = body.charCodeAt(i) - 48;
    sum += d * (pos % 2 === 0 ? 3 : 1);
  }
  const expectedCheck = (10 - (sum % 10)) % 10;
  const actualCheck = digits.charCodeAt(digits.length - 1) - 48;
  return expectedCheck === actualCheck;
}

export function validateAndClassifyBarcode(rawInput: string): {
  barcode: string;
  symbology: BarcodeSymbology;
} {
  const cleaned = rawInput.trim().replace(/[\s-]+/g, '');
  if (!/^\d+$/.test(cleaned) || ![8, 12, 13, 14].includes(cleaned.length)) {
    throw new BarcodeValidationError(
      'INVALID_BARCODE_FORMAT',
      'Barcode must be an 8, 12, 13, or 14-digit GTIN / JAN / EAN / UPC code',
    );
  }
  if (!verifyGs1CheckDigit(cleaned)) {
    throw new BarcodeValidationError(
      'INVALID_BARCODE_CHECK_DIGIT',
      'Barcode failed GS1 Modulo-10 check-digit verification',
    );
  }
  let symbology: BarcodeSymbology;
  if (cleaned.length === 8) symbology = 'EAN8';
  else if (cleaned.length === 12) symbology = 'UPCA';
  else if (cleaned.length === 14) symbology = 'GTIN14';
  else if (cleaned.startsWith('45') || cleaned.startsWith('49')) symbology = 'JAN13';
  else symbology = 'EAN13';

  return { barcode: cleaned, symbology };
}

function finiteNonNegative(value: unknown): number | undefined {
  const num = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(num) && num >= 0 && num < 1e7 ? Number(num.toFixed(3)) : undefined;
}

function parseNetQuantityAndUnit(product: Record<string, unknown>): {
  netQuantity: number | null;
  netUnit: BarcodeProductRecord['netUnit'];
} {
  const allowedUnits = new Set(['g', 'kg', 'ml', 'cl', 'dl', 'l', 'piece', 'pack']);
  const directQty = finiteNonNegative(product.product_quantity);
  const directUnitRaw = typeof product.product_quantity_unit === 'string' ? product.product_quantity_unit : '';
  const parsedDirectUnit = parseLocalizedCulinaryUnit(directUnitRaw);
  if (directQty && directQty > 0 && parsedDirectUnit && allowedUnits.has(parsedDirectUnit)) {
    return { netQuantity: directQty, netUnit: parsedDirectUnit as BarcodeProductRecord['netUnit'] };
  }

  const quantityText = typeof product.quantity === 'string' ? product.quantity.normalize('NFKC').trim() : '';
  const match = quantityText.match(/(\d+(?:[.,]\d+)?)\s*([a-zA-Z\p{Script=Han}\p{Script=Katakana}]+)/u);
  if (match) {
    const qty = Number(match[1].replace(',', '.'));
    const unit = parseLocalizedCulinaryUnit(match[2]);
    if (Number.isFinite(qty) && qty > 0 && unit && allowedUnits.has(unit)) {
      return { netQuantity: qty, netUnit: unit as BarcodeProductRecord['netUnit'] };
    }
  }
  return { netQuantity: null, netUnit: null };
}

function extractNutritionPer100g(rawNutriments: unknown): BarcodeNutritionFacts | null {
  if (!rawNutriments || typeof rawNutriments !== 'object') return null;
  const n = rawNutriments as Record<string, unknown>;
  const energyKcal = finiteNonNegative(n['energy-kcal_100g'] ?? n.energy_kcal_100g);
  const energyKj = finiteNonNegative(n['energy-kj_100g'] ?? n.energy_100g)
    ?? (energyKcal !== undefined ? kcalToKj(energyKcal) : undefined);
  const proteinG = finiteNonNegative(n.proteins_100g);
  const carbohydrateG = finiteNonNegative(n.carbohydrates_100g);
  const sugarG = finiteNonNegative(n.sugars_100g);
  const fatG = finiteNonNegative(n.fat_100g);
  const saturatedFatG = finiteNonNegative(n['saturated-fat_100g'] ?? n.saturated_fat_100g);
  const fiberG = finiteNonNegative(n.fiber_100g);
  const rawSaltG = finiteNonNegative(n.salt_100g);
  const rawSodiumG = finiteNonNegative(n.sodium_100g);
  const sodiumMg = rawSodiumG !== undefined
    ? Number((rawSodiumG * 1000).toFixed(1))
    : rawSaltG !== undefined
      ? saltGramsToSodiumMg(rawSaltG)
      : undefined;
  const saltG = rawSaltG ?? (sodiumMg !== undefined ? sodiumMgToSaltGrams(sodiumMg) : undefined);

  const facts: BarcodeNutritionFacts = {
    ...(energyKj !== undefined ? { energyKj } : {}),
    ...(energyKcal !== undefined ? { energyKcal } : {}),
    ...(proteinG !== undefined ? { proteinG } : {}),
    ...(carbohydrateG !== undefined ? { carbohydrateG } : {}),
    ...(sugarG !== undefined ? { sugarG } : {}),
    ...(fatG !== undefined ? { fatG } : {}),
    ...(saturatedFatG !== undefined ? { saturatedFatG } : {}),
    ...(fiberG !== undefined ? { fiberG } : {}),
    ...(saltG !== undefined ? { saltG } : {}),
    ...(sodiumMg !== undefined ? { sodiumMg } : {}),
  };
  return Object.keys(facts).length > 0 ? facts : null;
}

export interface BarcodeLookupResponse {
  found: boolean;
  cached: boolean;
  barcode: string;
  symbology: BarcodeSymbology;
  product?: {
    productName: string;
    localizedNames: Record<string, string>;
    brand: string | null;
    canonicalIngredientId: string | null;
    netQuantity: number | null;
    netUnit: BarcodeProductRecord['netUnit'];
    nutriscoreGrade: BarcodeProductRecord['nutriscoreGrade'];
    nutritionPer100g: BarcodeNutritionFacts | null;
    allergenTags: string[];
    allergenLabels: Array<{ key: string; label: string }>;
    storageZone: BarcodeProductRecord['storageZone'];
    source: BarcodeProductRecord['source'];
  };
}

function formatProductResponse(
  record: BarcodeProductRecord,
  locale: SupportedLocale,
  cached: boolean,
): BarcodeLookupResponse {
  const displayName =
    record.localizedNames[locale] ||
    record.localizedNames.en ||
    record.productName;
  return {
    found: true,
    cached,
    barcode: record.barcode,
    symbology: record.symbology,
    product: {
      productName: displayName,
      localizedNames: record.localizedNames,
      brand: record.brand,
      canonicalIngredientId: record.canonicalIngredientId,
      netQuantity: record.netQuantity,
      netUnit: record.netUnit,
      nutriscoreGrade: record.nutriscoreGrade,
      nutritionPer100g: record.nutritionPer100g,
      allergenTags: record.allergenTags,
      allergenLabels: record.allergenTags.map((key) => ({
        key,
        label: localizeAllergenLabel(key, locale),
      })),
      storageZone: record.storageZone,
      source: record.source,
    },
  };
}

export async function lookupBarcodeProduct(
  db: D1DatabaseBinding,
  rawBarcode: string,
  options?: {
    locale?: SupportedLocale;
    offBaseUrl?: string;
    nowMs?: number;
  },
): Promise<BarcodeLookupResponse> {
  const { barcode, symbology } = validateAndClassifyBarcode(rawBarcode);
  const locale = options?.locale ?? 'en';
  const nowMs = options?.nowMs ?? Date.now();
  const nowIso = new Date(nowMs).toISOString();

  const cached = await readCachedBarcodeProduct(db, barcode, nowIso);
  if (cached) {
    return formatProductResponse(cached, locale, true);
  }

  const baseUrl = (options?.offBaseUrl?.trim() || DEFAULT_OFF_BASE_URL).replace(/\/$/, '');
  const fields = [
    'code', 'product_name', 'brands', 'quantity', 'product_quantity', 'product_quantity_unit',
    'nutriscore_grade', 'nutriments', 'allergens_tags',
    ...SUPPORTED_LOCALES.map((loc) => `product_name_${loc}`),
  ].join(',');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OFF_TIMEOUT_MS);
  let payload: Record<string, unknown> | null = null;
  try {
    const res = await fetch(
      `${baseUrl}/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${fields}`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'TakolioGlobalBackend/2.0 (+https://takolio.com)',
        },
        signal: controller.signal,
      },
    );
    if (res.status === 404) {
      return { found: false, cached: false, barcode, symbology };
    }
    if (res.ok) {
      payload = (await res.json()) as Record<string, unknown>;
    }
  } catch {
    return { found: false, cached: false, barcode, symbology };
  } finally {
    clearTimeout(timer);
  }

  if (!payload || payload.status !== 1 || !payload.product || typeof payload.product !== 'object') {
    return { found: false, cached: false, barcode, symbology };
  }

  const product = payload.product as Record<string, unknown>;
  const localizedNames: Record<string, string> = {};
  for (const loc of SUPPORTED_LOCALES) {
    const candidate = product[`product_name_${loc}`];
    if (typeof candidate === 'string' && candidate.trim()) {
      localizedNames[loc] = candidate.trim();
    }
  }
  const fallbackName =
    (typeof product.product_name === 'string' && product.product_name.trim()) ||
    Object.values(localizedNames)[0] ||
    '';
  if (!fallbackName) {
    return { found: false, cached: false, barcode, symbology };
  }

  // Try matching canonical ingredient across localized names & fallback name
  let canonicalId: string | null = null;
  for (const nameCandidate of [
    localizedNames.ja,
    localizedNames.en,
    localizedNames.de,
    localizedNames.fr,
    localizedNames.vi,
    fallbackName,
  ]) {
    if (!nameCandidate) continue;
    const match = findCanonicalIngredient(nameCandidate, { includeGlobalLocales: true });
    if (match) {
      canonicalId = match.id;
      break;
    }
  }

  const offAllergens = Array.isArray(product.allergens_tags)
    ? mapOpenFoodFactsAllergens(product.allergens_tags.filter((t): t is string => typeof t === 'string'))
    : [];
  const derivedAllergens = canonicalId ? deriveAllergensFromIngredients([canonicalId]) : [];
  const allergenTags = [...new Set([...offAllergens, ...derivedAllergens])].sort();

  const rawGrade = typeof product.nutriscore_grade === 'string'
    ? product.nutriscore_grade.trim().toLowerCase()
    : '';
  const nutriscoreGrade = ['a', 'b', 'c', 'd', 'e'].includes(rawGrade)
    ? (rawGrade as BarcodeProductRecord['nutriscoreGrade'])
    : null;

  const { netQuantity, netUnit } = parseNetQuantityAndUnit(product);
  const nutritionPer100g = extractNutritionPer100g(product.nutriments);
  const brand = typeof product.brands === 'string' && product.brands.trim()
    ? product.brands.split(',')[0].trim()
    : null;
  const storageZone = recommendedStorageZoneForIngredient(canonicalId);
  const expiresIso = new Date(nowMs + BARCODE_CACHE_TTL_MS).toISOString();

  const record: BarcodeProductRecord = {
    barcode,
    symbology,
    canonicalIngredientId: canonicalId,
    productName: fallbackName,
    localizedNames,
    brand,
    netQuantity,
    netUnit,
    nutriscoreGrade,
    nutritionPer100g,
    allergenTags,
    storageZone,
    source: 'openfoodfacts',
    fetchedAt: nowIso,
    expiresAt: expiresIso,
  };

  await upsertBarcodeProduct(db, record);
  return formatProductResponse(record, locale, false);
}
