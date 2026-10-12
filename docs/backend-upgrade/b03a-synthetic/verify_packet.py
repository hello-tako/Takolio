"""Verify the recorded implementation, clean gates and local private evidence."""
import hashlib
import json
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parents[3]
packet = root / 'docs/backend-upgrade/b03a-synthetic'
receipt = json.loads((packet / 'validation.json').read_text())
implementation = receipt['implementationCommit']
base = receipt['baseCommit']
assert subprocess.check_output(['git', 'rev-parse', implementation], cwd=root).decode().strip() == implementation
assert subprocess.check_output(['git', 'merge-base', '--is-ancestor', implementation, 'HEAD'], cwd=root) == b''


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def original(path):
    return subprocess.check_output(['git', 'show', implementation + ':' + path], cwd=root)


for row in receipt['implementationSources']:
    raw = original(row['path'])
    assert digest(raw) == row['sha256'], row['path']
    assert (root / row['path']).read_bytes() == raw, row['path']
for row in receipt['receiptAssets']:
    assert digest((root / row['path']).read_bytes()) == row['sha256'], row['path']
commands = {row['name']: row for row in receipt['commands']}
private = root / '.artifacts/backend-b03a-synthetic'
for name in receipt['requiredCleanGates']:
    row = commands[name]
    assert row['before']['head'] == row['after']['head'] == implementation, name
    assert row['before']['status'] == row['after']['status'] == '', name
    assert row['exitCode'] == (1 if name == 'clean-audit' else 0), name
for row in receipt['commands']:
    assert digest((private / (row['name'] + '.log')).read_bytes()) == row['logSha256'], row['name']
    assert json.loads((private / (row['name'] + '.json')).read_text()) == row, row['name']
for row in receipt['attachments']:
    assert digest((root / row['path']).read_bytes()) == row['sha256'], row['path']
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
font = packet.parents[2] / 'qa/ocr/synthetic-v3/fonts'
provenance = json.loads((font / 'provenance.json').read_text())
assert digest((font / 'OFL.txt').read_bytes()) == provenance['licenseSha256']
assert digest((font / 'noto-sans-jp-test-subset.ttf').read_bytes()) == provenance['subsetSha256']
assert digest(original('qa/ocr/synthetic-v3/fonts/OFL.txt')) == provenance['licenseSourceSha256']
assert (font / 'OFL.txt').read_text() == '\n'.join(line.rstrip() for line in original('qa/ocr/synthetic-v3/fonts/OFL.txt').decode().splitlines()) + '\n'
assert receipt['securityGate'] == 'FAILED_HIGH_ADVISORY_REMAINS'
assert receipt['productOcrCertified'] is False
assert receipt['semanticFridgeRecognitionMeasured'] is False
assert receipt['independentRealSamples'] == 0
print(json.dumps({'status': 'PASS', 'implementationCommit': implementation,
                  'protectedBaseFiles': protected, 'sources': len(receipt['implementationSources']),
                  'commands': len(receipt['commands']), 'attachments': len(receipt['attachments']),
                  'securityGate': receipt['securityGate'], 'productOcrCertified': False,
                  'workingTree': subprocess.check_output(['git', 'status', '--porcelain'], cwd=root).decode()}))
