-- Phase 1 Global Expansion Foundation:
-- 1. Household & User locale, ISO country, ISO-4217 currency, IANA timezone, week-start day, and default-name markers.
-- 2. O(1) single-row `catalog_manifest` + automatic catalog-change triggers replacing the 9-table `json_group_array` 1 MB bind bomb.
-- 3. Kana-safe & European-folding multilingual FTS5 index (`recipe_search_documents` + `recipe_search_fts`).

ALTER TABLE user_preferences ADD COLUMN locale TEXT NOT NULL DEFAULT 'vi'
  CHECK (length(locale) BETWEEN 2 AND 16);
ALTER TABLE user_preferences ADD COLUMN country_code TEXT
  CHECK (country_code IS NULL OR (length(country_code) = 2 AND country_code NOT GLOB '*[^A-Z]*'));
ALTER TABLE user_preferences ADD COLUMN currency TEXT
  CHECK (currency IS NULL OR (length(currency) = 3 AND currency NOT GLOB '*[^A-Z]*'));
ALTER TABLE user_preferences ADD COLUMN timezone TEXT
  CHECK (timezone IS NULL OR (length(timezone) BETWEEN 1 AND 64));
ALTER TABLE user_preferences ADD COLUMN week_start_day INTEGER
  CHECK (week_start_day IS NULL OR week_start_day IN (0, 1));

ALTER TABLE households ADD COLUMN locale TEXT NOT NULL DEFAULT 'vi'
  CHECK (length(locale) BETWEEN 2 AND 16);
ALTER TABLE households ADD COLUMN country_code TEXT
  CHECK (country_code IS NULL OR (length(country_code) = 2 AND country_code NOT GLOB '*[^A-Z]*'));
ALTER TABLE households ADD COLUMN currency TEXT NOT NULL DEFAULT 'VND'
  CHECK (length(currency) = 3 AND currency NOT GLOB '*[^A-Z]*');
ALTER TABLE households ADD COLUMN timezone TEXT NOT NULL DEFAULT 'UTC'
  CHECK (length(timezone) BETWEEN 1 AND 64);
ALTER TABLE households ADD COLUMN week_start_day INTEGER NOT NULL DEFAULT 1
  CHECK (week_start_day IN (0, 1));
ALTER TABLE households ADD COLUMN is_default_name INTEGER NOT NULL DEFAULT 0
  CHECK (is_default_name IN (0, 1));

ALTER TABLE shopping_lists ADD COLUMN is_default_name INTEGER NOT NULL DEFAULT 0
  CHECK (is_default_name IN (0, 1));

