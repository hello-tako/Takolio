-- Staging-only QA enrollment/revocation. No passwords, recovery keys or role grants.
CREATE TABLE admin_staging_test_ceremonies (
 id TEXT PRIMARY KEY CHECK(length(id) BETWEEN 8 AND 48),
 operation TEXT NOT NULL CHECK(operation IN ('enroll','revoke')),
 user_id TEXT NOT NULL CHECK(user_id GLOB 'qa_*' AND length(user_id) BETWEEN 8 AND 64),
 operator_id TEXT NOT NULL CHECK(operator_id GLOB 'qa_*' AND length(operator_id) BETWEEN 8 AND 64),
 access_iss TEXT NOT NULL,
 access_sub TEXT NOT NULL CHECK(length(access_sub) BETWEEN 1 AND 128),
 email TEXT NOT NULL CHECK(length(email) BETWEEN 3 AND 254),
 display_name TEXT NOT NULL CHECK(length(display_name) BETWEEN 1 AND 200),
 owner_operator_id TEXT NOT NULL,
 owner_public_key TEXT NOT NULL,
 approval_ref TEXT NOT NULL CHECK(length(approval_ref) BETWEEN 8 AND 200),
 manifest_hash TEXT NOT NULL UNIQUE CHECK(length(manifest_hash)=64),
 expires_at TEXT NOT NULL,
 executed_at TEXT NOT NULL CHECK(expires_at>executed_at)
);
CREATE UNIQUE INDEX idx_admin_staging_test_enrollment ON admin_staging_test_ceremonies(user_id) WHERE operation='enroll';
CREATE UNIQUE INDEX idx_admin_staging_test_revocation ON admin_staging_test_ceremonies(user_id) WHERE operation='revoke';
CREATE TRIGGER trg_admin_staging_test_authority BEFORE INSERT ON admin_staging_test_ceremonies
WHEN NOT EXISTS(SELECT 1 FROM admin_database_identity WHERE id='authority' AND environment='staging')
 OR NOT EXISTS(SELECT 1 FROM admin_config_metadata WHERE key='bootstrap_completed_at')
 OR NEW.expires_at<=strftime('%Y-%m-%dT%H:%M:%fZ','now')
 OR NEW.executed_at>strftime('%Y-%m-%dT%H:%M:%fZ','now','+1 minute')
 OR NOT EXISTS(
   SELECT 1 FROM admin_owner_enrollments o
   JOIN admin_active_super_operators a ON a.operator_id=o.operator_id AND a.user_id=o.user_id AND a.access_iss=o.access_iss
   JOIN approved_human_operators h ON h.operator_id=o.operator_id
   WHERE o.operator_id=NEW.owner_operator_id AND o.public_key=NEW.owner_public_key
     AND h.recovery_public_key=NEW.owner_public_key AND h.recovery_key_algorithm='Ed25519'
     AND NEW.access_iss=o.access_iss AND NEW.access_sub<>o.access_sub
     AND NEW.user_id<>o.user_id AND NEW.operator_id<>o.operator_id
     AND instr(o.email,'+')=0 AND instr(o.email,'@')>1
     AND substr(NEW.email,1,instr(o.email,'@')-1)=substr(lower(o.email),1,instr(o.email,'@')-1)
     AND substr(NEW.email,instr(o.email,'@')) GLOB '+takolio-qa-?*@*'
     AND substr(NEW.email,instr(NEW.email,'@'))=substr(lower(o.email),instr(o.email,'@'))
 )
