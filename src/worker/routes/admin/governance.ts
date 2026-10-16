import { ADMIN_SUPER_ADMIN_MINIMUM } from '../../../shared/admin';
import type { D1DatabaseBinding } from '@frigo/db';
import { sha256Hex } from '../../utils/session';
export interface EnrolledIdentity { userId:string;operatorId:string;issuer:string;subject:string;email:string;displayName:string;credentialFingerprint:string }
export async function verifyEnrolledAdminAccessIdentity(db:D1DatabaseBinding,identity:{issuer:string;subject:string}):Promise<EnrolledIdentity|null> {
 const row=await db.prepare(`SELECT b.user_id,b.operator_id,b.access_iss,b.access_sub,b.email,b.display_name,b.security_epoch FROM operator_identity_bindings b JOIN approved_human_operators h ON h.operator_id=b.operator_id AND h.status='active' WHERE b.access_iss=? AND b.access_sub=? AND b.status='active' LIMIT 1`).bind(identity.issuer,identity.subject).first<{user_id:string;operator_id:string;access_iss:string;access_sub:string;email:string;display_name:string;security_epoch:number}>();
 if(!row)return null;
 return {userId:row.user_id,operatorId:row.operator_id,issuer:row.access_iss,subject:row.access_sub,email:row.email,displayName:row.display_name,credentialFingerprint:await sha256Hex(`admin-authority-v2:${row.user_id}:${row.access_iss}:${row.access_sub}:${row.security_epoch}`)};
}
export async function checkAdminGovernanceReadiness(db:D1DatabaseBinding,issuer?:string):Promise<{ready:boolean;activeOperators:number}> {
 const row=await db.prepare(`SELECT COUNT(DISTINCT b.operator_id) AS n FROM admin_role_assignments r JOIN operator_identity_bindings b ON b.user_id=r.user_id AND b.status='active' JOIN approved_human_operators h ON h.operator_id=b.operator_id AND h.status='active' WHERE r.role='SUPER_ADMIN' AND r.status='active' AND (? IS NULL OR b.access_iss=?)`).bind(issuer??null,issuer??null).first<{n:number}>();
 const bootstrapped=await db.prepare("SELECT value FROM admin_config_metadata WHERE key='bootstrap_completed_at'").first();
 return {ready:!!bootstrapped && Number(row?.n??0)>=ADMIN_SUPER_ADMIN_MINIMUM,activeOperators:Number(row?.n??0)};
}
export async function authorityAccount(db:D1DatabaseBinding,identity:{issuer:string;subject:string}) {
 const enrolled=await verifyEnrolledAdminAccessIdentity(db,identity); if(!enrolled)return null;
 return {id:enrolled.userId,user_id:enrolled.userId,is_verified:1,is_guest:0,email:enrolled.email,display_name:enrolled.displayName,credentialFingerprint:enrolled.credentialFingerprint};
}
