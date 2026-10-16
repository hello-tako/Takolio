-- Additive Admin-only authority. Historical 0001 and the customer ledger remain intact.
ALTER TABLE admin_sessions ADD COLUMN access_iss TEXT;
ALTER TABLE admin_sessions ADD COLUMN access_sub TEXT;
ALTER TABLE admin_action_approvals ADD COLUMN requester_access_iss TEXT;
ALTER TABLE admin_action_approvals ADD COLUMN requester_access_sub TEXT;
ALTER TABLE admin_action_approvals ADD COLUMN decider_access_iss TEXT;
ALTER TABLE admin_action_approvals ADD COLUMN decider_access_sub TEXT;

CREATE TABLE approved_human_operators (
 operator_id TEXT PRIMARY KEY CHECK(length(operator_id) BETWEEN 8 AND 128),
 approval_ref TEXT NOT NULL CHECK(length(approval_ref) BETWEEN 8 AND 200),
 approved_at TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','revoked')),
 recovery_public_key TEXT,
 recovery_key_algorithm TEXT CHECK(recovery_key_algorithm IS NULL OR recovery_key_algorithm='Ed25519')
);
CREATE TABLE operator_identity_bindings (
 id TEXT UNIQUE,
 user_id TEXT PRIMARY KEY CHECK(length(user_id) BETWEEN 1 AND 128),
 operator_id TEXT NOT NULL UNIQUE REFERENCES approved_human_operators(operator_id),
 access_iss TEXT NOT NULL CHECK(length(access_iss) BETWEEN 8 AND 255),
 access_sub TEXT NOT NULL CHECK(length(access_sub) BETWEEN 1 AND 128),
 approved_at TEXT NOT NULL,
 approval_ref TEXT NOT NULL CHECK(length(approval_ref) BETWEEN 8 AND 200),
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','revoked')),
 security_epoch INTEGER NOT NULL DEFAULT 1 CHECK(security_epoch>0),
 email TEXT NOT NULL CHECK(length(email) BETWEEN 3 AND 254),
 display_name TEXT NOT NULL CHECK(length(display_name) BETWEEN 1 AND 200),
 UNIQUE(access_iss,access_sub)
);
CREATE TRIGGER trg_admin_identity_immutable BEFORE UPDATE OF user_id,operator_id,access_iss,access_sub ON operator_identity_bindings
BEGIN SELECT RAISE(ABORT,'operator identity is immutable; enroll a new identity under reviewed recovery'); END;
CREATE TRIGGER trg_admin_identity_no_delete BEFORE DELETE ON operator_identity_bindings
BEGIN SELECT RAISE(ABORT,'operator identity is retained history'); END;
CREATE TRIGGER trg_admin_identity_revoke AFTER UPDATE OF status,security_epoch ON operator_identity_bindings
BEGIN UPDATE admin_sessions SET revoked_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),revoked_reason='credential_changed' WHERE user_id=NEW.user_id AND revoked_at IS NULL; END;
CREATE TRIGGER trg_admin_operator_revoke AFTER UPDATE OF status ON approved_human_operators
WHEN NEW.status='revoked'
BEGIN UPDATE admin_sessions SET revoked_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),revoked_reason='credential_changed' WHERE user_id IN(SELECT user_id FROM operator_identity_bindings WHERE operator_id=NEW.operator_id) AND revoked_at IS NULL; END;

-- Offline bootstrap is a single insert whose trigger writes all grants, closure,
-- and mandatory audit together. A failure anywhere rolls back the statement.
CREATE TABLE admin_bootstrap_ceremonies (
 id TEXT PRIMARY KEY CHECK(length(id) BETWEEN 8 AND 64),
 operator_user_ids TEXT NOT NULL CHECK(json_valid(operator_user_ids) AND json_type(operator_user_ids)='array' AND json_array_length(operator_user_ids)=3),
 independent_approval_ref TEXT NOT NULL CHECK(length(independent_approval_ref) BETWEEN 8 AND 200),
 created_at TEXT NOT NULL,
 audit_id TEXT NOT NULL UNIQUE CHECK(length(audit_id) BETWEEN 8 AND 64)
);
CREATE TRIGGER trg_admin_bootstrap_authority BEFORE INSERT ON admin_bootstrap_ceremonies
WHEN EXISTS(SELECT 1 FROM admin_role_assignments) OR EXISTS(SELECT 1 FROM admin_config_metadata WHERE key='bootstrap_completed_at')
 OR (SELECT COUNT(DISTINCT b.operator_id) FROM json_each(NEW.operator_user_ids) j JOIN operator_identity_bindings b ON b.user_id=j.value AND b.status='active' JOIN approved_human_operators h ON h.operator_id=b.operator_id AND h.status='active')<>3
