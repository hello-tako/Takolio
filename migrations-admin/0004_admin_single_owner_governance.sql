-- Owner-approved single-administrator governance. Preserve existing history and
-- keep enrollment, atomic audit, one-time bootstrap and last-owner protection.
DROP TRIGGER trg_admin_roles_super_minimum;
DROP TRIGGER trg_admin_roles_three_operators;
CREATE TRIGGER trg_admin_roles_super_minimum BEFORE UPDATE OF status ON admin_role_assignments
WHEN OLD.role='SUPER_ADMIN' AND OLD.status='active' AND NEW.status<>'active'
 AND NOT EXISTS(SELECT 1 FROM admin_active_super_operators
   WHERE assignment_id<>OLD.id
     AND access_iss=(SELECT access_iss FROM operator_identity_bindings WHERE user_id=OLD.user_id))
BEGIN SELECT RAISE(ABORT,'at least one active enrolled SUPER_ADMIN in the issuer must remain'); END;

-- The owner cannot accidentally revoke the last usable identity through another table.
CREATE TRIGGER trg_admin_identity_last_owner BEFORE UPDATE OF status ON operator_identity_bindings
WHEN OLD.status='active' AND NEW.status<>'active'
 AND EXISTS(SELECT 1 FROM admin_active_super_operators WHERE user_id=OLD.user_id)
 AND NOT EXISTS(SELECT 1 FROM admin_active_super_operators WHERE user_id<>OLD.user_id AND access_iss=OLD.access_iss)
BEGIN SELECT RAISE(ABORT,'at least one active enrolled SUPER_ADMIN in the issuer must remain'); END;
CREATE TRIGGER trg_admin_operator_last_owner BEFORE UPDATE OF status ON approved_human_operators
WHEN OLD.status='active' AND NEW.status<>'active'
 AND EXISTS(SELECT 1 FROM admin_active_super_operators WHERE operator_id=OLD.operator_id)
 AND EXISTS(SELECT 1 FROM admin_active_super_operators owner
   WHERE owner.operator_id=OLD.operator_id AND NOT EXISTS(
     SELECT 1 FROM admin_active_super_operators other
     WHERE other.operator_id<>OLD.operator_id AND other.access_iss=owner.access_iss))
BEGIN SELECT RAISE(ABORT,'at least one active enrolled SUPER_ADMIN in the issuer must remain'); END;

DROP TRIGGER trg_admin_bootstrap_grant_guard;
CREATE TABLE admin_bootstrap_ceremonies_next (
 id TEXT PRIMARY KEY CHECK(length(id) BETWEEN 8 AND 64),
 operator_user_ids TEXT NOT NULL CHECK(json_valid(operator_user_ids) AND json_type(operator_user_ids)='array' AND json_array_length(operator_user_ids) BETWEEN 1 AND 3),
 independent_approval_ref TEXT NOT NULL CHECK(length(independent_approval_ref) BETWEEN 8 AND 200),
 created_at TEXT NOT NULL,
 audit_id TEXT NOT NULL UNIQUE CHECK(length(audit_id) BETWEEN 8 AND 64)
);
INSERT INTO admin_bootstrap_ceremonies_next SELECT id,operator_user_ids,independent_approval_ref,created_at,audit_id FROM admin_bootstrap_ceremonies;
DROP TABLE admin_bootstrap_ceremonies;
ALTER TABLE admin_bootstrap_ceremonies_next RENAME TO admin_bootstrap_ceremonies;
CREATE TRIGGER trg_admin_bootstrap_authority BEFORE INSERT ON admin_bootstrap_ceremonies
WHEN EXISTS(SELECT 1 FROM admin_role_assignments) OR EXISTS(SELECT 1 FROM admin_config_metadata WHERE key='bootstrap_completed_at')
 OR (SELECT COUNT(DISTINCT b.operator_id) FROM json_each(NEW.operator_user_ids) j
   JOIN operator_identity_bindings b ON b.user_id=j.value AND b.status='active'
   JOIN approved_human_operators h ON h.operator_id=b.operator_id AND h.status='active')<>json_array_length(NEW.operator_user_ids)
 OR (SELECT COUNT(DISTINCT b.access_iss) FROM json_each(NEW.operator_user_ids) j JOIN operator_identity_bindings b ON b.user_id=j.value)<>1
