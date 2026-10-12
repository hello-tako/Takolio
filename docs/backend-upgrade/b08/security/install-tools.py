#!/usr/bin/env python3
"""Install pinned scanners only into an ignored repository artifact directory."""
import argparse
import hashlib
import json
import os
import platform
from pathlib import Path
import shutil
import subprocess
import sys
import tarfile
import urllib.request

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]


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


def private_write(path, value):
    path.write_text(json.dumps(value, sort_keys=True, indent=2) + '\n')
    path.chmod(0o600)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--tools-dir', type=Path, required=True)
    args = parser.parse_args()
    dest = args.tools_dir.resolve()
    if not dest.is_relative_to(ROOT / '.artifacts'):
        raise ValueError('tools directory must be inside repository .artifacts')
    if sys.version_info[:2] != (3, 12):
        raise ValueError('use Python 3.12 for the resolved Semgrep dependency lock')
    system = {'Darwin': 'darwin', 'Linux': 'linux'}.get(platform.system())
    machine = {'arm64': 'arm64', 'aarch64': 'arm64', 'x86_64': 'amd64'}.get(platform.machine())
    target = f'{system}-{machine}'
    manifest_path = HERE / 'tool-manifest.json'
    manifest = json.loads(manifest_path.read_text())
    dest.mkdir(parents=True, exist_ok=True)
    os.umask(0o077)
    records = []
    for tool in manifest['tools']:
        name = tool['name']
        if name == 'semgrep':
            continue
        release = tool['archives'][target]
        archive = dest / release['filename']
        if not archive.exists():
            request = urllib.request.Request(release['url'], headers={'User-Agent': 'takosan-b08-pinned-tool-candidate'})
            with urllib.request.urlopen(request, timeout=60) as response, archive.open('wb') as output:
                total = 0
                while chunk := response.read(1024 * 1024):
                    total += len(chunk)
                    if total > 150 * 1024 * 1024:
                        raise ValueError('archive exceeds bounded download size')
                    output.write(chunk)
        if sha(archive) != release['sha256']:
            raise ValueError(f'{name}: official archive SHA256 mismatch')
        binary = dest / name / name
        binary.parent.mkdir(exist_ok=True)
        with tarfile.open(archive, 'r:gz') as bundle:
            members = [item for item in bundle.getmembers() if item.isfile() and Path(item.name).name == name]
            if len(members) != 1:
                raise ValueError(f'{name}: expected exactly one regular binary member')
            source = bundle.extractfile(members[0])
            if source is None:
                raise ValueError('binary member unreadable')
            with source, binary.open('wb') as output:
                shutil.copyfileobj(source, output)
        binary.chmod(0o700)
        records.append({'name': name, 'version': tool['version'], 'executable': str(binary.relative_to(dest)),
                        'executableSha256': sha(binary), 'archiveSha256': release['sha256'], 'platform': target})
    venv = dest / 'semgrep-venv'
    uv = shutil.which('uv')
    log = dest / 'install-private.log'
    with log.open('ab') as output:
        if not (venv / 'bin/python').exists():
            command = [uv, '--no-config', '--cache-dir', str(dest / 'uv-cache'), 'venv', '--python', sys.executable, str(venv)] if uv else [sys.executable, '-m', 'venv', str(venv)]
            subprocess.run(command, stdout=output, stderr=output, timeout=120, check=True)
        lock = HERE / 'semgrep-requirements.lock'
        if uv:
            command = [uv, '--no-config', '--cache-dir', str(dest / 'uv-cache'), 'pip', 'install', '--default-index', 'https://pypi.org/simple', '--python', str(venv / 'bin/python'), '--require-hashes', '--only-binary', ':all:', '-r', str(lock)]
        else:
            command = [str(venv / 'bin/python'), '-m', 'pip', 'install', '--isolated', '--no-cache-dir', '--index-url', 'https://pypi.org/simple', '--require-hashes', '--only-binary=:all:', '-r', str(lock)]
        subprocess.run(command, stdout=output, stderr=output, timeout=600, check=True)
    semgrep = venv / 'bin/semgrep'
    records.append({'name': 'semgrep', 'version': next(t['version'] for t in manifest['tools'] if t['name'] == 'semgrep'),
                    'executable': str(semgrep.relative_to(dest)), 'executableSha256': sha(semgrep),
                    'requirementLockSha256': sha(lock), 'runtimeTreeSha256': tree_sha(venv),
                    'pythonExecutableSha256': sha((venv / 'bin/python').resolve()), 'platform': target})
    private_write(dest / 'toolchain-receipt.json', {'schemaVersion': 1, 'manifestSha256': sha(manifest_path),
                  'tools': records, 'provenance': 'Official archive SHA256; Python packages require-hashes/only-binary. No independent signature attestation.'})
    print(json.dumps({'status': 'INSTALLED_CANDIDATE', 'platform': target, 'tools': [r['name'] for r in records]}))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(json.dumps({'status': 'ERROR', 'errorType': type(error).__name__}), file=sys.stderr)
        sys.exit(2)
