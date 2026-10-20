// Payload validation is independent of provider credentials; no identity is invented here.
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) &&
  JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
export const STAGING_TEST_OPERATIONS = ['enroll-staging-test', 'revoke-staging-test'];
export function validateStagingTestPayload(operation, environment, payload) {
  if (!STAGING_TEST_OPERATIONS.includes(operation) || environment !== 'staging' ||
      !exact(payload, ['userId', 'operatorId', 'subject', 'email', 'displayName', 'approvalRef']) ||
      !/^qa_[A-Za-z0-9_-]{5,61}$/.test(payload.userId) || !/^qa_[A-Za-z0-9_-]{5,61}$/.test(payload.operatorId) ||
      typeof payload.subject !== 'string' || !/^[A-Za-z0-9_.:@-]{1,128}$/.test(payload.subject) ||
      typeof payload.email !== 'string' || payload.email.length > 254 ||
      !/^[a-z0-9._-]+\+takolio-qa-[a-z0-9-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(payload.email) ||
      typeof payload.displayName !== 'string' || !payload.displayName.trim() || payload.displayName.length > 200 ||
      typeof payload.approvalRef !== 'string' || payload.approvalRef.length < 8 || payload.approvalRef.length > 200) {
    throw new Error('Invalid staging-only test identity payload');
  }
  return payload;
}
export async function executeStagingTestIdentity({ manifest, signer, target, environment, checkWrite, query, digest }) {
  const operation = manifest.operation;
  const p = validateStagingTestPayload(operation, environment, manifest.payload);
  if (!signer || !target.custodians?.some(c => c.operatorId === signer.operatorId && c.publicKey === signer.publicKey)) {
    throw new Error('Trusted owner signer required');
  }
  await checkWrite();
  // One statement invokes all authority checks, enrollment/cleanup and mandatory audit atomically.
  await query(`INSERT INTO admin_staging_test_ceremonies
    (id,operation,user_id,operator_id,access_iss,access_sub,email,display_name,owner_operator_id,owner_public_key,approval_ref,manifest_hash,expires_at,executed_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [manifest.id, operation === 'enroll-staging-test' ? 'enroll' : 'revoke', p.userId, p.operatorId,
    target.issuer, p.subject, p.email, p.displayName, signer.operatorId, signer.publicKey, p.approvalRef, digest(manifest), manifest.expiresAt, new Date().toISOString()]);
  const rows = await query(`SELECT c.operation,b.status AS identity_status,h.status AS operator_status,
    (SELECT COUNT(*) FROM admin_role_assignments WHERE user_id=c.user_id AND status='active') AS roles,
    (SELECT COUNT(*) FROM admin_sessions WHERE user_id=c.user_id AND revoked_at IS NULL) AS sessions,
    (SELECT COUNT(*) FROM admin_audit_events WHERE id='evt_'||c.id AND action='admin.staging_test.'||c.operation AND outcome='success') AS audits
    FROM admin_staging_test_ceremonies c JOIN operator_identity_bindings b ON b.user_id=c.user_id
    JOIN approved_human_operators h ON h.operator_id=c.operator_id WHERE c.id=?`, [manifest.id]);
  const status = operation === 'enroll-staging-test' ? 'active' : 'revoked';
  if (rows.length !== 1 || rows[0].operation !== (status === 'active' ? 'enroll' : 'revoke') ||
      rows[0].identity_status !== status || rows[0].operator_status !== status || rows[0].roles !== 0 || rows[0].sessions !== 0 || rows[0].audits !== 1) {
    throw new Error('Staging QA identity postcondition failed');
  }
}
