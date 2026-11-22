import type { StorageZone } from '../../domain/src/global-ingredients';
import type { D1DatabaseBinding } from './index';

export type BarcodeSymbology = 'JAN13' | 'EAN13' | 'EAN8' | 'UPCA' | 'GTIN14';

export interface BarcodeNutritionFacts {
  energyKj?: number;
  energyKcal?: number;
  proteinG?: number;
  carbohydrateG?: number;
  sugarG?: number;
  fatG?: number;
  saturatedFatG?: number;
  fiberG?: number;
  saltG?: number;
  sodiumMg?: number;
}

export interface BarcodeProductRecord {
  barcode: string;
  symbology: BarcodeSymbology;
  canonicalIngredientId: string | null;
  productName: string;
  localizedNames: Record<string, string>;
  brand: string | null;
  netQuantity: number | null;
  netUnit: 'g' | 'kg' | 'ml' | 'cl' | 'dl' | 'l' | 'piece' | 'pack' | null;
  nutriscoreGrade: 'a' | 'b' | 'c' | 'd' | 'e' | null;
  nutritionPer100g: BarcodeNutritionFacts | null;
  allergenTags: string[];
  storageZone: StorageZone | null;
  source: 'openfoodfacts' | 'manual_verified' | 'catalog';
  fetchedAt: string;
  expiresAt: string;
}

interface BarcodeProductRow {
  barcode: string;
  barcode_symbology: BarcodeSymbology;
  canonical_ingredient_id: string | null;
  product_name: string;
  localized_names_json: string | null;
  brand: string | null;
  net_quantity: number | null;
  net_unit: BarcodeProductRecord['netUnit'];
  nutriscore_grade: BarcodeProductRecord['nutriscoreGrade'];
  nutrition_json: string | null;
  allergen_tags_json: string;
  storage_zone: StorageZone | null;
  source: BarcodeProductRecord['source'];
  fetched_at: string;
  expires_at: string;
}

export async function readCachedBarcodeProduct(
  db: D1DatabaseBinding,
  barcode: string,
  nowIso = new Date().toISOString(),
): Promise<BarcodeProductRecord | null> {
  const row = await db
    .prepare(
      `SELECT barcode, barcode_symbology, canonical_ingredient_id, product_name,
              localized_names_json, brand, net_quantity, net_unit, nutriscore_grade,
              nutrition_json, allergen_tags_json, storage_zone, source, fetched_at, expires_at
         FROM barcode_products
        WHERE barcode = ? AND expires_at > ?
        LIMIT 1`,
    )
    .bind(barcode, nowIso)
    .first<BarcodeProductRow>();

  if (!row) return null;
  return {
    barcode: row.barcode,
    symbology: row.barcode_symbology,
    canonicalIngredientId: row.canonical_ingredient_id,
    productName: row.product_name,
    localizedNames: row.localized_names_json ? JSON.parse(row.localized_names_json) : {},
    brand: row.brand,
    netQuantity: row.net_quantity,
    netUnit: row.net_unit,
    nutriscoreGrade: row.nutriscore_grade,
    nutritionPer100g: row.nutrition_json ? JSON.parse(row.nutrition_json) : null,
    allergenTags: JSON.parse(row.allergen_tags_json),
    storageZone: row.storage_zone,
    source: row.source,
    fetchedAt: row.fetched_at,
    expiresAt: row.expires_at,
  };
}

export async function upsertBarcodeProduct(
  db: D1DatabaseBinding,
  record: BarcodeProductRecord,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO barcode_products (
         barcode, barcode_symbology, canonical_ingredient_id, product_name,
         localized_names_json, brand, net_quantity, net_unit, nutriscore_grade,
         nutrition_json, allergen_tags_json, storage_zone, source, fetched_at, expires_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(barcode) DO UPDATE SET
         barcode_symbology = excluded.barcode_symbology,
         canonical_ingredient_id = excluded.canonical_ingredient_id,
         product_name = excluded.product_name,
         localized_names_json = excluded.localized_names_json,
         brand = excluded.brand,
         net_quantity = excluded.net_quantity,
         net_unit = excluded.net_unit,
         nutriscore_grade = excluded.nutriscore_grade,
         nutrition_json = excluded.nutrition_json,
         allergen_tags_json = excluded.allergen_tags_json,
         storage_zone = excluded.storage_zone,
         source = excluded.source,
         fetched_at = excluded.fetched_at,
         expires_at = excluded.expires_at`,
    )
    .bind(
      record.barcode,
      record.symbology,
      record.canonicalIngredientId,
      record.productName,
      Object.keys(record.localizedNames).length > 0 ? JSON.stringify(record.localizedNames) : null,
      record.brand,
      record.netQuantity,
      record.netUnit,
      record.nutriscoreGrade,
      record.nutritionPer100g ? JSON.stringify(record.nutritionPer100g) : null,
      JSON.stringify(record.allergenTags),
      record.storageZone,
      record.source,
      record.fetchedAt,
      record.expiresAt,
    )
    .run();
}
