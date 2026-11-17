-- Migration 0049: Takolio V6 Culinary OS & High-Power Backend Mode
-- Durable D1 Idempotency Ledger, Family Heirloom Recipes, Pantry Staple Thresholds,
-- Zero-Waste Impact Events, Household Grocery Budget Ledger, and Activity Feed.

-- 1. Durable D1 Idempotency Ledger
CREATE TABLE IF NOT EXISTS d1_idempotency_keys (
  key_hash TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL,
  route_key TEXT NOT NULL,
  request_sha256 TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  response_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_d1_idempotency_expires ON d1_idempotency_keys(expires_at);

-- 2. Custom Household (Family Heirloom) Recipes
CREATE TABLE IF NOT EXISTS custom_household_recipes (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  author_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  region TEXT NOT NULL DEFAULT 'all' CHECK (region IN ('bac', 'trung', 'nam', 'all')),
  category TEXT NOT NULL DEFAULT 'braise',
  difficulty TEXT NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  prep_time_minutes INTEGER NOT NULL DEFAULT 15,
  cook_time_minutes INTEGER NOT NULL DEFAULT 25,
  servings INTEGER NOT NULL DEFAULT 4,
  ingredients_json TEXT NOT NULL,
  steps_json TEXT NOT NULL,
  chef_secret TEXT,
  family_story TEXT,
  is_pinned INTEGER NOT NULL DEFAULT 0 CHECK (is_pinned IN (0, 1)),
  cooked_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(household_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_custom_hh_recipes_hh_updated
  ON custom_household_recipes(household_id, is_pinned DESC, updated_at DESC);

-- 3. Pantry Staple Thresholds & Auto-Restock Configuration
CREATE TABLE IF NOT EXISTS pantry_staple_thresholds (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  ingredient_id TEXT,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'seasoning',
  storage TEXT NOT NULL DEFAULT 'pantry' CHECK (storage IN ('fridge', 'freezer', 'pantry')),
  unit TEXT NOT NULL DEFAULT 'ml',
  min_quantity REAL NOT NULL DEFAULT 1,
  target_quantity REAL NOT NULL DEFAULT 2,
  auto_add_shopping INTEGER NOT NULL DEFAULT 1 CHECK (auto_add_shopping IN (0, 1)),
  updated_at TEXT NOT NULL,
  UNIQUE(household_id, name)
);
CREATE INDEX IF NOT EXISTS idx_pantry_thresholds_hh ON pantry_staple_thresholds(household_id);

-- 4. Household Zero-Waste Events Ledger
CREATE TABLE IF NOT EXISTS household_waste_events (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL,
  item_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'produce',
  event_type TEXT NOT NULL CHECK (event_type IN ('rescued', 'expired_discarded', 'composted', 'leftover_saved')),
  quantity REAL NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'phần',
  estimated_value_vnd INTEGER NOT NULL DEFAULT 0,
  co2_grams INTEGER NOT NULL DEFAULT 0,
  occurred_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_waste_events_hh_occurred
  ON household_waste_events(household_id, occurred_at DESC);

-- 5. Household Grocery Budget Ledger
CREATE TABLE IF NOT EXISTS household_budget_entries (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL,
  entry_kind TEXT NOT NULL DEFAULT 'expense' CHECK (entry_kind IN ('expense', 'weekly_target')),
  amount_vnd INTEGER NOT NULL CHECK (amount_vnd >= 0),
  category TEXT NOT NULL DEFAULT 'market',
  note TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'receipt_scan', 'shopping_import')),
  spent_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_budget_entries_hh_spent
  ON household_budget_entries(household_id, entry_kind, spent_at DESC);

-- 6. Household Real-Time Activity Timeline
CREATE TABLE IF NOT EXISTS household_activity_events (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL,
  actor_name TEXT NOT NULL DEFAULT 'Thành viên',
  event_kind TEXT NOT NULL,
  summary_vi TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_activity_events_hh_created
  ON household_activity_events(household_id, created_at DESC);
