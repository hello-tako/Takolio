import type { D1DatabaseBinding } from '@frigo/db';
import type { AdminHealthCheck, AdminOverview, AdminRange } from '../../../shared/admin';
import type { CustomerReadClient } from './customer-facade-client';
export const AI_NOT_WIRED_NOTE = 'Runtime chưa ghi đầy đủ yêu cầu AI; dữ liệu chỉ phản ánh các bản ghi đã lưu.';
export async function buildOverview(main:CustomerReadClient,db:D1DatabaseBinding,range:AdminRange,checks:AdminHealthCheck[]):Promise<AdminOverview> {
 const overview=await main.read<AdminOverview>('overview',{range});
 const audit=await db.prepare("SELECT id,occurred_at,action,outcome FROM admin_audit_events WHERE outcome IN ('denied','failure') ORDER BY occurred_at DESC,id DESC LIMIT 5").all<{id:string;occurred_at:string;action:string;outcome:string}>();
 return {...overview,health:{status:healthStatus(checks),checks},incidents:[...overview.incidents,...audit.results.map(r=>({id:r.id,occurredAt:r.occurred_at,severity:'info' as const,title:`Quản trị: ${r.action} — ${r.outcome}`,source:'ADMIN_DB:admin_audit_events'}))].sort((a,b)=>b.occurredAt.localeCompare(a.occurredAt)).slice(0,10)};
}
export function healthStatus(checks: AdminHealthCheck[]): 'ok' | 'degraded' | 'unhealthy' {
  const local = checks.filter((check) => check.observedBy === 'local');
  if (local.some((check) => check.status === 'error')) return 'unhealthy';
  if (local.some((check) => check.status === 'degraded')) return 'degraded';
  return 'ok';
}

