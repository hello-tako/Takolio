"""Check source-bound local receipts; private artifacts are required on this host."""
import hashlib
import json
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parents[3]
packet = root / 'docs/backend-upgrade/b03-preprocessing'
receipt = json.loads((packet / 'validation.json').read_text())
implementation = receipt['implementationCommit']
base = receipt['baseCommit']
subprocess.run(['git', 'merge-base', '--is-ancestor', implementation, 'HEAD'], cwd=root, check=True)


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


for row in receipt['implementationSources']:
    raw = subprocess.check_output(['git', 'show', implementation + ':' + row['path']], cwd=root)
    assert digest(raw) == row['sha256'] and (root / row['path']).read_bytes() == raw, row['path']
for row in receipt['receiptAssets'] + receipt['attachments']:
    assert digest((root / row['path']).read_bytes()) == row['sha256'], row['path']
commands = {row['name']: row for row in receipt['commands']}
private = root / '.artifacts/backend-b03-preprocessing'
for row in receipt['commands']:
    assert digest((private / (row['name'] + '.log')).read_bytes()) == row['logSha256'], row['name']
    assert json.loads((private / (row['name'] + '.json')).read_text()) == row, row['name']
for name in receipt['requiredCleanGates']:
    row = commands[name]
    assert row['before']['head'] == row['after']['head'] == implementation, name
    assert row['before']['status'] == row['after']['status'] == '', name
    assert row['exitCode'] == (1 if name == 'clean-audit' else 0), name
allowed = set(receipt['finalReceiptAllowedBaseChanges'])
protected = 0
for record in subprocess.check_output(['git', 'ls-tree', '-rz', '--full-tree', base], cwd=root).split(b'\0'):
    if not record:
        continue
    meta, name = record.split(b'\t', 1)
    path = name.decode()
    if path in allowed:
        continue
    raw = (root / path).read_bytes()
    actual = hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest()
    assert actual == meta.decode().split()[2], path
    protected += 1
assert protected == receipt['finalProtectedBaseFiles']
for path in ['docs/ai/CURRENT_STATE.md', 'docs/ai/TASK_BOARD.md', 'docs/ai/HANDOFF.md',
             'docs/backend-upgrade/IMPLEMENTATION_PLAN.md']:
    old = subprocess.check_output(['git', 'show', base + ':' + path], cwd=root)
    assert (root / path).read_bytes().endswith(old), path
old_decisions = subprocess.check_output(['git', 'show', base + ':docs/ai/DECISIONS.md'], cwd=root)
assert (root / 'docs/ai/DECISIONS.md').read_bytes().startswith(old_decisions)
runtime = root / '.artifacts/scan-preprocessing-runtime'
browser = json.loads((runtime / 'browser-report.json').read_text())
page = json.loads((runtime / 'scan-page-report.json').read_text())
for report in [browser, page]:
    assert report['status'] == 'PASS' and report['externalRequests'] == 0
    for row in report['sourceHashes']:
        assert digest((root / row['path']).read_bytes()) == row['sha256'], row['path']
assert len(browser['cases']) == 124
assert sum(row['photoParity'] is True for row in browser['cases']) == 60
assert sum(row['pixelExact'] is True for row in browser['cases']) == 2
assert sum(row['nativeDerivativeExact'] is True for row in browser['cases']) == 3
assert all(row['staleCallbacks'] == 0 for row in browser['lifecycle'])
assert len(page['measurements']) == 5 and len(page['races']) == 2
assert all(row['staleSubmissions'] == 0 for row in page['races'])
assert page['providerCalls'] == page['inventoryWrites'] == page['confirmationCalls'] == 0
for directory in [runtime / 'browser-images', root / '.artifacts/scan-synthetic-v3']:
    manifest = json.loads((directory / 'prepared.json').read_text())
    for row in manifest['cases']:
        assert digest((directory / row['file']).read_bytes()) == row['sha256'], row['case']
assert receipt['securityGate'] == 'FAILED_HIGH_ADVISORY_REMAINS'
assert receipt['productOcrCertified'] is False and receipt['independentRealSamples'] == 0
assert receipt['semanticFridgeRecognitionMeasured'] is False
print(json.dumps({'status': 'PASS', 'implementationCommit': implementation,
                  'protectedBaseFiles': protected, 'sources': len(receipt['implementationSources']),
                  'commands': len(receipt['commands']), 'attachments': len(receipt['attachments']),
                  'securityGate': receipt['securityGate'], 'productOcrCertified': False,
                  'workingTree': subprocess.check_output(['git', 'status', '--porcelain'], cwd=root).decode()}))
