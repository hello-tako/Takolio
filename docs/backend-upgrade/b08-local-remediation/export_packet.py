"""Export explicitly selected bounded receipts and safe command logs after freeze."""
import datetime
import gzip
import hashlib
import json
import re
from pathlib import Path
import subprocess
import sys

ROOT = Path.cwd().resolve()
PACKET = ROOT / 'docs/backend-upgrade/b08-local-remediation'
ARTIFACT = ROOT / '.artifacts/backend-b08-local-remediation'
BASE = '2c42984b2839d1b03c3b0ccfb89998d3535a48d8'
IMPLEMENTATION = sys.argv[1]
assert subprocess.check_output(['git', 'rev-parse', 'HEAD']).decode().strip() == IMPLEMENTATION
assert len(IMPLEMENTATION) == 40
assert not (PACKET / 'validation.json').exists(), 'Preserve immutable receipts'


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def write(path, raw):
    path.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(['sh', '-c', 'cat > "$1"', 'write', str(path)], input=raw, check=True)


def write_json(path, value):
    write(path, (json.dumps(value, indent=2) + '\n').encode())


def record(path):
    raw = path.read_bytes()
    return {'path': str(path.relative_to(ROOT)), 'bytes': len(raw), 'sha256': sha(raw)}


# Raw engine findings, snapshots, private pointers and tool caches never enter this list.
selected = {
    'local-cli/receipt.json': 'local-cli.json',
    'fixed-date-types.json': 'fixed-date-types.json',
    'local-d1/local-d1.json': 'local-d1.json',
    'compatibility-native-final/receipt.json': 'compatibility-native.json',
    'compatibility-brand-final/receipt.json': 'compatibility-brand.json',
    'compatibility-brand-final/generated-checksums.json': 'generated-brand-checksums.json',
    'compatibility-d1-final/receipt.json': 'compatibility-d1.json',
    'compatibility-browser-recovery-three/receipt.json': 'compatibility-browser.json',
    'compatibility-pwa-final/receipt.json': 'compatibility-pwa-final.json',
    'scanner-final-selftest/receipt.json': 'scanner-selftest.json',
    'scanner-final-repository/receipt.json': 'scanner-repository.json',
    'independent-transaction-final-review.json': 'independent-review.json',
}
attachments = []
for name, dest in selected.items():
    raw = (ARTIFACT / name).read_bytes()
    json.loads(raw)
    target = PACKET / 'attachments' / dest
    write(target, raw)
    attachments.append(record(target))
commands, logs = [], []
for path in sorted(ARTIFACT.glob('b08-*.json')):
    item = json.loads(path.read_text())
    if not isinstance(item, dict) or not {'name', 'command', 'logPath', 'logSha256'} <= item.keys():
        continue
    raw = (ROOT / item['logPath']).read_bytes()
    assert sha(raw) == item['logSha256'], path
    dest = PACKET / 'logs' / (item['name'] + '.log.gz')
    packed = gzip.compress(raw, mtime=0)
    write(dest, packed)
    logs.append({'rawPath': item['logPath'], 'rawBytes': len(raw), 'rawSha256': sha(raw),
                 'gzipPath': str(dest.relative_to(ROOT)), 'gzipBytes': len(packed), 'gzipSha256': sha(packed)})
    commands.append(item)

changed_names = subprocess.check_output(['git', 'diff', '--name-only', BASE, IMPLEMENTATION]).decode().splitlines()
changed = []
candidates = []
appendable = {'docs/ai/CURRENT_STATE.md', 'docs/ai/HANDOFF.md', 'docs/ai/TASK_BOARD.md',
              'docs/ai/DECISIONS.md', 'docs/backend-upgrade/IMPLEMENTATION_PLAN.md'}
for name in changed_names:
    if name.startswith('docs/'):
        if name.startswith('docs/backend-upgrade/b08-local-remediation/') and Path(name).suffix in {'.json', '.py', '.mjs', '.html'}:
            entry = record(ROOT / name)
            entry['mode'] = subprocess.check_output(['git', 'ls-tree', IMPLEMENTATION, '--', name]).decode().split()[0]
            candidates.append(entry)
        continue
    path = ROOT / name
    entry = record(path)
    entry['mode'] = subprocess.check_output(['git', 'ls-tree', IMPLEMENTATION, '--', name]).decode().split()[0]
    changed.append(entry)
protected = []
for line in subprocess.check_output(['git', 'ls-tree', '-r', BASE]).decode().splitlines():
    metadata, name = line.split('\t', 1)
    if name in changed_names or name in appendable:
        continue
    raw = subprocess.check_output(['git', 'show', BASE + ':' + name])
    assert raw == (ROOT / name).read_bytes(), name
    protected.append({'path': name, 'mode': metadata.split()[0], 'bytes': len(raw), 'sha256': sha(raw)})
