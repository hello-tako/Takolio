-- Takosan Admin Console: dedicated admin D1 database (binding ADMIN_DB).
-- Kept out of the customer database so customer releases, schema gates and
-- rollbacks are unaffected, and so a customer-Worker compromise cannot write
-- admin authority. User/recipe ids reference the customer database by value
-- (no cross-database foreign keys).

CREATE TABLE admin_config_metadata (
  key TEXT PRIMARY KEY CHECK (key IN ('schema_version','fixture_dataset','bootstrap_completed_at')),
  value TEXT NOT NULL CHECK (length(value) BETWEEN 1 AND 128),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
-- The admin Worker refuses to serve unless this equals its expected version.
INSERT INTO admin_config_metadata (key, value) VALUES ('schema_version', '1');

CREATE TABLE admin_role_assignments (
  id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 8 AND 64),
  user_id TEXT NOT NULL CHECK (length(user_id) BETWEEN 1 AND 128),
  role TEXT NOT NULL CHECK (role IN ('SUPER_ADMIN','OPERATIONS_ADMIN','CONTENT_EDITOR','SUPPORT_AGENT','READ_ONLY_AUDITOR')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  grant_source TEXT NOT NULL CHECK (grant_source IN ('operator_bootstrap','admin_grant','approval')),
  granted_by TEXT,
  granted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  revoked_by TEXT,
  revoked_at TEXT,
  revoke_reason TEXT CHECK (revoke_reason IS NULL OR length(revoke_reason) BETWEEN 1 AND 200),
  CHECK ((status = 'active' AND revoked_at IS NULL AND revoked_by IS NULL) OR (status = 'revoked' AND revoked_at IS NOT NULL)),
  -- Only the operator bootstrap may lack a granting admin; nobody grants themselves.
  CHECK ((grant_source = 'operator_bootstrap' AND granted_by IS NULL AND role = 'SUPER_ADMIN') OR
         (grant_source <> 'operator_bootstrap' AND granted_by IS NOT NULL AND granted_by <> user_id)),
  CHECK (grant_source <> 'approval' OR role = 'SUPER_ADMIN')
);
CREATE UNIQUE INDEX idx_admin_role_assignments_active ON admin_role_assignments(user_id, role) WHERE status = 'active';
CREATE INDEX idx_admin_role_assignments_role_status ON admin_role_assignments(role, status);

-- Assignments are history: never deleted, never re-activated, identity fields immutable.
CREATE TRIGGER trg_admin_roles_no_delete BEFORE DELETE ON admin_role_assignments
BEGIN SELECT RAISE(ABORT, 'admin_role_assignments rows are retained history'); END;
CREATE TRIGGER trg_admin_roles_immutable BEFORE UPDATE OF id, user_id, role, grant_source, granted_by, granted_at ON admin_role_assignments
BEGIN SELECT RAISE(ABORT, 'admin_role_assignments identity fields are immutable'); END;
CREATE TRIGGER trg_admin_roles_no_reactivate BEFORE UPDATE OF status ON admin_role_assignments
WHEN OLD.status = 'revoked'
BEGIN SELECT RAISE(ABORT, 'revoked admin role assignments cannot be reactivated'); END;
-- At least two active SUPER_ADMINs must remain (prevents single-approver deadlock and lock-out).
CREATE TRIGGER trg_admin_roles_super_minimum BEFORE UPDATE OF status ON admin_role_assignments
WHEN OLD.role = 'SUPER_ADMIN' AND OLD.status = 'active' AND NEW.status <> 'active'
  AND (SELECT COUNT(*) FROM admin_role_assignments WHERE role = 'SUPER_ADMIN' AND status = 'active') <= 2
BEGIN SELECT RAISE(ABORT, 'at least two active SUPER_ADMIN assignments must remain'); END;
-- Bootstrap is one-time: once completed, no further operator_bootstrap grant is accepted.
CREATE TRIGGER trg_admin_roles_bootstrap_once BEFORE INSERT ON admin_role_assignments
WHEN NEW.grant_source = 'operator_bootstrap'
  AND (EXISTS (SELECT 1 FROM admin_config_metadata WHERE key = 'bootstrap_completed_at')
       OR EXISTS (SELECT 1 FROM admin_role_assignments WHERE grant_source <> 'operator_bootstrap'))
BEGIN SELECT RAISE(ABORT, 'operator bootstrap has already been completed'); END;

CREATE TABLE admin_sessions (
  id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 8 AND 64),
  user_id TEXT NOT NULL CHECK (length(user_id) BETWEEN 1 AND 128),
  account_id TEXT NOT NULL CHECK (length(account_id) BETWEEN 1 AND 128),
  token_hash TEXT NOT NULL UNIQUE CHECK (length(token_hash) = 64 AND token_hash NOT GLOB '*[^0-9a-f]*'),
  -- Hash of the account's credential state at login; any change revokes the session.
  credential_fingerprint TEXT NOT NULL CHECK (length(credential_fingerprint) = 64 AND credential_fingerprint NOT GLOB '*[^0-9a-f]*'),
  auth_method TEXT NOT NULL CHECK (auth_method IN ('password','cloudflare_access')),
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  idle_expires_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  revoked_reason TEXT CHECK (revoked_reason IS NULL OR revoked_reason IN ('logout','admin_revoked','role_changed','credential_changed','auth_mode_changed')),
  ip_hash TEXT CHECK (ip_hash IS NULL OR length(ip_hash) = 64),
  CHECK ((revoked_at IS NULL AND revoked_reason IS NULL) OR (revoked_at IS NOT NULL AND revoked_reason IS NOT NULL))
);
CREATE INDEX idx_admin_sessions_user ON admin_sessions(user_id, revoked_at);
CREATE INDEX idx_admin_sessions_expires ON admin_sessions(expires_at);

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

