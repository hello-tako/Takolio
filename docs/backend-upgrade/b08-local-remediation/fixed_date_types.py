"""Compile unchanged Worker sources against the actually generated runtime date types."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys

root = Path.cwd().resolve()
local = root / '.artifacts/backend-b08-local-remediation/local-cli/receipt.json'
cli = json.loads(local.read_text())
command = next(item for item in cli['commands'] if item['name'] == 'types-fixed-date')
types = Path(command['command'][3]).resolve()
raw = types.read_bytes()
assert hashlib.sha256(raw).hexdigest() == cli['generatedTypesSha256']
assert b'2024-11-01 nodejs_compat' in raw
result = subprocess.run(['node', str(root / 'node_modules/typescript/bin/tsc'), '-p',
                         'tsconfig.worker.json', '--noEmit', '--types', str(types)])
receipt = {'classification': 'FIXED_DATE_GENERATED_WORKER_TYPES_COMPILE',
           'runtimeDate': '2024-11-01', 'runtimeFlags': ['nodejs_compat'],
           'generatedTypesSha256': cli['generatedTypesSha256'],
           'cliReceiptSha256': hashlib.sha256(local.read_bytes()).hexdigest(),
           'workerConfigSha256': hashlib.sha256((root / 'tsconfig.worker.json').read_bytes()).hexdigest(),
           'exitCode': result.returncode, 'status': 'PASS' if result.returncode == 0 else 'FAIL',
           'projectSourceChanged': False, 'remote': False,
           'limits': ['Compilation validates source API surface; no edge execution or rollout is certified.',
                      'skipLibCheck stays as configured for the Worker project.']}
path = root / '.artifacts/backend-b08-local-remediation/fixed-date-types.json'
assert not path.exists(), 'Preserve earlier evidence'
subprocess.run(['sh', '-c', 'cat > "$1"', 'write', str(path)],
               input=(json.dumps(receipt, indent=2) + '\n').encode(), check=True)
print('fixed-date-types=' + receipt['status'])
sys.exit(result.returncode)
