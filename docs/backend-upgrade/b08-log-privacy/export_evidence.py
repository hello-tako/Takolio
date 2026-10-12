"""Export only exact inputs admitted by the bounded privacy review."""
import gzip
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path.cwd().resolve()
PACKET = ROOT / 'docs/backend-upgrade/b08-log-privacy'
ARTIFACT = ROOT / '.artifacts/backend-b08-log-privacy'
IMPLEMENTATION = '41da180a941b348c6385895628b2bdd61b666763'
BASE = 'efffb4f84b52eb42979c69547b6bd7263963099a'


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def write(path, raw):
    path.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(['sh', '-c', 'cat > "$1"', 'write', str(path)], input=raw, check=True)


def tree(ref):
    records = {}
    for entry in subprocess.check_output(['git', 'ls-tree', '-rz', ref]).split(b'\0'):
        if not entry:
            continue
        header, name = entry.split(b'\t', 1)
        mode, kind, oid = header.decode().split()
        assert kind == 'blob'
        records[name.decode()] = (mode, oid)
    return records


review_path = ARTIFACT / 'privacy-export-final.json'
review = json.loads(review_path.read_text())
assert review['status'] == 'PASS' and review['reviewedHead'] == IMPLEMENTATION
admitted = {item['path']: item for item in review['files']}
for name, record in admitted.items():
    raw = (ROOT / name).read_bytes()
    assert digest(raw) == record['sha256'] and len(raw) == record['bytes'], name
commands = []
logs = []
for name in review['commandNames']:
    record = json.loads((ARTIFACT / (name + '.json')).read_text())
    source = ROOT / record['logPath']
    raw = source.read_bytes()
    assert str(source.relative_to(ROOT)) in admitted
    assert digest(raw) == record['logSha256']
    target = PACKET / 'logs' / (source.name + '.gz')
    packed = gzip.compress(raw, mtime=0)
    write(target, packed)
    logs.append({'path': str(target.relative_to(ROOT)), 'bytes': len(packed), 'sha256': digest(packed),
                 'rawPath': record['logPath'], 'rawBytes': len(raw), 'rawSha256': digest(raw)})
    commands.append(record)
attachments = []
for name in ['independent-producer-inventory.json', 'scanner-implementation-receipt.json',
             'scanner-implementation-reconciliation.json', 'reconciliation-attempt-1.json',
             'parent-committed-packet-verification.json', 'parent-documentation-scan-reconciliation.json',
             'source-review-binding.json', 'css-protected-surface.json', 'privacy-export-final.json']:
    source = ARTIFACT / name
    raw = source.read_bytes()
    if name != review_path.name:
        assert str(source.relative_to(ROOT)) in admitted
    target = PACKET / 'attachments' / name
    write(target, raw)
    attachments.append({'path': str(target.relative_to(ROOT)), 'bytes': len(raw), 'sha256': digest(raw)})
base_tree, implementation_tree = tree(BASE), tree(IMPLEMENTATION)
assert set(base_tree) <= set(implementation_tree)
changed = sorted(name for name in implementation_tree if base_tree.get(name) != implementation_tree[name])
source = [name for name in changed if not name.startswith('docs/')]
assert len(source) == 15
records = []
for name in source:
    raw = subprocess.check_output(['git', 'show', IMPLEMENTATION + ':' + name])
    records.append({'path': name, 'mode': implementation_tree[name][0], 'gitBlob': implementation_tree[name][1],
                    'bytes': len(raw), 'sha256': digest(raw), 'baseGitBlob': base_tree.get(name, (None, None))[1]})
validation = {
    'schemaVersion': 1, 'baseSha': BASE, 'implementationSha': IMPLEMENTATION,
    'implementationTree': subprocess.check_output(['git', 'rev-parse', IMPLEMENTATION + '^{tree}']).decode().strip(),
    'branch': 'codex/backend-b08-log-privacy', 'status': 'LOCAL_IMPLEMENTATION_VERIFIED_WITH_BLOCKING_RELEASE_GATES',
    'fullTests': {'files': 312, 'tests': 7523, 'status': 'PASS'}, 'focusedTests': {'files': 9, 'tests': 132, 'status': 'PASS'},
    'sourceChanges': records, 'implementationChangedPaths': changed,
    'protectedBaseFileCount': sum(1 for name in base_tree if name not in changed),
    'commands': commands, 'logs': logs, 'attachments': attachments,
    'audit': {'full': {'info': 0, 'low': 0, 'moderate': 0, 'high': 1, 'critical': 0},
              'production': {'info': 0, 'low': 0, 'moderate': 0, 'high': 0, 'critical': 0}},
    'securityCertified': False, 'productionCertified': False,
    'databaseState': '40 immutable migrations; local smoke PASS; no remote apply or schema change',
    'historicalReceipts': [BASE, '2c42984b2839d1b03c3b0ccfb89998d3535a48d8'],
    'limits': ['Audit/scanner gate failures remain retained.', 'Independent source review binds the reviewed source bytes; the final export byte review is executed by root.',
               '15 receipt-runner command logs preserved; first reconciliation assertion has a separate bounded actual-failure receipt.',
               'Final documentation SHA scan and postcommit packet check are retained separately in ignored artifacts to avoid recursive receipt mutation.'],
}
write(PACKET / 'validation.json', (json.dumps(validation, indent=2, sort_keys=True) + '\n').encode())
print('export=PASS; source=' + str(len(source)) + '; protected=' + str(validation['protectedBaseFileCount'])
      + '; commands=' + str(len(commands)) + '; attachments=' + str(len(attachments)))
