import { ApiError, fetchJson, guardPrivateSession } from './http';

export const PLANNER_REQUEST_TIMEOUT_MS = 30_000;

/** Bound the complete response, including body reads and transports that ignore abort. */
export async function fetchPlannerJson<T>(
  path: string,
  options?: RequestInit,
  apiVersion: 'v1' | 'v2' = 'v1',
): Promise<T> {
  const assertCurrent = guardPrivateSession();
  const controller = new AbortController();
  const callerSignal = options?.signal;
  const abortFromCaller = () => controller.abort(callerSignal?.reason);
  if (callerSignal?.aborted) abortFromCaller();
  else callerSignal?.addEventListener('abort', abortFromCaller, { once: true });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      const error = new ApiError('http', 'HTTP 408: {"code":"PLAN_REQUEST_TIMEOUT"}', 408, { retryable: true });
      reject(error);
      controller.abort(error);
    }, PLANNER_REQUEST_TIMEOUT_MS);
  });
  try {
    const result = await Promise.race([
      fetchJson<T>(path, { ...options, signal: controller.signal }, apiVersion),
      deadline,
    ]);
    assertCurrent();
    return result;
  } catch (error) {
    assertCurrent();
    throw error;
  } finally {
    clearTimeout(timer);
    callerSignal?.removeEventListener('abort', abortFromCaller);
  }
}
