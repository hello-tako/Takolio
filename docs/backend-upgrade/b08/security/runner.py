#!/usr/bin/env python3
"""Fail-closed wrapper around pinned external scanners. Never print raw findings."""
import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
SOURCE_SUFFIXES = {'.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx'}
SEMGREP_RULES = {'takosan.dynamic-eval', 'takosan.dynamic-function', 'takosan.tls-verification-disabled'}
PUBLIC_RULE_IDS = {'github-pat', 'generic-api-key', 'dangerous-triggers', 'template-injection', 'excessive-permissions', 'unpinned-uses', 'artipacked', 'cache-poisoning', 'unredacted-secrets', 'secrets-inherit'}


def sha(path):
    digest = hashlib.sha256()
    with path.open('rb') as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def tree_sha(root):
    digest = hashlib.sha256()
    for path in sorted(root.rglob('*')):
        if path.suffix == '.pyc' or '__pycache__' in path.parts:
            continue
        if path.is_symlink():
            digest.update(str(path.relative_to(root)).encode() + b'\0SYMLINK\0' + os.readlink(path).encode())
            if path.is_file():
                digest.update(bytes.fromhex(sha(path.resolve())))
            elif not path.resolve().is_relative_to(root.resolve()):
                raise ValueError('runtime directory symlink escapes tool tree')
        elif path.is_file():
            digest.update(str(path.relative_to(root)).encode() + b'\0' + bytes.fromhex(sha(path)))
    return digest.hexdigest()


def write_private(path, value):
    path.write_text(json.dumps(value, sort_keys=True, indent=2) + '\n')
    path.chmod(0o600)


def fail(kind, reason):
    return {'tool': kind, 'status': 'ERROR', 'reason': reason}


def checked_id(value):
    if not isinstance(value, str) or not re.fullmatch(r'[A-Za-z0-9_.-]{1,160}', value):
        raise ValueError('invalid bounded rule identifier')
    return value if value in PUBLIC_RULE_IDS else 'unknown-rule-sha256-' + hashlib.sha256(value.encode()).hexdigest()


def decode(tool, payload, code, expected_sources=None):
    """Reject malformed output and disagreement between findings and exit status."""
    try:
        data = json.loads(payload)
        rules = Counter()
        severities = Counter()
        if tool == 'semgrep':
            if not isinstance(data, dict) or not isinstance(data.get('results'), list) or not isinstance(data.get('errors'), list):
                raise ValueError('invalid SAST schema')
            if data['errors']:
                result = fail(tool, 'SCANNER_REPORTED_ERRORS')
                result['scannerErrorCount'] = len(data['errors'])
                result['findingCount'] = len(data['results'])
                return result
            scanned = data.get('paths', {}).get('scanned')
            if not isinstance(scanned, list) or not scanned:
                return fail(tool, 'EMPTY_SOURCE_COVERAGE')
            if expected_sources is not None and set(scanned) != set(expected_sources):
                return fail(tool, 'INCOMPLETE_SOURCE_COVERAGE')
            for item in data['results']:
                rule = item['check_id']
                if not isinstance(rule, str) or not re.fullmatch(r'[A-Za-z0-9_.-]{1,160}', rule):
                    raise ValueError('invalid SAST rule identifier')
                canonical = next((known for known in SEMGREP_RULES if rule == known or rule.endswith('.' + known)), None)
                severity = item['extra']['severity']
                if canonical is None or severity not in {'ERROR', 'WARNING', 'INFO'}:
                    raise ValueError('unknown SAST finding schema')
                rules[canonical] += 1
                severities[severity] += 1
            accepted = {1} if rules else {0}
        elif tool == 'gitleaks':
            if not isinstance(data, list):
                raise ValueError('invalid secret scanner schema')
            for item in data:
                rules[checked_id(item['RuleID'])] += 1
                # A report must demonstrate full redaction; never echo either field.
                if item.get('Secret') != 'REDACTED' or not isinstance(item.get('Match'), str) or 'REDACTED' not in item['Match']:
                    return fail(tool, 'SECRET_REPORT_NOT_FULLY_REDACTED')
                severities['SECRET_REVIEW_REQUIRED'] += 1
            accepted = {1} if rules else {0}
        elif tool == 'zizmor':
            if not isinstance(data, list):
                raise ValueError('invalid workflow scanner schema')
            for item in data:
                if item.get('ignored') is not False:
                    raise ValueError('unexpected ignored finding')
                severity = item['determinations']['severity']
                if severity not in {'Informational', 'Low', 'Medium', 'High'}:
                    raise ValueError('unknown workflow severity')
                rules[checked_id(item['ident'])] += 1
                severities[severity.upper()] += 1
            # Pinned zizmor: 11 informational, 12 low, 13 medium, 14 high.
            severity_codes = {'INFORMATIONAL': 11, 'LOW': 12, 'MEDIUM': 13, 'HIGH': 14}
            accepted = {max(severity_codes[key] for key in severities)} if rules else {0}
        elif tool == 'syft':
            if not isinstance(data, dict) or data.get('bomFormat') != 'CycloneDX' or data.get('specVersion') != '1.7' or not isinstance(data.get('components'), list):
                raise ValueError('invalid CycloneDX schema')
            if code != 0:
                return fail(tool, 'SCANNER_EXIT_DISAGREEMENT')
            packages = [component for component in data['components'] if component.get('type') == 'library' and component.get('name') and component.get('version')]
            if not packages:
                return fail(tool, 'EMPTY_PACKAGE_INVENTORY')
            return {'tool': tool, 'status': 'PASS', 'packageCount': len(packages), 'sbomSha256': hashlib.sha256(payload).hexdigest(), 'scope': 'DECLARED_MANIFEST_AND_LOCK_GRAPH_NOT_VULNERABILITY_SCAN'}
        else:
            raise ValueError('unknown tool')
        if code not in accepted:
            return fail(tool, 'SCANNER_EXIT_DISAGREEMENT')
        return {'tool': tool, 'status': 'FINDINGS' if rules else 'PASS', 'findingCount': sum(rules.values()),
                'rules': dict(sorted(rules.items())), 'severities': dict(sorted(severities.items()))}
    except (ValueError, TypeError, KeyError, AttributeError):
        return fail(tool, 'MALFORMED_SCANNER_OUTPUT')


