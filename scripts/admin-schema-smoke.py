"""Local-only Admin migration and rollback evidence. No Cloudflare calls."""
import pathlib
import sqlite3

root = pathlib.Path(__file__).resolve().parents[1]
db = sqlite3.connect(':memory:')
db.execute('PRAGMA foreign_keys=ON')
for migration in sorted((root / 'migrations-admin').glob('*.sql')):
    db.executescript(migration.read_text())
assert db.execute("SELECT value FROM admin_config_metadata WHERE key='schema_version'").fetchone()[0] == '5'


def refuses(sql):
    try:
        db.execute(sql)
    except sqlite3.DatabaseError:
        return
    raise AssertionError('Expected database constraint to reject operation')


for n in range(3):
    db.execute("INSERT INTO approved_human_operators(operator_id,approval_ref,approved_at) VALUES(?, 'synthetic-independent-roster','now')", (f'operator_{n}',))
    db.execute("INSERT INTO operator_identity_bindings(user_id,operator_id,access_iss,access_sub,approved_at,approval_ref,email,display_name) VALUES(?,?,'https://fixture.cloudflareaccess.com',?,'now','synthetic-independent-roster',?,'Synthetic')", (f'user_{n}',f'operator_{n}',f'sub_{n}',f'{n}@example.test'))
bootstrap = "INSERT INTO admin_bootstrap_ceremonies(id,operator_user_ids,independent_approval_ref,created_at,audit_id) VALUES('smoke_ceremony','[\"user_0\",\"user_1\",\"user_2\"]','synthetic-review','now','smoke_audit_01')"
db.execute("CREATE TRIGGER inject_failure BEFORE INSERT ON admin_audit_events BEGIN SELECT RAISE(ABORT,'injected audit failure'); END")
refuses(bootstrap)
assert db.execute('SELECT COUNT(*) FROM admin_role_assignments').fetchone()[0] == 0
assert db.execute('SELECT COUNT(*) FROM admin_bootstrap_ceremonies').fetchone()[0] == 0
assert not db.execute("SELECT value FROM admin_config_metadata WHERE key='bootstrap_completed_at'").fetchall()
db.execute('DROP TRIGGER inject_failure')
db.execute(bootstrap)
assert db.execute('SELECT COUNT(*) FROM admin_role_assignments').fetchone()[0] == 3
assert db.execute("SELECT COUNT(*) FROM admin_audit_events WHERE action='admin.bootstrap'").fetchone()[0] == 1
refuses(bootstrap)
refuses("INSERT INTO admin_role_assignments(id,user_id,role,grant_source) VALUES('late_bootstrap','other','SUPER_ADMIN','operator_bootstrap')")
db.execute("UPDATE admin_role_assignments SET status='revoked',revoked_at='now' WHERE id='smoke_ceremony_2'")
db.execute("UPDATE admin_role_assignments SET status='revoked',revoked_at='now' WHERE id='smoke_ceremony_1'")
refuses("UPDATE admin_role_assignments SET status='revoked',revoked_at='now' WHERE id='smoke_ceremony_0'")
refuses("UPDATE operator_identity_bindings SET status='revoked' WHERE user_id='user_0'")
refuses("UPDATE approved_human_operators SET status='revoked' WHERE operator_id='operator_0'")
refuses("UPDATE admin_role_assignments SET user_id='another' WHERE id='smoke_ceremony_2'")
refuses("DELETE FROM admin_role_assignments")
refuses("UPDATE admin_audit_events SET outcome='denied'")
refuses("DELETE FROM admin_audit_events")
refuses("UPDATE operator_identity_bindings SET access_sub='different' WHERE user_id='user_0'")
assert db.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
assert not db.execute('PRAGMA foreign_key_check').fetchall()
print('admin-migration-smoke=ok (schema v5; atomic bootstrap; minimum; immutable identity; append-only audit)')
