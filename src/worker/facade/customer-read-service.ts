import type { D1DatabaseBinding } from '@frigo/db';
import { operationInputs, verifyCapability, type CustomerReadBinding, type ReadOperation, type ReadCapability } from './contract';
import { getUser, listUsers, listHouseholds, userLabels } from './people';
import { getRecipe, listRecipes, recipesSummary } from './recipes';
import { aiSummary, billingSummary, listAiUsage, listTransactions } from './billing-ai';
import { buildOverview } from './overview';
import { budgetedDatabase } from './query-budget';
import { validateOutput } from './output-contract';

// A second boundary after SQL projection. Never serialize unknown object keys.
export function assertSafeOutput(value:unknown, depth=0):void {
  if(depth>16) throw new Error('FACADE_OUTPUT_INVALID');
  if(value===null || typeof value==='boolean') return;
  if(typeof value==='string') { if(value.length>8192) throw new Error('FACADE_OUTPUT_INVALID'); return; }
  if(typeof value==='number') { if(!Number.isFinite(value)) throw new Error('FACADE_OUTPUT_INVALID'); return; }
  if(Array.isArray(value)) { if(value.length>1000) throw new Error('FACADE_OUTPUT_INVALID'); value.forEach(v=>assertSafeOutput(v,depth+1)); return; }
  if(typeof value!=='object') throw new Error('FACADE_OUTPUT_INVALID');
  for(const [key,entry] of Object.entries(value)) {
    if(/password|salt|token_hash|credential|secret|google_id|access_token|refresh_token/i.test(key)) throw new Error('FACADE_OUTPUT_INVALID');
    assertSafeOutput(entry,depth+1);
  }
}
export function createCustomerReadFacade(database:D1DatabaseBinding, options:{secret:string}):CustomerReadBinding {
  return { async read(operation:ReadOperation, raw:unknown, capability:ReadCapability):Promise<unknown> {
    if(!Object.hasOwn(operationInputs,operation)) throw new Error('FACADE_OPERATION_INVALID');
    const schema=operationInputs[operation]; const input=schema.parse(raw);
    await verifyCapability(options.secret,operation,raw,capability);
    const db = budgetedDatabase(database);
    let result:unknown;
    // Each branch parses its named input independently to preserve inferred types.
    switch(operation) {
      case 'users.list': {const {adminIds,emailSearch,...q}=operationInputs[operation].parse(input); result=await listUsers(db,new Set(adminIds),q,{emailSearch});break;}
      case 'users.get': {const q=operationInputs[operation].parse(input); result=await getUser(db,q.id,q.reveal);break;}
      case 'users.eligible': {const q=operationInputs[operation].parse(input); result=!!await db.prepare(`SELECT u.id FROM users u WHERE u.id=? AND u.is_guest=0 AND EXISTS(SELECT 1 FROM auth_accounts a WHERE a.user_id=u.id AND a.is_verified=1) LIMIT 1`).bind(q.id).first();break;}
      case 'users.labels': {const q=operationInputs[operation].parse(input); result=Object.fromEntries(await userLabels(db,q.ids));break;}
      case 'households.list': result=await listHouseholds(db,operationInputs[operation].parse(input));break;
      case 'recipes.list': result=await listRecipes(db,operationInputs[operation].parse(input));break;
      case 'recipes.get': result=await getRecipe(db,operationInputs[operation].parse(input).id);break;
      case 'recipes.version': result=(await db.prepare('SELECT version FROM recipes WHERE id=? LIMIT 1').bind(operationInputs[operation].parse(input).id).first<{version:number}>())?.version??null;break;
      case 'recipes.summary': result=await recipesSummary(db,operationInputs[operation].parse(input).catalogMode);break;
      case 'billing.summary': result=await billingSummary(db,operationInputs[operation].parse(input).range);break;
      case 'billing.transactions': result=await listTransactions(db,operationInputs[operation].parse(input));break;
      case 'ai.summary': result=await aiSummary(db,operationInputs[operation].parse(input).range);break;
      case 'ai.usage': result=await listAiUsage(db,operationInputs[operation].parse(input));break;
      case 'overview': result=await buildOverview(db,operationInputs[operation].parse(input).range,[]);break;
      case 'system': {const rows=await db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name IN ('users','auth_accounts','sessions_v2','payment_intents','subscriptions','ai_requests','scan_queue_jobs','recipes') LIMIT 8`).all<{name:string}>();result={reachable:true,tables:rows.results.map(r=>r.name)};break;}
    }
    result = validateOutput(operation, result);
    assertSafeOutput(result);
    if(JSON.stringify(result).length>512_000) throw new Error('FACADE_OUTPUT_INVALID');
    return result;
  } };
}
