import re, subprocess, sys, collections
PATTERNS = {
 'github_token': r'gh[pousr]_[A-Za-z0-9]{30,}',
 'github_fine_grained_pat': r'github_pat_[A-Za-z0-9_]{30,}',
 'cloudflare_token': r'\b(cfut|cfat|cfk)_[A-Za-z0-9_-]{30,}',
 'aws_access_key': r'\bAKIA[0-9A-Z]{16}\b',
 'private_key_block': r'-----BEGIN (RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY',
 'slack_token': r'\bxox[abprs]-[0-9A-Za-z-]{10,}',
 'google_api_key': r'\bAIza[0-9A-Za-z_-]{35}\b',
 'openai_like_key': r'\bsk-[A-Za-z0-9]{32,}',
 'jwt_like': r'\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}',
 'host_session_cookie_value': r'__Host-[A-Za-z_]*(session|csrf)=[0-9a-f]{40,}',
 'bearer_header': r'[Aa]uthorization:\s*Bearer\s+[A-Za-z0-9._~+/=-]{16,}',
 'secret_assignment': r'(?i)\b(password|passwd|secret|token|api[_-]?key|private[_-]?key|checksum[_-]?key)\b\s*[:=]\s*["\']?[A-Za-z0-9/+_.!@#$%^&*-]{16,}',
 'modal_connect_token': r'_modal_connect_token=',
 'hoplite_internal_url': r'(api\.hoplite\.sh|\.preview\.usehoplite\.com)',
 'email_address': r'[A-Za-z0-9._%+-]{2,}@[A-Za-z0-9.-]+\.[A-Za-z]{2,}',
 'sha256_like_64hex': r'\b[0-9a-f]{64}\b',
 'uuid_like': r'\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b',
}
COMPILED = {k: re.compile(v) for k, v in PATTERNS.items()}
def redact(line, rx):
    return rx.sub(lambda m: f'[{len(m.group(0))}ch]', line).strip()[:160]
def tree_scan(ref):
    files = subprocess.run(['git', 'ls-tree', '-r', '--name-only', ref], capture_output=True, text=True).stdout.split('\n')
    counts = collections.Counter(); examples = collections.defaultdict(list)
    for f in files:
        if not f or f.endswith(('.png', '.jpg', '.zip', '.woff2', '.gz')): continue
        blob = subprocess.run(['git', 'show', f'{ref}:{f}'], capture_output=True).stdout
        if b'\0' in blob[:8000]: continue
        for n, line in enumerate(blob.decode('utf-8', 'replace').split('\n'), 1):
            for k, rx in COMPILED.items():
                if rx.search(line):
                    counts[k] += 1
                    if len(examples[k]) < 4: examples[k].append(f'{f}:{n}: {redact(line, rx)}')
    return counts, examples
def history_scan(rng):
    patch = subprocess.run(['git', 'log', '-p', '--no-color', '-U0', rng, '--', '.', ':!*.png', ':!*.zip'], capture_output=True, text=True).stdout
    counts = collections.Counter(); examples = collections.defaultdict(list); current = None
    for line in patch.split('\n'):
        if line.startswith('+++ b/'): current = line[6:]; continue
        if not line.startswith('+') or line.startswith('+++'): continue
        for k, rx in COMPILED.items():
            if rx.search(line[1:]):
                counts[k] += 1
                if len(examples[k]) < 4: examples[k].append(f'{current}: {redact(line[1:], rx)}')
    return counts, examples
mode, target = sys.argv[1], sys.argv[2]
counts, examples = tree_scan(target) if mode == 'tree' else history_scan(target)
print(f'## {mode} scan of {target}')
for k in PATTERNS:
    if counts[k]:
        print(f'{k}: {counts[k]} line(s)')
        for ex in examples[k][:4]: print('    ' + ex)
    else:
        print(f'{k}: 0')
