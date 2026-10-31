-- Public catalog content only; historical versions survive mutable catalog edits.
CREATE TABLE recipe_content_versions (
  fingerprint TEXT PRIMARY KEY NOT NULL
    CHECK (length(fingerprint) = 64 AND fingerprint NOT GLOB '*[^0-9a-f]*'),
  recipe_id TEXT NOT NULL CHECK (length(recipe_id) > 0),
  slug TEXT NOT NULL CHECK (length(slug) > 0),
  content_json TEXT NOT NULL CHECK (json_valid(content_json)
    AND json_extract(content_json, '$.id') IS recipe_id
    AND json_extract(content_json, '$.slug') IS slug),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_recipe_content_versions_recipe ON recipe_content_versions(recipe_id, fingerprint);
CREATE TRIGGER trg_recipe_content_versions_insert
BEFORE INSERT ON recipe_content_versions
WHEN EXISTS (SELECT 1 FROM recipe_content_versions WHERE fingerprint = NEW.fingerprint)
BEGIN
  SELECT RAISE(ABORT, 'Recipe content version already exists');
END;
CREATE TRIGGER trg_recipe_content_versions_update
BEFORE UPDATE ON recipe_content_versions
BEGIN
  SELECT RAISE(ABORT, 'Recipe content versions are immutable');
END;
CREATE TRIGGER trg_recipe_content_versions_delete
BEFORE DELETE ON recipe_content_versions
BEGIN
  SELECT RAISE(ABORT, 'Recipe content versions are retained');
END;

ALTER TABLE cooked_meals ADD COLUMN recipe_content_fingerprint TEXT
  REFERENCES recipe_content_versions(fingerprint);
CREATE TRIGGER trg_cooked_meals_content_insert
BEFORE INSERT ON cooked_meals
WHEN NEW.recipe_content_fingerprint IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM recipe_content_versions
  WHERE fingerprint = NEW.recipe_content_fingerprint AND recipe_id = NEW.recipe_id
)
BEGIN
  SELECT RAISE(ABORT, 'Cooking content version does not match recipe');
END;
CREATE TRIGGER trg_cooked_meals_content_update
BEFORE UPDATE OF recipe_id, recipe_content_fingerprint ON cooked_meals
WHEN NEW.recipe_id IS NOT OLD.recipe_id
  OR NEW.recipe_content_fingerprint IS NOT OLD.recipe_content_fingerprint
BEGIN
  SELECT RAISE(ABORT, 'Cooking content reference is immutable');
END;

-- Access follows the household's authority at issuance, never another tenant's archive.
CREATE TABLE recipe_content_access (
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  fingerprint TEXT NOT NULL REFERENCES recipe_content_versions(fingerprint),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (household_id, fingerprint)
);
ALTER TABLE cooked_meals ADD COLUMN request_fingerprint TEXT;
CREATE TRIGGER trg_cooked_meals_request_update
BEFORE UPDATE OF request_fingerprint ON cooked_meals
WHEN NEW.request_fingerprint IS NOT OLD.request_fingerprint
BEGIN
  SELECT RAISE(ABORT, 'Cooking request reference is immutable');
END;
