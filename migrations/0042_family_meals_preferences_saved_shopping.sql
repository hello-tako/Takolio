-- Explicit meal habits and saved recipes are additive; no legacy diet import.
CREATE TABLE family_meal_preferences (
  household_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  preferences_json TEXT NOT NULL CHECK (json_valid(preferences_json)),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (household_id, user_id),
  FOREIGN KEY (household_id, user_id) REFERENCES household_members(household_id, user_id) ON DELETE CASCADE
);
CREATE TABLE saved_recipe_entries (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipe_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  is_saved INTEGER NOT NULL CHECK (is_saved IN (0, 1)),
  display_json TEXT NOT NULL CHECK (json_valid(display_json)),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, recipe_id)
);
CREATE INDEX idx_saved_recipe_entries_recent ON saved_recipe_entries(user_id, is_saved, updated_at DESC);

CREATE TABLE generated_family_meal_plans (
  plan_id TEXT PRIMARY KEY REFERENCES generated_meal_plans(id) ON DELETE CASCADE,
  household_id TEXT NOT NULL,
  creator_user_id TEXT NOT NULL,
  schema_version INTEGER NOT NULL CHECK (schema_version = 2),
  profile_revision INTEGER NOT NULL CHECK (profile_revision >= 0),
  profile_fingerprint TEXT NOT NULL,
  policy_json TEXT NOT NULL CHECK (json_valid(policy_json)),
  diagnostics_json TEXT NOT NULL CHECK (json_valid(diagnostics_json)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (household_id, creator_user_id) REFERENCES household_members(household_id, user_id) ON DELETE CASCADE
);

-- Demand snapshots are independent of checked state and user purchase overrides.
CREATE TABLE shopping_plan_sources (
  id TEXT PRIMARY KEY,
  list_id TEXT NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES generated_meal_plans(id) ON DELETE CASCADE,
  creator_user_id TEXT NOT NULL REFERENCES users(id),
  plan_revision INTEGER NOT NULL CHECK (plan_revision >= 1),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(list_id, plan_id)
);
CREATE TABLE shopping_plan_demands (
  source_id TEXT NOT NULL REFERENCES shopping_plan_sources(id) ON DELETE CASCADE,
  demand_key TEXT NOT NULL,
  ingredient_id TEXT NOT NULL,
  name TEXT NOT NULL,
  quantity REAL CHECK (quantity IS NULL OR quantity > 0),
  unit TEXT NOT NULL,
  contributions_json TEXT NOT NULL CHECK (json_valid(contributions_json)),
  PRIMARY KEY (source_id, demand_key)
);
CREATE TABLE shopping_generated_item_state (
  item_id TEXT PRIMARY KEY REFERENCES shopping_items(id) ON DELETE CASCADE,
  list_id TEXT NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
  demand_key TEXT NOT NULL,
  is_overridden INTEGER NOT NULL DEFAULT 0 CHECK (is_overridden IN (0, 1)),
  UNIQUE(list_id, demand_key)
);
CREATE TABLE shopping_plan_commands (
  list_id TEXT NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
  request_key TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL,
  source_id TEXT NOT NULL REFERENCES shopping_plan_sources(id) ON DELETE CASCADE,
  response_json TEXT NOT NULL CHECK (json_valid(response_json)),
  created_at TEXT NOT NULL,
  PRIMARY KEY(list_id, request_key)
);
CREATE TABLE shopping_item_metadata (
  item_id TEXT PRIMARY KEY REFERENCES shopping_items(id) ON DELETE CASCADE,
  ingredient_identity TEXT,
  recipe_identity TEXT,
  recipe_title TEXT,
  cannot_buy INTEGER NOT NULL DEFAULT 0 CHECK (cannot_buy IN (0,1))
);
-- A deliberate deletion stays dismissed for that plan's subsequent trip updates.
CREATE TABLE shopping_plan_item_dismissals (
  list_id TEXT NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
  demand_key TEXT NOT NULL,
  plan_id TEXT NOT NULL REFERENCES generated_meal_plans(id) ON DELETE CASCADE,
  PRIMARY KEY (list_id, demand_key)
);
