import type { D1DatabaseBinding, D1PreparedStatement } from '@frigo/db';
import { assertReadOnlySql } from '../routes/admin/readonly-db';

export const MAX_SOURCE_ROWS = 5000;
export const MAX_OPERATION_QUERIES = 40;
// Static projections exclude raw credentials before any query executes.
const tables: Record<string, [string, string]> = {
  users:['id','id,email,is_guest,created_at'],
  profiles:['id','id,user_id,display_name,onboarding_completed_at'],
  auth_accounts:['id','id,user_id,email,is_verified,password_hash IS NOT NULL AS has_password,google_id IS NOT NULL AS has_google'],
  sessions_v2:['id','id,user_id,revoked_at,expires_at,last_seen_at,created_at'],
  subscriptions:['id','id,user_id,plan,status,expires_at'],
  households:['id','id,name,created_by,created_at'],
  household_members:['id','id,household_id,user_id,role'],
  inventory_items:['id','id,household_id'],
  payment_intents:['id','id,user_id,order_code,plan,amount_vnd,status,created_at,updated_at,expires_at'],
  ai_requests:['id','id,task,provider,model,input_tokens,output_tokens,latency_ms,estimated_cost,status,created_at'],
  scans:['id','id,user_id,status,created_at'],
  scan_queue_jobs:['id','id,status,attempts,max_attempts,error_code,created_at,updated_at'],
  recipes:['id','id,slug,title,cuisine,difficulty,cook_time_minutes,source_type,verification_state,version,created_at,description,servings,prep_time_minutes,tags,source_reference,family_id'],
  recipe_media:['id','id,recipe_id,role,version,status,source_type,mime_type'],
  recipe_ingredients:['id','id,recipe_id'],
  recipe_steps:['id','id,recipe_id'],
  checkout_admissions:['user_id','user_id,state'],
  payment_reconciliation_records:['intent_id','intent_id,reason,first_observed_at,last_observed_at'],
};

/** Bound all base-table reads in the same SQLite snapshot as the result.
 * Capped materialized CTEs prevent concurrent inserts bypassing the budget.
 * The guard rejects oversize sources instead of returning sampled totals.
 */
export function boundedSql(sql: string): string {
  assertReadOnlySql(sql);
  if (!/^\s*SELECT\b/i.test(sql)) throw new Error('FACADE_QUERY_FORBIDDEN');
  const names = [...new Set([...sql.matchAll(/\b(?:FROM|JOIN)\s+([a-z_][a-z0-9_]*)/gi)].map(m=>m[1]))];
  if (names.some(name=>!Object.hasOwn(tables,name) && name!=='sqlite_master' && name!=='json_each')) throw new Error('FACADE_TABLE_FORBIDDEN');
  const selected = names.filter(name=>Object.hasOwn(tables,name));
  if (!selected.length) return sql;
  const ctes = selected.map(name=>{
    const [pk, columns] = tables[name];
    return `${name} AS MATERIALIZED (SELECT ${columns} FROM main.${name} WHERE ${pk} >= '' ORDER BY ${pk} LIMIT ${MAX_SOURCE_ROWS + 1})`;
  });
  const exceeded = selected.map(name=>`(SELECT COUNT(*) FROM ${name}) > ${MAX_SOURCE_ROWS}`).join(' OR ');
  return `WITH ${ctes.join(',')}, _result AS MATERIALIZED (SELECT raw.*,1 AS __facade_present FROM (${sql}) raw), _budget AS MATERIALIZED (SELECT ${exceeded} AS __facade_exceeded) SELECT _result.*,_budget.__facade_exceeded FROM _budget LEFT JOIN _result ON 1`;
}
export function budgetedDatabase(db: D1DatabaseBinding): D1DatabaseBinding {
  let queries = 0;
  function prepare(sql: string): D1PreparedStatement {
    if (++queries > MAX_OPERATION_QUERIES) throw new Error('FACADE_QUERY_BUDGET');
    const bounded = boundedSql(sql);
    return wrap(db.prepare(bounded), /__facade_exceeded/.test(bounded));
  }
  function wrap(statement: D1PreparedStatement, bounded: boolean): D1PreparedStatement {
    async function all<T>() {
      const response = await statement.all<Record<string,unknown>>();
      if (!bounded) return {...response,results:response.results as T[]};
      if (response.results.some(row=>row.__facade_exceeded===1)) throw new Error('FACADE_DATASET_LIMIT');
      const results = response.results.filter(row=>row.__facade_present===1).map(row=>{
        const {__facade_present:_present,__facade_exceeded:_exceeded,...projected}=row;
        return projected as T;
      });
      return {...response,results};
    }
    return {
      bind:(...values)=>wrap(statement.bind(...values), bounded), all,
      first:async <T>(column?:string)=>{const row=(await all<Record<string,unknown>>()).results[0];return (row ? (column ? row[column] : row) : null) as T|null;},
      run:async()=>{throw new Error('FACADE_WRITE_FORBIDDEN');},
    };
  }
  return {prepare,batch:async()=>{throw new Error('FACADE_WRITE_FORBIDDEN');},exec:async()=>{throw new Error('FACADE_WRITE_FORBIDDEN');}};
}
