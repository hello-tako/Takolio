-- Migration 0049: Global Phase 2 — Culinary Localization, Extended Nutrition (EU Big 7 & JP Salt),
-- JAN-13 / EAN-13 Barcode Cache, and Multi-Currency / Dual-Expiry (USE_BY vs BEST_BEFORE) Scan Columns.
-- Additive & backward-compatible; standard rowid tables only.

-- 1. Decoupled per-locale recipe content translations pinned to immutable non-linguistic SHA-256 fingerprints.
-- Allows a user in Tokyo or Berlin to switch UI language (e.g. 'ja' <-> 'en' <-> 'de') while keeping
-- saved/cooked recipe content fingerprints 100% invariant.
CREATE TABLE recipe_content_localizations (
  fingerprint TEXT NOT NULL REFERENCES recipe_content_versions(fingerprint),
  locale TEXT NOT NULL CHECK (locale IN ('en', 'ja', 'de', 'fr', 'es', 'it', 'nl', 'pl', 'sv', 'vi')),
  localized_slug TEXT NOT NULL CHECK (length(trim(localized_slug)) > 0),
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  title_reading TEXT,
  description TEXT,
  steps_json TEXT NOT NULL CHECK (json_valid(steps_json) AND json_type(steps_json) = 'array'),
  ingredient_lines_json TEXT CHECK (
    ingredient_lines_json IS NULL OR (json_valid(ingredient_lines_json) AND json_type(ingredient_lines_json) = 'array')
  ),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (fingerprint, locale),
  UNIQUE (locale, localized_slug)
);

CREATE INDEX idx_recipe_content_localizations_locale_slug
  ON recipe_content_localizations(locale, localized_slug);