class Scanners:
    def __init__(self, tools, output):
        self.tools = tools
        self.output = output
        self.manifest = json.loads((HERE / 'tool-manifest.json').read_text())
        self.pinned = {item['name']: item['version'] for item in self.manifest['tools']}
        self.receipt = json.loads((tools / 'toolchain-receipt.json').read_text()) if (tools / 'toolchain-receipt.json').is_file() else None
        self.env = {key: value for key, value in os.environ.items() if key in {'PATH', 'HOME', 'TMPDIR', 'SYSTEMROOT', 'LANG', 'LC_ALL'}}
        self.env.update({'SEMGREP_SEND_METRICS': 'off', 'SEMGREP_ENABLE_VERSION_CHECK': '0',
                         'SEMGREP_SETTINGS_FILE': str(output / 'semgrep-settings.yml'),
                         'XDG_CACHE_HOME': str(output / 'cache'), 'SYFT_CHECK_FOR_APP_UPDATE': 'false',
                         'NO_COLOR': '1', 'PYTHONPYCACHEPREFIX': str(output / 'python-bytecode-private'), 'PYTHONDONTWRITEBYTECODE': '1'})

    def executable(self, name):
        return self.tools / ('semgrep-venv/bin/semgrep' if name == 'semgrep' else f'{name}/{name}')

    def validate(self, name):
        executable = self.executable(name)
        if not executable.is_file():
            result = {'tool': name, 'status': 'UNAVAILABLE', 'reason': 'EXECUTABLE_MISSING'}
        elif self.receipt is None:
            result = fail(name, 'INSTALL_PROVENANCE_MISSING')
        else:
            try:
                record = next(item for item in self.receipt['tools'] if item['name'] == name)
                if self.receipt['manifestSha256'] != sha(HERE / 'tool-manifest.json') or record['version'] != self.pinned[name] or record['executableSha256'] != sha(executable):
                    raise ValueError('provenance mismatch')
                if name == 'semgrep' and (record['requirementLockSha256'] != sha(HERE / 'semgrep-requirements.lock') or record['runtimeTreeSha256'] != tree_sha(self.tools / 'semgrep-venv') or record['pythonExecutableSha256'] != sha((self.tools / 'semgrep-venv/bin/python').resolve())):
                    raise ValueError('locked runtime integrity mismatch')
                argument = 'version' if name in {'gitleaks', 'syft'} else '--version'
                version = subprocess.run([str(executable), argument], cwd=self.output, env=self.env, capture_output=True, timeout=30)
                (self.output / f'{name}-version-private.log').write_bytes(version.stdout + version.stderr)
                match = re.search(rb'(?<![\d.])(\d+\.\d+\.\d+)(?![\d.])', version.stdout)
                if version.returncode != 0 or match is None or match.group(1).decode() != self.pinned[name]:
                    result = fail(name, 'VERSION_MISMATCH_OR_FAILURE')
                else:
                    result = {'tool': name, 'status': 'PASS', 'version': self.pinned[name], 'executableSha256': sha(executable)}
            except (ValueError, KeyError, StopIteration, OSError, subprocess.TimeoutExpired):
                result = fail(name, 'TOOL_PROVENANCE_OR_EXECUTION_FAILURE')
        return result

    def scan(self, name, target, label):
        validated = self.validate(name)
        if validated['status'] != 'PASS':
            return validated.copy()
        raw = self.output / f'{label}-{name}-private.json'
        log = self.output / f'{label}-{name}-private.log'
        binary = str(self.executable(name))
        if name == 'semgrep':
            targets = sorted(str(path) for path in target.rglob('*') if path.is_file() and path.suffix in SOURCE_SUFFIXES)
            if not targets:
                return fail(name, 'EMPTY_SOURCE_INPUT')
            command = [binary, 'scan', '--config', str(HERE / 'rules/semgrep.yml'), '--json', '--metrics=off',
                       '--disable-version-check', '--no-git-ignore', '--x-ignore-semgrepignore-files',
                       '--strict', '--error', '--timeout=10', '--jobs=2'] + targets
        elif name == 'gitleaks':
            if not any(path.is_file() for path in target.rglob('*')):
                return fail(name, 'EMPTY_SECRET_SCAN_INPUT')
            command = [binary, 'dir', str(target), '--config', str(HERE / 'rules/gitleaks.toml'), '--redact=100',
                       '--ignore-gitleaks-allow', '--gitleaks-ignore-path', str(self.output / 'no-ignore-file'),
                       '--report-format=json', '--report-path', str(raw), '--no-banner', '--no-color', '--timeout=180']
        elif name == 'zizmor':
            targets = sorted(str(path) for path in target.rglob('*') if path.is_file() and path.suffix in {'.yml', '.yaml'})
            if not targets:
                return fail(name, 'EMPTY_WORKFLOW_INPUT')
            command = [binary, '--offline', '--no-config', '--no-ignores', '--strict-collection', '--format=json', '--no-progress'] + targets
        else:
            command = [binary, 'scan', f'dir:{target}', '--config', str(HERE / 'rules/syft.yml'),
                       '--output', f'cyclonedx-json={raw}', '--quiet']
        try:
            with log.open('wb') as errors:
                if name in {'semgrep', 'zizmor'}:
                    with raw.open('wb') as output:
                        process = subprocess.run(command, cwd=self.output, env=self.env, stdout=output, stderr=errors, timeout=240)
                else:
                    process = subprocess.run(command, cwd=self.output, env=self.env, stdout=errors, stderr=errors, timeout=240)
            if not raw.is_file() or raw.stat().st_size > 64 * 1024 * 1024:
                return fail(name, 'MISSING_OR_OVERSIZE_SCANNER_OUTPUT')
            result = decode(name, raw.read_bytes(), process.returncode, targets if name == 'semgrep' else None)
            result.update({'version': self.pinned[name], 'rawReportSha256': sha(raw), 'rawLogSha256': sha(log)})
            return result
        except subprocess.TimeoutExpired:
            return fail(name, 'SCANNER_TIMEOUT')
        except OSError:
            return fail(name, 'SCANNER_EXECUTION_FAILURE')