CREATE TABLE admin_action_approvals (
  id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 8 AND 64),
  action TEXT NOT NULL CHECK (action IN ('role.grant.super_admin','role.revoke.super_admin')),
  target_user_id TEXT NOT NULL CHECK (length(target_user_id) BETWEEN 1 AND 128),
  assignment_id TEXT,
  requested_by TEXT NOT NULL,
  requested_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','expired','cancelled')),
  decided_by TEXT,
  decided_at TEXT,
  CHECK ((action = 'role.revoke.super_admin') = (assignment_id IS NOT NULL)),
  CHECK (requested_by <> target_user_id),
  CHECK (decided_by IS NULL OR (decided_by <> requested_by AND decided_by <> target_user_id)),
  CHECK ((status IN ('pending','expired','cancelled') AND decided_by IS NULL) OR
         (status IN ('approved','rejected') AND decided_by IS NOT NULL AND decided_at IS NOT NULL)),
  CHECK (status = 'pending' OR decided_at IS NOT NULL)
);
CREATE UNIQUE INDEX idx_admin_approvals_pending ON admin_action_approvals(action, target_user_id) WHERE status = 'pending';
CREATE INDEX idx_admin_approvals_status ON admin_action_approvals(status, requested_at DESC);
-- Decisions are final: only pending requests may change, and none are deleted.
CREATE TRIGGER trg_admin_approvals_final BEFORE UPDATE ON admin_action_approvals
WHEN OLD.status <> 'pending'
BEGIN SELECT RAISE(ABORT, 'decided admin approvals are final'); END;
CREATE TRIGGER trg_admin_approvals_no_delete BEFORE DELETE ON admin_action_approvals
BEGIN SELECT RAISE(ABORT, 'admin approvals are retained history'); END;

-- Editorial notes about customer recipes; never written back to recipe authority.
CREATE TABLE admin_recipe_editorial_reviews (
  id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 8 AND 64),
  recipe_id TEXT NOT NULL CHECK (length(recipe_id) BETWEEN 1 AND 128),
  recipe_version INTEGER NOT NULL CHECK (typeof(recipe_version) = 'integer' AND recipe_version > 0),
  state TEXT NOT NULL CHECK (state IN ('draft','in_review','approved','rejected')),
  note TEXT NOT NULL CHECK (length(note) BETWEEN 1 AND 2000),
  author_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_admin_recipe_reviews_recipe ON admin_recipe_editorial_reviews(recipe_id, created_at DESC, id DESC);
CREATE INDEX idx_admin_recipe_reviews_state ON admin_recipe_editorial_reviews(state, created_at DESC);

CREATE TABLE admin_user_preferences (
  user_id TEXT PRIMARY KEY,
  locale TEXT NOT NULL DEFAULT 'vi' CHECK (locale IN ('vi','en')),
  density TEXT NOT NULL DEFAULT 'comfortable' CHECK (density IN ('comfortable','compact')),
  sidebar_collapsed INTEGER NOT NULL DEFAULT 0 CHECK (sidebar_collapsed IN (0,1)),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
