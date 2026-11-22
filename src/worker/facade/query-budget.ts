import type { D1DatabaseBinding, D1PreparedStatement } from '@frigo/db';
import { assertReadOnlySql } from '../routes/admin/readonly-db';

export const MAX_SOURCE_ROWS = 25000;
export const MAX_OPERATION_QUERIES = 40;
export interface FacadeBudgetOptions {
  maxSourceRows?: number;
  maxOperationQueries?: number;
}
// Static projections exclude raw credentials before any query executes.
const tables: Record<string, [string, string]> = {
  users:['id','id,email,is_guest,created_at'],
  profiles:['id','id,user_id,display_name,onboarding_completed_at'],
  auth_accounts:['id','id,user_id,email,is_verified,password_hash IS NOT NULL AS has_password,google_id IS NOT NULL AS has_google'],
  sessions_v2:['id','id,user_id,revoked_at,expires_at,last_seen_at,created_at'],
  subscriptions:['id','id,user_id,plan,status,scan_count_current_month,max_scans_per_month,expires_at'],
  scan_quota_periods:['user_id','user_id,household_id,period_start,used_count,max_scans,updated_at'],
  households:['id','id,name,created_by,created_at,inventory_version'],
  household_members:['id','id,household_id,user_id,role,created_at'],
  inventory_items:['id','id,household_id,freshness'],
  inventory_lots:['id','id,household_id,state,expiry_at,estimated_expiry_at'],
  meal_plans:['id','id,household_id,status'],
  generated_meal_plans:['id','id,household_id'],
  cooked_meals:['id','id,household_id,user_id,recipe_id'],
  shopping_lists:['id','id,household_id'],
  payment_intents:['id','id,user_id,order_code,plan,amount_vnd,status,created_at,updated_at,expires_at'],
  ai_requests:['id','id,task,provider,model,input_tokens,output_tokens,latency_ms,estimated_cost,status,created_at'],
  scans:['id','id,user_id,household_id,status,scan_type,created_at'],
  scan_queue_jobs:['id','id,scan_id,household_id,user_id,status,attempts,max_attempts,error_code,error_message,locked_at,created_at,updated_at'],
  recipes:['id','id,slug,title,cuisine,difficulty,cook_time_minutes,source_type,verification_state,version,created_at,description,servings,prep_time_minutes,tags,source_reference,family_id'],
  recipe_media:['id','id,recipe_id,role,version,status,source_type,mime_type'],
  recipe_ingredients:['id','id,recipe_id,name,required_quantity,unit,is_optional'],
  recipe_steps:['id','id,recipe_id,step_number,instruction,tip,timer_minutes'],
  checkout_admissions:['user_id','user_id,state'],
  payment_reconciliation_records:['intent_id','intent_id,reason,first_observed_at,last_observed_at'],
};

/** Bound all base-table reads in the same SQLite snapshot as the result.
 * Capped materialized CTEs prevent concurrent inserts bypassing the budget.
 * The guard rejects oversize sources instead of returning sampled totals.
 */
export function boundedSql(sql: string, maxSourceRows: number = MAX_SOURCE_ROWS): string {
  assertReadOnlySql(sql);
  if (!/^\s*SELECT\b/i.test(sql)) throw new Error('FACADE_QUERY_FORBIDDEN');
  const names = [...new Set([...sql.matchAll(/\b(?:FROM|JOIN)\s+([a-z_][a-z0-9_]*)/gi)].map(m=>m[1]))];
  if (names.some(name=>!Object.hasOwn(tables,name) && name!=='sqlite_master' && name!=='json_each')) throw new Error('FACADE_TABLE_FORBIDDEN');
  const selected = names.filter(name=>Object.hasOwn(tables,name));
  if (!selected.length) return sql;
  const ctes = selected.map(name=>{
    const [pk, columns] = tables[name];
    return `${name} AS MATERIALIZED (SELECT ${columns} FROM main.${name} WHERE ${pk} >= '' ORDER BY ${pk} LIMIT ${maxSourceRows + 1})`;
  });
  const exceeded = selected.map(name=>`(SELECT COUNT(*) FROM ${name}) > ${maxSourceRows}`).join(' OR ');
  return `WITH ${ctes.join(',')}, _result AS MATERIALIZED (SELECT raw.*,1 AS __facade_present FROM (${sql}) raw), _budget AS MATERIALIZED (SELECT ${exceeded} AS __facade_exceeded) SELECT _result.*,_budget.__facade_exceeded FROM _budget LEFT JOIN _result ON 1`;
}
export function budgetedDatabase(db: D1DatabaseBinding, options: FacadeBudgetOptions = {}): D1DatabaseBinding {
  const maxSourceRows = options.maxSourceRows ?? MAX_SOURCE_ROWS;
  const maxOperationQueries = options.maxOperationQueries ?? MAX_OPERATION_QUERIES;
  let queries = 0;
  function prepare(sql: string): D1PreparedStatement {
    if (++queries > maxOperationQueries) throw new Error('FACADE_QUERY_BUDGET');
    const bounded = boundedSql(sql, maxSourceRows);
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
