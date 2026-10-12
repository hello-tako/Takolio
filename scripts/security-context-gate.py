#!/usr/bin/env python3
"""Context adjudication binds every reviewed location to whole source bytes."""
import argparse
import hashlib
import json
from pathlib import Path


def adjudicate(root, findings, context):
    root = root.resolve()
    if context.get('schemaVersion') != 1 or context.get('noCredentialOrMatchBytes') is not True:
        raise ValueError('INVALID_CONTEXT')
    entries = context.get('entries')
    if not isinstance(entries, list) or not isinstance(findings, list):
        raise ValueError('INVALID_FINDINGS')
    reviewed = {}
    allowed = {'DOCUMENTED_CHECKSUM', 'DOCUMENTED_NON_SECRET_IDENTIFIER', 'STATIC_ERROR_CODE',
               'SYNTHETIC_TEST_FIXTURE', 'DOCUMENTATION_PROSE'}
    for entry in entries:
        path = Path(entry['path'])
        if path.is_absolute() or '..' in path.parts or entry['classification'] not in allowed:
            raise ValueError('INVALID_CONTEXT_ENTRY')
        key = (path.as_posix(), *entry['coordinates'])
        if key in reviewed:
            raise ValueError('DUPLICATE_CONTEXT')
        reviewed[key] = entry
    unresolved = 0
    matched = set()
    for finding in findings:
        if finding.get('Secret') != 'REDACTED' or 'REDACTED' not in finding.get('Match', ''):
            raise ValueError('UNREDACTED_FINDING')
        text = finding['File']
        relative = text.split('/source-snapshot-private/', 1)[-1]
        path = Path(relative)
        if path.is_absolute() or '..' in path.parts:
            raise ValueError('UNBOUND_FINDING_PATH')
        key = (path.as_posix(), *(finding[name] for name in ['StartLine', 'StartColumn', 'EndLine', 'EndColumn', 'RuleID']))
        entry = reviewed.get(key)
        source = root / path
        valid = entry is not None and source.is_file() and not source.is_symlink()
        if valid:
            valid = hashlib.sha256(source.read_bytes()).hexdigest() == entry['sourceFileSha256']
        if valid:
            for proof in entry['provenanceInputHashes']:
                proof_path = Path(proof['path'])
                if proof_path.is_absolute() or '..' in proof_path.parts:
                    valid = False
                    break
                proof_file = root / proof_path
                if not proof_file.is_file() or proof_file.is_symlink() or hashlib.sha256(proof_file.read_bytes()).hexdigest() != proof['sha256']:
                    valid = False
                    break
        if valid and key not in matched:
            matched.add(key)
        else:
            unresolved += 1
    return {'schemaVersion': 1, 'status': 'ADJUDICATED' if unresolved == 0 else 'BLOCKED',
            'rawFindingCount': len(findings), 'contextMatchedCount': len(matched),
            'unresolvedCount': unresolved, 'scannerSuppressionAdded': False,
            'externalAcceptance': 'PENDING_EXTERNAL_EVIDENCE'}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--scan', type=Path, required=True)
    parser.add_argument('--context', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    receipt = json.loads((args.scan / 'receipt.json').read_text())
    tools = receipt.get('tools', [])
    names = [tool.get('tool') for tool in tools]
    if sorted(names) != ['gitleaks', 'semgrep', 'syft', 'zizmor']:
        raise ValueError('INCOMPLETE_SCAN')
    for tool in tools:
        if tool['tool'] != 'gitleaks' and tool['status'] != 'PASS':
            raise ValueError('SCANNER_GATE_FAILED')
        if tool['tool'] == 'gitleaks' and tool['status'] not in ['PASS', 'FINDINGS']:
            raise ValueError('SECRET_SCANNER_UNAVAILABLE')
    raw = (args.scan / 'repository-gitleaks-private.json').read_bytes()
    secret_tool = next(tool for tool in tools if tool['tool'] == 'gitleaks')
    if hashlib.sha256(raw).hexdigest() != secret_tool['rawReportSha256']:
        raise ValueError('SCANNER_REPORT_HASH_MISMATCH')
    findings = json.loads(raw)
    if len(findings) != secret_tool['findingCount']:
        raise ValueError('SCANNER_COUNT_MISMATCH')
    result = adjudicate(Path.cwd(), findings,
                        json.loads(args.context.read_text()))
    result['scanReceiptSha256'] = hashlib.sha256((args.scan / 'receipt.json').read_bytes()).hexdigest()
    result['contextSha256'] = hashlib.sha256(args.context.read_bytes()).hexdigest()
    args.output.write_text(json.dumps(result, indent=2) + '\n')
    args.output.chmod(0o600)
    print(json.dumps(result))
    return 0 if result['status'] == 'ADJUDICATED' else 1


if __name__ == '__main__':
    raise SystemExit(main())