def snapshot(target):
    names = subprocess.run(['git', 'ls-files', '-c', '-o', '--exclude-standard', '-z'], cwd=ROOT, capture_output=True, timeout=30, check=True).stdout.split(b'\0')
    digest = hashlib.sha256()
    count = 0
    skipped = Counter()
    for raw in sorted(set(names)):
        if not raw:
            continue
        relative = Path(os.fsdecode(raw))
        if relative.is_absolute() or '..' in relative.parts:
            raise ValueError('invalid Git file path')
        if relative.parts[0] in {'.hoplite', '.artifacts', 'node_modules', 'dist', '.wrangler'}:
            skipped['operational-or-generated-artifact'] += 1
            continue
        if relative.is_relative_to(Path('docs/backend-upgrade/b08/security/fixtures')):
            skipped['intentional-scanner-fixture'] += 1
            continue
        source = ROOT / relative
        if source.is_symlink():
            raise ValueError('snapshot refuses symlink inputs')
        if not source.exists():
            skipped['deleted-worktree-file'] += 1
            continue
        if not source.is_file():
            raise ValueError('snapshot refuses nonregular inputs')
        data = source.read_bytes()
        if len(data) > 20 * 1024 * 1024:
            raise ValueError('snapshot exceeds per-file size bound')
        destination = target / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(data)
        digest.update(raw + b'\0' + hashlib.sha256(data).digest())
        count += 1
    if not count:
        raise ValueError('empty snapshot')
    return {'scope': 'GIT_TRACKED_AND_NONIGNORED_WORKTREE_SNAPSHOT', 'fileCount': count,
            'treeContentSha256': digest.hexdigest(), 'skipped': dict(skipped), 'gitHistoryScanned': False,
            'installedNodeModulesScanned': False}


