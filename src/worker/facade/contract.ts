import { z } from 'zod';
import type { AdminPermission, AdminRole } from '../../shared/admin';
import { hasAdminPermission, ADMIN_ROLES } from '../../shared/admin';

const id = z.string().min(1).max(128).regex(/^(?!\.{1,2}$)[A-Za-z0-9_.:-]+$/);
const page = { page: z.number().int().min(1).max(1000), pageSize: z.number().int().min(1).max(100) };
const range = z.enum(['7d', '30d', '90d']);
const query = z.string().trim().min(1).max(100).optional();
export const operationInputs = {
  'users.list': z.object({ ...page, q: query, type: z.enum(['registered','guest','all']), plan: z.enum(['free','plus']).optional(), admin: z.enum(['true','false']).optional(), adminIds: z.array(id).max(1000), emailSearch: z.boolean() }).strict(),
  'users.get': z.object({ id, reveal: z.boolean() }).strict(),
  'users.eligible': z.object({ id }).strict(),
  'users.labels': z.object({ ids: z.array(id).max(500) }).strict(),
  'households.list': z.object({ ...page, q: query }).strict(),
  'recipes.list': z.object({ ...page, q: query, cuisine: z.string().max(64).optional(), verification: z.enum(['unverified','reviewed','rejected']).optional(), source: z.enum(['legacy','curated','imported','ai_generated','user_generated']).optional() }).strict(),
  'recipes.get': z.object({ id }).strict(),
  'recipes.version': z.object({ id }).strict(),
  'recipes.summary': z.object({ catalogMode: z.string().max(64).optional() }).strict(),
  'billing.summary': z.object({ range }).strict(),
  'billing.transactions': z.object({ ...page, status: z.enum(['pending','paid','failed','expired','refunded']).optional() }).strict(),
  'ai.summary': z.object({ range }).strict(),
  'ai.usage': z.object({ ...page, task: z.string().max(64).optional(), status: z.string().max(32).optional() }).strict(),
  'overview': z.object({ range }).strict(),
  'system': z.object({}).strict(),
} as const;
export type ReadOperation = keyof typeof operationInputs;
export type ReadInput<O extends ReadOperation> = z.infer<(typeof operationInputs)[O]>;
export const operationPermissions: Record<ReadOperation, AdminPermission> = {
  'users.list':'users.read', 'users.get':'users.read', 'users.eligible':'admin.roles.manage', 'users.labels':'admin.roles.read',
  'households.list':'households.read', 'recipes.list':'recipes.read', 'recipes.get':'recipes.read', 'recipes.version':'recipes.review',
  'recipes.summary':'recipes.read', 'billing.summary':'billing.read', 'billing.transactions':'billing.read', 'ai.summary':'ai.read',
  'ai.usage':'ai.read', overview:'overview.read', system:'admin.self.read',
};
export const Capability = z.object({ version:z.literal(1), operation:z.enum(Object.keys(operationInputs) as [ReadOperation,...ReadOperation[]]),
  inputHash:z.string().regex(/^[0-9a-f]{64}$/), userId:id, sessionId:id, roles:z.array(z.enum(ADMIN_ROLES)).min(1).max(5),
  issuedAt:z.number().int(), expiresAt:z.number().int(), nonce:z.string().regex(/^[0-9a-f]{32}$/), signature:z.string().regex(/^[0-9a-f]{64}$/) }).strict();
export type ReadCapability = z.infer<typeof Capability>;
export interface CustomerReadBinding { read(operation: ReadOperation, input: unknown, capability: ReadCapability): Promise<unknown> }
export function authorized(operation: ReadOperation, input: Record<string,unknown>, roles: readonly AdminRole[]): boolean {
  return hasAdminPermission(roles, operationPermissions[operation]) &&
    (!(input.reveal || input.emailSearch) || hasAdminPermission(roles, 'users.pii.reveal'));
}
export async function hash(value: unknown): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value, (_key,entry) => entry && typeof entry==='object' && !Array.isArray(entry) ? Object.fromEntries(Object.keys(entry).sort().map(key=>[key,entry[key]])) : entry)))), b=>b.toString(16).padStart(2,'0')).join('');
}
async function hmac(secret: string, value: unknown): Promise<string> {
  if (secret.length < 32) throw new Error('FACADE_AUTH_UNAVAILABLE');
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(JSON.stringify(value, (_key,entry) => entry && typeof entry==='object' && !Array.isArray(entry) ? Object.fromEntries(Object.keys(entry).sort().map(key=>[key,entry[key]])) : entry)))), b=>b.toString(16).padStart(2,'0')).join('');
}
export async function signCapability(secret:string, operation:ReadOperation, input:unknown, actor:{userId:string;sessionId:string;roles:AdminRole[]}):Promise<ReadCapability> {
  const now=Date.now();
  const claims={version:1 as const, operation,inputHash:await hash(input),userId:actor.userId,sessionId:actor.sessionId,roles:actor.roles,issuedAt:now,expiresAt:now+15_000,nonce:Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('')};
  return {...claims,signature:await hmac(secret,claims)};
}
export async function verifyCapability(secret:string, operation:ReadOperation, input:unknown, raw:unknown):Promise<ReadCapability> {
  const parsed=Capability.parse(raw); const {signature,...claims}=parsed;
  const expected=await hmac(secret,claims);
  let diff=0; for(let i=0;i<64;i+=1) diff|=signature.charCodeAt(i)^expected.charCodeAt(i);
  if(diff || parsed.operation!==operation || parsed.inputHash!==await hash(input) || parsed.issuedAt>Date.now()+1000 || parsed.expiresAt<=Date.now() || parsed.expiresAt-parsed.issuedAt>15_000 || !authorized(operation,input as Record<string,unknown>,parsed.roles)) throw new Error('FACADE_FORBIDDEN');
  return parsed;
}
