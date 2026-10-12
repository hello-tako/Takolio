"""Verify exact source scope, preserved log bytes and clean implementation receipts."""
import gzip
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path.cwd().resolve()
PACKET = ROOT / 'docs/backend-upgrade/b08-log-privacy'
V = json.loads((PACKET / 'validation.json').read_text())
BASE, IMPLEMENTATION = V['baseSha'], V['implementationSha']
STATUS_DOCS = {'docs/ai/CURRENT_STATE.md', 'docs/ai/TASK_BOARD.md', 'docs/ai/HANDOFF.md',
              'docs/ai/DECISIONS.md', 'docs/backend-upgrade/IMPLEMENTATION_PLAN.md'}
STATIC_COUNTS = {'src/worker/routes/shopping.ts': 4, 'src/worker/routes/preferences.ts': 2,
                 'src/worker/routes/inventory-truth.ts': 3, 'src/worker/routes/scans.ts': 5,
                 'src/worker/routes/recipes.ts': 2, 'src/worker/routes/inventory.ts': 10,
                 'src/worker/routes/week.ts': 14, 'packages/ai/src/providers/cloudflare.ts': 1}


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def blob(ref, name):
    return subprocess.check_output(['git', 'show', ref + ':' + name])


def tree(ref):
    records = {}
    for entry in subprocess.check_output(['git', 'ls-tree', '-rz', ref]).split(b'\0'):
        if entry:
            header, name = entry.split(b'\t', 1)
            mode, kind, oid = header.decode().split()
            assert kind == 'blob'
            records[name.decode()] = (mode, oid)
    return records


base_tree, impl_tree = tree(BASE), tree(IMPLEMENTATION)
assert set(base_tree) <= set(impl_tree)
changed = sorted(name for name in impl_tree if base_tree.get(name) != impl_tree[name])
assert changed == V['implementationChangedPaths']
source = {record['path'] for record in V['sourceChanges']}
assert len(source) == 15
assert all(name in source or name in STATUS_DOCS or name.startswith('docs/backend-upgrade/b08-log-privacy/') for name in changed)
assert sum(name not in changed for name in base_tree) == V['protectedBaseFileCount']
for name, (mode, oid) in base_tree.items():
    if name in changed:
        continue
    path = ROOT / name
    raw = os.readlink(path).encode() if mode == '120000' else path.read_bytes()
    assert hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest() == oid, name
    if mode != '120000':
        assert bool(path.stat().st_mode & 0o111) == (mode == '100755'), name
for record in V['sourceChanges']:
    raw = (ROOT / record['path']).read_bytes()
    assert raw == blob(IMPLEMENTATION, record['path'])
    assert digest(raw) == record['sha256'] and len(raw) == record['bytes']
    assert impl_tree[record['path']] == (record['mode'], record['gitBlob'])
    assert bool((ROOT / record['path']).stat().st_mode & 0o111) == (record['mode'] == '100755')
for name, count in STATIC_COUNTS.items():
    before = blob(BASE, name)
    expected, matches = re.subn(rb"(console\.error\('[^'\n]*'), (?:err|error)(\);)", rb'\1\2', before)
    assert matches == count and expected == blob(IMPLEMENTATION, name)
cleanup_before = blob(BASE, 'src/worker/services/cleanup.ts')
cleanup_after = blob(IMPLEMENTATION, 'src/worker/services/cleanup.ts')
helper_start = b'function changesOf('
helper_end = b'function sanitizeError('
assert cleanup_before[cleanup_before.index(helper_start):cleanup_before.index(helper_end)] in cleanup_after
shadow_before = blob(BASE, 'src/worker/services/recipe-catalog-shadow.ts')
shadow_after = blob(IMPLEMENTATION, 'src/worker/services/recipe-catalog-shadow.ts')
shadow_tail = b'/** Throttle decision for the current isolate;'
assert shadow_before[shadow_before.index(shadow_tail):] == shadow_after[shadow_after.index(shadow_tail):]
for path in PACKET.rglob('*.json'):
    json.loads(path.read_text())
raw_logs = {}
for record in V['logs']:
    packed = (ROOT / record['path']).read_bytes()
    raw = gzip.decompress(packed)
    assert len(packed) == record['bytes'] and digest(packed) == record['sha256']
    assert len(raw) == record['rawBytes'] and digest(raw) == record['rawSha256']
    raw_logs[record['rawPath']] = raw
for record in V['commands']:
    assert digest(raw_logs[record['logPath']]) == record['logSha256']
for record in V['attachments']:
    raw = (ROOT / record['path']).read_bytes()
    assert len(raw) == record['bytes'] and digest(raw) == record['sha256']
required = ['full-tests', 'frozen-install', 'lint', 'typecheck', 'migrations', 'build', 'audit-prod']
for suffix in required:
    record = next(x for x in V['commands'] if x['name'] == 'b08-log-final-' + suffix)
    assert record['exitCode'] == 0
    for bound in ['sourceBefore', 'sourceAfter']:
        assert record[bound]['headSha'] == IMPLEMENTATION and record[bound]['status'] == ''
        assert record[bound]['packageSha256'] == digest(blob(IMPLEMENTATION, 'package.json'))
        assert record[bound]['lockSha256'] == digest(blob(IMPLEMENTATION, 'pnpm-lock.yaml'))
full = next(x for x in V['commands'] if x['name'] == 'b08-log-final-full-tests')
text = re.sub(r'\x1b\[[0-9;]*m', '', raw_logs[full['logPath']].decode())
for label, count in [('Test Files', 312), ('Tests', 7523)]:
    result = re.search(label + r'\s+(\d+) passed \((\d+)\)', text)
    assert result and int(result[1]) == int(result[2]) == count
for name in ['b08-log-precommit-typecheck', 'b08-log-final-audit-full', 'b08-log-final-scanner']:
    assert next(x for x in V['commands'] if x['name'] == name)['exitCode'] != 0
assert V['securityCertified'] is False and V['productionCertified'] is False
for name in STATUS_DOCS:
    assert (ROOT / name).read_bytes().endswith(blob(IMPLEMENTATION, name))
subprocess.run(['git', 'diff', '--check'], check=True)
if '--committed' in sys.argv:
    head = subprocess.check_output(['git', 'rev-parse', 'HEAD']).decode().strip()
    assert subprocess.check_output(['git', 'status', '--porcelain']) == b''
    head_tree = tree(head)
    assert set(impl_tree) <= set(head_tree)
    docs_delta = [name for name in head_tree if impl_tree.get(name) != head_tree[name]]
    assert docs_delta and all(name in STATUS_DOCS or name.startswith('docs/backend-upgrade/b08-log-privacy/') for name in docs_delta)
    for name in docs_delta:
        assert (ROOT / name).read_bytes() == blob(head, name)
    print('receiptCommit=' + head + '; tree=CLEAN; docsOnlyDelta=' + str(len(docs_delta)))
print('packet=PASS; source=15; protected=' + str(V['protectedBaseFileCount'])
      + '; logs=' + str(len(V['logs'])) + '; attachments=' + str(len(V['attachments'])))
