import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildRequestTelemetry, createRequestCorrelation, emitRequestTelemetry } from '../../src/worker/observability/request-telemetry';

const serverId = 'c907b11d-593e-4605-bc3f-e30fc34c6127';
const input = { requestId: serverId, method: 'GET', routePath: '/api/v1/recipes/:id',
  registeredRoutes: new Set(['/api/v1/recipes/:id']), status: 200, durationMs: 12, environment: 'production' };
afterEach(() => vi.restoreAllMocks());

describe('Bounded request telemetry', () => {
  it('retains response correlation compatibility but never uses supplied IDs as log correlation', () => {
    const correlation = createRequestCorrelation('frontend_test_123');
    expect(correlation.responseRequestId).toBe('frontend_test_123');
    expect(correlation.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(correlation.requestId).not.toBe(correlation.responseRequestId);
  });

  it.each(['private@example.test', 'line\nbreak', 'short', 'x'.repeat(65)])('replaces malformed response ID %s', (id) => {
    const correlation = createRequestCorrelation(id);
    expect(correlation.responseRequestId).toBe(correlation.requestId);
  });

  it('allowlists event fields and ignores raw path/query/header/user/provider error data', () => {
    const event = buildRequestTelemetry({ ...input, body: 'private-receipt', headers: { Cookie: 'session-secret' },
      userId: 'foreign-user', rawPath: '/api/v1/recipes/private-email@example.test?otp=123456', provider: 'raw-model-output' } as typeof input);
    expect(event).toEqual({ event: 'http_request', schemaVersion: 1, requestId: serverId, method: 'GET',
      routeTemplate: '/api/v1/recipes/:id', status: 200, durationMs: 12, environment: 'production', errorClass: 'NONE' });
    expect(JSON.stringify(event)).not.toMatch(/private|Cookie|secret|foreign|otp|model|headers|body/);
  });

  it.each(['/api/v1/recipes/private@example.test', '/anything?otp=123456', '*', '/*', '/api/*'])('never logs a raw path or registered wildcard %s', (routePath) => {
    expect(buildRequestTelemetry({ ...input, routePath,
      registeredRoutes: new Set([...input.registeredRoutes, '*', '/*', '/api/*']) }).routeTemplate).toBe('UNMATCHED_OR_GATED');
  });

  it('rejects correlation, method and environment content that could become telemetry payload', () => {
    const event = buildRequestTelemetry({ ...input, requestId: 'private-email', method: 'PRIVATE_CUSTOM_METHOD', environment: 'env-secret' });
    expect(event.method).toBe('OTHER');
    expect(event.environment).toBe('unknown');
    expect(event.requestId).not.toBe('private-email');
    expect(JSON.stringify(event)).not.toMatch(/private-email|CUSTOM|env-secret/);
  });

  it.each([[401, 'AUTHENTICATION'], [403, 'AUTHORIZATION'], [409, 'CONFLICT'], [429, 'RATE_LIMITED'],
    [422, 'VALIDATION'], [503, 'UNAVAILABLE'], [500, 'SERVER_ERROR']] as const)('classifies %s without inspecting response data', (status, errorClass) => {
    expect(buildRequestTelemetry({ ...input, status }).errorClass).toBe(errorClass);
  });

  it('marks unexpected error with a bounded class and clamps invalid measurement values', () => {
    expect(buildRequestTelemetry({ ...input, status: NaN, durationMs: Infinity, internalError: true }))
      .toMatchObject({ status: 500, durationMs: 0, errorClass: 'INTERNAL_SERVER_ERROR' });
    expect(buildRequestTelemetry({ ...input, durationMs: -50 }).durationMs).toBe(0);
    expect(buildRequestTelemetry({ ...input, durationMs: Number.MAX_SAFE_INTEGER }).durationMs).toBe(86_400_000);
  });

  it('contains telemetry sink failures without changing request behavior or logging fallbacks', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => { throw new Error('sink unavailable'); });
    expect(() => emitRequestTelemetry(buildRequestTelemetry(input))).not.toThrow();
    expect(log).toHaveBeenCalledTimes(1);
  });
});
