-- R2 roster and target enrollment must remain valid at the durable transition.
CREATE VIEW admin_active_super_operators AS
SELECT r.id AS assignment_id, b.user_id, b.operator_id, b.access_iss
FROM admin_role_assignments r
JOIN operator_identity_bindings b ON b.user_id=r.user_id AND b.status='active'
JOIN approved_human_operators h ON h.operator_id=b.operator_id AND h.status='active'
WHERE r.role='SUPER_ADMIN' AND r.status='active';

CREATE TRIGGER trg_admin_roles_three_operators BEFORE UPDATE OF status ON admin_role_assignments
WHEN OLD.role='SUPER_ADMIN' AND OLD.status='active' AND NEW.status<>'active'
 AND (SELECT COUNT(DISTINCT operator_id) FROM admin_active_super_operators
      WHERE assignment_id<>OLD.id
        AND access_iss=(SELECT access_iss FROM operator_identity_bindings WHERE user_id=OLD.user_id))<3
BEGIN SELECT RAISE(ABORT,'at least three active enrolled SUPER_ADMIN operators in the issuer must remain'); END;

-- This covers ordinary grants, bootstrap, approvals and offline recovery. A
-- revoked identity can never acquire a new role between a precheck and commit.
CREATE TRIGGER trg_admin_roles_target_enrolled BEFORE INSERT ON admin_role_assignments
WHEN NEW.status='active' AND NOT EXISTS(
 SELECT 1 FROM operator_identity_bindings b
 JOIN approved_human_operators h ON h.operator_id=b.operator_id AND h.status='active'
 WHERE b.user_id=NEW.user_id AND b.status='active')
BEGIN SELECT RAISE(ABORT,'role target must be an active approved enrolled operator'); END;

CREATE TRIGGER trg_admin_approval_target_enrolled BEFORE UPDATE OF status ON admin_action_approvals
WHEN NEW.status='approved' AND OLD.action='role.grant.super_admin' AND NOT EXISTS(
 SELECT 1 FROM operator_identity_bindings b
 JOIN approved_human_operators h ON h.operator_id=b.operator_id AND h.status='active'
 WHERE b.user_id=OLD.target_user_id AND b.status='active' AND b.access_iss=NEW.decider_access_iss)
BEGIN SELECT RAISE(ABORT,'approval target must be an active approved enrolled operator in the issuer'); END;

UPDATE admin_config_metadata SET value='3' WHERE key='schema_version';