def private_snapshot_directory(output, temporary_root=None):
    # Test runners discover files below the repository, including ignored artifacts.
    # Retain source bytes outside that tree; keep only a private pointer beside receipts.
    temporary_root = Path(tempfile.gettempdir() if temporary_root is None else temporary_root).resolve()
    if temporary_root.is_relative_to(ROOT):
        raise ValueError('private snapshot temp directory must be outside repository')
    storage = Path(tempfile.mkdtemp(prefix='takosan-b08-private-snapshot-', dir=temporary_root))
    storage.chmod(0o700)
    target = storage / 'source-snapshot-private'
    target.mkdir(mode=0o700)
    pointer = output / 'source-snapshot-pointer-private.json'
    write_private(pointer, {'schemaVersion': 1, 'snapshotDirectory': str(target),
                           'retention': 'RETAINED_FOR_PRIVATE_LOCAL_REVIEW',
                           'storageBoundary': 'OUTSIDE_REPOSITORY_TEST_DISCOVERY_TREE'})
    return target, sha(pointer)


def selftest(scanners):
    fixtures = HERE / 'fixtures'
    cases = []
    isolated, pointer_sha = private_snapshot_directory(scanners.output)
    (isolated / 'discovery-isolation.test.ts').write_text('export const syntheticFixture = true;\n')
    cases.append({'case': 'private-snapshot-outside-test-discovery-tree', 'status': 'PASS' if not isolated.resolve().is_relative_to(ROOT) and len(pointer_sha) == 64 else 'FAILED'})
    try:
        private_snapshot_directory(scanners.output, ROOT)
        rejected = False
    except ValueError:
        rejected = True
    cases.append({'case': 'repository-local-temp-root-rejected', 'status': 'PASS' if rejected else 'FAILED'})
    for name in ['semgrep', 'gitleaks', 'zizmor', 'syft']:
        for polarity in ['positive', 'negative']:
            result = scanners.scan(name, fixtures / name / polarity, f'selftest-{polarity}')
            expected = 'ERROR' if name == 'syft' and polarity == 'negative' else 'PASS' if polarity == 'negative' or name == 'syft' else 'FINDINGS'
            checked = result['status'] == expected
            if name == 'semgrep' and polarity == 'positive':
                checked = checked and set(result.get('rules', {})) == SEMGREP_RULES
            if name == 'gitleaks' and polarity == 'positive':
                checked = checked and result.get('findingCount', 0) >= 1
            if name == 'zizmor' and polarity == 'positive':
                checked = checked and 'template-injection' in result.get('rules', {})
            if name == 'syft' and polarity == 'positive' and checked:
                raw = json.loads((scanners.output / 'selftest-positive-syft-private.json').read_text())
                checked = any(item.get('name') == 'hono' and item.get('version') == '4.0.0' for item in raw['components'])
            cases.append({'case': f'{name}-{polarity}', 'status': 'PASS' if checked else 'FAILED', 'expected': expected, 'observed': result})
    result = scanners.scan('zizmor', fixtures / 'zizmor/malformed', 'selftest-malformed-input')
    cases.append({'case': 'zizmor-real-malformed-input', 'status': 'PASS' if result['status'] == 'ERROR' else 'FAILED', 'observed': result})
    for name in scanners.pinned:
        malformed = decode(name, b'{broken', 0)
        empty_object = decode(name, b'{}', 0)
        cases.append({'case': f'{name}-malformed-output', 'status': 'PASS' if malformed['status'] == empty_object['status'] == 'ERROR' else 'FAILED'})
        absent = Scanners(scanners.output / 'deliberately-missing-tools', scanners.output).scan(name, fixtures / name / 'positive', 'unavailable')
        cases.append({'case': f'{name}-unavailable', 'status': 'PASS' if absent['status'] == 'UNAVAILABLE' else 'FAILED'})
    altered_tools = scanners.output / 'altered-receipt-tools'
    altered_tools.mkdir()
    (altered_tools / 'gitleaks').symlink_to(scanners.tools / 'gitleaks', target_is_directory=True)
    altered_receipt = json.loads((scanners.tools / 'toolchain-receipt.json').read_text())
    for record in altered_receipt['tools']:
        if record['name'] == 'gitleaks':
            record['executableSha256'] = '0' * 64
    write_private(altered_tools / 'toolchain-receipt.json', altered_receipt)
    altered = Scanners(altered_tools, scanners.output).validate('gitleaks')
    cases.append({'case': 'altered-tool-integrity-rejected', 'status': 'PASS' if altered['status'] == 'ERROR' else 'FAILED'})
    # Revalidation must detect receipt changes even after an earlier successful call.
    probe = Scanners(scanners.tools, scanners.output)
    first = probe.validate('gitleaks')
    probe.receipt = altered_receipt
    second = probe.validate('gitleaks')
    cases.append({'case': 'cached-tool-integrity-bypass-rejected', 'status': 'PASS' if first['status'] == 'PASS' and second['status'] == 'ERROR' else 'FAILED'})
    partial = decode('semgrep', b'{"results":[],"errors":[],"paths":{"scanned":["one.ts"]}}', 0, ['one.ts', 'two.ts'])
    cases.append({'case': 'partial-sast-coverage-rejected', 'status': 'PASS' if partial['status'] == 'ERROR' else 'FAILED'})
    disagreement = decode('gitleaks', b'[]', 2)
    cases.append({'case': 'nonzero-exit-with-empty-findings', 'status': 'PASS' if disagreement['status'] == 'ERROR' else 'FAILED'})
    redaction = decode('gitleaks', b'[{"RuleID":"synthetic","Secret":"not-redacted","Match":"not-redacted"}]', 1)
    cases.append({'case': 'unredacted-output-rejected', 'status': 'PASS' if redaction['status'] == 'ERROR' else 'FAILED'})
    return {'status': 'PASS' if all(case['status'] == 'PASS' for case in cases) else 'FAILED', 'cases': cases}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['selftest', 'scan'])
    parser.add_argument('--tools-dir', type=Path, required=True)
    parser.add_argument('--output-dir', type=Path, required=True)
    args = parser.parse_args()
    output = args.output_dir.resolve()
    tools = args.tools_dir.resolve()
    if not output.is_relative_to(ROOT / '.artifacts') or not tools.is_relative_to(ROOT / '.artifacts'):
        raise ValueError('tool and output directories must be inside repository .artifacts')
    output.mkdir(parents=True, exist_ok=False)
    output.chmod(0o700)
    os.umask(0o077)
    metadata = {'schemaVersion': 1, 'classification': 'LOCAL_SECURITY_CANDIDATE_NOT_RELEASE_CERTIFICATION',
                'checkedAtUtc': datetime.now(timezone.utc).isoformat(), 'manifestSha256': sha(HERE / 'tool-manifest.json'),
                'runnerSha256': sha(Path(__file__)), 'semgrepRulesSha256': sha(HERE / 'rules/semgrep.yml'),
                'secretValuesAndSourceTextPublished': False}
    try:
        scanners = Scanners(tools, output)
        if args.command == 'selftest':
            metadata.update(selftest(scanners))
        else:
            # Freeze source bytes once, then run every scanner against the same tree.
            target, pointer_sha = private_snapshot_directory(output)
            metadata['source'] = snapshot(target)
            metadata['source'].update({'privateSnapshotStorage': 'OS_PRIVATE_TEMP_OUTSIDE_REPOSITORY',
                                       'privateSnapshotPointerSha256': pointer_sha})
            results = []
            for name in ['semgrep', 'gitleaks', 'zizmor', 'syft']:
                scope = target / '.github/workflows' if name == 'zizmor' else target
                results.append(scanners.scan(name, scope, 'repository'))
            metadata['tools'] = results
            metadata['status'] = 'PASS' if all(item['status'] == 'PASS' for item in results) else 'FAILED'
    except Exception as error:
        metadata.update({'status': 'ERROR', 'reason': 'RUNNER_EXCEPTION', 'errorType': type(error).__name__})
    write_private(output / 'receipt.json', metadata)
    print(json.dumps(metadata, sort_keys=True))
    return 0 if metadata['status'] == 'PASS' else 2 if metadata['status'] == 'ERROR' else 1


if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception as error:
        print(json.dumps({'status': 'ERROR', 'reason': 'RUNNER_EXCEPTION', 'errorType': type(error).__name__}), file=sys.stderr)
        sys.exit(2)