BEGIN SELECT RAISE(ABORT,'bootstrap requires enrolled active operators in one issuer and an empty authority database'); END;
CREATE TRIGGER trg_admin_bootstrap_apply AFTER INSERT ON admin_bootstrap_ceremonies
BEGIN
 INSERT INTO admin_role_assignments(id,user_id,role,grant_source,granted_at)
 SELECT NEW.id || '_' || j.key,j.value,'SUPER_ADMIN','operator_bootstrap',NEW.created_at FROM json_each(NEW.operator_user_ids) j;
 INSERT INTO admin_config_metadata(key,value) VALUES('bootstrap_completed_at',NEW.created_at);
 INSERT INTO admin_audit_events(id,occurred_at,actor_roles,action,target_type,target_id,outcome,metadata_json)
 VALUES(NEW.audit_id,NEW.created_at,'[]','admin.bootstrap','ceremony',NEW.id,'success',json_object('approvalRef',NEW.independent_approval_ref,'governance','single_owner'));
END;
CREATE TRIGGER trg_admin_bootstrap_grant_guard BEFORE INSERT ON admin_role_assignments
WHEN NEW.grant_source='operator_bootstrap' AND NOT EXISTS(SELECT 1 FROM admin_bootstrap_ceremonies c,json_each(c.operator_user_ids) j WHERE j.value=NEW.user_id)
BEGIN SELECT RAISE(ABORT,'bootstrap grants require an atomic authorized ceremony'); END;
CREATE TRIGGER trg_admin_bootstrap_no_update BEFORE UPDATE ON admin_bootstrap_ceremonies
BEGIN SELECT RAISE(ABORT,'bootstrap ceremony is immutable'); END;
CREATE TRIGGER trg_admin_bootstrap_no_delete BEFORE DELETE ON admin_bootstrap_ceremonies
BEGIN SELECT RAISE(ABORT,'bootstrap ceremony is retained history'); END;

-- Keep the explicit request/confirm step; the requesting owner may confirm.
CREATE TABLE admin_action_approvals_next (
 id TEXT PRIMARY KEY CHECK(length(id) BETWEEN 8 AND 64),
 action TEXT NOT NULL CHECK(action IN ('role.grant.super_admin','role.revoke.super_admin')),
 target_user_id TEXT NOT NULL CHECK(length(target_user_id) BETWEEN 1 AND 128),
 assignment_id TEXT,
 requested_by TEXT NOT NULL,
 requested_at TEXT NOT NULL,
 expires_at TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','expired','cancelled')),
 decided_by TEXT,
 decided_at TEXT,
 requester_access_iss TEXT,
 requester_access_sub TEXT,
 decider_access_iss TEXT,
 decider_access_sub TEXT,
 CHECK((action='role.revoke.super_admin')=(assignment_id IS NOT NULL)),
 CHECK(requested_by<>target_user_id),
 CHECK(decided_by IS NULL OR decided_by<>target_user_id),
 CHECK((status IN ('pending','expired','cancelled') AND decided_by IS NULL) OR
       (status IN ('approved','rejected') AND decided_by IS NOT NULL AND decided_at IS NOT NULL)),
 CHECK(status='pending' OR decided_at IS NOT NULL)
);
INSERT INTO admin_action_approvals_next SELECT id,action,target_user_id,assignment_id,requested_by,requested_at,expires_at,status,decided_by,decided_at,requester_access_iss,requester_access_sub,decider_access_iss,decider_access_sub FROM admin_action_approvals;
DROP TABLE admin_action_approvals;
ALTER TABLE admin_action_approvals_next RENAME TO admin_action_approvals;
CREATE UNIQUE INDEX idx_admin_approvals_pending ON admin_action_approvals(action,target_user_id) WHERE status='pending';
CREATE INDEX idx_admin_approvals_status ON admin_action_approvals(status,requested_at DESC);
CREATE TRIGGER trg_admin_approvals_final BEFORE UPDATE ON admin_action_approvals WHEN OLD.status<>'pending'
BEGIN SELECT RAISE(ABORT,'decided admin approvals are final'); END;
CREATE TRIGGER trg_admin_approvals_no_delete BEFORE DELETE ON admin_action_approvals
BEGIN SELECT RAISE(ABORT,'admin approvals are retained history'); END;
CREATE TRIGGER trg_admin_approval_operation_immutable BEFORE UPDATE OF action,target_user_id,assignment_id,requested_by,requested_at,expires_at,requester_access_iss,requester_access_sub ON admin_action_approvals
BEGIN SELECT RAISE(ABORT,'approval operation is immutable'); END;
CREATE TRIGGER trg_admin_approval_identity BEFORE UPDATE OF status ON admin_action_approvals
WHEN NEW.status IN ('approved','rejected') AND (
 NEW.decider_access_iss IS NULL OR NEW.decider_access_sub IS NULL OR
 NOT EXISTS(SELECT 1 FROM operator_identity_bindings b JOIN approved_human_operators h ON h.operator_id=b.operator_id AND h.status='active' JOIN admin_role_assignments r ON r.user_id=b.user_id AND r.role='SUPER_ADMIN' AND r.status='active'
   WHERE b.user_id=NEW.decided_by AND b.access_iss=NEW.decider_access_iss AND b.access_sub=NEW.decider_access_sub AND b.status='active') OR
 NOT EXISTS(SELECT 1 FROM operator_identity_bindings b JOIN approved_human_operators h ON h.operator_id=b.operator_id AND h.status='active' JOIN admin_role_assignments r ON r.user_id=b.user_id AND r.role='SUPER_ADMIN' AND r.status='active'
   WHERE b.user_id=OLD.requested_by AND b.access_iss=OLD.requester_access_iss AND b.access_sub=OLD.requester_access_sub AND b.status='active') OR
 NEW.decider_access_iss<>OLD.requester_access_iss OR NEW.decided_by=OLD.target_user_id)
