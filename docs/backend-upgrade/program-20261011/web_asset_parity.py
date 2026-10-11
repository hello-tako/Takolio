import hashlib, io, json, os, pathlib, subprocess, tarfile, tempfile, sys

root = pathlib.Path.cwd()
base = '1963c469e2e3bd4819cda6bb9ef8162101ad523a'
out = root / '.artifacts/backend-program-20261011' / (sys.argv[1] if len(sys.argv) == 2 else 'web-parity')
assert not out.exists(), 'Keep earlier parity evidence immutable; choose a new output directory'
out.mkdir(parents=True)

def write(path, raw):
    subprocess.run(['sh', '-c', 'cat > "$1"', 'write', str(path)], input=raw, check=True)

def digest(raw):
    return hashlib.sha256(raw).hexdigest()

def files(directory):
    return [{'path': str(path.relative_to(directory)), 'bytes': path.stat().st_size,
             'sha256': digest(path.read_bytes())} for path in sorted(pathlib.Path(parent) / name for parent, _, names in os.walk(directory) for name in names) if path.is_file()]

env = {key: value for key, value in os.environ.items() if not key.startswith('VITE_')}
env.update({'GIT_COMMIT': base, 'BUILD_TIMESTAMP': '2026-10-11T00:00:00.000Z',
            'VITE_MEAL_COMPOSITION_V2_ENABLED': 'true', 'VITE_MEAL_PLANNER_ENABLED': 'true',
            'npm_package_version': '0.1.0'})
archive = subprocess.check_output(['git', 'archive', base], cwd=root)
local = pathlib.Path(tempfile.mkdtemp(prefix='takosan-program-web-base-', dir='/private/tmp'))
with tarfile.open(fileobj=io.BytesIO(archive), mode='r:') as reader:
    members = reader.getmembers()
    for member in members:
        name = pathlib.PurePosixPath(member.name)
        assert not name.is_absolute() and '..' not in name.parts and (member.isdir() or member.isfile()), member.name
    reader.extractall(local, members=members)
commands = []
install_command = ['pnpm', 'install', '--frozen-lockfile', '--offline']
installed = subprocess.run(install_command, cwd=local, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
write(out / 'base-install.log', installed.stdout)
commands.append({'name': 'base-install', 'command': install_command, 'cwd': str(local),
                 'exitCode': installed.returncode, 'logSha256': digest(installed.stdout)})
assert installed.returncode == 0, 'Baseline frozen install'
for name, cwd in [('base', local), ('candidate', root)]:
    command = ['pnpm', 'build']
    result = subprocess.run(command, cwd=cwd, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    write(out / (name + '.log'), result.stdout)
    commands.append({'name': name, 'command': command, 'cwd': str(cwd), 'exitCode': result.returncode,
                     'logSha256': digest(result.stdout)})
    assert result.returncode == 0, name
    manifest = files(cwd / 'dist/client')
    write(out / (name + '.manifest.json'), (json.dumps(manifest, indent=2) + '\n').encode())
    if name == 'base':
        original = manifest
    else:
        assert manifest == original, 'Client asset bytes differ under identical inputs'
receipt = {'status': 'LOCAL_ASSET_PARITY_VERIFIED', 'baseSha': base,
           'candidateSha': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root).decode().strip(),
           'candidateStatus': subprocess.check_output(['git', 'status', '--porcelain'], cwd=root).decode(),
           'buildInputs': {key: env[key] for key in ['GIT_COMMIT', 'BUILD_TIMESTAMP', 'npm_package_version',
                           'VITE_MEAL_COMPOSITION_V2_ENABLED', 'VITE_MEAL_PLANNER_ENABLED']},
           'sourceArchiveSha256': digest(archive), 'lockfileSha256': digest((root / 'pnpm-lock.yaml').read_bytes()),
           'clientAssetCount': len(original), 'commands': commands, 'sameClientAssetBytes': True,
           'temporaryBaselineDirectory': str(local), 'productionCertified': False}
write(out / 'receipt.json', (json.dumps(receipt, indent=2) + '\n').encode())
print('web-asset-parity=PASS; clientAssets=' + str(len(original)) + '; identical inputs and bytes; two sequential builds')