BEGIN SELECT RAISE(ABORT,'bootstrap requires three independently approved enrolled operators and an empty authority database'); END;
CREATE TRIGGER trg_admin_bootstrap_apply AFTER INSERT ON admin_bootstrap_ceremonies
BEGIN
 INSERT INTO admin_role_assignments(id,user_id,role,grant_source,granted_at)
 SELECT NEW.id || '_' || j.key,j.value,'SUPER_ADMIN','operator_bootstrap',NEW.created_at FROM json_each(NEW.operator_user_ids) j;
 INSERT INTO admin_config_metadata(key,value) VALUES('bootstrap_completed_at',NEW.created_at);
 INSERT INTO admin_audit_events(id,occurred_at,actor_roles,action,target_type,target_id,outcome,metadata_json)
 VALUES(NEW.audit_id,NEW.created_at,'[]','admin.bootstrap','ceremony',NEW.id,'success',json_object('approvalRef',NEW.independent_approval_ref));
END;
CREATE TRIGGER trg_admin_bootstrap_grant_guard BEFORE INSERT ON admin_role_assignments
WHEN NEW.grant_source='operator_bootstrap' AND NOT EXISTS(SELECT 1 FROM admin_bootstrap_ceremonies c,json_each(c.operator_user_ids) j WHERE j.value=NEW.user_id)
BEGIN SELECT RAISE(ABORT,'bootstrap grants require an atomic authorized ceremony'); END;
CREATE TRIGGER trg_admin_bootstrap_no_update BEFORE UPDATE ON admin_bootstrap_ceremonies
BEGIN SELECT RAISE(ABORT,'bootstrap ceremony is immutable'); END;
CREATE TRIGGER trg_admin_bootstrap_no_delete BEFORE DELETE ON admin_bootstrap_ceremonies
BEGIN SELECT RAISE(ABORT,'bootstrap ceremony is retained history'); END;
CREATE TRIGGER trg_admin_approval_operation_immutable BEFORE UPDATE OF action,target_user_id,assignment_id,requested_by,requested_at,expires_at,requester_access_iss,requester_access_sub ON admin_action_approvals
BEGIN SELECT RAISE(ABORT,'approval operation is immutable'); END;
CREATE TRIGGER trg_admin_approval_identity BEFORE UPDATE OF status ON admin_action_approvals
WHEN NEW.status IN ('approved','rejected') AND (
 NEW.decider_access_iss IS NULL OR NEW.decider_access_sub IS NULL OR
 NOT EXISTS(SELECT 1 FROM operator_identity_bindings b JOIN approved_human_operators h ON h.operator_id=b.operator_id AND h.status='active' JOIN admin_role_assignments r ON r.user_id=b.user_id AND r.role='SUPER_ADMIN' AND r.status='active'
 WHERE b.user_id=NEW.decided_by AND b.access_iss=NEW.decider_access_iss AND b.access_sub=NEW.decider_access_sub AND b.status='active') OR
 NOT EXISTS(SELECT 1 FROM operator_identity_bindings b JOIN approved_human_operators h ON h.operator_id=b.operator_id AND h.status='active' JOIN admin_role_assignments r ON r.user_id=b.user_id AND r.role='SUPER_ADMIN' AND r.status='active'
 WHERE b.user_id=OLD.requested_by AND b.access_iss=OLD.requester_access_iss AND b.access_sub=OLD.requester_access_sub AND b.status='active') OR
 (SELECT operator_id FROM operator_identity_bindings WHERE user_id=NEW.decided_by) IN (SELECT operator_id FROM operator_identity_bindings WHERE user_id IN (OLD.requested_by,OLD.target_user_id)))
BEGIN SELECT RAISE(ABORT,'approval authority or independent operator check failed'); END;
CREATE TABLE admin_recovery_operations (
 id TEXT PRIMARY KEY CHECK(length(id) BETWEEN 8 AND 64),
 manifest_hash TEXT NOT NULL UNIQUE CHECK(length(manifest_hash)=64),
 source_sha TEXT NOT NULL CHECK(length(source_sha)=40),
 database_identity TEXT NOT NULL CHECK(length(database_identity) BETWEEN 8 AND 128),
 expires_at TEXT NOT NULL,
 executed_at TEXT NOT NULL,
 approval_operator_ids TEXT NOT NULL CHECK(json_valid(approval_operator_ids) AND json_array_length(approval_operator_ids)=2),
 CHECK(expires_at>executed_at)
);
UPDATE admin_config_metadata SET value='2' WHERE key='schema_version';
-- R1 sessions cannot carry R2 identity authority.
UPDATE admin_sessions SET revoked_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),revoked_reason='auth_mode_changed' WHERE revoked_at IS NULL;
-- Local credentials are never provisioned outside verifiably local tooling.
CREATE TABLE admin_local_credentials (
 user_id TEXT PRIMARY KEY REFERENCES operator_identity_bindings(user_id),
 email TEXT NOT NULL UNIQUE,
 display_name TEXT NOT NULL,
 password_hash TEXT NOT NULL,
 salt TEXT NOT NULL
);
