-- Dormant strict-OTP foundation: existing routes continue using auth_otps until
-- the coordinator is integrated. Each scope lazily imports legacy accounting
-- at first initialization; the strict path does not adopt legacy challenges.
-- Live legacy supersession remains part of later route integration.
-- Durable rows intentionally have no foreign keys or cascading account cleanup.

CREATE TABLE auth_otp_scopes (
  scope_hash TEXT PRIMARY KEY NOT NULL
    CHECK (length(scope_hash) = 64 AND scope_hash NOT GLOB '*[^0-9a-f]*'),
  account_hash TEXT NOT NULL
    CHECK (length(account_hash) = 64 AND account_hash NOT GLOB '*[^0-9a-f]*'),
  purpose TEXT NOT NULL CHECK (purpose IN ('register', 'forgot_password', 'login')),
  generation INTEGER NOT NULL DEFAULT 0
    CHECK (typeof(generation) = 'integer' AND generation >= 0),
  current_issuance_id TEXT,
  cooldown_until INTEGER NOT NULL DEFAULT 0
    CHECK (typeof(cooldown_until) = 'integer' AND cooldown_until >= 0),
  locked_until INTEGER NOT NULL DEFAULT 0
    CHECK (typeof(locked_until) = 'integer' AND locked_until >= 0),
  initialized_at INTEGER NOT NULL
    CHECK (typeof(initialized_at) = 'integer' AND initialized_at >= 0),
  legacy_weight INTEGER NOT NULL
    CHECK (typeof(legacy_weight) = 'integer' AND legacy_weight BETWEEN 0 AND 5),
  UNIQUE (account_hash, purpose)
);

-- Account-wide keys fence reuse across operations and purpose changes.
CREATE TABLE auth_otp_requests (
  id TEXT PRIMARY KEY NOT NULL,
  account_hash TEXT NOT NULL
    CHECK (length(account_hash) = 64 AND account_hash NOT GLOB '*[^0-9a-f]*'),
  scope_hash TEXT NOT NULL
    CHECK (length(scope_hash) = 64 AND scope_hash NOT GLOB '*[^0-9a-f]*'),
  request_key TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN (
    'issue_register', 'issue_login', 'issue_forgot', 'register_verify',
    'login_verify', 'reset_preliminary', 'reset_final'
  )),
  purpose TEXT NOT NULL CHECK (purpose IN ('register', 'forgot_password', 'login')),
  fingerprint TEXT NOT NULL
    CHECK (length(fingerprint) = 64 AND fingerprint NOT GLOB '*[^0-9a-f]*'),
  generation INTEGER NOT NULL
    CHECK (typeof(generation) = 'integer' AND generation >= 0),
  issuance_id TEXT,
  owner_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN (
    'issued', 'pending', 'unavailable', 'invalid', 'stale', 'budget',
    'cooldown', 'expired', 'proof', 'completed'
  )),
  created_at INTEGER NOT NULL
    CHECK (typeof(created_at) = 'integer' AND created_at >= 0),
  retained_until INTEGER NOT NULL
    CHECK (typeof(retained_until) = 'integer' AND retained_until >= created_at),
  proof_expires_at INTEGER
    CHECK (proof_expires_at IS NULL OR (typeof(proof_expires_at) = 'integer' AND proof_expires_at >= 0)),
  UNIQUE (account_hash, request_key),
  CHECK (
    (operation IN ('issue_register', 'register_verify') AND purpose = 'register')
    OR (operation IN ('issue_login', 'login_verify') AND purpose = 'login')
    OR (operation IN ('issue_forgot', 'reset_preliminary', 'reset_final') AND purpose = 'forgot_password')
  )
);

CREATE TABLE auth_otp_issuances (
  id TEXT PRIMARY KEY NOT NULL,
  scope_hash TEXT NOT NULL
    CHECK (length(scope_hash) = 64 AND scope_hash NOT GLOB '*[^0-9a-f]*'),
  generation INTEGER NOT NULL
    CHECK (typeof(generation) = 'integer' AND generation > 0),
  request_id TEXT NOT NULL UNIQUE,
  state TEXT NOT NULL CHECK (state IN ('pending', 'accepted', 'rejected', 'delivery_unknown', 'superseded')),
  expected_digest TEXT NOT NULL
    CHECK (length(expected_digest) = 64 AND expected_digest NOT GLOB '*[^0-9a-f]*'),
  digest_version INTEGER NOT NULL
    CHECK (typeof(digest_version) = 'integer' AND digest_version IN (1, 2)),
  account_id TEXT,
  user_id TEXT,
  created_at INTEGER NOT NULL
    CHECK (typeof(created_at) = 'integer' AND created_at >= 0),
  expires_at INTEGER NOT NULL
    CHECK (typeof(expires_at) = 'integer' AND expires_at > created_at),
  used INTEGER NOT NULL DEFAULT 0
    CHECK (typeof(used) = 'integer' AND used IN (0, 1)),
  CHECK ((account_id IS NULL AND user_id IS NULL) OR (account_id IS NOT NULL AND user_id IS NOT NULL)),
  UNIQUE (scope_hash, generation)
);

CREATE TABLE auth_otp_tickets (
  id TEXT PRIMARY KEY NOT NULL,
  scope_hash TEXT NOT NULL
    CHECK (length(scope_hash) = 64 AND scope_hash NOT GLOB '*[^0-9a-f]*'),
  request_id TEXT UNIQUE,
  issuance_id TEXT,
  generation INTEGER NOT NULL
    CHECK (typeof(generation) = 'integer' AND generation >= 0),
  owner_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN (
    'register_verify', 'login_verify', 'reset_preliminary', 'reset_final', 'legacy_import'
  )),
  state TEXT NOT NULL CHECK (state IN ('admitted', 'unavailable', 'invalid', 'stale', 'proof', 'completed', 'imported')),
  weight INTEGER NOT NULL
    CHECK (typeof(weight) = 'integer' AND weight BETWEEN 1 AND 5),
  admitted_at INTEGER NOT NULL
    CHECK (typeof(admitted_at) = 'integer' AND admitted_at >= 0),
  deadline INTEGER NOT NULL
    CHECK (typeof(deadline) = 'integer' AND deadline >= admitted_at),
  proof_expires_at INTEGER
    CHECK (proof_expires_at IS NULL OR (typeof(proof_expires_at) = 'integer' AND proof_expires_at >= 0)),
  CHECK (
    (operation = 'legacy_import' AND request_id IS NULL AND state = 'imported')
    OR (operation <> 'legacy_import' AND request_id IS NOT NULL AND state <> 'imported' AND weight = 1)
  )
);

CREATE TABLE auth_otp_claims (
  id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('reserve', 'delivery', 'finalize')),
  now_sec INTEGER NOT NULL CHECK (typeof(now_sec) = 'integer' AND now_sec >= 0)
);

-- Required-write assertions execute inside the same D1 batch as their claim.
-- A false or NULL assertion aborts the batch, rolling back every guarded write.
CREATE TABLE auth_otp_assertions (
  command_id TEXT NOT NULL,
  ok INTEGER NOT NULL CHECK (ok = 1)
);

CREATE INDEX idx_auth_otp_tickets_scope_admitted ON auth_otp_tickets (scope_hash, admitted_at);
CREATE INDEX idx_auth_otp_requests_retained_until ON auth_otp_requests (retained_until);