BEGIN SELECT RAISE(ABORT,'staging QA requires the active enrolled owner and an exact owner-controlled alias'); END;
CREATE TRIGGER trg_admin_staging_test_target BEFORE INSERT ON admin_staging_test_ceremonies
WHEN (NEW.operation='enroll' AND (
 EXISTS(SELECT 1 FROM operator_identity_bindings WHERE user_id=NEW.user_id OR operator_id=NEW.operator_id OR (access_iss=NEW.access_iss AND access_sub=NEW.access_sub) OR lower(email)=NEW.email)
 OR EXISTS(SELECT 1 FROM approved_human_operators WHERE operator_id=NEW.operator_id)
 OR (SELECT COUNT(*) FROM admin_staging_test_ceremonies e
   JOIN operator_identity_bindings b ON b.user_id=e.user_id AND b.status='active' WHERE e.operation='enroll')>=5
 )) OR (NEW.operation='revoke' AND NOT EXISTS(
 SELECT 1 FROM admin_staging_test_ceremonies e
 JOIN operator_identity_bindings b ON b.user_id=e.user_id AND b.operator_id=e.operator_id AND b.status='active'
 WHERE e.operation='enroll' AND e.user_id=NEW.user_id AND e.operator_id=NEW.operator_id
   AND e.access_iss=NEW.access_iss AND e.access_sub=NEW.access_sub AND e.email=NEW.email
 ))
BEGIN SELECT RAISE(ABORT,'staging QA target is not a new identity or active enrolled test identity'); END;
CREATE TRIGGER trg_admin_staging_test_apply AFTER INSERT ON admin_staging_test_ceremonies
BEGIN
 INSERT INTO approved_human_operators(operator_id,approval_ref,approved_at)
 SELECT NEW.operator_id,NEW.approval_ref,NEW.executed_at WHERE NEW.operation='enroll';
 INSERT INTO operator_identity_bindings(user_id,operator_id,access_iss,access_sub,approved_at,approval_ref,email,display_name)
 SELECT NEW.user_id,NEW.operator_id,NEW.access_iss,NEW.access_sub,NEW.executed_at,NEW.approval_ref,NEW.email,NEW.display_name WHERE NEW.operation='enroll';
 UPDATE admin_role_assignments SET status='revoked',revoked_at=NEW.executed_at,revoked_by=NEW.owner_operator_id,revoke_reason='staging_test_cleanup'
 WHERE NEW.operation='revoke' AND user_id=NEW.user_id AND status='active';
 UPDATE operator_identity_bindings SET status='revoked',security_epoch=security_epoch+1
 WHERE NEW.operation='revoke' AND user_id=NEW.user_id;
 UPDATE approved_human_operators SET status='revoked' WHERE NEW.operation='revoke' AND operator_id=NEW.operator_id;
 INSERT INTO admin_audit_events(id,occurred_at,actor_roles,action,target_type,target_id,outcome,metadata_json)
 VALUES('evt_'||NEW.id,NEW.executed_at,'[]','admin.staging_test.'||NEW.operation,'user',NEW.user_id,'success',
   json_object('approvalRef',NEW.approval_ref,'manifestHash',NEW.manifest_hash));
END;
CREATE TRIGGER trg_admin_staging_test_no_update BEFORE UPDATE ON admin_staging_test_ceremonies
BEGIN SELECT RAISE(ABORT,'staging QA ceremonies are immutable'); END;
CREATE TRIGGER trg_admin_staging_test_no_delete BEFORE DELETE ON admin_staging_test_ceremonies
BEGIN SELECT RAISE(ABORT,'staging QA ceremonies are retained history'); END;
-- The Worker schema contract stays at 4: this additive ledger is release-tooling only.

-- QA aliases never substitute for the durable owner in last-owner protection.
DROP VIEW admin_active_super_operators;
CREATE VIEW admin_active_super_operators AS
SELECT r.id AS assignment_id,b.user_id,b.operator_id,b.access_iss
FROM admin_role_assignments r
JOIN operator_identity_bindings b ON b.user_id=r.user_id AND b.status='active'
JOIN approved_human_operators h ON h.operator_id=b.operator_id AND h.status='active'
WHERE r.role='SUPER_ADMIN' AND r.status='active'
 AND NOT EXISTS(SELECT 1 FROM admin_staging_test_ceremonies q WHERE q.user_id=b.user_id AND q.operation='enroll');
