import { generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { digest, executeRelease, loadContext, validateAuthorization } from '../../scripts/admin-release-adapter.mjs';
import { signOwnerArtifact } from '../../scripts/admin-owner-sign.mjs';
import { executeStagingTestIdentity, validateStagingTestPayload } from '../../scripts/admin-staging-test-identities.mjs';

function fixture(operation = 'enroll-staging-test', environment = 'staging') {
  const keys = generateKeyPairSync('ed25519');
  const policy = JSON.parse(readFileSync('admin/release-policy.json', 'utf8'));
  const signer = { operatorId: 'fixture-owner', publicKey: keys.publicKey.export({ type: 'spki', format: 'pem' }), approvalRef: 'fixture-owner-review' };
  for (const target of Object.values(policy.environments)) target.custodians = [signer];
  const now = Date.now();
  const context = { environment, operation, sourceSha: 'a'.repeat(40), runId: '42', runAttempt: '1', migrationDigest: 'b'.repeat(64) };
  const manifest = { version: 1, id: 'qa_test_ceremony', ...context, policyDigest: digest(policy),
    issuedAt: new Date(now - 1000).toISOString(), expiresAt: new Date(now + 60000).toISOString(),
    payload: { userId: 'qa_fixture_user', operatorId: 'qa_fixture_operator', subject: 'signed-real-subject',
      email: 'owner+takolio-qa-content@example.test', displayName: 'QA Content', approvalRef: 'owner-qa-request' } };
  delete manifest.runAttempt;
  const sign = (m = manifest) => signOwnerArtifact('release', m, signer.operatorId, keys.privateKey.export({ type: 'pkcs8', format: 'pem' }), policy, context, now);
  return { policy, signer, context, manifest, sign, now };
}

describe('signed staging test identity boundaries', () => {
  it.each(['enroll-staging-test', 'revoke-staging-test'])('accepts an owner signature for %s only on the bound staging run', operation => {
    const f = fixture(operation);
    const signed = f.sign();
    expect(validateAuthorization(signed, f.policy, f.context, f.now).manifest.operation).toBe(operation);
    expect(() => validateAuthorization(signed, f.policy, { ...f.context, runId: '43' }, f.now)).toThrow('mismatch');
    expect(() => validateAuthorization(signed, f.policy, { ...f.context, sourceSha: 'c'.repeat(40) }, f.now)).toThrow('mismatch');
  });

  it.each(['enroll-staging-test', 'revoke-staging-test'])('rejects %s on production before credentials, checkout or network access', async operation => {
    const f = fixture(operation, 'production');
    expect(() => f.sign()).toThrow('staging-only');
    expect(() => loadContext('production', operation, {})).toThrow('staging-only');
    const query = vi.fn(), checkWrite = vi.fn();
    await expect(executeStagingTestIdentity({ manifest: f.manifest, target: {}, environment: 'production', query, checkWrite })).rejects.toThrow('staging-only');
    expect(query).not.toHaveBeenCalled();
    expect(checkWrite).not.toHaveBeenCalled();
  });

  it.each([
    { role: 'SUPER_ADMIN' }, { password: 'fixture-only' }, { recoveryPublicKey: 'key' }, { sql: 'arbitrary' }, { issuer: 'https://foreign.cloudflareaccess.com' },
  ])('rejects unsolicited authority/credential fields: %j', extra => {
    const f = fixture();
    expect(() => f.sign({ ...f.manifest, payload: { ...f.manifest.payload, ...extra } })).toThrow('payload');
  });

  it.each([
    { userId: 'owner' }, { operatorId: 'owner_operator' }, { subject: "subject' OR 1=1" },
    { email: 'owner@example.test' }, { email: 'owner+arbitrary@example.test' }, { email: 'owner+takolio-qa-a@invalid' },
    { displayName: ' ' }, { approvalRef: 'short' },
  ])('rejects malformed or unrestricted identities: %j', patch => {
    const f = fixture();
    expect(() => validateStagingTestPayload(f.context.operation, 'staging', { ...f.manifest.payload, ...patch })).toThrow('payload');
  });

  it('performs target, disabled-console, ledger and database checks before the QA mutation', async () => {
    const f = fixture();
    const authorized = validateAuthorization(f.sign(), f.policy, f.context, f.now);
    const calls = [];
    const provider = Object.fromEntries(['verifyTargets', 'verifyConsoleDisabled', 'verifyLedger', 'verifyDatabaseIdentity', 'stagingTestIdentity', 'deploymentVersions']
      .map(name => [name, vi.fn(async () => { calls.push(name); return {}; })]));
    const receipt = await executeRelease(authorized, f.context, provider);
    expect(calls).toEqual(['verifyTargets', 'verifyConsoleDisabled', 'verifyLedger', 'verifyDatabaseIdentity', 'stagingTestIdentity', 'verifyTargets', 'verifyConsoleDisabled', 'deploymentVersions']);
    expect(receipt).toMatchObject({ result: 'PASS', consoleEnabled: false, productionDeployed: false });
    provider.verifyConsoleDisabled.mockRejectedValueOnce(new Error('enabled'));
    provider.stagingTestIdentity.mockClear();
    await expect(executeRelease(authorized, f.context, provider)).rejects.toThrow('enabled');
    expect(provider.stagingTestIdentity).not.toHaveBeenCalled();
  });

  it('does not claim success after a failed postcondition', async () => {
    const f = fixture();
    const checkWrite = vi.fn();
    const query = vi.fn(async () => []);
    await expect(executeStagingTestIdentity({ manifest: f.manifest, signer: f.signer,
      target: { custodians: [f.signer], issuer: f.policy.environments.staging.issuer }, environment: 'staging', query, checkWrite, digest }))
      .rejects.toThrow('postcondition');
    expect(checkWrite).toHaveBeenCalledOnce();
    expect(query).toHaveBeenCalledTimes(2);
  });
});

it('the provider certifies the actual current migration/schema manifest and rejects a stale schema marker', async () => {
  const { readdirSync } = await import('node:fs');
  const { execFileSync } = await import('node:child_process');
  const { createProvider } = await import('../../scripts/admin-release-provider.mjs');
  const f = fixture();
  const authorized = validateAuthorization(f.sign(), f.policy, f.context, f.now);
  const migrations = readdirSync('migrations-admin').filter(name => name.endsWith('.sql')).sort()
    .map(name => ({ name, sha256: digest(readFileSync(`migrations-admin/${name}`)) }));
  const objects = JSON.parse(execFileSync('python3', ['-c', `import sqlite3,json,pathlib
c=sqlite3.connect(':memory:')
for p in sorted(pathlib.Path('migrations-admin').iterdir()):
 if p.name.endswith('.sql'): c.executescript(p.read_text())
q="SELECT type,name,tbl_name,sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY type,name"
print(json.dumps([dict(zip(['type','name','tbl_name','sql'],r)) for r in c.execute(q)]))`], { encoding: 'utf8' }));
  let version = '5';
  const fetcher = vi.fn(async (url, init) => {
    expect(url).toBe(`https://api.cloudflare.com/client/v4/accounts/${authorized.target.accountId}/d1/database/${authorized.target.adminDatabaseId}/query`);
    const { sql } = JSON.parse(init.body);
    let rows;
    if (sql.includes("type='table'")) rows = [{ name: 'd1_migrations' }];
    else if (sql.includes('FROM d1_migrations')) rows = migrations.map(({ name }) => ({ name }));
    else if (sql.includes('schema_version')) rows = [{ value: version }];
    else if (sql.includes('sqlite_master')) rows = objects;
    else if (sql === 'PRAGMA quick_check') rows = [{ quick_check: 'ok' }];
    else if (sql === 'PRAGMA foreign_key_check') rows = [];
    else throw new Error('Unexpected provider SQL');
    return Response.json({ success: true, result: [{ success: true, results: rows }] });
  });
  const provider = createProvider(authorized, f.context, { CLOUDFLARE_API_TOKEN: 'synthetic-offline' }, fetcher);
  await expect(provider.verifyLedger(authorized.target, migrations, true)).resolves.toBeUndefined();
  version = '4';
  await expect(provider.verifyLedger(authorized.target, migrations, true)).rejects.toThrow('Admin schema version mismatch');
});
