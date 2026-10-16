import type { D1DatabaseBinding } from '@frigo/db';
import { localPasswordAuthCompiled } from './policy';
import { verifyPassword } from '../../utils/password';
import { sha256Hex } from '../../utils/session';

/** Separate Admin authority credentials, available only in local builds. */
export async function localAuthorityAccount(db: D1DatabaseBinding, email: string, password: string | null) {
  if (!localPasswordAuthCompiled()) return null;
  const row = await db.prepare(`SELECT c.user_id,c.email,c.display_name,c.password_hash,c.salt,b.security_epoch
    FROM admin_local_credentials c JOIN operator_identity_bindings b ON b.user_id=c.user_id AND b.status='active'
    JOIN approved_human_operators h ON h.operator_id=b.operator_id AND h.status='active' WHERE c.email=? LIMIT 1`)
    .bind(email).first<{user_id:string;email:string;display_name:string;password_hash:string;salt:string;security_epoch:number}>();
  if (!row || (password !== null && !(await verifyPassword(password, row.salt, row.password_hash)))) return null;
  return {id:row.user_id,user_id:row.user_id,is_verified:1,is_guest:0,email:row.email,display_name:row.display_name,
    credentialFingerprint:await sha256Hex(`admin-local-v2:${row.password_hash}:${row.salt}:${row.security_epoch}`)};
}
