"""Scan added public patch content; report locations, never matched values."""
import pathlib
import re
import subprocess

base = 'cc1267e719b4af38325a20290382481e86f67a05'
patterns = {
    'private key': r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY',
    'GitHub token': r'(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})',
    'API credential': r'\b(?:sk-proj-|sk-svcacct-|cfut_|cfat_|xox[baprs]-)[A-Za-z0-9_-]{25,}',
    'AWS key': r'\bAKIA[A-Z0-9]{16}\b',
    'bearer literal': r'(?i)authorization:\s*bearer\s+[A-Za-z0-9._~+/=-]{24,}',
}
compiled = {key: re.compile(value) for key, value in patterns.items()}
patch = subprocess.check_output(['git','diff','--no-ext-diff','--no-color','--unified=0',base],text=True)
added = [(None, patch)]
untracked = subprocess.check_output(['git','ls-files','--others','--exclude-standard'],text=True).splitlines()
for filename in untracked:
    data = pathlib.Path(filename).read_bytes()
    if b'\0' not in data[:8000]:
        added.append((filename, data.decode('utf8','replace')))
failures = []
for filename, content in added:
    current = filename
    for n,line in enumerate(content.splitlines(),1):
        if filename is None:
            if line.startswith('+++ b/'):
                current = line[6:]
                continue
            if not line.startswith('+') or line.startswith('+++'):
                continue
            line = line[1:]
        for label,pattern in compiled.items():
            if pattern.search(line):
                failures.append(f'{current}:{n}: {label}')
        for email in re.findall(r'[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}',line):
            domain = email.split('@')[1]
            if not domain.endswith(('.test','.example','.invalid')) and domain not in ('example.com','example.org','users.noreply.github.com'):
                failures.append(f'{current}:{n}: non-synthetic email requires review')
if failures:
    print('\n'.join(failures))
    raise SystemExit(1)
print('admin-public-scan=PASS (added text only; synthetic domains permitted; binary/manual review remains required)')
