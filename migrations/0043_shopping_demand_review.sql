-- Purchase intent never changes unknown recipe demand or physical inventory.
CREATE TABLE shopping_demand_reviews (
  source_id TEXT NOT NULL REFERENCES shopping_plan_sources(id) ON DELETE CASCADE,
  demand_key TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  demand_fingerprint TEXT NOT NULL CHECK (length(demand_fingerprint) = 64),
  decision TEXT NOT NULL CHECK (decision IN ('pending', 'purchased', 'skipped')),
  item_id TEXT REFERENCES shopping_items(id) ON DELETE SET NULL,
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (source_id, demand_key)
);
CREATE INDEX idx_shopping_demand_reviews_item ON shopping_demand_reviews(item_id);

-- Receipts outlive demand replacement, review reopening and purchase deletion.
CREATE TABLE shopping_demand_review_commands (
  list_id TEXT NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
  request_key TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL CHECK (length(request_fingerprint) = 64),
  response_json TEXT NOT NULL CHECK (json_valid(response_json)),
  created_at TEXT NOT NULL,
  PRIMARY KEY (list_id, request_key)
);
CREATE TRIGGER trg_shopping_demand_review_commands_immutable_update
BEFORE UPDATE ON shopping_demand_review_commands
BEGIN
  SELECT RAISE(ABORT, 'Shopping demand review receipts are immutable');
END;
CREATE TRIGGER trg_shopping_demand_review_commands_immutable_delete
BEFORE DELETE ON shopping_demand_review_commands
WHEN EXISTS (SELECT 1 FROM shopping_lists WHERE id = OLD.list_id)
BEGIN
  SELECT RAISE(ABORT, 'Shopping demand review receipts are immutable');
END;
