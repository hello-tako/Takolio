-- Migration 0048: Takolio V4 Unified Platform (Multi-Member Invites, Durable Cooking Sessions, Persistent Notifications & High-Impact Indexes)

-- 1. Household Invites for Multi-Member Sharing
CREATE TABLE IF NOT EXISTS household_invites (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  invite_code TEXT NOT NULL UNIQUE,
  created_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  max_uses INTEGER NOT NULL DEFAULT 5,
  used_count INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_household_invites_household_id ON household_invites(household_id);
CREATE INDEX IF NOT EXISTS idx_household_invites_invite_code ON household_invites(invite_code);

-- 2. Durable Active Cooking Sessions (Single Dish & Mam Com Multi-Dish)
CREATE TABLE IF NOT EXISTS cooking_sessions (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'single' CHECK (mode IN ('single', 'mam_com')),
  recipe_ids_json TEXT NOT NULL,
  current_step_index INTEGER NOT NULL DEFAULT 0,
  target_servings INTEGER NOT NULL DEFAULT 2,
  timers_json TEXT NOT NULL DEFAULT '{}',
  completed_steps_json TEXT NOT NULL DEFAULT '[]',
  content_fingerprint TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  started_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_cooking_sessions_hh_status_updated ON cooking_sessions(household_id, status, updated_at DESC);

-- 3. Persistent Deduplicated Household & User Notifications
CREATE TABLE IF NOT EXISTS user_notifications (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id TEXT,
  category TEXT NOT NULL CHECK (category IN ('expiry', 'shopping', 'planner', 'household', 'system')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  action_url TEXT,
  dedupe_key TEXT,
  is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0, 1)),
  read_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(household_id, dedupe_key)
);
CREATE INDEX IF NOT EXISTS idx_user_notifications_hh_read_created ON user_notifications(household_id, is_read, created_at DESC);

-- 4. High-Impact Missing D1 Indexes
CREATE INDEX IF NOT EXISTS idx_household_members_user_id ON household_members(user_id);
CREATE INDEX IF NOT EXISTS idx_shopping_lists_household_id ON shopping_lists(household_id);
CREATE INDEX IF NOT EXISTS idx_scans_household_created_at ON scans(household_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scans_status_created_at ON scans(status, created_at);
CREATE INDEX IF NOT EXISTS idx_inventory_obs_hh_status ON inventory_observations(household_id, status, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_cooked_meals_hh_completed ON cooked_meals(household_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_requests_created_at ON ai_requests(created_at DESC);
