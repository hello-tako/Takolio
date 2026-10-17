import {afterAll,afterEach,beforeAll,describe,expect,it} from 'vitest';
import {buildBootstrapAdminSql} from '../../scripts/admin-local-lib.mjs';
import {call,closeDatabases,createDatabases,fx,localEnv,login,setLocalAuthBuild,type Databases} from '../helpers/admin-harness';
import {checkAdminGovernanceReadiness,verifyEnrolledAdminAccessIdentity} from '../../src/worker/routes/admin/governance';
let dbs:Databases|undefined;
beforeAll(()=>setLocalAuthBuild(true));afterAll(()=>setLocalAuthBuild(false));afterEach(()=>{closeDatabases(dbs);dbs=undefined;});
describe('R2 governance invariants',()=>{
 it('F3/F11: exact issuer and subject are required even with the same email',async()=>{
  dbs=createDatabases();
  expect(await verifyEnrolledAdminAccessIdentity(dbs.admin,{issuer:'https://fixture.cloudflareaccess.com',subject:'fx-sub-super'})).toMatchObject({userId:'fx_admin_super'});
  expect(await verifyEnrolledAdminAccessIdentity(dbs.admin,{issuer:'https://fixture.cloudflareaccess.com',subject:'reassigned-email-new-sub'})).toBeNull();
  expect(()=>dbs!.admin.seed("INSERT INTO operator_identity_bindings(user_id,operator_id,access_iss,access_sub,approved_at,approval_ref,email,display_name) VALUES('different','operator_super','https://fixture.cloudflareaccess.com','another-sub','now','approved-reference','same@example.test','Same')")).toThrow();
 });
 it('F2: requires three approved active operators for production readiness',async()=>{
  dbs=createDatabases();expect(await checkAdminGovernanceReadiness(dbs.admin,'https://fixture.cloudflareaccess.com')).toEqual({ready:true,activeOperators:3});
  dbs.admin.seed("UPDATE approved_human_operators SET status='revoked' WHERE operator_id='operator_super3'");
  expect(await checkAdminGovernanceReadiness(dbs.admin,'https://fixture.cloudflareaccess.com')).toEqual({ready:false,activeOperators:2});
 });
 it('F5: an injected audit failure rolls back every bootstrap grant and closure',()=>{
  dbs=createDatabases({seed:false});
  for(let i=1;i<=3;i+=1)dbs.admin.seed(`INSERT INTO approved_human_operators(operator_id,approval_ref,approved_at) VALUES('operator_${i}','independent-approval','now');INSERT INTO operator_identity_bindings(user_id,operator_id,access_iss,access_sub,approved_at,approval_ref,email,display_name) VALUES('user_${i}','operator_${i}','https://test.cloudflareaccess.com','sub_${i}','now','independent-approval','${i}@example.test','Operator ${i}')`);
  const sql=buildBootstrapAdminSql({userIds:['user_1','user_2','user_3'],ceremonyId:'ceremony_test_01',independentApprovalRef:'independent-approval'});
  dbs.admin.seed("CREATE TRIGGER inject_audit_failure BEFORE INSERT ON admin_audit_events BEGIN SELECT RAISE(ABORT,'injected'); END;");
  expect(()=>dbs!.admin.seed(sql)).toThrow('injected');
  for(const table of ['admin_bootstrap_ceremonies','admin_role_assignments','admin_audit_events'])expect(dbs.admin.query(`SELECT COUNT(*) AS n FROM ${table}`)[0]).toEqual({n:0});
  expect(dbs.admin.query("SELECT value FROM admin_config_metadata WHERE key='bootstrap_completed_at'")).toEqual([]);
  dbs.admin.seed('DROP TRIGGER inject_audit_failure');dbs.admin.seed(sql);
  expect(dbs.admin.query('SELECT COUNT(*) AS n FROM admin_role_assignments')[0]).toEqual({n:3});
  expect(dbs.admin.query('SELECT COUNT(*) AS n FROM admin_audit_events')[0]).toEqual({n:1});
  expect(()=>dbs!.admin.seed(sql)).toThrow();
  expect(()=>dbs!.admin.seed("INSERT INTO admin_role_assignments(id,user_id,role,grant_source)VALUES('extra_bootstrap','other','SUPER_ADMIN','operator_bootstrap')")).toThrow();
 });
 it('F4: concurrent decisions apply once and retain one matching success audit',async()=>{
  dbs=createDatabases();const env=localEnv(dbs);const requester=await login(env,fx('super'));const decider=await login(env,fx('super2'));
  const requested=await call('/api/v1/admin/roles',{env,method:'POST',session:requester,body:{userId:'fx_user_003',role:'SUPER_ADMIN'}});expect(requested.status).toBe(201);
  const id=requested.json.data.approval.id;
  const results=await Promise.all(Array.from({length:5},()=>call(`/api/v1/admin/approvals/${id}/approve`,{env,method:'POST',session:decider})));
  expect(results.filter(r=>r.status===200)).toHaveLength(1);expect(results.filter(r=>r.status===409)).toHaveLength(4);
  expect(dbs.admin.query("SELECT COUNT(*) AS n FROM admin_role_assignments WHERE user_id='fx_user_003' AND role='SUPER_ADMIN'")[0]).toEqual({n:1});
  expect(dbs.admin.query("SELECT COUNT(*) AS n FROM admin_audit_events WHERE action='admin.approval.approve'")[0]).toEqual({n:1});
 });
});
