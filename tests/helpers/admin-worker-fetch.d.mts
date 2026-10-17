import type { AdminEnv } from '../../src/worker/routes/admin/env';

export function fetchAdminWorker(request: Request, env: AdminEnv): Promise<Response> | Response;
