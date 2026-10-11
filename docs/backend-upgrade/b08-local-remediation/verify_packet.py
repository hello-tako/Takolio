"""Validate the B08 local evidence and its protected Git delta without remote calls."""
import gzip
import hashlib
import json
import re
from pathlib import Path
import subprocess
import sys

ROOT = Path.cwd().resolve()
PACKET = ROOT / 'docs/backend-upgrade/b08-local-remediation'


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def read(path):
    return json.loads(path.read_text())


def blob(ref, path):
    return subprocess.check_output(['git', 'show', ref + ':' + path])


validation = read(PACKET / 'validation.json')
freeze = read(PACKET / 'source-freeze-final.json')
implementation = validation['implementationSha']
base = validation['baseSha']
for path in PACKET.rglob('*.json'):
    read(path)
for group, ref in [('changedSource', implementation), ('candidateSource', implementation), ('protected', base)]:
    for record in freeze[group]:
        raw = (ROOT / record['path']).read_bytes()
        assert len(raw) == record['bytes'] and sha(raw) == record['sha256'], record['path']
        assert raw == blob(ref, record['path']), record['path']
        mode = subprocess.check_output(['git', 'ls-tree', ref, '--', record['path']]).decode().split()[0]
        assert mode == record['mode'], record['path']
        assert bool((ROOT / record['path']).stat().st_mode & 0o111) == (mode == '100755'), record['path']
assert freeze['migrationCount'] == 40
assert freeze['publicAssetDeltaCount'] == freeze['paymentRuntimeDeltaCount'] == 0
assert freeze['workerRuntimeDeltaCount'] == freeze['productionConfigDeltaCount'] == 0
assert blob(implementation, 'src/web/App.tsx').replace(
    b'<BrowserRouter useTransitions={false}>', b'<BrowserRouter>', 1
) == blob(base, 'src/web/App.tsx')
raw_logs = {}
for record in validation['rawLogs']:
    packed = (ROOT / record['gzipPath']).read_bytes()
    raw = gzip.decompress(packed)
    assert len(packed) == record['gzipBytes'] and sha(packed) == record['gzipSha256']
    assert len(raw) == record['rawBytes'] and sha(raw) == record['rawSha256']
    raw_logs[record['rawPath']] = raw
    original = ROOT / record['rawPath']
    if original.exists():
        assert original.read_bytes() == raw
for record in validation['commands']:
    assert sha(raw_logs[record['logPath']]) == record['logSha256']
for record in validation['attachments']:
    raw = (ROOT / record['path']).read_bytes()
    assert len(raw) == record['bytes'] and sha(raw) == record['sha256'], record['path']
required = ['b08-final-full-tests', 'b08-final-build', 'b08-final-lint', 'b08-final-typecheck',
            'b08-final-migrations', 'b08-final-frozen-install', 'b08-final-audit-prod',
            'b08-final-scanner-selftest']
for name in required:
    record = next(item for item in validation['commands'] if item['name'] == name)
    assert record['exitCode'] == 0, name
    assert record['sourceBefore']['headSha'] == record['sourceAfter']['headSha'] == implementation, name
    assert record['sourceBefore']['status'] == record['sourceAfter']['status'] == '', name
    for key in ['packageSha256', 'lockSha256']:
        assert record['sourceBefore'][key] == record['sourceAfter'][key], name
        frozen_path = 'package.json' if key == 'packageSha256' else 'pnpm-lock.yaml'
        assert record['sourceBefore'][key] == sha(blob(implementation, frozen_path)), name
failed_full = next(item for item in validation['commands'] if item['name'] == 'b08-first-full-tests')
assert failed_full['exitCode'] == 1
assert validation['fullTests'] == {'files': 309, 'tests': 7463, 'status': 'PASS'}
final_full = next(item for item in validation['commands'] if item['name'] == 'b08-final-full-tests')
full_log = re.sub(r'\x1b\[[0-9;]*m', '', raw_logs[final_full['logPath']].decode())
for label, count in [('Test Files', 309), ('Tests', 7463)]:
    result = re.search(label + r'\s+(\d+) passed \((\d+)\)', full_log)
    assert result and int(result[1]) == int(result[2]) == count
audit = next(item for item in validation['commands'] if item['name'] == 'b08-final-audit-full')
assert audit['exitCode'] == 1
assert validation['audit']['full']['high'] == 1 and validation['audit']['full']['critical'] == 0
assert sum(validation['audit']['production'].values()) == 0
assert validation['productionCertified'] is False and validation['securityCertified'] is False
for record in validation['historicalSuffixes']:
    assert (ROOT / record['path']).read_bytes().endswith(blob(implementation, record['path']))
master = Path(validation['masterplanPath'])
if master.exists():
    assert sha(master.read_bytes()) == validation['masterplanSha256']
subprocess.run(['git', 'diff', '--check'], check=True)
if '--committed' in sys.argv:
    head = subprocess.check_output(['git', 'rev-parse', 'HEAD']).decode().strip()
    assert subprocess.check_output(['git', 'status', '--porcelain']) == b''
    changed = subprocess.check_output(['git', 'diff', '--name-only', implementation, head]).decode().splitlines()
    assert changed and all(path.startswith('docs/') for path in changed)
    for path in changed:
        assert (ROOT / path).read_bytes() == blob(head, path)
    print('receiptCommit=' + head + '; tree=CLEAN; docsOnlyDelta=' + str(len(changed)))
print('packet=PASS; changed=' + str(len(freeze['changedSource'])) + '; protected=' + str(len(freeze['protected']))
      + '; logs=' + str(len(validation['rawLogs'])) + '; commands=' + str(len(validation['commands'])))
