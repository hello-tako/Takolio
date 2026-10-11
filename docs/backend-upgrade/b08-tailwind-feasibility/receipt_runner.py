"""Capture private command evidence; candidate mode reads only the prepared copy."""
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
out = root / '.artifacts/backend-b08-tailwind-feasibility'
name, mode, command = sys.argv[1], sys.argv[2], sys.argv[3:]
assert re.fullmatch(r'[a-z0-9-]+', name) and command
assert mode in {'canonical', 'candidate'}
assert not (out / (name + '.json')).exists()
assert not (out / (name + '.log')).exists()
cwd = root if mode == 'canonical' else Path(json.loads((out / 'candidate-private.json').read_text())['directory'])
if mode == 'candidate':
    assert cwd.parent == Path('/private/tmp') and cwd.name.startswith('takosan-tailwind4-')


def write(path, raw):
    subprocess.run(['sh', '-c', 'cat > "$1"', 'write', str(path)], input=raw, check=True)
    path.chmod(0o600)


def snapshot():
    return { 'head': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root).decode().strip(),
             'status': subprocess.check_output(['git', 'status', '--porcelain'], cwd=root).decode(),
             'packageSha256': hashlib.sha256((cwd / 'package.json').read_bytes()).hexdigest(),
             'lockSha256': hashlib.sha256((cwd / 'pnpm-lock.yaml').read_bytes()).hexdigest() }


env = os.environ.copy()
env.update({'PATH': '/opt/homebrew/opt/node@24/bin:' + env['PATH'],
            'NODE_OPTIONS': '--no-experimental-webstorage', 'CI': 'true',
            'WRANGLER_SEND_METRICS': 'false', 'TMPDIR': '/private/tmp',
            'GIT_COMMIT': os.environ.get('GIT_COMMIT', subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root).decode().strip()),
            'BUILD_TIMESTAMP': '2026-10-12T00:00:00Z',
            'VITE_MEAL_PLANNER_ENABLED': 'true', 'VITE_MEAL_COMPOSITION_V2_ENABLED': 'false'})
for flag in ['CHECK_REMOTE_SCHEMA', 'CHECK_WEEK_PARITY_REMOTE']:
    env.pop(flag, None)
before = snapshot()
started = datetime.datetime.now(datetime.timezone.utc).isoformat()
tick = time.monotonic()
result = subprocess.run(command, cwd=cwd, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
write(out / (name + '.log'), result.stdout)
receipt = {'name': name, 'mode': mode, 'command': command,
           'startedAtUtc': started, 'durationSeconds': round(time.monotonic() - tick, 3),
           'exitCode': result.returncode, 'before': before, 'after': snapshot(),
           'logSha256': hashlib.sha256(result.stdout).hexdigest(),
           'environment': {k: env[k] for k in ['NODE_OPTIONS', 'CI', 'WRANGLER_SEND_METRICS',
                                            'TMPDIR', 'GIT_COMMIT', 'BUILD_TIMESTAMP', 'VITE_MEAL_PLANNER_ENABLED',
                                            'VITE_MEAL_COMPOSITION_V2_ENABLED']},
           'remoteFlags': 'unset', 'runtimeCandidateApplied': False}
write(out / (name + '.json'), (json.dumps(receipt, indent=2) + '\n').encode())
print(json.dumps({k: receipt[k] for k in ['name', 'mode', 'exitCode', 'durationSeconds', 'logSha256']}))
sys.exit(result.returncode)
