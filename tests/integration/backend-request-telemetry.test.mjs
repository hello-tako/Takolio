import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../../src/worker/index';

vi.mock('../../src/worker/services/email', () => ({ sendEmail: vi.fn(), buildOtpEmail: vi.fn() }));
let logSpy;
let errorSpy;
beforeEach(() => {
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());
function requestEvents() { return logSpy.mock.calls.map(([line]) => JSON.parse(String(line))).filter((row) => row.event === 'http_request'); }
function allLogs() { return JSON.stringify([...logSpy.mock.calls, ...errorSpy.mock.calls]); }

const production = { ENVIRONMENT: 'production', APP_URL: 'https://app.example.com', DB: {}, CACHE: {}, AI: {}, SCAN_QUEUE: {},
  QWEN_API_KEY: 'test-key', JWT_SECRET: 'test-only-jwt-secret'.repeat(3), OTP_HASH_SECRET: 'test-only-otp-secret',
  TURNSTILE_SITE_KEY: 'test-site', TURNSTILE_SECRET_KEY: 'test-secret' };

describe('Worker request telemetry privacy and response compatibility', () => {
  it('preserves health/CORS/response ID while logging no caller-controlled query, headers or ID', async () => {
    const response = await worker.fetch(new Request('https://app.example.com/api/v1/health?email=private@example.test&otp=123456', {
      headers: { Origin: 'https://app.example.com', 'X-Request-ID': 'client_OTP_123456', Cookie: 'session=private-session',
        Authorization: 'Bearer private-token', 'X-User-ID': 'foreign-user' },
    }), production);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'ok', app: 'Frigo' });
    expect(response.headers.get('X-Request-ID')).toBe('client_OTP_123456');
    expect(response.headers.get('Access-Control-Expose-Headers')).toBe('X-Request-Id');
    expect(requestEvents()).toMatchObject([{ routeTemplate: '/api/v1/health', status: 200, errorClass: 'NONE' }]);
    expect(allLogs()).not.toMatch(/private|123456|foreign|client_OTP|session=|Bearer/);
  });

  it('logs developer route template instead of dynamic identifiers even on unauthenticated denial', async () => {
    const response = await worker.fetch(new Request('https://app.example.com/api/v1/scans/private-image-key@example.test?receipt=private-receipt', {
      headers: { 'X-Request-ID': 'private@example.test' },
    }), { ENVIRONMENT: 'development' });
    expect(response.status).toBe(401);
    expect(response.headers.get('X-Request-ID')).toMatch(/^[0-9a-f-]{36}$/);
    expect(requestEvents()).toMatchObject([{ status: 401, errorClass: 'AUTHENTICATION' }]);
    expect(allLogs()).not.toMatch(/private|image-key|receipt=|example/);
  });

  it('logs no SPA/raw path identifiers for an unmatched request', async () => {
    const response = await worker.fetch(new Request('https://app.example.com/private-user-secret/path?image=private-base64'), { ENVIRONMENT: 'development' });
    expect(response.status).toBe(200);
    expect(requestEvents()).toMatchObject([{ routeTemplate: 'UNMATCHED_OR_GATED', status: 200 }]);
    expect(allLogs()).not.toMatch(/private|base64|path\?/);
  });

  it('sanitizes global internal-error logs and reports the actual 500 without changing production error response', async () => {
    const response = await worker.fetch(new Request('https://app.example.com/private-path', { headers: { 'X-Request-ID': 'otp_123456' } }),
      { ...production, ASSETS: { fetch: async () => { throw new Error('private-stack-email@example.test image-secret'); } } });
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Đã xảy ra lỗi máy chủ nội bộ', code: 'INTERNAL_SERVER_ERROR' });
    expect(response.headers.get('X-Request-ID')).toBe('otp_123456');
    expect(requestEvents()).toMatchObject([{ status: 500, errorClass: 'INTERNAL_SERVER_ERROR' }]);
    expect(allLogs()).not.toMatch(/private|123456|otp_|image-secret|example/);
  });

  it('uses server correlation in pre-route configuration gate diagnostics too', async () => {
    const response = await worker.fetch(new Request('https://app.example.com/api/v1/health', { headers: { 'X-Request-ID': 'client_123456' } }),
      { ENVIRONMENT: 'production' });
    expect(response.status).toBe(503);
    expect(requestEvents()).toMatchObject([{ status: 503, routeTemplate: 'UNMATCHED_OR_GATED', errorClass: 'UNAVAILABLE' }]);
    expect(allLogs()).not.toContain('client_123456');
    expect(errorSpy.mock.calls).toHaveLength(1);
  });

  it('keeps successful health response when the telemetry sink throws', async () => {
    logSpy.mockImplementation(() => { throw new Error('Sink fixture unavailable'); });
    const response = await worker.fetch(new Request('https://app.example.com/api/v1/health'), { ENVIRONMENT: 'development' });
    expect(response.status).toBe(200);
  });
});
