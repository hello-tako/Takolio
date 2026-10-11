import hashlib
import json
import os
import pathlib
import shutil
import subprocess
import tempfile

root = pathlib.Path.cwd().resolve()
artifact = root / '.artifacts/backend-program-20261011/local-d1'
assert not artifact.exists(), 'Preserve prior evidence; use a fresh checkout for another run'
assert not (pathlib.Path.home() / '.wrangler').is_dir(), 'Legacy Wrangler config overrides XDG isolation'
node = shutil.which('node')
assert node is not None, 'Node is required'
wrangler = root / 'node_modules/wrangler/bin/wrangler.js'
assert wrangler.is_file()
migrations = sorted(path for path in (root / 'migrations').iterdir() if path.suffix == '.sql')
assert len(migrations) == 40, 'This receipt requires the exact 40-migration checkpoint'
local = pathlib.Path(tempfile.mkdtemp(prefix='takosan-program-local-d1-', dir='/private/tmp')).resolve()
artifact.mkdir(parents=True)


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def write(path, raw):
    path.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(['sh', '-c', 'cat > "$1"', 'write', str(path)], input=raw, check=True)


def migration_inputs():
    return [{'name': path.name, 'sha256': digest(path.read_bytes())} for path in migrations]


inputs = migration_inputs()
database = 'takosan-program-local'
config = {'name': database, 'compatibility_date': '2024-11-01', 'd1_databases': [{
    'binding': 'DB', 'database_name': database,
    'database_id': '00000000-0000-4000-8000-000000000040',
    'migrations_dir': str(root / 'migrations')}]}
config_path = local / 'wrangler.local.jsonc'
write(config_path, (json.dumps(config, indent=2) + '\n').encode())
# An allowlist excludes inherited credentials; HOME stays unchanged. Wrangler runs
# outside the project so its dotenv loader cannot read the project's environment.
allowed_keys = ('PATH', 'HOME', 'TMPDIR', 'LANG', 'LC_ALL', 'LC_CTYPE', 'TZ', 'SYSTEMROOT', 'WINDIR')
env = {key: os.environ[key] for key in allowed_keys if key in os.environ}
env.update({'CI': 'true', 'WRANGLER_SEND_METRICS': 'false',
            'XDG_CONFIG_HOME': str(local / 'config'), 'XDG_CACHE_HOME': str(local / 'cache'),
            'XDG_DATA_HOME': str(local / 'data'), 'XDG_STATE_HOME': str(local / 'xdg-state'),
            'WRANGLER_LOG_PATH': str(local / 'logs')})
base = [node, str(wrangler), 'd1']
flags = ['--local', '--persist-to', str(local / 'state'), '--config', str(config_path)]
commands = []


def run(name, args, cwd=local):
    result = subprocess.run(args, cwd=cwd, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    raw_path = artifact / (name + '.raw')
    write(raw_path, result.stdout)
    command = {'name': name, 'command': args, 'cwd': str(cwd), 'exitCode': result.returncode,
               'rawPath': str(raw_path.relative_to(root)), 'rawSha256': digest(result.stdout)}
    commands.append(command)
    print(json.dumps(command), flush=True)
    print(result.stdout.decode(errors='replace')[-3000:], flush=True)
    assert result.returncode == 0, name
    return result.stdout


run('d1-apply', base + ['migrations', 'apply', database] + flags)
repeat = run('d1-reapply', base + ['migrations', 'apply', database] + flags)
assert b'No migrations to apply' in repeat, 'Unexpected reapplication result'
pending = run('d1-pending', base + ['migrations', 'list', database] + flags)
assert b'No migrations to apply' in pending, 'Unexpected pending migration'
gate = run('schema-gate-render', [node, 'scripts/d1-schema-gate.mjs', 'render'], cwd=root)
write(local / 'schema-gate.sql', gate)
gate_results = json.loads(run('d1-gate', base + ['execute', database] + flags + [
    '--yes', '--file', str(local / 'schema-gate.sql'), '--json']))
assert gate_results and all(item['success'] and item['results'] == [] for item in gate_results), gate_results
sql = ('SELECT name FROM d1_migrations ORDER BY name; PRAGMA foreign_key_check; PRAGMA quick_check; '
       "SELECT name FROM sqlite_master WHERE type = 'table' AND substr(name, 1, 9) = 'auth_otp_' ORDER BY name;")
state = json.loads(run('d1-integrity', base + ['execute', database] + flags + [
    '--yes', '--command', sql, '--json']))
assert len(state) == 4 and all(item['success'] for item in state)
ledger = [item['name'] for item in state[0]['results']]
assert ledger == [item['name'] for item in inputs], 'Migration ledger differs from the exact source set'
assert state[1]['results'] == [], state[1]['results']
assert state[2]['results'] == [{'quick_check': 'ok'}], state[2]['results']
assert [item['name'] for item in state[3]['results']] == [
    'auth_otp_assertions', 'auth_otp_claims', 'auth_otp_issuances',
    'auth_otp_requests', 'auth_otp_scopes', 'auth_otp_tickets']
assert migration_inputs() == inputs, 'Migration inputs changed during the replay'
assert not (pathlib.Path.home() / '.wrangler').is_dir(), 'Legacy config appeared during replay'
assert not any(path.name == 'default.toml' for path in (local / 'config').rglob('default.toml'))
receipt = {'status': 'LOCAL_VERIFIED', 'localDirectory': str(local), 'config': config,
           'commands': commands, 'migrationInputs': inputs, 'ledger': ledger, 'migrationCount': len(ledger),
           'reappliedMigrations': 0, 'pendingMigrations': 0, 'schemaGateIssues': [],
           'foreignKeyIssues': [], 'quickCheck': 'ok', 'otpTables': state[3]['results'],
           'credentials': {'inheritedCredentialEnvironment': False, 'environmentAllowlist': list(allowed_keys),
                           'projectDotenvLoaded': False, 'legacyConfigPresent': False,
                           'globalConfigDirectoryIsolated': True, 'homeUnchanged': True,
                           'authConfigCreated': False},
           'remote': False, 'productionCertified': False,
           'scriptSha256': digest(pathlib.Path(__file__).read_bytes())}
write(artifact / 'local-d1.json', (json.dumps(receipt, indent=2) + '\n').encode())
print('isolated-local-d1=PASS; exactMigrations40; reapplied0; pending0; gate[]; FK[]; quick_check=ok; credentials=none; remote=false', flush=True)
