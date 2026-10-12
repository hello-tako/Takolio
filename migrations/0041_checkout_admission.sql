-- Expand only. Original issued offers and legacy webhook/grant authority remain.
CREATE TABLE checkout_admissions (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_key TEXT NOT NULL CHECK (length(request_key) BETWEEN 16 AND 128),
  intent_id TEXT NOT NULL UNIQUE REFERENCES payment_intents(id) ON DELETE CASCADE,
  plan TEXT NOT NULL CHECK (plan IN ('monthly','annual')),
  state TEXT NOT NULL CHECK (state IN ('dispatching','ready','remote_uncertain')),
  attempt_id TEXT NOT NULL UNIQUE,
  deadline_at TEXT NOT NULL,
  instructions_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, request_key),
  CHECK ((state = 'ready' AND instructions_json IS NOT NULL) OR
         (state <> 'ready' AND instructions_json IS NULL))
);
CREATE INDEX idx_checkout_admissions_user_state ON checkout_admissions(user_id, state);
CREATE TABLE payment_reconciliation_records (
  intent_id TEXT PRIMARY KEY REFERENCES payment_intents(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('provider_outcome_unknown','attempt_deadline')),
  first_observed_at TEXT NOT NULL,
  last_observed_at TEXT NOT NULL
);
