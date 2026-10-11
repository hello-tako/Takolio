const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RESPONSE_REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/;
const METHODS = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);

export type RequestErrorClass = 'NONE' | 'REDIRECT' | 'AUTHENTICATION' | 'AUTHORIZATION' | 'NOT_FOUND'
  | 'CONFLICT' | 'VALIDATION' | 'RATE_LIMITED' | 'CLIENT_ERROR' | 'UNAVAILABLE' | 'SERVER_ERROR' | 'INTERNAL_SERVER_ERROR';
export interface RequestTelemetryEvent {
  event: 'http_request';
  schemaVersion: 1;
  requestId: string;
  method: string;
  routeTemplate: string;
  status: number;
  durationMs: number;
  environment: 'production' | 'staging' | 'development' | 'unknown';
  errorClass: RequestErrorClass;
}

export function createRequestCorrelation(suppliedResponseId?: string): { requestId: string; responseRequestId: string } {
  const requestId = crypto.randomUUID();
  return { requestId, responseRequestId: suppliedResponseId && RESPONSE_REQUEST_ID.test(suppliedResponseId)
    ? suppliedResponseId : requestId };
}
export function classifyRequestStatus(status: number): RequestErrorClass {
  if (status < 300) return 'NONE';
  if (status < 400) return 'REDIRECT';
  if (status === 401) return 'AUTHENTICATION';
  if (status === 403) return 'AUTHORIZATION';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'CONFLICT';
  if (status === 400 || status === 422) return 'VALIDATION';
  if (status === 429) return 'RATE_LIMITED';
  if (status < 500) return 'CLIENT_ERROR';
  return status === 503 ? 'UNAVAILABLE' : 'SERVER_ERROR';
}

export function buildRequestTelemetry(input: {
  requestId: string;
  method: string;
  routePath: string;
  registeredRoutes: ReadonlySet<string>;
  status: number;
  durationMs: number;
  environment?: string;
  internalError?: boolean;
}): RequestTelemetryEvent {
  const status = Number.isInteger(input.status) && input.status >= 100 && input.status <= 599 ? input.status : 500;
  const environment = input.environment === undefined ? 'development'
    : ['production', 'staging', 'development'].includes(input.environment)
      ? input.environment as RequestTelemetryEvent['environment'] : 'unknown';
  return {
    event: 'http_request', schemaVersion: 1,
    requestId: UUID_V4.test(input.requestId) ? input.requestId : crypto.randomUUID(),
    method: METHODS.has(input.method) ? input.method : 'OTHER',
    routeTemplate: !input.routePath.includes('*') && input.registeredRoutes.has(input.routePath)
      ? input.routePath : 'UNMATCHED_OR_GATED',
    status,
    durationMs: Number.isFinite(input.durationMs) ? Math.min(86_400_000, Math.max(0, Math.floor(input.durationMs))) : 0,
    environment,
    errorClass: input.internalError ? 'INTERNAL_SERVER_ERROR' : classifyRequestStatus(status),
  };
}

export function emitRequestTelemetry(event: RequestTelemetryEvent): void {
  try {
    console.log(JSON.stringify(event));
  } catch {
    // Telemetry sink failure must not change a completed API response.
  }
}
