-- Keyed Week swaps retain immutable acceptance for the household lifetime.
-- Plan/meal rows can be replaced or deleted without erasing command acceptance.
CREATE TABLE week_swap_receipts (
  id TEXT PRIMARY KEY NOT NULL,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL REFERENCES users(id),
  plan_id TEXT NOT NULL CHECK (length(trim(plan_id)) > 0),
  meal_id TEXT NOT NULL CHECK (length(trim(meal_id)) > 0),
  client_key TEXT NOT NULL CHECK (length(client_key) BETWEEN 8 AND 200),
  fingerprint TEXT NOT NULL CHECK (length(trim(fingerprint)) > 0),
  created_at TEXT NOT NULL,
  UNIQUE (household_id, plan_id, meal_id, client_key)
);

CREATE TRIGGER trg_week_swap_receipts_immutable_insert
BEFORE INSERT ON week_swap_receipts
WHEN EXISTS (
  SELECT 1 FROM week_swap_receipts WHERE id = NEW.id
    OR (household_id = NEW.household_id AND plan_id = NEW.plan_id
      AND meal_id = NEW.meal_id AND client_key = NEW.client_key)
)
BEGIN
  SELECT RAISE(ABORT, 'Week swap receipt already exists');
END;

CREATE TRIGGER trg_week_swap_receipts_immutable_update
BEFORE UPDATE ON week_swap_receipts
BEGIN
  SELECT RAISE(ABORT, 'Week swap receipts are immutable');
END;

CREATE TRIGGER trg_week_swap_receipts_immutable_delete
BEFORE DELETE ON week_swap_receipts
WHEN EXISTS (SELECT 1 FROM households WHERE id = OLD.household_id)
BEGIN
  SELECT RAISE(ABORT, 'Week swap receipts are retained for household lifetime');
END;
