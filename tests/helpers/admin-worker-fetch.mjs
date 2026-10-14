import worker from '../../src/worker/admin-worker.ts';

// Keeps the Worker's global types isolated from the DOM test compilation target.
const ctx = { waitUntil(promise) { promise.catch(() => {}); }, passThroughOnException() {}, props: {} };
export const fetchAdminWorker = (request, env) => worker.fetch(request, env, ctx);