BEGIN SELECT RAISE(ABORT,'approval authority or target identity check failed'); END;
CREATE TRIGGER trg_admin_approval_target_enrolled BEFORE UPDATE OF status ON admin_action_approvals
WHEN NEW.status='approved' AND OLD.action='role.grant.super_admin' AND NOT EXISTS(
 SELECT 1 FROM operator_identity_bindings b JOIN approved_human_operators h ON h.operator_id=b.operator_id AND h.status='active'
 WHERE b.user_id=OLD.target_user_id AND b.status='active' AND b.access_iss=NEW.decider_access_iss)
BEGIN SELECT RAISE(ABORT,'approval target must be an active approved enrolled operator in the issuer'); END;

-- Offline recovery can use one enrolled owner's key. Existing two-key records survive.
CREATE TABLE admin_recovery_operations_next (
 id TEXT PRIMARY KEY CHECK(length(id) BETWEEN 8 AND 64),
 manifest_hash TEXT NOT NULL UNIQUE CHECK(length(manifest_hash)=64),
 source_sha TEXT NOT NULL CHECK(length(source_sha)=40),
 database_identity TEXT NOT NULL CHECK(length(database_identity) BETWEEN 8 AND 128),
 expires_at TEXT NOT NULL,
 executed_at TEXT NOT NULL,
 approval_operator_ids TEXT NOT NULL CHECK(json_valid(approval_operator_ids) AND json_type(approval_operator_ids)='array' AND json_array_length(approval_operator_ids) BETWEEN 1 AND 2),
 target_user_id TEXT NOT NULL,
 approval_public_keys TEXT NOT NULL CHECK(json_valid(approval_public_keys) AND json_type(approval_public_keys)='array' AND json_array_length(approval_public_keys)=json_array_length(approval_operator_ids)),
 CHECK(expires_at>executed_at)
);
INSERT INTO admin_recovery_operations_next SELECT id,manifest_hash,source_sha,database_identity,expires_at,executed_at,approval_operator_ids,target_user_id,approval_public_keys FROM admin_recovery_operations;
DROP TABLE admin_recovery_operations;
ALTER TABLE admin_recovery_operations_next RENAME TO admin_recovery_operations;
CREATE TRIGGER trg_admin_recovery_authority BEFORE INSERT ON admin_recovery_operations
WHEN NOT EXISTS(SELECT 1 FROM admin_database_identity WHERE identity=NEW.database_identity)
 OR (SELECT COUNT(DISTINCT value) FROM json_each(NEW.approval_public_keys))<>json_array_length(NEW.approval_public_keys)
 OR NEW.expires_at<=strftime('%Y-%m-%dT%H:%M:%fZ','now')
 OR NEW.executed_at>strftime('%Y-%m-%dT%H:%M:%fZ','now','+1 minute')
 OR (SELECT COUNT(DISTINCT h.operator_id) FROM json_each(NEW.approval_operator_ids) a
   JOIN approved_human_operators h ON h.operator_id=a.value AND h.status='active' AND h.recovery_key_algorithm='Ed25519'
     AND h.recovery_public_key=json_extract(NEW.approval_public_keys,'$['||a.key||']'))<>json_array_length(NEW.approval_operator_ids)
 OR NOT EXISTS(SELECT 1 FROM operator_identity_bindings b JOIN approved_human_operators h ON h.operator_id=b.operator_id AND h.status='active'
   WHERE b.user_id=NEW.target_user_id AND b.status='active')
 OR EXISTS(SELECT 1 FROM admin_role_assignments WHERE user_id=NEW.target_user_id AND role='SUPER_ADMIN' AND status='active')
