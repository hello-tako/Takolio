#!/usr/bin/env node
// Offline verifier/SQL generator. This tool never connects to Cloudflare.
import { createHash, createPublicKey, verify } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { sql } from './admin-local-lib.mjs';

const id = /^[A-Za-z0-9_-]{8,48}$/;
export function canonical(value) {
  return JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
}

export function verifyRecovery(manifest, approvals, roster, { sourceSha, databaseIdentity, now = Date.now() }) {
  const fields = ['version', 'id', 'sourceSha', 'databaseIdentity', 'targetUserId', 'issuedAt', 'expiresAt'];
  if (!manifest || canonical(Object.keys(manifest).sort()) !== canonical(fields.sort()) || manifest.version !== 1 ||
      !id.test(manifest.id) || !/^[A-Za-z0-9_.:@-]{1,128}$/.test(manifest.targetUserId)) {
    throw new Error('Invalid recovery manifest');
  }
  if (!/^[0-9a-f]{40}$/.test(sourceSha) || manifest.sourceSha !== sourceSha ||
      typeof databaseIdentity !== 'string' || databaseIdentity.length < 8 || databaseIdentity.length > 128 ||
      manifest.databaseIdentity !== databaseIdentity) throw new Error('Recovery source/database identity mismatch');
  const issued = Date.parse(manifest.issuedAt), expires = Date.parse(manifest.expiresAt);
  if (!Number.isFinite(issued) || !Number.isFinite(expires) || issued > now || expires <= now || expires - issued > 3600000) {
    throw new Error('Recovery authorization expired or exceeds one hour');
  }
  if (!Array.isArray(roster) || !Array.isArray(approvals) || approvals.length !== 2 ||
      new Set(approvals.map(a => a.operatorId)).size !== 2) throw new Error('Two distinct recovery approvers required');
  const fingerprints = new Set();
  const keys = approvals.map(approval => {
    const matches = roster.filter(row => row.operator_id === approval.operatorId && row.status === 'active' && row.recovery_key_algorithm === 'Ed25519');
    const operator = matches[0];
    if (matches.length !== 1 || !operator.recovery_public_key || !/^[A-Za-z0-9_-]{86}$/.test(approval.signature ?? '')) {
      throw new Error('Unenrolled recovery approver');
    }
    const key = createPublicKey(operator.recovery_public_key);
    if (key.asymmetricKeyType !== 'ed25519' || !verify(null, Buffer.from(canonical(manifest)), key, Buffer.from(approval.signature, 'base64url'))) {
      throw new Error('Invalid recovery signature');
    }
    fingerprints.add(createHash('sha256').update(key.export({ type: 'spki', format: 'der' })).digest('hex'));
    return operator.recovery_public_key;
  });
  if (fingerprints.size !== 2) throw new Error('Distinct recovery signing keys required');
  const digest = createHash('sha256').update(canonical(manifest)).digest('hex');
  return { manifestHash: digest, sql: `INSERT INTO admin_recovery_operations(id,manifest_hash,source_sha,database_identity,expires_at,executed_at,approval_operator_ids,target_user_id,approval_public_keys)
 VALUES(${sql(manifest.id)},${sql(digest)},${sql(sourceSha)},${sql(databaseIdentity)},${sql(new Date(expires).toISOString())},${sql(new Date(now).toISOString())},${sql(JSON.stringify(approvals.map(a => a.operatorId)))},${sql(manifest.targetUserId)},${sql(JSON.stringify(keys))});` };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [manifestPath, approvalPath, rosterPath, sourceSha, databaseIdentity, out] = process.argv.slice(2);
    if (!out) throw new Error('Usage: admin-recovery.mjs MANIFEST APPROVALS TRUSTED_ROSTER EXACT_SHA DATABASE_ID OUTPUT_SQL');
    const result = verifyRecovery(JSON.parse(readFileSync(manifestPath)), JSON.parse(readFileSync(approvalPath)), JSON.parse(readFileSync(rosterPath)), { sourceSha, databaseIdentity });
    writeFileSync(out, result.sql, { mode: 0o600, flag: 'wx' });
    console.log(JSON.stringify({ manifestHash: result.manifestHash, mode: 'offline-preparation-only', remoteExecuted: false }));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
