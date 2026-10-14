#!/usr/bin/env bash
# Admin database (migrations-admin/) replay and invariant smoke test (local sqlite3 only).
set -euo pipefail
command -v sqlite3 >/dev/null 2>&1 || { echo "sqlite3 is required for the admin migration smoke test"; exit 1; }
db="$(mktemp -d)/admin.sqlite"
trap 'rm -rf "$(dirname "$db")"' EXIT
for file in migrations-admin/*.sql; do sqlite3 -bail "$db" < "$file"; done

q() { sqlite3 -bail "$db" "PRAGMA foreign_keys=ON; $1"; }
expect() { local got; got="$(q "$1")"; [ "$got" = "$2" ] || { echo "admin-migration-smoke FAIL: $1 => '$got' (expected '$2')"; exit 1; }; }
expect_abort() { if sqlite3 "$db" "$1" >/dev/null 2>&1; then echo "admin-migration-smoke FAIL: expected abort: $1"; exit 1; fi; }

expect "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name LIKE 'admin_%'" 7
expect "SELECT COUNT(*) FROM sqlite_master WHERE type='trigger' AND name LIKE 'trg_admin_%'" 9
expect "SELECT value FROM admin_config_metadata WHERE key='schema_version'" 1

# Two-person bootstrap inserts both rows from one statement (or none).
boot="INSERT INTO admin_role_assignments (id, user_id, role, grant_source)
 SELECT 'ara_0000000000000001','u1','SUPER_ADMIN','operator_bootstrap' WHERE NOT EXISTS (SELECT 1 FROM admin_role_assignments)
 UNION ALL SELECT 'ara_0000000000000002','u2','SUPER_ADMIN','operator_bootstrap' WHERE NOT EXISTS (SELECT 1 FROM admin_role_assignments);"
q "$boot"
expect "SELECT COUNT(*) FROM admin_role_assignments WHERE grant_source='operator_bootstrap'" 2
q "$boot"
expect "SELECT COUNT(*) FROM admin_role_assignments" 2
q "INSERT INTO admin_config_metadata (key, value) VALUES ('bootstrap_completed_at', 'x');"
expect_abort "INSERT INTO admin_role_assignments (id, user_id, role, grant_source) VALUES ('ara_0000000000000003','u3','SUPER_ADMIN','operator_bootstrap');"
# Nobody grants themselves; non-bootstrap grants need a granting admin.
expect_abort "INSERT INTO admin_role_assignments (id, user_id, role, grant_source, granted_by) VALUES ('ara_0000000000000004','u4','SUPPORT_AGENT','admin_grant','u4');"
expect_abort "INSERT INTO admin_role_assignments (id, user_id, role, grant_source) VALUES ('ara_0000000000000005','u5','SUPPORT_AGENT','admin_grant');"
# Minimum two active SUPER_ADMINs.
expect_abort "UPDATE admin_role_assignments SET status='revoked', revoked_at='x' WHERE id='ara_0000000000000001';"
q "INSERT INTO admin_role_assignments (id, user_id, role, grant_source, granted_by) VALUES ('ara_0000000000000006','u6','SUPER_ADMIN','approval','u1');"
q "UPDATE admin_role_assignments SET status='revoked', revoked_at='x', revoked_by='u1' WHERE id='ara_0000000000000006';"
expect_abort "UPDATE admin_role_assignments SET status='active', revoked_at=NULL, revoked_by=NULL WHERE id='ara_0000000000000006';"
expect_abort "UPDATE admin_role_assignments SET role='SUPPORT_AGENT' WHERE id='ara_0000000000000001';"
expect_abort "DELETE FROM admin_role_assignments WHERE id='ara_0000000000000006';"
# Audit is append-only; approval decisions are final.
q "INSERT INTO admin_audit_events (id, action, outcome) VALUES ('evt_000000000001','admin.login','success');"
expect_abort "UPDATE admin_audit_events SET outcome='denied';"
expect_abort "DELETE FROM admin_audit_events;"
q "INSERT INTO admin_action_approvals (id, action, target_user_id, requested_by, requested_at, expires_at, status, decided_by, decided_at) VALUES ('appr_00000000001','role.grant.super_admin','u7','u1','x','y','approved','u2','z');"
expect_abort "UPDATE admin_action_approvals SET status='rejected' WHERE id='appr_00000000001';"
expect_abort "INSERT INTO admin_action_approvals (id, action, target_user_id, requested_by, requested_at, expires_at, status, decided_by, decided_at) VALUES ('appr_00000000002','role.grant.super_admin','u8','u1','x','y','approved','u1','z');"
expect_abort "INSERT INTO admin_action_approvals (id, action, target_user_id, requested_by, requested_at, expires_at) VALUES ('appr_00000000003','role.revoke.super_admin','u2','u1','x','y');"
expect "SELECT COUNT(*) FROM pragma_integrity_check WHERE integrity_check <> 'ok'" 0
echo "admin-migration-smoke=ok"