BEGIN SELECT RAISE(ABORT,'recovery authority, expiry or database identity check failed'); END;
CREATE TRIGGER trg_admin_recovery_apply AFTER INSERT ON admin_recovery_operations
BEGIN
 INSERT INTO admin_role_assignments(id,user_id,role,grant_source,granted_by,granted_at)
 VALUES('ara_'||NEW.id,NEW.target_user_id,'SUPER_ADMIN','approval','recovery:'||NEW.id,NEW.executed_at);
 INSERT INTO admin_audit_events(id,occurred_at,actor_roles,action,target_type,target_id,outcome,metadata_json)
 VALUES('evt_'||NEW.id,NEW.executed_at,'[]','admin.breakglass','user',NEW.target_user_id,'success',
   json_object('manifestHash',NEW.manifest_hash,'sourceSha',NEW.source_sha,'operators',json(NEW.approval_operator_ids)));
 UPDATE admin_sessions SET revoked_at=NEW.executed_at,revoked_reason='role_changed' WHERE user_id=NEW.target_user_id AND revoked_at IS NULL;
END;
CREATE TRIGGER trg_admin_recovery_no_update BEFORE UPDATE ON admin_recovery_operations
BEGIN SELECT RAISE(ABORT,'recovery operations are immutable'); END;
CREATE TRIGGER trg_admin_recovery_no_delete BEFORE DELETE ON admin_recovery_operations
BEGIN SELECT RAISE(ABORT,'recovery operations are retained history'); END;

-- First-owner enrollment is one audited statement, accepted only before bootstrap.
CREATE TABLE admin_owner_enrollments (
 id TEXT PRIMARY KEY CHECK(length(id) BETWEEN 8 AND 48),
 user_id TEXT NOT NULL UNIQUE CHECK(length(user_id) BETWEEN 1 AND 128),
 operator_id TEXT NOT NULL UNIQUE CHECK(length(operator_id) BETWEEN 8 AND 64),
 access_iss TEXT NOT NULL,
 access_sub TEXT NOT NULL CHECK(length(access_sub) BETWEEN 1 AND 128),
 email TEXT NOT NULL CHECK(length(email) BETWEEN 3 AND 254),
 display_name TEXT NOT NULL CHECK(length(display_name) BETWEEN 1 AND 200),
 public_key TEXT NOT NULL,
 approval_ref TEXT NOT NULL CHECK(length(approval_ref) BETWEEN 8 AND 200),
 created_at TEXT NOT NULL
);
CREATE TRIGGER trg_admin_owner_enrollment_guard BEFORE INSERT ON admin_owner_enrollments
WHEN EXISTS(SELECT 1 FROM approved_human_operators)
 OR EXISTS(SELECT 1 FROM operator_identity_bindings)
 OR EXISTS(SELECT 1 FROM admin_role_assignments)
 OR EXISTS(SELECT 1 FROM admin_config_metadata WHERE key='bootstrap_completed_at')
BEGIN SELECT RAISE(ABORT,'owner enrollment requires an empty authority database'); END;
CREATE TRIGGER trg_admin_owner_enrollment_apply AFTER INSERT ON admin_owner_enrollments
BEGIN
 INSERT INTO approved_human_operators(operator_id,approval_ref,approved_at,recovery_public_key,recovery_key_algorithm)
 VALUES(NEW.operator_id,NEW.approval_ref,NEW.created_at,NEW.public_key,'Ed25519');
 INSERT INTO operator_identity_bindings(user_id,operator_id,access_iss,access_sub,approved_at,approval_ref,email,display_name)
 VALUES(NEW.user_id,NEW.operator_id,NEW.access_iss,NEW.access_sub,NEW.created_at,NEW.approval_ref,NEW.email,NEW.display_name);
 INSERT INTO admin_audit_events(id,occurred_at,actor_roles,action,target_type,target_id,outcome,metadata_json)
 VALUES('evt_'||NEW.id,NEW.created_at,'[]','admin.owner.enroll','user',NEW.user_id,'success',json_object('approvalRef',NEW.approval_ref));
END;
CREATE TRIGGER trg_admin_owner_enrollment_no_update BEFORE UPDATE ON admin_owner_enrollments
BEGIN SELECT RAISE(ABORT,'owner enrollment is immutable'); END;
CREATE TRIGGER trg_admin_owner_enrollment_no_delete BEFORE DELETE ON admin_owner_enrollments
BEGIN SELECT RAISE(ABORT,'owner enrollment is retained history'); END;

UPDATE admin_sessions SET revoked_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),revoked_reason='auth_mode_changed' WHERE revoked_at IS NULL;
UPDATE admin_config_metadata SET value='4' WHERE key='schema_version';
