"""Check Wrangler contracts using isolated help, type generation and dry run only."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

root = Path.cwd().resolve()
artifact = root / '.artifacts/backend-b08-local-remediation/local-cli'
assert not artifact.exists(), 'Use a fresh output directory; preserve old evidence'
artifact.mkdir(parents=True)
local = Path(tempfile.mkdtemp(prefix='takosan-b08-cli-', dir='/private/tmp')).resolve()
assert not (Path.home() / '.wrangler').is_dir(), 'Legacy auth config could override isolation'
node = shutil.which('node')
assert node
wrangler = root / 'node_modules/wrangler/bin/wrangler.js'
assert wrangler.is_file()
allowed = ['PATH', 'HOME', 'TMPDIR', 'LANG', 'LC_ALL', 'LC_CTYPE', 'TZ']
env = {key: os.environ[key] for key in allowed if key in os.environ}
env.update({
    'CI': 'true', 'WRANGLER_SEND_METRICS': 'false',
    'XDG_CONFIG_HOME': str(local / 'config'), 'XDG_CACHE_HOME': str(local / 'cache'),
    'XDG_DATA_HOME': str(local / 'data'), 'XDG_STATE_HOME': str(local / 'state'),
    'WRANGLER_LOG_PATH': str(local / 'logs'),
})
config = {
    'name': 'takosan-b08-dry-run', 'main': str(root / 'src/worker/index.ts'),
    'compatibility_date': '2024-11-01', 'compatibility_flags': ['nodejs_compat'],
    'assets': {'directory': str(root / 'dist/client'), 'binding': 'ASSETS',
               'html_handling': 'auto-trailing-slash', 'not_found_handling': 'single-page-application'},
    'vars': {'ENVIRONMENT': 'staging', 'AI_MOCK_MODE': 'true', 'AI_QWEN_ONLY': 'true'},
    'd1_databases': [{'binding': 'DB', 'database_name': 'takosan-b08-local',
                      'database_id': '00000000-0000-4000-8000-000000000040'}],
    'kv_namespaces': [{'binding': 'CACHE', 'id': '00000000000000000000000000000001'}],
    'r2_buckets': [{'binding': 'IMAGES', 'bucket_name': 'takosan-b08-local'}],
    'queues': {'producers': [{'binding': 'SCAN_QUEUE', 'queue': 'takosan-b08-local'}],
               'consumers': [{'queue': 'takosan-b08-local', 'max_retries': 3,
                              'dead_letter_queue': 'takosan-b08-dlq'}]},
    'ai': {'binding': 'AI'}, 'send_email': [{'name': 'SEND_EMAIL'}],
    'triggers': {'crons': ['0 0 * * *']}, 'observability': {'enabled': True},
}


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def write(path, raw):
    subprocess.run(['sh', '-c', 'cat > "$1"', 'write', str(path)], input=raw, check=True)


config_path = local / 'wrangler.local.jsonc'
write(config_path, (json.dumps(config, indent=2) + '\n').encode())
commands = []


def run(name, args):
    result = subprocess.run([node, str(wrangler)] + args, cwd=local, env=env,
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    path = artifact / (name + '.raw')
    write(path, result.stdout)
    record = {'name': name, 'command': ['node', 'wrangler'] + args,
              'exitCode': result.returncode, 'rawPath': str(path.relative_to(root)),
              'rawSha256': sha(result.stdout)}
    commands.append(record)
    assert result.returncode == 0, name
    return result.stdout.decode(errors='replace')


version = run('version', ['--version']).strip()
assert '4.149.0' in version
matrix = [
    ('secret-list', ['secret', 'list'], ['--format', '--config']),
    ('d1-list', ['d1', 'list'], ['--json', '--config']),
    ('d1-info', ['d1', 'info'], ['--json', '--config']),
    ('d1-execute', ['d1', 'execute'], ['--remote', '--local', '--json', '--yes', '--config']),
    ('d1-migrations-list', ['d1', 'migrations', 'list'], ['--remote', '--local', '--config']),
    ('d1-migrations-apply', ['d1', 'migrations', 'apply'], ['--remote', '--local', '--config']),
    ('d1-time-travel-info', ['d1', 'time-travel', 'info'], ['--json', '--config']),
    ('deploy', ['deploy'], ['--dry-run', '--outdir', '--var', '--config']),
    ('deployments-status', ['deployments', 'status'], ['--json', '--config']),
    ('versions-view', ['versions', 'view'], ['--json', '--config']),
]
for name, args, flags in matrix:
    output = run('help-' + name, args + ['--help'])
    for flag in flags:
        assert flag in output, name + ' missing consumed flag ' + flag
run('types-fixed-date', ['types', str(local / 'worker-configuration.d.ts'), '--config', str(config_path)])
generated = (local / 'worker-configuration.d.ts').read_bytes()
assert b'D1Database' in generated and b'R2Bucket' in generated and b'Queue' in generated
run('deploy-dry-run', ['deploy', '--dry-run', '--outdir', str(local / 'bundle'),
                      '--config', str(config_path), '--var', 'B08_LOCAL_PROBE:one',
                      '--var', 'B08_LOCAL_SECOND:two'])
bundle = [path for path in (local / 'bundle').rglob('*') if path.is_file()]
assert bundle
assert not list((local / 'config').rglob('default.toml')), 'An auth config was created'
receipt = {
    'status': 'LOCAL_CLI_COMPATIBILITY_PASS', 'wranglerVersion': version,
    'commands': commands, 'helpContracts': len(matrix),
    'configSha256': sha(config_path.read_bytes()), 'generatedTypesSha256': sha(generated),
    'generatedTypesBytes': len(generated), 'bundleFileCount': len(bundle),
    'bundleContentSha256': sha(b''.join(path.read_bytes() for path in sorted(bundle))),
    'runtimeDate': '2024-11-01', 'productionConfigChanged': False,
    'credentialsInherited': False, 'projectDotenvLoaded': False,
    'globalConfigIsolated': True, 'remote': False, 'deployed': False,
    'limits': ['Help proves flags only; remote output/result semantics require captured parser and hosted receipts',
               'Generated types and dry-run bundle do not prove edge queue/email/AI/rollback behavior'],
    'scriptSha256': sha(Path(__file__).read_bytes()),
}
write(artifact / 'receipt.json', (json.dumps(receipt, indent=2) + '\n').encode())
print('local-cli=PASS; helpContracts=10; fixedDateTypes=true; dryRun=true; credentials=none; remote=false')
