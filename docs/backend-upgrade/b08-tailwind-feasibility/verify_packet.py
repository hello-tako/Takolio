"""Verify implementation bindings and the later documentation-only receipt."""
import hashlib
import json
from pathlib import Path
import subprocess

root = Path.cwd()
packet = root / 'docs/backend-upgrade/b08-tailwind-feasibility'
d = json.loads((packet / 'validation.json').read_text())
implementation = d['implementationSha']
base = d['baseSha']
assert subprocess.check_output(['git', 'status', '--porcelain']).strip() == b'', 'Tree must be clean'
allowed_state = {'docs/ai/CURRENT_STATE.md', 'docs/ai/TASK_BOARD.md', 'docs/ai/HANDOFF.md',
                 'docs/ai/DECISIONS.md', 'docs/backend-upgrade/IMPLEMENTATION_PLAN.md'}
for record in d['source']:
    raw = subprocess.check_output(['git', 'show', implementation + ':' + record['path']])
    assert hashlib.sha256(raw).hexdigest() == record['sha256'], record['path']
changed = subprocess.check_output(['git', 'diff', '--name-only', '-z', implementation, 'HEAD']).split(b'\0')
for name in changed:
    if name:
        path = name.decode()
        assert path in allowed_state or path.startswith('docs/backend-upgrade/b08-tailwind-feasibility/'), path
for attachment in d['attachments']:
    raw = (root / attachment['path']).read_bytes()
    assert hashlib.sha256(raw).hexdigest() == attachment['sha256'], attachment['path']
required = ['braces-final-clean-frozen', 'braces-final-clean-lint', 'braces-final-clean-types',
            'braces-final-clean-focused', 'braces-final-clean-full-tests', 'braces-final-clean-migrations',
            'braces-final-clean-build', 'braces-final-clean-audit', 'braces-final-clean-audit-prod',
            'braces-final-clean-scanner']
for name in required:
    c = next(command for command in d['commands'] if command['name'] == name)
    assert c['before']['head'] == implementation == c['after']['head']
    assert c['before']['status'] == c['after']['status'] == ''
    assert c['before']['packageSha256'] == c['after']['packageSha256']
    assert c['before']['lockSha256'] == c['after']['lockSha256']
    assert c['exitCode'] == (1 if name.endswith('-audit') or name.endswith('-scanner') else 0)
    private_log = root / '.artifacts/backend-b08-tailwind-feasibility' / (name + '.log')
    if private_log.exists():
        assert hashlib.sha256(private_log.read_bytes()).hexdigest() == c['logSha256']
assert d['securityGate'] == 'FAILED' and d['advisorySuppressed'] is False
for path in ['src', 'packages', 'public', '.github', 'migrations', 'wrangler.jsonc',
             'tailwind.config.js', 'postcss.config.js', 'vite.config.ts']:
    assert not subprocess.check_output(['git', 'diff', '--name-only', base, 'HEAD', '--', path]).strip(), path
print(json.dumps({'packet': 'PASS', 'implementation': implementation,
                  'receiptCommit': subprocess.check_output(['git', 'rev-parse', 'HEAD']).decode().strip(),
                  'source': len(d['source']), 'attachments': len(d['attachments']),
                  'requiredCommittedGates': len(required), 'securityGate': 'FAILED', 'tree': 'CLEAN'}))
