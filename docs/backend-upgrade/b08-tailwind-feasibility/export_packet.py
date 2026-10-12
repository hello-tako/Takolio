"""Export only bounded reviewed metadata, retaining raw logs/reports privately."""
import hashlib
import json
from pathlib import Path
import subprocess

root = Path.cwd()
private = root / '.artifacts/backend-b08-tailwind-feasibility'
packet = root / 'docs/backend-upgrade/b08-tailwind-feasibility'
base = 'b9612d199bbad57efbe71a423ab97b41fab8f3af'
implementation = subprocess.check_output(['git', 'rev-parse', 'HEAD']).decode().strip()
assert subprocess.check_output(['git', 'status', '--porcelain']).decode() == ''


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def write(path, value):
    subprocess.run(['sh', '-c', 'cat > "$1"', 'write', str(path)],
                   input=(json.dumps(value, indent=2) + '\n').encode(), check=True)


def load(name):
    return json.loads((private / name).read_text())


commands = []
for path in sorted(private.glob('*.json')):
    d = json.loads(path.read_text())
    if 'command' not in d or 'logSha256' not in d:
        continue
    log = private / (d['name'] + '.log')
    assert sha(log.read_bytes()) == d['logSha256']
    # Transitional docs/source changes are retained in earlier commands.
    # Only the required final-clean gates certify a committed source below.
    commands.append(d)
required = ['braces-final-clean-frozen', 'braces-final-clean-lint', 'braces-final-clean-types',
            'braces-final-clean-focused', 'braces-final-clean-full-tests', 'braces-final-clean-migrations',
            'braces-final-clean-build', 'braces-final-clean-audit', 'braces-final-clean-audit-prod',
            'braces-final-clean-scanner']
for name in required:
    d = next(c for c in commands if c['name'] == name)
    assert d['before']['head'] == implementation and d['before']['status'] == ''
    assert d['after']['status'] == ''
    assert d['exitCode'] == (1 if name in {'braces-final-clean-audit', 'braces-final-clean-scanner'} else 0)

analysis = load('candidate-analysis.json')
# Keep selector inventories/lexical false positives private; export precise counts
# and the complete nonsecret package graph. No application data or raw finding.
analysis_export = {key: value for key, value in analysis.items()
                   if key not in {'baseline', 'candidate', 'usedMissing', 'changedInputs'}}
analysis_export['baseline'] = {k: v for k, v in analysis['baseline'].items() if k != 'classes'}
analysis_export['candidate'] = {k: v for k, v in analysis['candidate'].items() if k != 'classes'}
analysis_export['changedInputs'] = analysis['changedInputs']
analysis_export['usedMissingInterpretation'] = 'The two lexical classes !container/ring occur in identifiers/comments; no missing rendered utility is certified.'
pairs = load('browser-route-recovery/browser-comparison.json')
states = load('browser-focus-hover/browser-comparison.json')
for d in [pairs, states]:
    assert d['pageErrors'] == 0 and d['forbiddenApiWrites'] == 0
    assert all(c['recoveryPixels']['changedPixels'] == 0 for c in d['checks'])
    for c in d['checks']:
        c['examples'] = c['examples'][:8]
inputs = load('source-inputs.json')
protected = load('protected-surface.json')
scanner = load('scanner-clean-implementation/receipt.json')
comparison = load('braces-comparison.json')
outputs = {'registry.json': load('registry.json'), 'candidate-analysis.json': analysis_export,
           'browser-comparison.json': pairs, 'browser-states.json': states,
           'braces-comparison.json': comparison, 'upstream-control.json': load('upstream-control.json'),
           'protected-surface.json': protected, 'scanner-implementation.json': scanner,
           'scanner-reconciliation.json': load('scanner-reconciliation.json')}
attachments = packet / 'attachments'
attachments.mkdir(exist_ok=True)
for name, value in outputs.items():
    write(attachments / name, value)
source_paths = subprocess.check_output(['git', 'diff', '--name-only', '-z', base, implementation]).split(b'\0')
source = []
for raw_name in source_paths:
    if not raw_name:
        continue
    name = raw_name.decode()
    blob = subprocess.check_output(['git', 'show', implementation + ':' + name])
    source.append({'path': name, 'sha256': sha(blob)})
validation = {'classification': 'LOCAL_BOUNDED_MITIGATION_NOT_RELEASE_CERTIFICATION',
              'baseSha': base, 'implementationSha': implementation,
              'source': source, 'commands': commands,
              'inputManifest': {'count': len(inputs['inputs']), 'sha256': sha((private / 'source-inputs.json').read_bytes())},
              'attachments': [{'path': str((attachments / name).relative_to(root)), 'sha256': sha((attachments / name).read_bytes())}
                              for name in outputs],
              'securityGate': 'FAILED', 'advisorySuppressed': False, 'upstreamPatchedVersionClaimed': False,
              'privacyExport': {'type': 'Reviewed bounded metadata only', 'rawCommandLogsExported': False,
                               'rawScannerReportsOrPointersExported': False, 'privateCandidateSourceExported': False},
              'limits': ['No hosted/Linux/device/browser-floor/release acceptance.',
                         'No real OCR/provider/human data/inbox/SLO/billing certification.',
                         'Local depth guard addresses the defined string/AST recursion paths only.']}
write(packet / 'validation.json', validation)
print(json.dumps({'commands': len(commands), 'source': len(source), 'attachments': len(outputs),
                  'requiredCommittedGates': len(required), 'rawLogsExported': False}))
