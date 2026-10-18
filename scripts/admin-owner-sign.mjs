#!/usr/bin/env node
// Offline only. The key stays in its owner-provided file; outputs are private.
import { createPrivateKey, sign } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { canonical, verifyRecovery } from './admin-recovery.mjs';
import { validateAuthorization, validateStagingReport, validateStagingCertificate } from './admin-release-adapter.mjs';

export function signOwnerArtifact(kind, manifest, operatorId, privateKeyPem, trust, context, now = Date.now()) {
  const key = createPrivateKey(privateKeyPem);
  if (key.asymmetricKeyType !== 'ed25519') throw new Error('Owner key must be Ed25519');
  const approvals = [{ operatorId, signature: sign(null, Buffer.from(canonical(manifest)), key).toString('base64url') }];
  const bundle = { manifest, approvals };
  if (kind === 'release') validateAuthorization(bundle, trust, context, now);
  else if (kind === 'staging-report') validateStagingReport(bundle, trust, context, now);
  else if (kind === 'staging-certificate') validateStagingCertificate(bundle, trust, context, now);
  else if (kind === 'recovery') verifyRecovery(manifest, approvals, trust, { ...context, now });
  else throw new Error('Unknown owner artifact kind');
  return bundle;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [kind, manifestFile, operatorId, keyFile, trustFile, contextFile, output, ...extra] = process.argv.slice(2);
    if (!output || extra.length) throw new Error('Invalid signing arguments');
    const bundle = signOwnerArtifact(kind, JSON.parse(readFileSync(manifestFile, 'utf8')), operatorId,
      readFileSync(keyFile, 'utf8'), JSON.parse(readFileSync(trustFile, 'utf8')), JSON.parse(readFileSync(contextFile, 'utf8')));
    writeFileSync(output, JSON.stringify(bundle, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    console.log(JSON.stringify({ mode: 'offline-owner-signature', remoteExecuted: false, outputCreated: true }));
  } catch {
    console.error('Owner signing failed. Use: admin-owner-sign.mjs KIND MANIFEST OPERATOR_ID KEY TRUST CONTEXT NEW_OUTPUT. No key material is printed.');
    process.exitCode = 1;
  }
}
