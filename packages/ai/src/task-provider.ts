import type { AIProviderUsage, AICallControl, VisionScanParams } from './types';
import type { ReceiptScanResult, VisionScanResult } from './schemas';
import type { AIModelRole, AITask, ModelCapabilities } from './model-governance';
import { AIProviderError } from './errors';

export interface TaskProviderCallOptions extends AICallControl {
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
  visionRepairInstructions?: string;
}
export interface RuntimeTaskProvider {
  providerId: string;
  vision(params: VisionScanParams, options?: TaskProviderCallOptions): Promise<VisionScanResult>;
  receiptScan(params: VisionScanParams, options?: TaskProviderCallOptions): Promise<ReceiptScanResult>;
  chat(prompt: string, context?: Record<string, unknown>, options?: TaskProviderCallOptions): Promise<string>;
  getLastUsage(): AIProviderUsage | undefined;
}
export interface TaskProviderFactoryContext {
  role: AIModelRole;
  physicalModel: string;
  capabilities: ModelCapabilities;
  requestTimeoutMs?: number;
}
export type TaskProviderFactory = (context: TaskProviderFactoryContext) => RuntimeTaskProvider | undefined;
export interface TaskCallAdmission extends AICallControl {
  task: AITask;
  role: AIModelRole;
  physicalModel: string;
  kind: 'primary' | 'repair' | 'retry' | 'escalation' | 'shadow';
  attempt: number;
  opaqueScope?: string;
  inputBudget: {
    estimatedInputTokens: number;
    inputTokenBound: null;
    imageBytesBound: number | null;
  };
  maxOutputTokens: number;
}
export interface TaskRuntimeOptions {
  providerFactory?: TaskProviderFactory;
  beforeCall?: (admission: TaskCallAdmission) => Promise<void>;
  callScope?: string;
}
export interface TaskCallControl {
  signal: AbortSignal;
  check(): void;
  run<T>(operation: () => Promise<T>): Promise<T>;
  dispose(): void;
}

export function validateTaskCallDeadline(deadlineAt: number | undefined, provider = 'task-runtime', model?: string): void {
  if (deadlineAt !== undefined && (!Number.isSafeInteger(deadlineAt) || deadlineAt < 0)) {
    throw new AIProviderError('AI_INVALID_DEADLINE: invalid operation deadline', {
      code: 'AI_INVALID_DEADLINE', retryable: false, provider, model,
    });
  }
}

export function createTaskCallControl(options: AICallControl, provider = 'task-runtime', model?: string): TaskCallControl {
  const { signal, deadlineAt } = options;
  validateTaskCallDeadline(deadlineAt, provider, model);
  const controller = new AbortController();
  let failure: AIProviderError | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stop = (code: 'AI_CALL_ABORTED' | 'REQUEST_TIMEOUT') => {
    if (failure) return;
    failure = new AIProviderError(code === 'AI_CALL_ABORTED' ? 'AI_CALL_ABORTED: request cancelled'
      : 'REQUEST_TIMEOUT: operation deadline exceeded', { code, retryable: false, provider, model });
    controller.abort();
  };
  const onAbort = () => stop('AI_CALL_ABORTED');
  const check = () => {
    if (signal?.aborted) onAbort();
    if (deadlineAt !== undefined && Date.now() >= deadlineAt) stop('REQUEST_TIMEOUT');
    if (failure) throw failure;
  };
  signal?.addEventListener('abort', onAbort, { once: true });
  if (signal?.aborted) onAbort();
  const scheduleDeadline = () => {
    if (deadlineAt === undefined || failure) return;
    const remaining = deadlineAt - Date.now();
    if (remaining <= 0) stop('REQUEST_TIMEOUT');
    else timer = setTimeout(scheduleDeadline, Math.min(remaining, 2_147_483_647));
  };
  scheduleDeadline();
  return {
    signal: controller.signal,
    check,
    async run<T>(operation: () => Promise<T>): Promise<T> {
      check();
      let rejectStopped: () => void = () => undefined;
      const stopped = new Promise<never>((_resolve, reject) => {
        rejectStopped = () => reject(failure);
        controller.signal.addEventListener('abort', rejectStopped, { once: true });
      });
      try {
        const result = await Promise.race([Promise.resolve().then(() => { check(); return operation(); }), stopped]);
        check();
        return result;
      } finally {
        controller.signal.removeEventListener('abort', rejectStopped);
      }
    },
    dispose() {
      if (timer !== undefined) clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    },
  };
}
