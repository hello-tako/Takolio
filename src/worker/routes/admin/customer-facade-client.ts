import { AdminHttpError, type AdminPrincipal } from './http';
import { validateMutationOutput, validateOutput } from '../../facade/output-contract';
import {
  mutationInputs,
  operationInputs,
  signCapability,
  signMutationCapability,
  type CustomerReadBinding,
  type MutationInput,
  type MutationOperation,
  type ReadInput,
  type ReadOperation,
} from '../../facade/contract';

function mapFacadeError(error: unknown): never {
  if (error instanceof Error) {
    if (error.message.startsWith('FACADE_NOT_FOUND')) {
      const msg = error.message.slice('FACADE_NOT_FOUND'.length).replace(/^:/, '').trim() || 'Không tìm thấy.';
      throw new AdminHttpError(404, 'ADMIN_NOT_FOUND', msg);
    }
    if (error.message.startsWith('FACADE_CONFLICT')) {
      const msg = error.message.slice('FACADE_CONFLICT'.length).replace(/^:/, '').trim() || 'Dữ liệu đã thay đổi. Vui lòng tải lại.';
      throw new AdminHttpError(409, 'ADMIN_CONFLICT', msg);
    }
    if (error.message.startsWith('FACADE_VALIDATION')) {
      const msg = error.message.slice('FACADE_VALIDATION'.length).replace(/^:/, '').trim() || 'Tham số yêu cầu không hợp lệ.';
      throw new AdminHttpError(400, 'ADMIN_VALIDATION_FAILED', msg);
    }
    if (/FACADE_|ZodError|malformed JSON/.test(error.message + error.name)) {
      throw new AdminHttpError(503, 'ADMIN_UNAVAILABLE', 'Nguồn dữ liệu tạm thời không khả dụng hoặc vượt giới hạn truy vấn an toàn.');
    }
  }
  throw error;
}

/** No SQL or customer D1 capability exists on this client. */
export class CustomerReadClient {
  constructor(private readonly binding:CustomerReadBinding,private readonly secret:string,private readonly principal:()=>AdminPrincipal) {}
  async read<T,O extends ReadOperation = ReadOperation>(operation:O,input:ReadInput<O>):Promise<T> {
    const parsed=operationInputs[operation].parse(input);
    const capability=await signCapability(this.secret,operation,parsed,this.principal());
    try {
      return validateOutput(operation, await this.binding.read(operation,parsed,capability)) as T;
    } catch (error) {
      return mapFacadeError(error);
    }
  }
  async mutate<T,O extends MutationOperation = MutationOperation>(operation:O,input:MutationInput<O>):Promise<T> {
    const parsed=mutationInputs[operation].parse(input);
    const capability=await signMutationCapability(this.secret,operation,parsed,this.principal());
    try {
      return validateMutationOutput(operation, await this.binding.mutate(operation,parsed,capability)) as T;
    } catch (error) {
      return mapFacadeError(error);
    }
  }
  eligibleUser(id:string):Promise<boolean> { return this.read('users.eligible',{id}); }
  recipeVersion(id:string):Promise<number|null> { return this.read('recipes.version',{id}); }
}
