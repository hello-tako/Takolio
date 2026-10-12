"""Retain immutable local command evidence without printing large raw reports."""
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time

root = Path.cwd()
out = root / '.artifacts/backend-b08-log-privacy'
out.mkdir(parents=True, exist_ok=True)
out.chmod(0o700)
name, command = sys.argv[1], sys.argv[2:]
assert re.fullmatch(r'[a-z0-9-]+', name) and command
assert not (out / (name + '.json')).exists(), name
assert not (out / (name + '.log')).exists(), name


def write(path, raw):
    subprocess.run(['sh', '-c', 'cat > "$1"', 'write', str(path)], input=raw, check=True)
    path.chmod(0o600)


def snapshot():
    return {
        'workingDirectory': str(root),
        'headSha': subprocess.check_output(['git', 'rev-parse', 'HEAD']).decode().strip(),
        'status': subprocess.check_output(['git', 'status', '--porcelain']).decode(),
        'packageSha256': hashlib.sha256((root / 'package.json').read_bytes()).hexdigest(),
        'lockSha256': hashlib.sha256((root / 'pnpm-lock.yaml').read_bytes()).hexdigest(),
    }


env = os.environ.copy()
env.update({
    'PATH': '/opt/homebrew/opt/node@24/bin:' + env['PATH'],
    'NODE_OPTIONS': '--no-experimental-webstorage',
    'CI': 'true', 'WRANGLER_SEND_METRICS': 'false',
    'TMPDIR': env.get('TAKOSAN_PROGRAM_TMPDIR', '/private/tmp'),
})
for flag in ['CHECK_REMOTE_SCHEMA', 'CHECK_WEEK_PARITY_REMOTE']:
    env.pop(flag, None)
before = snapshot()
start = datetime.datetime.now(datetime.timezone.utc).isoformat()
tick = time.monotonic()
result = subprocess.run(command, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
log = out / (name + '.log')
write(log, result.stdout)
receipt = {
    'name': name, 'command': command, 'startedAtUtc': start,
    'durationSeconds': round(time.monotonic() - tick, 3),
    'exitCode': result.returncode, 'status': 'PASS' if result.returncode == 0 else 'FAIL',
    'sourceBefore': before, 'sourceAfter': snapshot(),
    'logPath': str(log.relative_to(root)),
    'logSha256': hashlib.sha256(result.stdout).hexdigest(),
    'environment': {key: env[key] for key in ['NODE_OPTIONS', 'CI', 'WRANGLER_SEND_METRICS', 'TMPDIR']},
    'buildCommit': env.get('GIT_COMMIT'), 'nodePath': '/opt/homebrew/opt/node@24/bin',
    'remoteFlags': 'unset',
}
write(out / (name + '.json'), (json.dumps(receipt, indent=2) + '\n').encode())
print(json.dumps({key: receipt[key] for key in ['name', 'command', 'exitCode', 'status', 'durationSeconds', 'logPath', 'logSha256']}))
sys.exit(result.returncode)
