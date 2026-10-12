"""Record local command receipts without printing raw fixture/provider content."""
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
out = root / '.artifacts/backend-b03-preprocessing'
name, command = sys.argv[1], sys.argv[2:]
assert re.fullmatch(r'[a-z0-9-]+', name) and command
out.mkdir(parents=True, exist_ok=True)
assert not (out / (name + '.json')).exists()
assert not (out / (name + '.log')).exists()


def write(path, raw):
    subprocess.run(['sh', '-c', 'cat > "$1"', 'write', str(path)], input=raw, check=True)
    path.chmod(0o600)


def snapshot():
    return {'head': subprocess.check_output(['git', 'rev-parse', 'HEAD']).decode().strip(),
            'status': subprocess.check_output(['git', 'status', '--porcelain']).decode()}


env = os.environ.copy()
env.update({'PATH': '/opt/homebrew/opt/node@24/bin:' + env['PATH'],
            'NODE_OPTIONS': '--no-experimental-webstorage', 'CI': 'true',
            'WRANGLER_SEND_METRICS': 'false', 'TMPDIR': '/private/tmp',
            'GIT_COMMIT': subprocess.check_output(['git', 'rev-parse', 'HEAD']).decode().strip(),
            'BUILD_TIMESTAMP': '2026-10-12T00:00:00Z',
            'VITE_MEAL_PLANNER_ENABLED': 'true', 'VITE_MEAL_COMPOSITION_V2_ENABLED': 'false'})
for flag in ['CHECK_REMOTE_SCHEMA', 'CHECK_WEEK_PARITY_REMOTE']:
    env.pop(flag, None)
before = snapshot()
started = datetime.datetime.now(datetime.timezone.utc).isoformat()
tick = time.monotonic()
result = subprocess.run(command, cwd=root, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
write(out / (name + '.log'), result.stdout)
receipt = {'name': name, 'command': command, 'startedAtUtc': started,
           'durationSeconds': round(time.monotonic() - tick, 3), 'exitCode': result.returncode,
           'before': before, 'after': snapshot(), 'logSha256': hashlib.sha256(result.stdout).hexdigest(),
           'environment': {key: env[key] for key in ['NODE_OPTIONS', 'CI', 'WRANGLER_SEND_METRICS',
                          'TMPDIR', 'GIT_COMMIT', 'BUILD_TIMESTAMP', 'VITE_MEAL_PLANNER_ENABLED',
                          'VITE_MEAL_COMPOSITION_V2_ENABLED']}, 'remoteFlags': 'unset'}
write(out / (name + '.json'), (json.dumps(receipt, indent=2) + '\n').encode())
print(json.dumps({key: receipt[key] for key in ['name', 'exitCode', 'durationSeconds', 'logSha256']}))
sys.exit(result.returncode)