-- O(1) Catalog Witness Authority (prevents D1 1 MB SQLITE_TOOBIG parameter overflow as catalog scales globally)
CREATE TABLE catalog_manifest (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  catalog_revision INTEGER NOT NULL DEFAULT 1 CHECK (catalog_revision >= 1),
  manifest_token TEXT NOT NULL DEFAULT 'rev:1' CHECK (length(manifest_token) > 0),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO catalog_manifest (id, catalog_revision, manifest_token)
VALUES (1, 1, 'rev:1');

CREATE TRIGGER trg_catalog_manifest_no_delete
BEFORE DELETE ON catalog_manifest
BEGIN
  SELECT RAISE(ABORT, 'catalog_manifest singleton row cannot be deleted');
END;

-- Automatic revision bump across all 9 catalog tables fenced by family meal planning
CREATE TRIGGER trg_catalog_rev_recipes_ins AFTER INSERT ON recipes BEGIN
  UPDATE catalog_manifest SET catalog_revision = catalog_revision + 1, manifest_token = 'rev:' || (catalog_revision + 1), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = 1;
END;
CREATE TRIGGER trg_catalog_rev_recipes_upd AFTER UPDATE ON recipes BEGIN
  UPDATE catalog_manifest SET catalog_revision = catalog_revision + 1, manifest_token = 'rev:' || (catalog_revision + 1), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = 1;
END;
CREATE TRIGGER trg_catalog_rev_recipes_del AFTER DELETE ON recipes BEGIN
  UPDATE catalog_manifest SET catalog_revision = catalog_revision + 1, manifest_token = 'rev:' || (catalog_revision + 1), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = 1;
END;

CREATE TRIGGER trg_catalog_rev_recipe_ingredients_ins AFTER INSERT ON recipe_ingredients BEGIN
  UPDATE catalog_manifest SET catalog_revision = catalog_revision + 1, manifest_token = 'rev:' || (catalog_revision + 1), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = 1;
END;
CREATE TRIGGER trg_catalog_rev_recipe_ingredients_upd AFTER UPDATE ON recipe_ingredients BEGIN
  UPDATE catalog_manifest SET catalog_revision = catalog_revision + 1, manifest_token = 'rev:' || (catalog_revision + 1), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = 1;
END;
CREATE TRIGGER trg_catalog_rev_recipe_ingredients_del AFTER DELETE ON recipe_ingredients BEGIN
  UPDATE catalog_manifest SET catalog_revision = catalog_revision + 1, manifest_token = 'rev:' || (catalog_revision + 1), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = 1;
END;

CREATE TRIGGER trg_catalog_rev_recipe_steps_ins AFTER INSERT ON recipe_steps BEGIN
  UPDATE catalog_manifest SET catalog_revision = catalog_revision + 1, manifest_token = 'rev:' || (catalog_revision + 1), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = 1;
END;
CREATE TRIGGER trg_catalog_rev_recipe_steps_upd AFTER UPDATE ON recipe_steps BEGIN
  UPDATE catalog_manifest SET catalog_revision = catalog_revision + 1, manifest_token = 'rev:' || (catalog_revision + 1), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = 1;
END;
CREATE TRIGGER trg_catalog_rev_recipe_steps_del AFTER DELETE ON recipe_steps BEGIN
  UPDATE catalog_manifest SET catalog_revision = catalog_revision + 1, manifest_token = 'rev:' || (catalog_revision + 1), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = 1;
END;

CREATE TRIGGER trg_catalog_rev_runtime_fields_ins AFTER INSERT ON recipe_runtime_fields BEGIN
  UPDATE catalog_manifest SET catalog_revision = catalog_revision + 1, manifest_token = 'rev:' || (catalog_revision + 1), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = 1;
END;
CREATE TRIGGER trg_catalog_rev_runtime_fields_upd AFTER UPDATE ON recipe_runtime_fields BEGIN
  UPDATE catalog_manifest SET catalog_revision = catalog_revision + 1, manifest_token = 'rev:' || (catalog_revision + 1), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = 1;
END;
CREATE TRIGGER trg_catalog_rev_runtime_fields_del AFTER DELETE ON recipe_runtime_fields BEGIN
  UPDATE catalog_manifest SET catalog_revision = catalog_revision + 1, manifest_token = 'rev:' || (catalog_revision + 1), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = 1;
END;

CREATE TRIGGER trg_catalog_rev_ing_order_ins AFTER INSERT ON recipe_runtime_ingredient_order BEGIN
  UPDATE catalog_manifest SET catalog_revision = catalog_revision + 1, manifest_token = 'rev:' || (catalog_revision + 1), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = 1;
END;
CREATE TRIGGER trg_catalog_rev_ing_order_upd AFTER UPDATE ON recipe_runtime_ingredient_order BEGIN
  UPDATE catalog_manifest SET catalog_revision = catalog_revision + 1, manifest_token = 'rev:' || (catalog_revision + 1), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = 1;
END;
CREATE TRIGGER trg_catalog_rev_ing_order_del AFTER DELETE ON recipe_runtime_ingredient_order BEGIN
  UPDATE catalog_manifest SET catalog_revision = catalog_revision + 1, manifest_token = 'rev:' || (catalog_revision + 1), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = 1;
END;

CREATE TRIGGER trg_catalog_rev_classifications_ins AFTER INSERT ON recipe_classifications BEGIN
  UPDATE catalog_manifest SET catalog_revision = catalog_revision + 1, manifest_token = 'rev:' || (catalog_revision + 1), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = 1;
END;
CREATE TRIGGER trg_catalog_rev_classifications_upd AFTER UPDATE ON recipe_classifications BEGIN
  UPDATE catalog_manifest SET catalog_revision = catalog_revision + 1, manifest_token = 'rev:' || (catalog_revision + 1), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = 1;
END;
CREATE TRIGGER trg_catalog_rev_classifications_del AFTER DELETE ON recipe_classifications BEGIN
  UPDATE catalog_manifest SET catalog_revision = catalog_revision + 1, manifest_token = 'rev:' || (catalog_revision + 1), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = 1;
END;

CREATE TRIGGER trg_catalog_rev_roles_ins AFTER INSERT ON recipe_role_assignments BEGIN
  UPDATE catalog_manifest SET catalog_revision = catalog_revision + 1, manifest_token = 'rev:' || (catalog_revision + 1), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = 1;
END;
CREATE TRIGGER trg_catalog_rev_roles_upd AFTER UPDATE ON recipe_role_assignments BEGIN
  UPDATE catalog_manifest SET catalog_revision = catalog_revision + 1, manifest_token = 'rev:' || (catalog_revision + 1), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = 1;
END;
CREATE TRIGGER trg_catalog_rev_roles_del AFTER DELETE ON recipe_role_assignments BEGIN
  UPDATE catalog_manifest SET catalog_revision = catalog_revision + 1, manifest_token = 'rev:' || (catalog_revision + 1), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = 1;
END;

CREATE TRIGGER trg_catalog_rev_recipe_nut_ins AFTER INSERT ON recipe_nutrition BEGIN
  UPDATE catalog_manifest SET catalog_revision = catalog_revision + 1, manifest_token = 'rev:' || (catalog_revision + 1), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = 1;
END;
CREATE TRIGGER trg_catalog_rev_recipe_nut_upd AFTER UPDATE ON recipe_nutrition BEGIN
  UPDATE catalog_manifest SET catalog_revision = catalog_revision + 1, manifest_token = 'rev:' || (catalog_revision + 1), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = 1;
END;
CREATE TRIGGER trg_catalog_rev_recipe_nut_del AFTER DELETE ON recipe_nutrition BEGIN
  UPDATE catalog_manifest SET catalog_revision = catalog_revision + 1, manifest_token = 'rev:' || (catalog_revision + 1), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = 1;
END;

CREATE TRIGGER trg_catalog_rev_nut_prof_ins AFTER INSERT ON nutrition_profiles BEGIN
  UPDATE catalog_manifest SET catalog_revision = catalog_revision + 1, manifest_token = 'rev:' || (catalog_revision + 1), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = 1;
END;
CREATE TRIGGER trg_catalog_rev_nut_prof_upd AFTER UPDATE ON nutrition_profiles BEGIN
  UPDATE catalog_manifest SET catalog_revision = catalog_revision + 1, manifest_token = 'rev:' || (catalog_revision + 1), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = 1;
END;
CREATE TRIGGER trg_catalog_rev_nut_prof_del AFTER DELETE ON nutrition_profiles BEGIN
  UPDATE catalog_manifest SET catalog_revision = catalog_revision + 1, manifest_token = 'rev:' || (catalog_revision + 1), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = 1;
END;

-- Multilingual Recipe Search Index (preserves Japanese Kana dakuten via remove_diacritics 0)
CREATE TABLE recipe_search_documents (
  recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK (length(locale) BETWEEN 2 AND 16),
  normalized_title TEXT NOT NULL,
  reading_hiragana TEXT,
  search_tokens TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (recipe_id, locale)
);

CREATE INDEX idx_recipe_search_docs_locale_title
  ON recipe_search_documents(locale, normalized_title, recipe_id);

CREATE VIRTUAL TABLE recipe_search_fts USING fts5(
  recipe_id UNINDEXED,
  locale UNINDEXED,
  search_tokens,
  tokenize = 'unicode61 remove_diacritics 0'
);

CREATE TRIGGER trg_recipe_search_docs_ins
AFTER INSERT ON recipe_search_documents
BEGIN
  INSERT INTO recipe_search_fts (recipe_id, locale, search_tokens)
  VALUES (NEW.recipe_id, NEW.locale, NEW.search_tokens);
END;

CREATE TRIGGER trg_recipe_search_docs_upd
AFTER UPDATE ON recipe_search_documents
BEGIN
  DELETE FROM recipe_search_fts WHERE recipe_id = OLD.recipe_id AND locale = OLD.locale;
  INSERT INTO recipe_search_fts (recipe_id, locale, search_tokens)
  VALUES (NEW.recipe_id, NEW.locale, NEW.search_tokens);
END;

CREATE TRIGGER trg_recipe_search_docs_del
AFTER DELETE ON recipe_search_documents
BEGIN
  DELETE FROM recipe_search_fts WHERE recipe_id = OLD.recipe_id AND locale = OLD.locale;
END;

-- Supporting indexes for global household read latency
CREATE INDEX IF NOT EXISTS idx_household_members_user_household
  ON household_members(user_id, household_id);
CREATE INDEX IF NOT EXISTS idx_shopping_lists_household_created
  ON shopping_lists(household_id, created_at);
CREATE INDEX IF NOT EXISTS idx_scans_household_created
  ON scans(household_id, created_at DESC);
