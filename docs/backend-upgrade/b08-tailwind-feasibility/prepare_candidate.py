"""Copy public build inputs into a private, non-authoritative Tailwind candidate."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import urllib.request
from datetime import datetime, timezone

root = Path.cwd()
out = root / '.artifacts/backend-b08-tailwind-feasibility'
out.mkdir(parents=True, exist_ok=True)
out.chmod(0o700)
assert not (out / 'candidate-private.json').exists(), 'Use a fresh evidence directory'
base = 'b9612d199bbad57efbe71a423ab97b41fab8f3af'
subprocess.run(['git', 'cat-file', '-e', base], check=True)
candidate = Path(tempfile.mkdtemp(prefix='takosan-tailwind4-', dir='/private/tmp'))
candidate.chmod(0o700)


def write(path, raw):
    path.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(['sh', '-c', 'cat > "$1"', 'write', str(path)], input=raw, check=True)


tracked = subprocess.check_output(['git', 'ls-tree', '-r', '--name-only', '-z', base]).split(b'\0')
inputs = []
for name in tracked:
    if not name:
        continue
    rel = Path(os.fsdecode(name))
    if (rel.parts[0] not in {'src', 'packages', 'public', 'scripts', 'tests'}
            and str(rel) not in {'package.json', 'pnpm-lock.yaml', 'index.html',
                                'vite.config.ts', 'tailwind.config.js', 'postcss.config.js',
                                'tsconfig.json', 'tsconfig.worker.json', 'eslint.config.js'}):
        continue
    raw = subprocess.check_output(['git', 'show', base + ':' + str(rel)])
    write(candidate / rel, raw)
    inputs.append({'path': str(rel), 'sha256': hashlib.sha256(raw).hexdigest()})

package = json.loads((candidate / 'package.json').read_bytes())
package['devDependencies']['tailwindcss'] = '4.3.3'
package['devDependencies']['@tailwindcss/postcss'] = '4.3.3'
package['pnpm']['overrides'] = {}
write(candidate / 'package.json', (json.dumps(package, indent=2) + '\n').encode())
write(candidate / 'postcss.config.js', b'export default {\n  plugins: { "@tailwindcss/postcss": {}, autoprefixer: {} },\n};\n')
css_path = candidate / 'src/web/styles/index.css'
css = css_path.read_text()
old = '@tailwind base;\n@tailwind components;\n@tailwind utilities;'
assert css.count(old) == 1
css = css.replace(old, '')
css = '@import "tailwindcss" source(none);\n' + css
css = css.replace('@import "./kitchen-recipes.css";', '@import "./kitchen-recipes.css";\n@config "../../../tailwind.config.js";\n@source "../";\n@source "../../../index.html";')
write(css_path, css.encode())

metadata = {'fetchedAtUtc': datetime.now(timezone.utc).isoformat(), 'baseSha': base,
            'packages': [], 'advisory': None}
for name in ['tailwindcss', '@tailwindcss/postcss', 'braces', 'chokidar', 'micromatch', 'fast-glob']:
    url = 'https://registry.npmjs.org/' + name
    with urllib.request.urlopen(url) as response:
        data = json.load(response)
    tags = data['dist-tags']
    versions = sorted(set([tags['latest']] + ([tags['v3-lts']] if 'v3-lts' in tags else [])))
    metadata['packages'].append({'package': name, 'url': url, 'tags': tags,
        'releases': [{key: data['versions'][version].get(key) for key in
                     ['name', 'version', 'dependencies', 'peerDependencies', 'engines', 'dist']}
                    for version in versions]})
url = 'https://api.github.com/advisories/GHSA-vfj7-8cjw-p6xm'
with urllib.request.urlopen(urllib.request.Request(url, headers={'Accept': 'application/vnd.github+json'})) as response:
    data = json.load(response)
metadata['advisory'] = {'url': url, **{key: data.get(key) for key in
    ['ghsa_id', 'summary', 'description', 'severity', 'published_at', 'updated_at',
     'withdrawn_at', 'vulnerabilities', 'references']}}
write(out / 'registry.json', (json.dumps(metadata, indent=2) + '\n').encode())
write(out / 'source-inputs.json', (json.dumps({'baseSha': base, 'inputs': inputs}, indent=2) + '\n').encode())
write(out / 'candidate-private.json', (json.dumps({'directory': str(candidate), 'baseSha': base}) + '\n').encode())
for path in out.iterdir():
    path.chmod(0o600)
print(json.dumps({'status': 'PREPARED', 'baseSha': base, 'copiedInputs': len(inputs),
                  'candidateAuthoritative': False, 'runtimeChanged': False}))
