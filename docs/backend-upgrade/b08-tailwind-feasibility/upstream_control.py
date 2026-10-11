"""Verify the published tarball and retain an unpatched control privately."""
import base64
import hashlib
import io
import json
from pathlib import Path
import subprocess
import tarfile
import urllib.request

out = Path('.artifacts/backend-b08-tailwind-feasibility')
registry = json.loads((out / 'registry.json').read_text())
release = next(p for p in registry['packages'] if p['package'] == 'braces')['releases'][0]
dist = release['dist']
with urllib.request.urlopen(dist['tarball']) as response:
    raw = response.read(2 * 1024 * 1024)
algorithm, digest = dist['integrity'].split('-', 1)
assert algorithm == 'sha512'
assert hashlib.sha512(raw).digest() == base64.b64decode(digest)
control = out / 'braces-unpatched'
control.mkdir(mode=0o700)
files = []
with tarfile.open(fileobj=io.BytesIO(raw), mode='r:gz') as archive:
    for member in archive.getmembers():
        if not member.isfile():
            continue
        path = Path(member.name)
        assert path.parts[0] == 'package' and '..' not in path.parts
        rel = Path(*path.parts[1:])
        if not (str(rel) in {'index.js', 'package.json', 'LICENSE'} or rel.parts[0] == 'lib'):
            continue
        contents = archive.extractfile(member).read()
        dest = control / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(['sh', '-c', 'cat > "$1"', 'write', str(dest)], input=contents, check=True)
        dest.chmod(0o600)
        files.append({'path': str(rel), 'sha256': hashlib.sha256(contents).hexdigest()})
receipt = {'officialTarball': dist['tarball'], 'integrityVerified': True,
           'tarballSha256': hashlib.sha256(raw).hexdigest(), 'files': files,
           'authority': 'TEST_ONLY_UNPATCHED_CONTROL'}
subprocess.run(['sh', '-c', 'cat > "$1"', 'write', str(out / 'upstream-control.json')],
               input=(json.dumps(receipt, indent=2) + '\n').encode(), check=True)
print(json.dumps({'status': 'VERIFIED', 'version': release['version'], 'files': len(files),
                  'tarballSha256': receipt['tarballSha256']}))
