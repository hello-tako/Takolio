import { describe, expect, it } from 'vitest';
import { buildSloReport } from '../../src/worker/observability/slo-report';
const base = () => ({ classification: 'SYNTHETIC', deploymentSha: 'a'.repeat(40),
  windowStart: '2026-10-01T00:00:00.000Z', windowEnd: '2026-10-08T00:00:00.000Z',
  samplingRatio: 1, allowedRouteTemplates: ['/api/v1/inventory'], minimumSamples: 20, targets: null,
  events: Array.from({ length: 20 }, (_, i) => ({ requestId: crypto.randomUUID(), routeTemplate: '/api/v1/inventory',
    status: i === 0 ? 503 : i === 1 ? 401 : 200, durationMs: i * 10,
    observedAt: '2026-10-02T00:00:00.000Z', internalError: false })) });
describe('SLO denominators and evidence boundaries', () => {
  it('keeps authentication errors visible and computes only server failure availability', () => {
    const report = buildSloReport(base());
    expect(report.routes[0]).toMatchObject({ count: 20, serverErrors: 1, clientErrors: 1,
      availability: 0.95, p95Ms: 180, status: 'TARGETS_UNSET' });
    expect(report.productionSloCertified).toBe(false);
    expect(report.windowSeconds).toBe(7 * 86400);
  });
  it('does not invent percentiles for undersampled/empty series', () => {
    const input = base(); input.events = input.events.slice(0, 1);
    expect(buildSloReport(input).routes[0]).toMatchObject({ availability: null, p95Ms: null, status: 'INSUFFICIENT_SAMPLE' });
    input.events = [];
    expect(buildSloReport(input).routes[0].availability).toBeNull();
  });
  it('retains target misses without calling synthetic target success a production certificate', () => {
    const report = buildSloReport({ ...base(), targets: { availability: 0.99, p95Ms: 200 } });
    expect(report.routes[0].status).toBe('TARGET_MISSED');
    expect(report.externalAcceptance).toBe('PENDING_EXTERNAL_EVIDENCE');
  });
  it('rejects duplicated, out-of-window, foreign/raw routes and sensitive extra fields', () => {
    const input = base();
    expect(() => buildSloReport({ ...input, events: [input.events[0], input.events[0]] })).toThrow();
    expect(() => buildSloReport({ ...input, events: [{ ...input.events[0], observedAt: input.windowEnd }] })).toThrow();
    expect(() => buildSloReport({ ...input, events: [{ ...input.events[0], routeTemplate: '/users/private-email' }] })).toThrow();
    expect(() => buildSloReport({ ...input, events: [{ ...input.events[0], email: 'secret@example.test' }] })).toThrow();
  });
});
