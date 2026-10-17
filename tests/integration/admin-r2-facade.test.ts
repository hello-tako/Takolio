import {afterAll,afterEach,beforeAll,describe,expect,it} from 'vitest';
import {createCustomerReadFacade} from '../../src/worker/facade/customer-read-service';
import {operationInputs,signCapability,type ReadOperation} from '../../src/worker/facade/contract';
import {budgetedDatabase,boundedSql,MAX_SOURCE_ROWS} from '../../src/worker/facade/query-budget';
import {validateOutput} from '../../src/worker/facade/output-contract';
import {call,createDatabases,closeDatabases,localEnv,login,fx,setLocalAuthBuild,type Databases} from '../helpers/admin-harness';
const secret='local-facade-fixture-secret-32-characters';
let dbs:Databases|undefined;
beforeAll(()=>setLocalAuthBuild(true));afterAll(()=>setLocalAuthBuild(false));afterEach(()=>{closeDatabases(dbs);dbs=undefined;});
const actor={userId:'fx_admin_super',sessionId:'asess_test_001',roles:['SUPER_ADMIN'] as ['SUPER_ADMIN']};
describe('F1 named facade boundary',()=>{
 it('has a single enumerated RPC method and refuses arbitrary SQL or oversized input',async()=>{
  dbs=createDatabases();const facade=createCustomerReadFacade(dbs.main,{secret});
  expect(Object.keys(facade)).toEqual(['read']);
  const cap=await signCapability(secret,'users.get',{id:'fx_user_001',reveal:false},actor);
  await expect(facade.read('sql' as ReadOperation,{sql:'DELETE FROM users'},cap)).rejects.toThrow();
  await expect(facade.read('users.get',{id:'fx_user_001',reveal:false,sql:'SELECT password_hash'},cap)).rejects.toThrow();
  await expect(facade.read('users.list',{page:1,pageSize:101,type:'all',adminIds:[],emailSearch:false},cap)).rejects.toThrow();
  expect(Object.keys(operationInputs)).toHaveLength(15);
 });
 it('requires an authentic server capability bound to exact inputs and permission',async()=>{
  dbs=createDatabases();const facade=createCustomerReadFacade(dbs.main,{secret});const input={id:'fx_user_001',reveal:false};
  const cap=await signCapability(secret,'users.get',input,actor);
  const result=await facade.read('users.get',input,cap) as Record<string,unknown>;
  expect(result.email).toBeNull();expect(result.emailMasked).toBeTruthy();
  await expect(facade.read('users.get',{...input,reveal:true},cap)).rejects.toThrow();
  await expect(facade.read('users.get',input,{...cap,signature:'0'.repeat(64)})).rejects.toThrow();
  const denied=await signCapability(secret,'users.get',{...input,reveal:true},{...actor,roles:['OPERATIONS_ADMIN']});
  await expect(facade.read('users.get',{...input,reveal:true},denied)).rejects.toThrow();
 });
 it('never passes credential material to Admin, and audit failure prevents disclosure',async()=>{
  dbs=createDatabases();const env=localEnv(dbs);const session=await login(env,fx('support'));
  const events:string[]=[];dbs.main.hooks.beforeStatement=e=>{events.push(e.sql);};
  const viewed=await call('/api/v1/admin/users/fx_user_001',{env,session});expect(viewed.status).toBe(200);
  expect(viewed.text).not.toMatch(/password_hash|salt|token_hash|credential_fingerprint/);
  let disclosed=false;dbs.main.hooks.beforeStatement=()=>{disclosed=true;};
  dbs.admin.hooks.beforeStatement=e=>{if(e.sql.includes('INSERT INTO admin_audit_events'))throw new Error('injected audit failure');};
  expect((await call('/api/v1/admin/users/fx_user_001?reveal=email',{env,session})).status).toBe(503);
  expect(disclosed).toBe(false);expect(events.length).toBeGreaterThan(0);
 });
 it('F7: indexed materialization bounds base reads and refuses oversized data even for empty results',async()=>{
  dbs=createDatabases();
  const query="SELECT COUNT(*) AS n FROM users WHERE is_guest=0";
  const plan=dbs.main.query<{detail:string}>('EXPLAIN QUERY PLAN '+boundedSql(query));
  expect(plan.some(row=>/SEARCH main.users USING INDEX.*id>/.test(row.detail))).toBe(true);
  const bounded=budgetedDatabase(dbs.main);
  expect((await bounded.prepare(query).first<{n:number}>())!.n).toBeGreaterThan(0);
  dbs.main.seed(`WITH RECURSIVE n(i) AS(VALUES(1) UNION ALL SELECT i+1 FROM n WHERE i<${MAX_SOURCE_ROWS+1}) INSERT INTO users(id,is_guest) SELECT 'budget_'||i,1 FROM n`);
  await expect(budgetedDatabase(dbs.main).prepare(query).first()).rejects.toThrow('FACADE_DATASET_LIMIT');
  await expect(budgetedDatabase(dbs.main).prepare("SELECT id FROM users WHERE id='absent'").all()).rejects.toThrow('FACADE_DATASET_LIMIT');
  const env=localEnv(dbs);const session=await login(env,fx('super'));
  expect((await call('/api/v1/admin/users',{env,session})).status).toBe(503);
 });
 it('F1: all named operations enforce output schemas and reject undisclosed fields',()=>{
  expect(()=>validateOutput('users.eligible',true)).not.toThrow();
  expect(()=>validateOutput('users.eligible',{allowed:true})).toThrow();
  expect(()=>validateOutput('system',{reachable:true,tables:[],email:'leak@example.test'})).toThrow();
  expect(()=>validateOutput('recipes.version',NaN)).toThrow();
 });

});
