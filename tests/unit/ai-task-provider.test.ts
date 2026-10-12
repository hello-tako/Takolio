import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { QwenTaskRuntime } from '../../packages/ai/src/task-runtime';
import { QwenProvider, type QwenCallOptions } from '../../packages/ai/src/providers/qwen';
import { createGovernanceConfig } from '../../packages/ai/src/model-governance';
import { AIProviderError, createAIResponseError } from '../../packages/ai/src/errors';
import { createTaskCallControl, type RuntimeTaskProvider, type TaskCallAdmission,
  type TaskProviderCallOptions, type TaskRuntimeOptions } from '../../packages/ai/src/task-provider';
import type { AIUsageLog, ReceiptScanResult } from '../../packages/ai/src/schemas';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const receipt: ReceiptScanResult = { items: [{ raw_name: 'Test tomato', estimated_quantity: 1, unit: 'piece', storage: 'fridge' }] };
function provider(): RuntimeTaskProvider {
  return { providerId: 'test-only', vision: vi.fn().mockResolvedValue(receipt), receiptScan: vi.fn().mockResolvedValue(receipt),
    chat: vi.fn().mockResolvedValue('hello'), getLastUsage: vi.fn().mockReturnValue({ inputTokens: 10, outputTokens: 5 }) };
}
function runtime(fake = provider(), options: TaskRuntimeOptions = {}, logs: AIUsageLog[] = []) {
  return new QwenTaskRuntime({ qwenOnly: true }, (log) => logs.push(log), { providerFactory: () => fake, ...options });
}
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('Governed runtime provider injection and admission', () => {
  it('uses explicitly injected provider without a key/network and preserves bounded options and true provider identity', async () => {
    const fake = provider();
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network prohibited in fixture'));
    const result = await runtime(fake).generate({ task: 'receipt_ocr', input: { imageBase64OrUrl: 'AQI=' } });
    expect(result.value).toEqual(receipt);
    expect(fake.receiptScan).toHaveBeenCalledWith({ imageBase64OrUrl: 'AQI=' }, expect.objectContaining({
      maxTokens: 2048, temperature: 0.1, jsonMode: true, signal: expect.any(AbortSignal),
    }));
    expect(result.usage[0]?.provider).toBe('test-only');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not silently construct Qwen when injected factory supplies no provider', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const instance = new QwenTaskRuntime({ qwenOnly: true, qwenApiKey: 'unused-test-key' }, undefined,
      { providerFactory: () => undefined });
    await expect(instance.generate({ task: 'fridge_chat', input: 'hello' })).rejects.toMatchObject({ code: 'AI_UNAVAILABLE' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('passes descriptor aliases/capabilities without giving factory API credentials', () => {
    const factory = vi.fn((_context: Parameters<NonNullable<TaskRuntimeOptions['providerFactory']>>[0]) => provider());
    new QwenTaskRuntime({ qwenOnly: true, qwenApiKey: 'private-test-key', qwenRequestTimeoutMs: 1000 }, undefined,
      { providerFactory: factory });
    expect(factory).toHaveBeenCalled();
    expect(factory.mock.calls[0]?.[0]).toMatchObject({ role: 'QWEN_FAST', capabilities: expect.any(Object), requestTimeoutMs: 1000 });
    expect(JSON.stringify(factory.mock.calls)).not.toContain('private-test-key');
  });

  it('runs the same bounded schema repair and escalation policies under injected providers', async () => {
    const fake = provider();
    vi.mocked(fake.receiptScan).mockRejectedValueOnce(createAIResponseError('test-only', 'Invalid structured fixture'))
      .mockRejectedValueOnce(createAIResponseError('test-only', 'Still invalid fixture')).mockResolvedValue(receipt);
    const admissions: TaskCallAdmission[] = [];
    const result = await runtime(fake, { beforeCall: async (admission) => { admissions.push(admission); }, callScope: 'job-test-1' })
      .generate({ task: 'receipt_ocr', input: { imageBase64OrUrl: 'AQI=' } });
    expect(result.attempts).toBe(3);
    expect(admissions.map((entry) => entry.kind)).toEqual(['primary', 'repair', 'escalation']);
    expect(admissions.map((entry) => entry.physicalModel)).toEqual(['qwen-vl-ocr', 'qwen-vl-ocr', 'qwen3.8-flash']);
    for (const entry of admissions) {
      expect(entry.opaqueScope).toBe('job-test-1');
      expect(entry.inputBudget.inputTokenBound).toBeNull();
      expect(entry.inputBudget.imageBytesBound).toBe(2);
      expect(JSON.stringify(entry)).not.toContain('AQI=');
    }
    expect(vi.mocked(fake.receiptScan).mock.calls[1]?.[1]?.visionRepairInstructions).toContain('INVALID_RESPONSE');
  });

  it('requires a separate retry admission after a transient provider outage', async () => {
    const fake = provider();
    vi.mocked(fake.chat).mockRejectedValueOnce(new AIProviderError('Transient fixture outage', { code: 'NETWORK_ERROR', retryable: true }));
    const admissions: TaskCallAdmission[] = [];
    await runtime(fake, { beforeCall: async (entry) => { admissions.push(entry); } }).generate({ task: 'fridge_chat', input: 'hello' });
    expect(admissions.map((entry) => entry.kind)).toEqual(['primary', 'retry']);
  });

  it('rejects disabled reasoning/input budgets before the injected provider or admission hook', async () => {
    const fake = provider();
    const beforeCall = vi.fn(async () => undefined);
    const governance = createGovernanceConfig({ AI_MAX_INPUT_TOKENS: '1024' }, { qwenOnly: true });
    const instance = new QwenTaskRuntime({ qwenOnly: true, governance }, undefined, { providerFactory: () => fake, beforeCall });
    await expect(instance.generate({ task: 'fridge_chat', input: 'x'.repeat(10000) })).rejects.toMatchObject({ code: 'AI_BUDGET_EXCEEDED' });
    expect(fake.chat).not.toHaveBeenCalled();
    expect(beforeCall).not.toHaveBeenCalled();
  });

  it('never retries admission errors or reports paid provider usage for calls not started', async () => {
    const fake = provider();
    const beforeCall = vi.fn(async () => { throw new Error('Sensitive admission details'); });
    const logs: AIUsageLog[] = [];
    await expect(runtime(fake, { beforeCall }, logs).generate({ task: 'receipt_ocr', input: { imageBase64OrUrl: 'AQI=' } }))
      .rejects.toMatchObject({ code: 'AI_ADMISSION_DENIED', retryable: false, message: 'AI_ADMISSION_DENIED: provider call not admitted' });
    expect(beforeCall).toHaveBeenCalledTimes(1);
    expect(fake.receiptScan).not.toHaveBeenCalled();
    expect(fake.getLastUsage).not.toHaveBeenCalled();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ inputTokens: 0, outputTokens: 0, estimatedCost: 0 });
    expect(JSON.stringify(logs)).not.toContain('Sensitive admission');
  });

  it('requires admission for shadow with the same opaque scope and a separate role/kind', async () => {
    const fake = provider();
    const admissions: TaskCallAdmission[] = [];
    const scheduled: Promise<unknown>[] = [];
    const governance = createGovernanceConfig({ AI_SHADOW_CANARY_PERCENT: '100', AI_MAX_CALLS_PER_OPERATION: '2' }, { qwenOnly: true });
    const instance = new QwenTaskRuntime({ qwenOnly: true, governance, backgroundExecutor: (promise) => scheduled.push(promise) },
      undefined, { providerFactory: () => fake, callScope: 'job-1', beforeCall: async (entry) => { admissions.push(entry); } });
    await instance.generate({ task: 'fridge_chat', input: 'hello' });
    await scheduled[0];
    expect(admissions.map((entry) => [entry.kind, entry.role, entry.opaqueScope])).toEqual([
      ['primary', 'QWEN_FAST', 'job-1'], ['shadow', 'QWEN_FAST_CANARY', 'job-1'],
    ]);
    expect(fake.chat).toHaveBeenCalledTimes(2);
  });
});

describe('Runtime abort and absolute deadline fences', () => {
  it('rejects already aborted request before provider/admission and omits private abort reason', async () => {
    const fake = provider();
    const beforeCall = vi.fn(async () => undefined);
    const controller = new AbortController();
    controller.abort('private-user-email@example.test');
    let caught: unknown;
    try { await runtime(fake, { beforeCall }).generate({ task: 'fridge_chat', input: 'hello', signal: controller.signal }); }
    catch (error) { caught = error; }
    expect(caught).toMatchObject({ code: 'AI_CALL_ABORTED', retryable: false, message: 'AI_CALL_ABORTED: request cancelled' });
    expect(caught).not.toHaveProperty('cause');
    expect(fake.chat).not.toHaveBeenCalled();
    expect(beforeCall).not.toHaveBeenCalled();
  });

  it('fences an adapter that ignores abort and discards its late result without retry or success telemetry', async () => {
    const fake = provider();
    const output = deferred<string>();
    const started = deferred<TaskProviderCallOptions>();
    vi.mocked(fake.chat).mockImplementation((_prompt, _context, options) => { started.resolve(options!); return output.promise; });
    const controller = new AbortController();
    const logs: AIUsageLog[] = [];
    const pending = runtime(fake, {}, logs).generate({ task: 'fridge_chat', input: 'hello', signal: controller.signal });
    const rejection = expect(pending).rejects.toMatchObject({ code: 'AI_CALL_ABORTED', retryable: false });
    const options = await started.promise;
    controller.abort('sensitive-image');
    await rejection;
    expect(options.signal?.aborted).toBe(true);
    output.resolve('late-private-result');
    await output.promise;
    expect(fake.chat).toHaveBeenCalledTimes(1);
    expect(logs.filter((log) => log.status === 'success')).toHaveLength(0);
    expect(logs.map((log) => log.failureCode)).toEqual(['AI_CALL_ABORTED']);
  });

  it('never invokes provider after a late successful admission that ignored cancellation', async () => {
    const fake = provider();
    const admitted = deferred<void>();
    const admissionStarted = deferred<void>();
    const beforeCall = vi.fn(() => { admissionStarted.resolve(); return admitted.promise; });
    const controller = new AbortController();
    const pending = runtime(fake, { beforeCall }).generate({ task: 'fridge_chat', input: 'hello', signal: controller.signal });
    const rejection = expect(pending).rejects.toMatchObject({ code: 'AI_CALL_ABORTED' });
    await admissionStarted.promise;
    controller.abort();
    await rejection;
    admitted.resolve();
    await admitted.promise;
    await Promise.resolve();
    expect(fake.chat).not.toHaveBeenCalled();
    expect(beforeCall).toHaveBeenCalledTimes(1);
  });

  it('does not launch a stale repair after abort at the end of the first failed attempt', async () => {
    const fake = provider();
    const controller = new AbortController();
    vi.mocked(fake.receiptScan).mockImplementation(async () => {
      controller.abort();
      throw createAIResponseError('test-only', 'Malformed result');
    });
    await expect(runtime(fake).generate({ task: 'receipt_ocr', input: { imageBase64OrUrl: 'AQI=' }, signal: controller.signal }))
      .rejects.toMatchObject({ code: 'AI_CALL_ABORTED' });
    expect(fake.receiptScan).toHaveBeenCalledTimes(1);
  });

  it('aborts a never-resolving adapter on the shared deadline and does not reset it across repairs', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-11T00:00:00Z'));
    const fake = provider();
    const started = deferred<TaskProviderCallOptions>();
    vi.mocked(fake.chat).mockImplementation((_prompt, _context, options) => { started.resolve(options!); return new Promise(() => undefined); });
    const deadlineAt = Date.now() + 25;
    const pending = runtime(fake).generate({ task: 'fridge_chat', input: 'hello', deadlineAt });
    const rejection = expect(pending).rejects.toMatchObject({ code: 'REQUEST_TIMEOUT', retryable: false });
    const options = await started.promise;
    expect(options.deadlineAt).toBe(deadlineAt);
    await vi.advanceTimersByTimeAsync(25);
    await rejection;
    expect(options.signal?.aborted).toBe(true);
    expect(fake.chat).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('uses the original absolute deadline during a later repair, rather than resetting the timer per attempt', async () => {
    vi.useFakeTimers();
    const fake = provider();
    const firstStarted = deferred<void>();
    const firstOutput = deferred<ReceiptScanResult>();
    const repairStarted = deferred<TaskProviderCallOptions>();
    vi.mocked(fake.receiptScan).mockImplementationOnce(() => { firstStarted.resolve(); return firstOutput.promise; })
      .mockImplementationOnce((_image, options) => { repairStarted.resolve(options!); return new Promise(() => undefined); });
    const deadlineAt = Date.now() + 25;
    const pending = runtime(fake).generate({ task: 'receipt_ocr', input: { imageBase64OrUrl: 'AQI=' }, deadlineAt });
    const rejection = expect(pending).rejects.toMatchObject({ code: 'REQUEST_TIMEOUT', retryable: false });
    await firstStarted.promise;
    await vi.advanceTimersByTimeAsync(10);
    firstOutput.reject(createAIResponseError('test-only', 'Repair fixture'));
    const options = await repairStarted.promise;
    expect(options.deadlineAt).toBe(deadlineAt);
    await vi.advanceTimersByTimeAsync(15);
    await rejection;
    expect(fake.receiptScan).toHaveBeenCalledTimes(2);
    expect(options.signal?.aborted).toBe(true);
  });

  it('checks deadline before a late admission, even if admission ignores the abort signal', async () => {
    vi.useFakeTimers();
    const fake = provider();
    const started = deferred<void>();
    const admitted = deferred<void>();
    const instance = runtime(fake, { beforeCall: () => { started.resolve(); return admitted.promise; } });
    const pending = instance.generate({ task: 'fridge_chat', input: 'hello', deadlineAt: Date.now() + 10 });
    const rejection = expect(pending).rejects.toMatchObject({ code: 'REQUEST_TIMEOUT', retryable: false });
    await started.promise;
    await vi.advanceTimersByTimeAsync(10);
    await rejection;
    admitted.resolve();
    await admitted.promise;
    await Promise.resolve();
    expect(fake.chat).not.toHaveBeenCalled();
  });

  it('a schema parser that exhausts deadline cannot publish otherwise valid result', async () => {
    vi.useFakeTimers();
    const fake = provider();
    const deadlineAt = Date.now() + 10;
    const schema = z.string().transform((value) => { vi.setSystemTime(deadlineAt + 1); return value; });
    await expect(runtime(fake).generate({ task: 'fridge_chat', input: 'hello', deadlineAt, schema }))
      .rejects.toMatchObject({ code: 'REQUEST_TIMEOUT', retryable: false });
  });

  it('retains original external signal for shadow after primary returns and discards late shadow output', async () => {
    const primary = provider();
    const shadow = provider();
    const shadowOutput = deferred<string>();
    const shadowStarted = deferred<TaskProviderCallOptions>();
    vi.mocked(shadow.chat).mockImplementation((_prompt, _context, options) => { shadowStarted.resolve(options!); return shadowOutput.promise; });
    const scheduled: Promise<unknown>[] = [];
    const logs: AIUsageLog[] = [];
    const governance = createGovernanceConfig({ AI_SHADOW_CANARY_PERCENT: '100' }, { qwenOnly: true });
    const controller = new AbortController();
    const instance = new QwenTaskRuntime({ qwenOnly: true, governance, backgroundExecutor: (promise) => scheduled.push(promise) },
      (log) => logs.push(log), { providerFactory: ({ role }) => role === 'QWEN_FAST_CANARY' ? shadow : primary });
    await instance.generate({ task: 'fridge_chat', input: 'hello', signal: controller.signal });
    const shadowOptions = await shadowStarted.promise;
    controller.abort();
    await scheduled[0];
    expect(shadowOptions.signal?.aborted).toBe(true);
    shadowOutput.resolve('late-shadow');
    await shadowOutput.promise;
    expect(logs.filter((log) => log.escalationReason === 'shadow_canary'))
      .toMatchObject([{ status: 'error', failureCode: 'AI_CALL_ABORTED' }]);
  });

  it.each([NaN, Infinity, -1, 1.5])('rejects malformed deadline %s without a call', async (deadlineAt) => {
    const fake = provider();
    await expect(runtime(fake).generate({ task: 'fridge_chat', input: 'hello', deadlineAt }))
      .rejects.toMatchObject({ code: 'AI_INVALID_DEADLINE', retryable: false });
    expect(fake.chat).not.toHaveBeenCalled();
  });

  it('cleans listeners/timers on successful control and respects far-future deadlines', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, 'removeEventListener');
    const control = createTaskCallControl({ signal: controller.signal, deadlineAt: Date.now() + 2_147_483_648 });
    await expect(control.run(async () => 'complete')).resolves.toBe('complete');
    control.dispose();
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('Qwen caller controls preserve legacy options and provider timeout taxonomy', () => {
  it.each(['chat', 'receiptScan', 'vision'] as const)('propagates mid-call abort for %s and never treats cancellation as a retryable timeout', async (method) => {
    const controller = new AbortController();
    const started = deferred<AbortSignal>();
    vi.spyOn(globalThis, 'fetch').mockImplementation((_url, options) => {
      const signal = options?.signal as AbortSignal;
      started.resolve(signal);
      return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }));
    });
    const qwen = new QwenProvider('test-key');
    const options: QwenCallOptions = { signal: controller.signal, maxTokens: 25, deadlineAt: Date.now() + 10000 };
    const pending = method === 'chat' ? qwen.chat('hello', undefined, options)
      : qwen[method]({ imageBase64OrUrl: 'AQI=' }, options);
    const rejection = expect(pending).rejects.toMatchObject({ code: 'AI_CALL_ABORTED', retryable: false });
    const signal = await started.promise;
    controller.abort('private-cancellation-reason');
    await rejection;
    expect(signal.aborted).toBe(true);
    expect(qwen.getLastUsage()).toBeUndefined();
  });

  it.each([NaN, Infinity, -1, Date.now() + 0.5])('rejects invalid direct Qwen deadline before fetch %s', async (deadlineAt) => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    await expect(new QwenProvider('test-key').chat('hello', undefined, { deadlineAt }))
      .rejects.toMatchObject({ code: 'AI_INVALID_DEADLINE', retryable: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fences late response body and prevents stale usage capture after caller deadline', async () => {
    vi.useFakeTimers();
    const body = deferred<unknown>();
    const bodyStarted = deferred<void>();
    const response = { ok: true, json: () => { bodyStarted.resolve(); return body.promise; } } as Response;
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);
    const qwen = new QwenProvider('test-key');
    const pending = qwen.chat('hello', undefined, { deadlineAt: Date.now() + 10 });
    const rejection = expect(pending).rejects.toMatchObject({ code: 'REQUEST_TIMEOUT', retryable: false });
    await bodyStarted.promise;
    await vi.advanceTimersByTimeAsync(10);
    await rejection;
    body.resolve({ choices: [{ message: { content: 'late-secret-result' } }], usage: { prompt_tokens: 55, completion_tokens: 23 } });
    await body.promise;
    await Promise.resolve();
    expect(qwen.getLastUsage()).toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('fences a fetch implementation that ignores the provider-owned timeout signal', async () => {
    vi.useFakeTimers();
    const started = deferred<void>();
    const output = deferred<Response>();
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => { started.resolve(); return output.promise; });
    const qwen = new QwenProvider('test-key', undefined, 1000);
    const pending = qwen.chat('hello');
    const rejection = expect(pending).rejects.toMatchObject({ code: 'REQUEST_TIMEOUT', retryable: true });
    await started.promise;
    await vi.advanceTimersByTimeAsync(1000);
    await rejection;
    output.resolve(new Response(JSON.stringify({ choices: [{ message: { content: 'late result' } }],
      usage: { prompt_tokens: 50, completion_tokens: 20 } })));
    await output.promise;
    await Promise.resolve();
    expect(qwen.getLastUsage()).toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('retains retryable provider-owned timeout when caller has no cancellation or deadline', async () => {
    vi.useFakeTimers();
    const started = deferred<void>();
    vi.spyOn(globalThis, 'fetch').mockImplementation((_url, options) => {
      const signal = options?.signal as AbortSignal;
      started.resolve();
      return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }));
    });
    const pending = new QwenProvider('test-key', undefined, 1000).chat('hello');
    const rejection = expect(pending).rejects.toMatchObject({ code: 'REQUEST_TIMEOUT', retryable: true });
    await started.promise;
    await vi.advanceTimersByTimeAsync(1000);
    await rejection;
    expect(vi.getTimerCount()).toBe(0);
  });
});
