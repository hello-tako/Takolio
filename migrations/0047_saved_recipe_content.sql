-- Existing components have unknown historical content; do not infer it from the current catalog.
ALTER TABLE generated_meal_plan_components ADD COLUMN recipe_content_fingerprint TEXT
  REFERENCES recipe_content_versions(fingerprint);

CREATE TRIGGER trg_meal_components_content_insert
BEFORE INSERT ON generated_meal_plan_components
WHEN NEW.recipe_content_fingerprint IS NOT NULL AND (
  NEW.kind <> 'recipe' OR NOT EXISTS (
    SELECT 1 FROM recipe_content_versions
    WHERE fingerprint = NEW.recipe_content_fingerprint AND recipe_id = NEW.recipe_id
  )
)
BEGIN
  SELECT RAISE(ABORT, 'Meal component content version does not match recipe');
END;

CREATE TRIGGER trg_meal_components_content_update
BEFORE UPDATE OF kind, recipe_id, recipe_content_fingerprint ON generated_meal_plan_components
WHEN NEW.recipe_content_fingerprint IS NOT NULL AND (
  NEW.kind <> 'recipe' OR NOT EXISTS (
    SELECT 1 FROM recipe_content_versions
    WHERE fingerprint = NEW.recipe_content_fingerprint AND recipe_id = NEW.recipe_id
  )
)
BEGIN
  SELECT RAISE(ABORT, 'Meal component content version does not match recipe');
END;
