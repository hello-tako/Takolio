import type { AdminAiSummary, AdminAiUsageRow, AdminBillingSummary, AdminPage, AdminRange, AdminTransaction } from '../../../shared/admin';
import type { CustomerReadClient } from './customer-facade-client';
export const billingSummary=(main:CustomerReadClient,range:AdminRange):Promise<AdminBillingSummary>=>main.read('billing.summary',{range});
export const listTransactions=(main:CustomerReadClient,q:{status?:AdminTransaction['status'];page:number;pageSize:number}):Promise<AdminPage<AdminTransaction>>=>main.read('billing.transactions',q);
export const aiSummary=(main:CustomerReadClient,range:AdminRange):Promise<AdminAiSummary>=>main.read('ai.summary',{range});
export const listAiUsage=(main:CustomerReadClient,q:{task?:string;status?:string;page:number;pageSize:number}):Promise<AdminPage<AdminAiUsageRow>>=>main.read('ai.usage',q);
