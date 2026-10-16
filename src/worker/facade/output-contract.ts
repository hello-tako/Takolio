import { z } from 'zod';
import type { ReadOperation } from './contract';
const text = z.string().max(8192);
const nullable = text.nullable();
const number = z.number().finite();
const count = number.int().nonnegative();
const role = z.enum(['SUPER_ADMIN','OPERATIONS_ADMIN','CONTENT_EDITOR','SUPPORT_AGENT','READ_ONLY_AUDITOR']);
const editorial = z.enum(['draft','in_review','approved','rejected']);
const status = z.enum(['pending','paid','failed','expired','refunded']);
const range = z.enum(['7d','30d','90d']);
const array = <T extends z.ZodTypeAny>(schema:T, max=100) => z.array(schema).max(max);
const page = <T extends z.ZodTypeAny>(schema:T) => z.object({items:array(schema),page:count.min(1).max(1000),pageSize:count.min(1).max(100),total:count}).strict();
const metric = z.object({key:text,label:text,value:number.nullable(),unit:z.enum(['count','vnd','usd','ms','percent','tokens']),status:z.enum(['ok','partial','unavailable']),source:text,definition:text,note:text.optional()}).strict();
const series = z.object({key:text,label:text,unit:z.enum(['count','vnd','usd','ms','percent','tokens']),source:text,points:array(z.object({date:text,value:number}).strict(),90)}).strict();
const health = z.object({key:text,label:text,status:z.enum(['ok','degraded','error','unavailable']),observedBy:z.enum(['local','remote']),detail:text.optional()}).strict();
const user = z.object({id:text,displayName:nullable,emailMasked:nullable,isGuest:z.boolean(),isVerified:z.boolean(),plan:z.enum(['free','plus']),subscriptionStatus:nullable,subscriptionExpiresAt:nullable,householdCount:count,createdAt:text,lastSeenAt:nullable,isPlatformAdmin:z.boolean()}).strict();
const recipe = z.object({id:text,slug:text,title:text,cuisine:text,difficulty:text,cookTimeMinutes:number,sourceType:text,verificationState:z.enum(['unverified','reviewed','rejected']),version:count,hasReadyMedia:z.boolean(),latestEditorialState:editorial.nullable(),createdAt:text}).strict();
const review = z.object({id:text,state:editorial,note:text,authorUserId:text,recipeVersion:count,createdAt:text}).strict();
const outputs: Record<ReadOperation,z.ZodTypeAny> = {
  'users.list':page(user),
  'users.get':user.extend({email:nullable,emailRevealed:z.boolean(),onboardingCompletedAt:nullable,authProviders:array(z.enum(['password','google']),2),households:array(z.object({id:text,name:text,role:text,memberCount:count,createdAt:text}).strict(),20),activity:z.object({activeSessions:count,scans30d:count,lastScanAt:nullable,payments:z.object({paid:count,pending:count,failed:count}).strict()}).strict(),adminRoles:array(role,5)}).strict().nullable(),
  'users.eligible':z.boolean(),
  'users.labels':z.record(text,z.object({displayName:nullable,emailMasked:nullable}).strict()).refine(value=>Object.keys(value).length<=500),
  'households.list':page(z.object({id:text,name:text,ownerUserId:text,ownerDisplayName:nullable,memberCount:count,inventoryItemCount:count,createdAt:text}).strict()),
  'recipes.list':page(recipe),
  'recipes.get':recipe.extend({description:nullable,servings:number,prepTimeMinutes:number.nullable(),tags:array(text,50),sourceReference:nullable,familyId:nullable,ingredientCount:count,stepCount:count,media:array(z.object({role:text,version:count,status:text,sourceType:nullable,mimeType:nullable}).strict(),20),editorialReviews:array(review),publication:z.object({canPublish:z.literal(false),note:text}).strict()}).strict().nullable(),
  'recipes.version':count.nullable(),
  'recipes.summary':z.object({total:count,byVerification:array(z.object({state:text,count}).strict()),bySource:array(z.object({sourceType:text,count}).strict()),byCuisine:array(z.object({cuisine:text,count}).strict(),20),withReadyMedia:count,catalogMode:text,editorialQueue:array(z.object({state:editorial,count}).strict())}).strict(),
  'billing.summary':z.object({range,metrics:array(metric,20),statusBreakdown:array(z.object({status,count,amountVnd:number}).strict(),5),checkoutStates:array(z.object({state:z.enum(['dispatching','ready','remote_uncertain']),count}).strict(),3),reconciliationExceptions:array(z.object({intentId:text,reason:text,firstObservedAt:text,lastObservedAt:text}).strict(),20),series:array(series,10),providerReconciliation:z.object({status:z.literal('unavailable'),note:text}).strict()}).strict(),
  'billing.transactions':page(z.object({id:text,userId:text,orderCodeMasked:text,plan:text,amountVnd:number,status,effectiveStatus:status,hasReconciliationRecord:z.boolean(),createdAt:text,updatedAt:text,expiresAt:text}).strict()),
  'ai.summary':z.object({range,metrics:array(metric,20),byTask:array(z.object({task:text,requests:count,errors:count,avgLatencyMs:number.nullable(),estimatedCostUsd:number}).strict(),50),byModel:array(z.object({provider:text,model:text,requests:count,inputTokens:number,outputTokens:number,estimatedCostUsd:number}).strict(),50),ocr:z.object({scansByStatus:array(z.object({status:text,count}).strict()),jobsByStatus:array(z.object({status:text,count}).strict()),retriedJobs:count,exhaustedJobs:count}).strict(),queue:z.object({localJobStatus:array(z.object({status:text,count}).strict()),remoteBacklog:z.object({status:z.literal('unavailable'),note:text}).strict()}).strict(),instrumentation:z.object({aiRequestsWriter:z.enum(['not_wired','wired']),note:text}).strict(),series:array(series,10)}).strict(),
  'ai.usage':page(z.object({id:text,task:text,provider:text,model:text,inputTokens:number,outputTokens:number,latencyMs:number,estimatedCostUsd:number,status:text,createdAt:text}).strict()),
  overview:z.object({range,metrics:array(metric,20),series:array(series,10),health:z.object({status:z.enum(['ok','degraded','unhealthy']),checks:array(health,20)}).strict(),incidents:array(z.object({id:text,occurredAt:text,severity:z.enum(['info','warning','critical']),title:text,source:text}).strict(),10)}).strict(),
  system:z.object({reachable:z.boolean(),tables:array(text,8)}).strict(),
};
export function validateOutput(operation:ReadOperation,value:unknown):unknown { return outputs[operation].parse(value); }
