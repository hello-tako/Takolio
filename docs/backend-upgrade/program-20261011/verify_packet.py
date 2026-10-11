"""Verify recorded local evidence against Git blobs; does not run remote gates."""
import gzip
import hashlib
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path.cwd()
PACKET = ROOT / 'docs/backend-upgrade/program-20261011'


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
for group, ref in [('source', implementation), ('candidateSource', implementation), ('protected', base)]:
    for record in freeze[group]:
        raw = (ROOT / record['path']).read_bytes()
        assert len(raw) == record['bytes'] and sha(raw) == record['sha256'], record['path']
        assert raw == blob(ref, record['path']), record['path']
assert freeze['paymentAssertionsUnchanged'] and freeze['paymentFixtureOnly']
payment_path = 'tests/integration/payment-authority.test.ts'
payment_fixture = b"""  await db.batch([
    db.prepare('INSERT INTO households (id,name,created_by) VALUES (?,?,?)')
      .bind(`${userId}-household`, 'Auth fixture household', userId),
    db.prepare('INSERT INTO household_members (id,household_id,user_id,role) VALUES (?,?,?,?)')
      .bind(`${userId}-membership`, `${userId}-household`, userId, 'owner'),
  ]);
"""
payment = (ROOT / payment_path).read_bytes()
assert payment.count(payment_fixture) == 1
assert payment.replace(payment_fixture, b'', 1) == blob(base, payment_path)
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
for record in validation['rootCommandReceipts']:
    assert sha(raw_logs[record['logPath']]) == record['logSha256']
for record in validation['attachments']:
    raw = (ROOT / record['path']).read_bytes()
    assert len(raw) == record['bytes'] and sha(raw) == record['sha256'], record['path']
required = ['program-full-tests-final-committed', 'program-build-final-committed', 'program-lint-final-committed',
            'program-typecheck-final-committed', 'program-migrations-final-committed']
for name in required:
    record = next(item for item in validation['rootCommandReceipts'] if item['name'] == name)
    assert record['exitCode'] == 0
    assert record['sourceBefore']['headSha'] == record['sourceAfter']['headSha'] == implementation
    assert record['sourceBefore']['status'] == record['sourceAfter']['status'] == ''
failed_full = next(item for item in validation['rootCommandReceipts'] if item['name'] == 'program-full-tests-frozen')
assert failed_full['exitCode'] == 1
interrupted = next(item for item in validation['rootCommandReceipts'] if item['name'] == 'program-full-tests-committed')
assert interrupted['exitCode'] == 130
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
print('packet=PASS; source=' + str(len(freeze['source'])) + '; protected=' + str(len(freeze['protected']))
      + '; logs=' + str(len(validation['rawLogs'])) + '; commands=' + str(len(validation['rootCommandReceipts'])))