-- 2. JAN-13 (45*/49* Japan) & EAN-13 / EAN-8 / UPC-A (Europe & Global) Barcode Product Cache.
CREATE TABLE barcode_products (
  barcode TEXT PRIMARY KEY NOT NULL CHECK (barcode GLOB '[0-9]*' AND length(barcode) BETWEEN 8 AND 14),
  barcode_symbology TEXT NOT NULL CHECK (barcode_symbology IN ('JAN13', 'EAN13', 'EAN8', 'UPCA', 'GTIN14')),
  canonical_ingredient_id TEXT CHECK (
    canonical_ingredient_id IS NULL
    OR (canonical_ingredient_id GLOB '[A-Z][A-Z0-9_]*' AND length(canonical_ingredient_id) <= 100)
  ),
  product_name TEXT NOT NULL CHECK (length(trim(product_name)) > 0),
  localized_names_json TEXT CHECK (
    localized_names_json IS NULL
    OR (json_valid(localized_names_json) AND json_type(localized_names_json) = 'object')
  ),
  brand TEXT,
  net_quantity REAL CHECK (net_quantity IS NULL OR (net_quantity > 0 AND net_quantity < 1e9)),
  net_unit TEXT CHECK (net_unit IS NULL OR net_unit IN ('g', 'kg', 'ml', 'cl', 'dl', 'l', 'piece', 'pack')),
  nutriscore_grade TEXT CHECK (nutriscore_grade IS NULL OR nutriscore_grade IN ('a', 'b', 'c', 'd', 'e')),
  nutrition_json TEXT CHECK (
    nutrition_json IS NULL
    OR (json_valid(nutrition_json) AND json_type(nutrition_json) = 'object')
  ),
  allergen_tags_json TEXT NOT NULL DEFAULT '[]' CHECK (
    json_valid(allergen_tags_json) AND json_type(allergen_tags_json) = 'array'
  ),
  storage_zone TEXT CHECK (
    storage_zone IS NULL OR storage_zone IN ('fridge', 'veg_crisper', 'chilled', 'freezer', 'pantry')
  ),
  source TEXT NOT NULL CHECK (source IN ('openfoodfacts', 'manual_verified', 'catalog')),
  fetched_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX idx_barcode_products_ingredient
  ON barcode_products(canonical_ingredient_id)
  WHERE canonical_ingredient_id IS NOT NULL;

CREATE INDEX idx_barcode_products_expires_at
  ON barcode_products(expires_at);

-- 3. Multi-currency minor-unit & regional AI metadata on `scans` (preserves legacy `total_amount_vnd`).
ALTER TABLE scans ADD COLUMN currency TEXT CHECK (
  currency IS NULL OR currency IN (
    'JPY', 'EUR', 'GBP', 'CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RON', 'ISK', 'USD', 'VND'
  )
);
ALTER TABLE scans ADD COLUMN total_amount_minor INTEGER CHECK (
  total_amount_minor IS NULL OR (typeof(total_amount_minor) = 'integer' AND total_amount_minor >= 0)
);
ALTER TABLE scans ADD COLUMN tax_amount_minor INTEGER CHECK (
  tax_amount_minor IS NULL OR (typeof(tax_amount_minor) = 'integer' AND tax_amount_minor >= 0)
);
ALTER TABLE scans ADD COLUMN discount_amount_minor INTEGER CHECK (
  discount_amount_minor IS NULL OR typeof(discount_amount_minor) = 'integer'
);
ALTER TABLE scans ADD COLUMN ai_region TEXT;

-- 4. Multi-currency minor-unit, dual food-safety expiry regime (`USE_BY` vs `BEST_BEFORE`),
-- JAN/EAN barcode & 5-zone refrigerator compartment on `scan_items`.
ALTER TABLE scan_items ADD COLUMN currency TEXT CHECK (
  currency IS NULL OR currency IN (
    'JPY', 'EUR', 'GBP', 'CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RON', 'ISK', 'USD', 'VND'
  )
);
ALTER TABLE scan_items ADD COLUMN unit_price_minor INTEGER CHECK (
  unit_price_minor IS NULL OR typeof(unit_price_minor) = 'integer'
);
ALTER TABLE scan_items ADD COLUMN total_price_minor INTEGER CHECK (
  total_price_minor IS NULL OR typeof(total_price_minor) = 'integer'
);
ALTER TABLE scan_items ADD COLUMN discount_amount_minor INTEGER CHECK (
  discount_amount_minor IS NULL OR typeof(discount_amount_minor) = 'integer'
);
ALTER TABLE scan_items ADD COLUMN expiry_regime TEXT CHECK (
  expiry_regime IS NULL OR expiry_regime IN ('USE_BY', 'BEST_BEFORE', 'ESTIMATED', 'UNKNOWN')
);
ALTER TABLE scan_items ADD COLUMN barcode TEXT CHECK (
  barcode IS NULL OR (barcode GLOB '[0-9]*' AND length(barcode) BETWEEN 8 AND 14)
);
ALTER TABLE scan_items ADD COLUMN storage_zone TEXT CHECK (
  storage_zone IS NULL OR storage_zone IN ('fridge', 'veg_crisper', 'chilled', 'freezer', 'pantry')
);

-- 5. EU Regulation 1169/2011 "Big 7" (`energy_kj`, `saturated_fat_g`, `salt_g`) & Japan MEXT
-- Standard Tables (`食塩相当量` / `edible_yield_ratio`) extensions on `nutrition_profiles`.
ALTER TABLE nutrition_profiles ADD COLUMN energy_kj REAL CHECK (
  energy_kj IS NULL OR (energy_kj >= 0 AND energy_kj < 1e308)
);
ALTER TABLE nutrition_profiles ADD COLUMN saturated_fat_g REAL CHECK (
  saturated_fat_g IS NULL OR (saturated_fat_g >= 0 AND saturated_fat_g < 1e308)
);
ALTER TABLE nutrition_profiles ADD COLUMN salt_g REAL CHECK (
  salt_g IS NULL OR (salt_g >= 0 AND salt_g < 1e308)
);
ALTER TABLE nutrition_profiles ADD COLUMN edible_yield_ratio REAL CHECK (
  edible_yield_ratio IS NULL OR (edible_yield_ratio > 0 AND edible_yield_ratio <= 1)
);
