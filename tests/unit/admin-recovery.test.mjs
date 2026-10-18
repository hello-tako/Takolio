import {describe,it,expect} from 'vitest';
import {generateKeyPairSync,sign} from 'node:crypto';
import path from 'node:path';
import {canonical,verifyRecovery} from '../../scripts/admin-recovery.mjs';
import {signOwnerArtifact} from '../../scripts/admin-owner-sign.mjs';
import {SqliteD1,applyMigrations} from '../helpers/sqlite-d1';
describe('offline enrolled-owner recovery',()=>{
 function fixture(){
  const keys=Array.from({length:2},()=>generateKeyPairSync('ed25519'));
  const roster=keys.map((key,i)=>({operator_id:`recovery_${i}`,status:'active',recovery_key_algorithm:'Ed25519',recovery_public_key:key.publicKey.export({type:'spki',format:'pem'}).toString()}));
  const now=Date.now();const sourceSha='a'.repeat(40),databaseIdentity='synthetic-admin-db';
  const manifest={version:1,id:'recovery_test_01',sourceSha,databaseIdentity,targetUserId:'replacement_admin',issuedAt:new Date(now-1000).toISOString(),expiresAt:new Date(now+60000).toISOString()};
  const approvals=keys.map((key,i)=>({operatorId:roster[i].operator_id,signature:sign(null,Buffer.from(canonical(manifest)),key.privateKey).toString('base64url')}));
  return {keys,roster,manifest,approvals,options:{sourceSha,databaseIdentity,now}};
 }
 it('prepares exactly one valid owner signature offline and rejects an untrusted key',()=>{
  const f=fixture();const pem=f.keys[0].privateKey.export({type:'pkcs8',format:'pem'});
  const signed=signOwnerArtifact('recovery',f.manifest,f.roster[0].operator_id,pem,f.roster,f.options,f.options.now);
  expect(signed.approvals).toHaveLength(1);
  expect(verifyRecovery(signed.manifest,signed.approvals,f.roster,f.options).sql).toContain('admin_recovery_operations');
  expect(()=>signOwnerArtifact('recovery',f.manifest,'untrusted',pem,f.roster,f.options,f.options.now)).toThrow();
  expect(()=>signOwnerArtifact('unknown',f.manifest,f.roster[0].operator_id,pem,f.roster,f.options,f.options.now)).toThrow();
 });
 it('rejects duplicate, forged, expired, revoked, changed-source and changed-database approvals',()=>{
  const f=fixture();expect(verifyRecovery(f.manifest,f.approvals,f.roster,f.options).sql).toContain('admin_recovery_operations');
  expect(()=>verifyRecovery(f.manifest,[f.approvals[0],f.approvals[0]],f.roster,f.options)).toThrow();
  const sharedKeyRoster=f.roster.map(r=>({...r,recovery_public_key:f.roster[0].recovery_public_key}));
  const sharedKeyApprovals=f.approvals.map(a=>({...a,signature:f.approvals[0].signature}));
  expect(()=>verifyRecovery(f.manifest,sharedKeyApprovals,sharedKeyRoster,f.options)).toThrow('Distinct recovery signing keys required');
  expect(()=>verifyRecovery(f.manifest,f.approvals,[...f.roster,f.roster[0]],f.options)).toThrow('Unenrolled recovery approver');
  expect(()=>verifyRecovery({...f.manifest,targetUserId:'attacker'},f.approvals,f.roster,f.options)).toThrow();
  expect(()=>verifyRecovery(f.manifest,f.approvals,f.roster,{...f.options,now:Date.now()+120000})).toThrow();
  expect(()=>verifyRecovery(f.manifest,f.approvals,f.roster.map(r=>({...r,status:'revoked'})),f.options)).toThrow();
  expect(()=>verifyRecovery(f.manifest,f.approvals,f.roster,{...f.options,sourceSha:'b'.repeat(40)})).toThrow();
  expect(()=>verifyRecovery(f.manifest,f.approvals,f.roster,{...f.options,databaseIdentity:'wrong-db'})).toThrow();
 });
 it('applies a narrow grant with audit atomically and refuses replay, changed keys, revoked enrollment and audit failure with one owner key',async()=>{
  const f=fixture();f.approvals=f.approvals.slice(0,1);const db=new SqliteD1({migrate:false});applyMigrations(db,path.resolve('migrations-admin'));
  try{
   await db.prepare("INSERT INTO admin_database_identity VALUES('authority',?,'local')").bind(f.options.databaseIdentity).run();
   for(const r of [...f.roster,{operator_id:'replacement_operator',status:'active',recovery_key_algorithm:null,recovery_public_key:null}])db.seed(`INSERT INTO approved_human_operators(operator_id,approval_ref,approved_at,status,recovery_public_key,recovery_key_algorithm) VALUES('${r.operator_id}','synthetic-approval','now','active',${r.recovery_public_key?"'"+r.recovery_public_key+"'":'NULL'},${r.recovery_key_algorithm?"'Ed25519'":'NULL'})`);
   db.seed("INSERT INTO operator_identity_bindings(user_id,operator_id,access_iss,access_sub,approved_at,approval_ref,email,display_name) VALUES('replacement_admin','replacement_operator','https://test.cloudflareaccess.com','replacement-sub','now','synthetic-approval','replacement@example.test','Replacement')");
   const result=verifyRecovery(f.manifest,f.approvals,f.roster,f.options);
   db.seed("UPDATE approved_human_operators SET status='revoked' WHERE operator_id='recovery_0'");
   expect(()=>db.seed(result.sql)).toThrow('recovery authority');
   db.seed("UPDATE approved_human_operators SET status='active',recovery_public_key='changed-key' WHERE operator_id='recovery_0'");
   expect(()=>db.seed(result.sql)).toThrow('recovery authority');
   await db.prepare("UPDATE approved_human_operators SET recovery_public_key=? WHERE operator_id='recovery_0'").bind(f.roster[0].recovery_public_key).run();
   db.seed("UPDATE admin_database_identity SET identity='different-authority'");
   expect(()=>db.seed(result.sql)).toThrow('recovery authority');
   await db.prepare("UPDATE admin_database_identity SET identity=?").bind(f.options.databaseIdentity).run();
   db.seed("CREATE TRIGGER inject_failure BEFORE INSERT ON admin_audit_events BEGIN SELECT RAISE(ABORT,'injected'); END");
   expect(()=>db.seed(result.sql)).toThrow('injected');expect(db.query('SELECT COUNT(*) AS n FROM admin_role_assignments')[0].n).toBe(0);
   db.seed('DROP TRIGGER inject_failure');db.seed(result.sql);
   expect(db.query("SELECT COUNT(*) AS n FROM admin_audit_events WHERE action='admin.breakglass'")[0].n).toBe(1);
   expect(db.query("SELECT role FROM admin_role_assignments WHERE user_id='replacement_admin'")).toEqual([{role:'SUPER_ADMIN'}]);
   expect(()=>db.seed(result.sql)).toThrow();
  } finally{db.close();}
 });
});
