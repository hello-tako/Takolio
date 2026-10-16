import type { AdminPrincipal } from './http';
import { operationInputs, signCapability, type CustomerReadBinding, type ReadOperation, type ReadInput } from '../../facade/contract';

/** No SQL or customer D1 capability exists on this client. */
export class CustomerReadClient {
  constructor(private readonly binding:CustomerReadBinding,private readonly secret:string,private readonly principal:()=>AdminPrincipal) {}
  async read<T,O extends ReadOperation = ReadOperation>(operation:O,input:ReadInput<O>):Promise<T> {
    const parsed=operationInputs[operation].parse(input);
    const capability=await signCapability(this.secret,operation,parsed,this.principal());
    return await this.binding.read(operation,parsed,capability) as T;
  }
  eligibleUser(id:string):Promise<boolean> { return this.read('users.eligible',{id}); }
  recipeVersion(id:string):Promise<number|null> { return this.read('recipes.version',{id}); }
}
