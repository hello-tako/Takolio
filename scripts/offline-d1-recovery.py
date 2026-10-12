#!/usr/bin/env python3
"""Synthetic SQLite backup/restore and query measurements; never connects remotely."""
import argparse
import hashlib
import json
import sqlite3
import time
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
db = sqlite3.connect(':memory:')
db.execute('PRAGMA foreign_keys=ON')
files = sorted(path for path in Path('migrations').iterdir() if path.suffix == '.sql')
for path in files:
    db.executescript(path.read_text())
db.execute("INSERT INTO users(id,email) VALUES ('offline-owner','offline@example.test')")
db.execute("INSERT INTO households(id,name,created_by) VALUES ('offline-home','Synthetic recovery','offline-owner')")
db.execute("INSERT INTO household_members(id,household_id,user_id,role) VALUES ('offline-member','offline-home','offline-owner','owner')")
for i in range(1000):
    db.execute("INSERT INTO inventory_items(id,household_id,ingredient_id,name,quantity,unit,storage,version) VALUES (?,?,?,?,?,'g','fridge',1)",
               (f'offline-lot-{i}', 'offline-home', 'GARLIC', 'Synthetic garlic', 100))
db.commit()

def digest(connection):
    rows = connection.execute('SELECT id,quantity,version FROM inventory_items ORDER BY id').fetchall()
    return hashlib.sha256(json.dumps(rows, separators=(',', ':')).encode()).hexdigest()

original = digest(db)
clone = sqlite3.connect(':memory:')
db.backup(clone)
assert digest(clone) == original
# A fault after mutation must roll back the whole command, not leave half stock.
try:
    db.execute("UPDATE inventory_items SET quantity=0, version=version+1 WHERE household_id='offline-home'")
    raise RuntimeError('synthetic interruption')
except RuntimeError:
    db.rollback()
assert digest(db) == original
# Deliberately damage only the synthetic database and restore the local snapshot.
db.execute("UPDATE inventory_items SET quantity=1 WHERE household_id='offline-home'")
db.commit()
assert digest(db) != original
clone.backup(db)
assert digest(db) == original
assert db.execute('PRAGMA foreign_key_check').fetchall() == []
assert db.execute('PRAGMA quick_check').fetchall() == [('ok',)]

query = 'SELECT id,ingredient_id,quantity,unit,version FROM inventory_items WHERE household_id=? ORDER BY id'
plan = db.execute('EXPLAIN QUERY PLAN ' + query, ('offline-home',)).fetchall()
samples = []
for _ in range(100):
    start = time.perf_counter_ns()
    rows = db.execute(query, ('offline-home',)).fetchall()
    samples.append((time.perf_counter_ns() - start) / 1_000_000)
    assert len(rows) == 1000
samples.sort()
receipt = {'schemaVersion': 1, 'classification': 'SYNTHETIC_SQLITE_OFFLINE',
           'status': 'PASS', 'externalAcceptance': 'PENDING_EXTERNAL_EVIDENCE',
           'remoteCalls': 0, 'migrations': len(files), 'tip': files[-1].name,
           'migrationHashes': [{'path': str(path), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()} for path in files],
           'checks': ['backup clone identity', 'interrupted command rollback', 'restore stock identity', 'foreign keys', 'quick_check'],
           'stockRows': 1000, 'stockFingerprint': original,
           'queryMeasurement': {'iterations': len(samples), 'rowsPerQuery': 1000, 'plan': plan,
                                'p50Ms': samples[49], 'p95Ms': samples[94], 'maxMs': samples[-1],
                                'optimizationApplied': False},
           'limits': 'SQLite local timing/backup, not Cloudflare Time Travel, hosted load, edge isolates or production SLO.'}
args.output.parent.mkdir(parents=True, exist_ok=True)
with args.output.open('w') as stream:
    json.dump(receipt, stream, indent=2)
    stream.write('\n')
args.output.chmod(0o600)
print(json.dumps({key: value for key, value in receipt.items() if key != 'migrationHashes'}))
clone.close()
db.close()
