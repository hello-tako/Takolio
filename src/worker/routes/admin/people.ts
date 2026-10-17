import type { D1DatabaseBinding } from '@frigo/db';
import { isAdminRole, type AdminHouseholdSummary, type AdminPage, type AdminUserDetail, type AdminUserSummary } from '../../../shared/admin';
import type { CustomerReadClient } from './customer-facade-client';

export async function activeAdminUserIds(db:D1DatabaseBinding):Promise<Set<string>> {
 const rows=await db.prepare("SELECT DISTINCT user_id FROM admin_role_assignments WHERE status='active' ORDER BY user_id LIMIT 1000").all<{user_id:string}>();
 return new Set(rows.results.map(r=>r.user_id));
}
export async function listUsers(main:CustomerReadClient,adminDb:D1DatabaseBinding,query:{q?:string;type:'registered'|'guest'|'all';plan?:'free'|'plus';admin?:'true'|'false';page:number;pageSize:number},options:{emailSearch:boolean}):Promise<AdminPage<AdminUserSummary>> {
 return main.read('users.list',{...query,...options,adminIds:[...await activeAdminUserIds(adminDb)]});
}
export async function getUser(main:CustomerReadClient,adminDb:D1DatabaseBinding,id:string,reveal:boolean):Promise<AdminUserDetail|null> {
 const user=await main.read<AdminUserDetail|null>('users.get',{id,reveal});
 if(!user) return null;
 const roles=await adminDb.prepare("SELECT role FROM admin_role_assignments WHERE user_id=? AND status='active' ORDER BY role LIMIT 5").bind(id).all<{role:string}>();
 return {...user,adminRoles:roles.results.map(r=>r.role).filter(isAdminRole),isPlatformAdmin:roles.results.length>0};
}
export function listHouseholds(main:CustomerReadClient,query:{q?:string;page:number;pageSize:number}):Promise<AdminPage<AdminHouseholdSummary>> {return main.read('households.list',query);}
export async function userLabels(main:CustomerReadClient,userIds:string[]):Promise<Map<string,{displayName:string|null;emailMasked:string|null}>> {
 return new Map(Object.entries(await main.read<Record<string,{displayName:string|null;emailMasked:string|null}>>('users.labels',{ids:[...new Set(userIds)].slice(0,500)})));
}
