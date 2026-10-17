import { AdminHttpError, type AdminPrincipal } from './http';
import { validateOutput } from '../../facade/output-contract';
import { operationInputs, signCapability, type CustomerReadBinding, type ReadOperation, type ReadInput } from '../../facade/contract';

/** No SQL or customer D1 capability exists on this client. */
export class CustomerReadClient {
  constructor(private readonly binding:CustomerReadBinding,private readonly secret:string,private readonly principal:()=>AdminPrincipal) {}
  async read<T,O extends ReadOperation = ReadOperation>(operation:O,input:ReadInput<O>):Promise<T> {
    const parsed=operationInputs[operation].parse(input);
    const capability=await signCapability(this.secret,operation,parsed,this.principal());
    try {
      return validateOutput(operation, await this.binding.read(operation,parsed,capability)) as T;
    } catch (error) {
      if (!(error instanceof Error) || !/FACADE_|ZodError|malformed JSON/.test(error.message + error.name)) throw error;
      throw new AdminHttpError(503, 'ADMIN_UNAVAILABLE', 'Nguồn dữ liệu tạm thời không khả dụng hoặc vượt giới hạn truy vấn an toàn.');
    }
  }
  eligibleUser(id:string):Promise<boolean> { return this.read('users.eligible',{id}); }
  recipeVersion(id:string):Promise<number|null> { return this.read('recipes.version',{id}); }
}
