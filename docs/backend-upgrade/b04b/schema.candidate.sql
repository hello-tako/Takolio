-- B04b candidate only. Not an applied migration or a production budget gate.
-- RESTRICT and immutable rows retain uncertain spend until retention is reviewed.
CREATE TABLE scan_ai_job_budgets (
  job_id TEXT NOT NULL REFERENCES scan_queue_jobs(id) ON DELETE RESTRICT,
  lane TEXT NOT NULL CHECK (lane IN ('main','shadow')),
  scan_id TEXT NOT NULL REFERENCES scans(id) ON DELETE RESTRICT,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE RESTRICT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  policy_fingerprint TEXT NOT NULL CHECK (length(policy_fingerprint)=64),
  policy_reference TEXT NOT NULL CHECK (length(trim(policy_reference)) BETWEEN 1 AND 200),
  max_calls INTEGER NOT NULL CHECK (typeof(max_calls)='integer' AND max_calls BETWEEN 0 AND 10000),
  max_tokens INTEGER NOT NULL CHECK (typeof(max_tokens)='integer' AND max_tokens BETWEEN 0 AND 1000000000000),
  max_micro_usd INTEGER NOT NULL CHECK (typeof(max_micro_usd)='integer' AND max_micro_usd BETWEEN 0 AND 1000000000000),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (job_id,lane)
);
CREATE TABLE scan_ai_call_reservations (
  id TEXT PRIMARY KEY NOT NULL,
  job_id TEXT NOT NULL,
  lane TEXT NOT NULL,
  call_key TEXT NOT NULL CHECK (length(trim(call_key)) BETWEEN 1 AND 200),
  descriptor_fingerprint TEXT NOT NULL CHECK (length(descriptor_fingerprint)=64),
  request_sha256 TEXT NOT NULL CHECK (length(request_sha256)=64),
  proof_fingerprint TEXT NOT NULL CHECK (length(proof_fingerprint)=64),
  provider_id TEXT NOT NULL CHECK (length(trim(provider_id)) BETWEEN 1 AND 200),
  physical_model TEXT NOT NULL CHECK (length(trim(physical_model)) BETWEEN 1 AND 200),
  task TEXT NOT NULL CHECK (task IN ('fridge_image_analysis','receipt_ocr','label_ocr','ingredient_normalization','inventory_candidate_extraction')),
  kind TEXT NOT NULL CHECK (kind IN ('primary','repair','retry','escalation','shadow')),
  claim_token TEXT NOT NULL CHECK (length(trim(claim_token)) BETWEEN 1 AND 200),
  claim_attempt INTEGER NOT NULL CHECK (typeof(claim_attempt)='integer' AND claim_attempt>0),
  input_token_bound INTEGER NOT NULL CHECK (typeof(input_token_bound)='integer' AND input_token_bound BETWEEN 0 AND 1000000000000),
  output_token_bound INTEGER NOT NULL CHECK (typeof(output_token_bound)='integer' AND output_token_bound BETWEEN 1 AND 1000000000000),
  reserved_tokens INTEGER NOT NULL CHECK (typeof(reserved_tokens)='integer' AND reserved_tokens BETWEEN 1 AND 1000000000000
    AND reserved_tokens=input_token_bound+output_token_bound),
  reserved_micro_usd INTEGER NOT NULL CHECK (typeof(reserved_micro_usd)='integer' AND reserved_micro_usd BETWEEN 0 AND 1000000000000),
  outcome TEXT NOT NULL DEFAULT 'RESERVED_UNKNOWN' CHECK (outcome='RESERVED_UNKNOWN'),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (job_id,lane) REFERENCES scan_ai_job_budgets(job_id,lane) ON DELETE RESTRICT,
  UNIQUE (job_id,lane,call_key),
  CHECK ((lane='shadow' AND kind='shadow') OR (lane='main' AND kind<>'shadow'))
);
CREATE TRIGGER scan_ai_budget_immutable_update BEFORE UPDATE ON scan_ai_job_budgets
BEGIN SELECT RAISE(ABORT,'SCAN_AI_BUDGET_IMMUTABLE'); END;
CREATE TRIGGER scan_ai_budget_immutable_delete BEFORE DELETE ON scan_ai_job_budgets
BEGIN SELECT RAISE(ABORT,'SCAN_AI_BUDGET_IMMUTABLE'); END;
CREATE TRIGGER scan_ai_reservation_immutable_update BEFORE UPDATE ON scan_ai_call_reservations
BEGIN SELECT RAISE(ABORT,'SCAN_AI_RESERVATION_IMMUTABLE'); END;
CREATE TRIGGER scan_ai_reservation_immutable_delete BEFORE DELETE ON scan_ai_call_reservations
BEGIN SELECT RAISE(ABORT,'SCAN_AI_RESERVATION_IMMUTABLE'); END;
