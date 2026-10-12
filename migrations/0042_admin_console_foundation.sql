-- Admin Console V1 foundation. Additive only: no existing table, payment,
-- entitlement, recipe, household or inventory authority is rewritten.
-- Platform admin authority lives here, never in household_members.role.

CREATE TABLE admin_role_assignments (
  id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 8 AND 64),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('SUPER_ADMIN','OPERATIONS_ADMIN','CONTENT_EDITOR','SUPPORT_AGENT','READ_ONLY_AUDITOR')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  grant_source TEXT NOT NULL CHECK (grant_source IN ('local_bootstrap','admin_grant','approval')),
  granted_by TEXT REFERENCES users(id),
  granted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  revoked_by TEXT REFERENCES users(id),
  revoked_at TEXT,
  revoke_reason TEXT CHECK (revoke_reason IS NULL OR length(revoke_reason) BETWEEN 1 AND 200),
  CHECK ((status = 'active' AND revoked_at IS NULL AND revoked_by IS NULL) OR
         (status = 'revoked' AND revoked_at IS NOT NULL)),
  -- Only the local bootstrap may lack a granting admin.
  CHECK ((grant_source = 'local_bootstrap' AND granted_by IS NULL) OR
         (grant_source <> 'local_bootstrap' AND granted_by IS NOT NULL AND granted_by <> user_id))
);
CREATE UNIQUE INDEX idx_admin_role_assignments_active ON admin_role_assignments(user_id, role) WHERE status = 'active';
CREATE INDEX idx_admin_role_assignments_role_status ON admin_role_assignments(role, status);

CREATE TABLE admin_sessions (
  id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 8 AND 64),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE CHECK (length(token_hash) = 64 AND token_hash NOT GLOB '*[^0-9a-f]*'),
  csrf_hash TEXT NOT NULL CHECK (length(csrf_hash) = 64 AND csrf_hash NOT GLOB '*[^0-9a-f]*'),
  auth_method TEXT NOT NULL CHECK (auth_method IN ('password','cloudflare_access')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  last_seen_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  idle_expires_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  revoked_reason TEXT CHECK (revoked_reason IS NULL OR revoked_reason IN ('logout','admin_revoked','role_revoked','superseded')),
  ip_hash TEXT CHECK (ip_hash IS NULL OR length(ip_hash) = 64),
  CHECK ((revoked_at IS NULL AND revoked_reason IS NULL) OR (revoked_at IS NOT NULL AND revoked_reason IS NOT NULL))
);
CREATE INDEX idx_admin_sessions_user ON admin_sessions(user_id, revoked_at);
CREATE INDEX idx_admin_sessions_expires ON admin_sessions(expires_at);

-- Append-only: enforced by triggers below.
CREATE TABLE admin_audit_events (
  id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 8 AND 64),
  occurred_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  actor_user_id TEXT,
  actor_roles TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(actor_roles) AND json_type(actor_roles) = 'array'),
  action TEXT NOT NULL CHECK (length(action) BETWEEN 3 AND 64 AND action NOT GLOB '*[^a-z0-9._]*'),
  target_type TEXT CHECK (target_type IS NULL OR length(target_type) BETWEEN 1 AND 32),
  target_id TEXT CHECK (target_id IS NULL OR length(target_id) BETWEEN 1 AND 128),
  outcome TEXT NOT NULL CHECK (outcome IN ('success','denied','failure')),
  reason_code TEXT CHECK (reason_code IS NULL OR length(reason_code) BETWEEN 1 AND 64),
  request_id TEXT CHECK (request_id IS NULL OR length(request_id) <= 128),
  ip_hash TEXT CHECK (ip_hash IS NULL OR length(ip_hash) = 64),
  metadata_json TEXT CHECK (metadata_json IS NULL OR (json_valid(metadata_json) AND json_type(metadata_json) = 'object' AND length(metadata_json) <= 4000))
);
CREATE INDEX idx_admin_audit_occurred ON admin_audit_events(occurred_at DESC, id DESC);
CREATE INDEX idx_admin_audit_actor ON admin_audit_events(actor_user_id, occurred_at DESC);
CREATE INDEX idx_admin_audit_action ON admin_audit_events(action, occurred_at DESC);
CREATE INDEX idx_admin_audit_outcome ON admin_audit_events(outcome, occurred_at DESC);
CREATE TRIGGER trg_admin_audit_events_no_update BEFORE UPDATE ON admin_audit_events
BEGIN SELECT RAISE(ABORT, 'admin_audit_events is append-only'); END;
CREATE TRIGGER trg_admin_audit_events_no_delete BEFORE DELETE ON admin_audit_events
BEGIN SELECT RAISE(ABORT, 'admin_audit_events is append-only'); END;

-- Four-eyes approvals for privilege-raising actions (V1: SUPER_ADMIN grants).
CREATE TABLE admin_action_approvals (
  id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 8 AND 64),
  action TEXT NOT NULL CHECK (action IN ('role.grant.super_admin')),
  target_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_by TEXT NOT NULL REFERENCES users(id),
  requested_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expires_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','expired','cancelled')),
  decided_by TEXT REFERENCES users(id),
  decided_at TEXT,
  CHECK (requested_by <> target_user_id),
  CHECK (decided_by IS NULL OR (decided_by <> requested_by AND decided_by <> target_user_id)),
  CHECK ((status IN ('pending','expired') AND decided_by IS NULL AND decided_at IS NULL) OR
         (status IN ('approved','rejected') AND decided_by IS NOT NULL AND decided_at IS NOT NULL) OR
         (status = 'cancelled' AND decided_at IS NOT NULL))
);
CREATE UNIQUE INDEX idx_admin_approvals_pending ON admin_action_approvals(action, target_user_id) WHERE status = 'pending';
CREATE INDEX idx_admin_approvals_status ON admin_action_approvals(status, requested_at DESC);

-- Editorial review ledger. Does not modify recipes; publication into canonical
-- recipe authority is a separately authorized future workflow.
CREATE TABLE admin_recipe_editorial_reviews (
  id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 8 AND 64),
  recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  recipe_version INTEGER NOT NULL CHECK (typeof(recipe_version) = 'integer' AND recipe_version > 0),
  state TEXT NOT NULL CHECK (state IN ('draft','in_review','approved','rejected')),
  note TEXT NOT NULL CHECK (length(note) BETWEEN 1 AND 2000),
  author_user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_admin_recipe_reviews_recipe ON admin_recipe_editorial_reviews(recipe_id, created_at DESC, id DESC);
CREATE INDEX idx_admin_recipe_reviews_state ON admin_recipe_editorial_reviews(state, created_at DESC);

CREATE TABLE admin_user_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  locale TEXT NOT NULL DEFAULT 'vi' CHECK (locale IN ('vi','en')),
  density TEXT NOT NULL DEFAULT 'comfortable' CHECK (density IN ('comfortable','compact')),
  sidebar_collapsed INTEGER NOT NULL DEFAULT 0 CHECK (sidebar_collapsed IN (0,1)),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Operator metadata (e.g. the synthetic fixture marker). Never holds secrets.
CREATE TABLE admin_config_metadata (
  key TEXT PRIMARY KEY CHECK (key IN ('fixture_dataset','rbac_matrix_version')),
  value TEXT NOT NULL CHECK (length(value) BETWEEN 1 AND 128),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Read-path indexes for bounded admin aggregation on non-payment tables.
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_v2_last_seen ON sessions_v2(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_ai_requests_created ON ai_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_requests_task_created ON ai_requests(task, created_at);
