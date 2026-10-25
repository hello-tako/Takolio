import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const scan = (line) => spawnSync('python3', ['-c', `
import json, runpy, sys
from unittest.mock import patch
line = json.load(sys.stdin)
diff = '+++ b/evidence.json\\n+' + line + '\\n'
with patch('subprocess.check_output', side_effect=[diff, '']):
    runpy.run_path('scripts/admin-public-scan.py', run_name='__main__')
`], { input: JSON.stringify(line), encoding: 'utf8' });
const guest = 'guest' + '@' + 'frigo.local';
const packagePatch = 'braces' + '@' + '3.0.3.patch';
const realEmail = 'person' + '@' + 'company.com';

describe('public patch scanner', () => {
  it.each([
    `"path": "patches/${packagePatch}",`,
    JSON.stringify({ email: guest }),
    'person' + '@' + 'example.test',
  ])('accepts reviewed synthetic evidence: %s', (line) => {
    const result = scan(line);
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).toContain('admin-public-scan=PASS');
  });

  it.each([
    JSON.stringify({ email: realEmail }),
    'other' + '@' + 'frigo.local',
    guest + '.com',
    `"email": "${packagePatch}"`,
    `"path": "patches/${packagePatch}.bak",`,
    `"path": "patches/${packagePatch}", "email": "${realEmail}"`,
    `"path": "patches/${packagePatch}", "token": "ghp_${'a'.repeat(36)}"`,
    JSON.stringify({ email: guest, token: `ghp_${'a'.repeat(36)}` }),
  ])('rejects real contacts, lookalikes, credentials: %s', (line) => {
    const result = scan(line);
    expect(result.status, result.stdout + result.stderr).toBe(1);
    expect(result.stdout).toContain('evidence.json:');
    expect(result.stdout).not.toContain(realEmail);
    expect(result.stdout).not.toContain('a'.repeat(36));
  });
});
