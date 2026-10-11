import datetime, hashlib, json, pathlib, subprocess, sys

root = pathlib.Path.cwd()
base = '1963c469e2e3bd4819cda6bb9ef8162101ad523a'
out = root / '.artifacts/backend-program-20261011'
name = sys.argv[1] if len(sys.argv) == 2 else 'scope-freeze'
assert not (out / (name + '.json')).exists(), 'Preserve previous receipts'
allowed_modified = {
    'packages/ai/src/providers/qwen.ts', 'packages/ai/src/router.ts',
    'packages/ai/src/task-runtime.ts', 'packages/ai/src/types.ts',
    'src/worker/index.ts', 'src/worker/middleware/auth.ts', 'src/worker/middleware/tenancy.ts',
    'src/worker/routes/notifications.ts', 'src/worker/routes/recipes.ts', 'src/worker/routes/scans.ts',
    'src/worker/routes/week.ts', 'src/worker/services/scan-queue.ts', 'src/worker/utils/week-shopping.ts',
    'tests/integration/payment-authority.test.ts',  # Auth session fixture only; payment assertions protected.
}
changed = subprocess.check_output(['git', 'diff', '--name-only', '-z', base]).decode().split('\0')[:-1]
untracked = subprocess.check_output(['git', 'ls-files', '--others', '--exclude-standard', '-z']).decode().split('\0')[:-1]
tracked = subprocess.check_output(['git', 'ls-tree', '-rz', '--name-only', base]).decode().split('\0')[:-1]
assert {path for path in changed if path in tracked and not path.startswith('docs/')} <= allowed_modified, changed
assert all(path.startswith(('docs/backend-upgrade/', 'src/worker/', 'packages/', 'tests/', 'scripts/', 'qa/ocr/v3/')) for path in untracked), untracked
source = sorted(set(path for path in changed + untracked if not path.startswith('docs/')))
protected = sorted(path for path in tracked if not path.startswith('docs/') and path not in allowed_modified)
for path in protected:
    assert path not in changed, 'Protected source changed: ' + path

def records(paths):
    return [{'path': path, 'bytes': (root / path).stat().st_size,
             'sha256': hashlib.sha256((root / path).read_bytes()).hexdigest()} for path in paths]

master = pathlib.Path('/Users/tunbee27/Downloads/TAKOSAN_BACKEND_MASTERPLAN_2026-10-11.md')
assert hashlib.sha256(master.read_bytes()).hexdigest() == '13809f0874ae357707fc6a37a16f5e8b3164674eeb194dff0adc3ae7f530b44b'
assert len([path for path in (root / 'migrations').iterdir() if path.suffix == '.sql']) == 40
assert (root / 'tests/unit/planner-contract.test.ts').read_bytes() == subprocess.check_output(['git', 'show', base + ':tests/unit/planner-contract.test.ts'])
payment_path = 'tests/integration/payment-authority.test.ts'
payment_base = subprocess.check_output(['git', 'show', base + ':' + payment_path])
payment_fixture = b"""  await db.batch([
    db.prepare('INSERT INTO households (id,name,created_by) VALUES (?,?,?)')
      .bind(`${userId}-household`, 'Auth fixture household', userId),
    db.prepare('INSERT INTO household_members (id,household_id,user_id,role) VALUES (?,?,?,?)')
      .bind(`${userId}-membership`, `${userId}-household`, userId, 'owner'),
  ]);
"""
payment_current = (root / payment_path).read_bytes()
assert payment_current.count(payment_fixture) == 1
assert payment_current.replace(payment_fixture, b'', 1) == payment_base, 'Payment assertions/runtime scope changed'
candidate = sorted(path for path in changed + untracked if path.startswith('docs/backend-upgrade/')
                   and not path.endswith('.md'))
receipt = {'capturedAtUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'baseSha': base,
           'headSha': subprocess.check_output(['git', 'rev-parse', 'HEAD']).decode().strip(),
           'source': records(source), 'protected': records(protected), 'candidateSource': records(candidate),
           'paymentFixtureOnly': True, 'paymentAssertionsUnchanged': True,
           'migrationCount': 40, 'masterplanUnchanged': True, 'protectedChangedPaths': [],
           'scope': 'Changed application/tests/evaluation source; all other tracked non-document paths protected',
           'productionCertified': False}
subprocess.run(['sh', '-c', 'cat > "$1"', 'write', str(out / (name + '.json'))],
               input=(json.dumps(receipt, indent=2) + '\n').encode(), check=True)
subprocess.run(['git', 'diff', '--check'], check=True)
print('scope-freeze=PASS; source=' + str(len(source)) + '; protected=' + str(len(protected)) + '; migrations40 unchanged; masterplan unchanged')
