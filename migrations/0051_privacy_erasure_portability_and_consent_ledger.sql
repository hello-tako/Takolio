-- Migration 0051: Global Phase 4 — GDPR Art. 17 / APPI Art. 35 Two-Phase Account Erasure,
-- GDPR Art. 20 Data Portability Receipts, Art. 7 / APPI Art. 28 Consent Ledger,
-- and Zero-PII Statutory Financial Tax Archive (7y JP NTA / 10y DE AO §147).
-- Additive & backward-compatible; standard rowid tables only.

-- 1. Privacy erasure & data portability request ledger (`subject_hash` = SHA-256 of userId; zero PII!).
CREATE TABLE privacy_requests (
  id TEXT PRIMARY KEY NOT NULL,
  subject_hash TEXT NOT NULL CHECK (length(subject_hash) = 64),
  request_type TEXT NOT NULL CHECK (request_type IN ('erasure', 'export')),
  jurisdiction TEXT NOT NULL CHECK (jurisdiction IN ('EU', 'JP', 'VN', 'GLOBAL')),
  status TEXT NOT NULL CHECK (status IN ('pending_r2_purge', 'completed', 'failed')),
  r2_keys_json TEXT NOT NULL DEFAULT '[]' CHECK (
    json_valid(r2_keys_json) AND json_type(r2_keys_json) = 'array'
  ),
  r2_deleted_count INTEGER NOT NULL DEFAULT 0 CHECK (
    typeof(r2_deleted_count) = 'integer' AND r2_deleted_count >= 0
  ),
  erasure_mode TEXT CHECK (
    erasure_mode IS NULL OR erasure_mode IN ('hard_delete', 'cryptographic_tombstone')
  ),
  requested_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  completed_at TEXT,
  deadline_at TEXT NOT NULL
);

CREATE INDEX idx_privacy_requests_status_deadline
  ON privacy_requests(status, deadline_at);

-- 2. Immutable user consent ledger (GDPR Art. 7 proof of consent & Japan APPI Art. 28 cross-border AI notice).
CREATE TABLE consent_records (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL CHECK (
    consent_type IN (
      'privacy_policy',
      'terms_of_service',
      'ai_vision_processing',
      'cross_border_ai_transfer',
      'marketing_communications'
    )
  ),
  policy_version TEXT NOT NULL CHECK (length(trim(policy_version)) > 0),
  granted INTEGER NOT NULL CHECK (granted IN (0, 1)),
  jurisdiction TEXT NOT NULL CHECK (jurisdiction IN ('EU', 'JP', 'VN', 'GLOBAL')),
  recorded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_consent_records_user_type
  ON consent_records(user_id, consent_type, recorded_at DESC);

-- 3. Pseudonymized zero-PII statutory tax archive (GDPR Art. 17(3)(b) legal obligation carve-out:
-- 10 years EU/DE AO §147 & 7 years Japan National Tax Agency 電子帳簿保存法).
CREATE TABLE financial_tax_archive (
  id TEXT PRIMARY KEY NOT NULL,
  source_intent_hash TEXT NOT NULL UNIQUE CHECK (length(source_intent_hash) = 64),
  provider TEXT NOT NULL CHECK (provider IN ('dodo_mor', 'payos_vn')),
  plan TEXT NOT NULL CHECK (plan IN ('monthly', 'annual')),
  currency TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK (typeof(amount_minor) = 'integer' AND amount_minor > 0),
  minor_digits INTEGER NOT NULL CHECK (minor_digits IN (0, 2)),
  tax_amount_minor INTEGER NOT NULL DEFAULT 0 CHECK (
    typeof(tax_amount_minor) = 'integer' AND tax_amount_minor >= 0
  ),
  country_code TEXT NOT NULL CHECK (length(country_code) = 2),
  paid_at TEXT NOT NULL,
  retention_until TEXT NOT NULL,
  archived_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_financial_tax_archive_retention
  ON financial_tax_archive(retention_until);

-- 4. Tombstone marker on `users` for accounts referenced by append-only immutable inventory ledgers.
ALTER TABLE users ADD COLUMN erased_at TEXT;