freeze = {
    'baseSha': BASE, 'implementationSha': IMPLEMENTATION,
    'changedSource': changed, 'candidateSource': candidates, 'protected': protected,
    'migrationCount': sum(item['path'].startswith('migrations/') and item['path'].endswith('.sql') for item in protected),
    'paymentRuntimeDeltaCount': sum(name.startswith(('src/worker/routes/billing', 'src/worker/services/payment')) for name in changed_names),
    'workerRuntimeDeltaCount': sum(name.startswith('src/worker/') for name in changed_names),
    'publicAssetDeltaCount': sum(name.startswith('public/') for name in changed_names),
    'productionConfigDeltaCount': sum(name.startswith('wrangler.') for name in changed_names),
    'limits': ['Protected set includes every unchanged base source/history file except the five appendable current-status documents.',
               'Existing workflow security deltas and PNG test semantics are independently reviewed; they are not classified byte-protected.'],
}
write_json(PACKET / 'source-freeze-final.json', freeze)
full_raw = json.loads((ARTIFACT / 'b08-final-audit-full.log').read_text())
prod_raw = json.loads((ARTIFACT / 'b08-final-audit-prod.log').read_text())
test_log = (ARTIFACT / 'b08-final-full-tests.log').read_text()
test_log = re.sub(r'\x1b\[[0-9;]*m', '', test_log)
files = re.search(r'Test Files\s+(\d+) passed \((\d+)\)', test_log)
tests = re.search(r'Tests\s+(\d+) passed \((\d+)\)', test_log)
assert files and tests and files[1] == files[2] and tests[1] == tests[2]
full_tests = {'files': int(files[1]), 'tests': int(tests[1]), 'status': 'PASS'}
assert full_tests == {'files': 309, 'tests': 7463, 'status': 'PASS'}
validation = {
    'classification': 'LOCAL_BACKEND_AND_B08_REMEDIATION_VERIFIED_WITH_RELEASE_GATES',
    'capturedAtUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'implementationSha': IMPLEMENTATION, 'baseSha': BASE, 'branch': 'codex/backend-b08-local-remediation',
    'worktree': str(ROOT),
    'masterplanPath': '/Users/tunbee27/Downloads/TAKOSAN_BACKEND_MASTERPLAN_2026-10-11.md',
    'masterplanSha256': '13809f0874ae357707fc6a37a16f5e8b3164674eeb194dff0adc3ae7f530b44b',
    'fullTests': full_tests,
    'audit': {'full': full_raw['metadata']['vulnerabilities'], 'production': prod_raw['metadata']['vulnerabilities']},
    'commands': commands, 'rawLogs': logs, 'attachments': attachments,
    'historicalSuffixes': [{'path': path} for path in ['docs/ai/CURRENT_STATE.md', 'docs/ai/HANDOFF.md',
                           'docs/ai/TASK_BOARD.md', 'docs/ai/DECISIONS.md', 'docs/backend-upgrade/IMPLEMENTATION_PLAN.md']],
    'securityCertified': False, 'productionCertified': False,
    'limits': ['One high braces advisory has no published compatible patched release.',
               'Raw security reports/source snapshots and pointers are private; historical parent discovery logs retain old snapshot pathname references.',
               'Local probe receipts do not certify edge/runtime/SLO/inbox/provider/data or protected billing acceptance.',
               'Hosted scanner Linux amd64, workflow execution, deployment, release and rollback proof remain separate.'],
}
write_json(PACKET / 'validation.json', validation)
lines = ['# Executed local validation', '',
         'This immutable packet binds the implementation SHA recorded in validation.json.',
         'Commands run with Node24, NODE_OPTIONS=--no-experimental-webstorage, CI=true,',
         'Wrangler metrics disabled and remote-check flags unset. Original failures remain.', '',
         '| Receipt | Command | Exit | Status | Seconds |', '| --- | --- | --- | --- | --- |']
for item in commands:
    lines.append('| ' + item['name'] + ' | `' + ' '.join(item['command']).replace('|', '\\|') + '` | '
                 + str(item['exitCode']) + ' | ' + item['status'] + ' | ' + str(item['durationSeconds']) + ' |')
lines += ['', 'Gzip preserves bytes; it is not redaction. Only the reviewed command logs are exported.',
          'Raw engine reports/snapshots/tool caches/private pointers stay outside this packet.',
          'Original first full test failure:305 passed/4 failed files,7455 passed/8 failed tests.',
          'Compatibility fixes preserve auth assertions, vendor parser boundaries and protected public assets.',
          'The PNG reproducibility test intentionally compares exact pixels/metadata after the native encoder update.',
          'Parent evidence remains historical at2c42984b; run its verifier there, not against B08 source.', '']
write(PACKET / 'LOCAL_VALIDATION.md', '\n'.join(lines).encode())
print('exported commands=' + str(len(commands)) + '; logs=' + str(len(logs)) + '; attachments=' + str(len(attachments)))
