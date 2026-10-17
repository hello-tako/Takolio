import { WorkerEntrypoint } from 'cloudflare:workers';
import type { D1DatabaseBinding } from '@frigo/db';
import { createCustomerReadFacade } from './facade/customer-read-service';
import type { ReadCapability, ReadOperation } from './facade/contract';
interface FacadeEnv { DB:D1DatabaseBinding; ADMIN_FACADE_HMAC_SECRET:string }
export class AdminCustomerReadFacade extends WorkerEntrypoint<FacadeEnv> {
  async read(operation:ReadOperation,input:unknown,capability:ReadCapability):Promise<unknown> {
    return createCustomerReadFacade(this.env.DB,{secret:this.env.ADMIN_FACADE_HMAC_SECRET}).read(operation,input,capability);
  }
}
export default { fetch:()=>new Response('Not Found',{status:404}) };
