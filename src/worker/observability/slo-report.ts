import { z } from 'zod';
const EventSchema = z.object({
  requestId: z.string().uuid(), routeTemplate: z.string().min(1).max(160),
  status: z.number().int().min(100).max(599), durationMs: z.number().finite().nonnegative().max(86_400_000),
  observedAt: z.string().datetime(), internalError: z.boolean(),
}).strict();
export const SloInputSchema = z.object({
  classification: z.enum(['SYNTHETIC', 'UNVERIFIED_IMPORT']),
  deploymentSha: z.string().regex(/^[a-f0-9]{40}$/),
  windowStart: z.string().datetime(), windowEnd: z.string().datetime(),
  samplingRatio: z.number().finite().positive().max(1),
  allowedRouteTemplates: z.array(z.string().min(1).max(160)).min(1),
  minimumSamples: z.number().int().positive().safe(),
  targets: z.object({ availability: z.number().min(0).max(1), p95Ms: z.number().finite().positive() }).strict().nullable(),
  events: z.array(EventSchema).max(1_000_000),
}).strict().superRefine((input, ctx) => {
  const start = Date.parse(input.windowStart);
  const end = Date.parse(input.windowEnd);
  if (end <= start || new Set(input.allowedRouteTemplates).size !== input.allowedRouteTemplates.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'INVALID_WINDOW_OR_ROUTES' });
  }
  const ids = new Set<string>();
  for (const event of input.events) {
    const timestamp = Date.parse(event.observedAt);
    if (timestamp < start || timestamp >= end || ids.has(event.requestId) || !input.allowedRouteTemplates.includes(event.routeTemplate)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'UNBOUND_OR_DUPLICATE_EVENT' });
    }
    ids.add(event.requestId);
  }
});
export type SloInput = z.infer<typeof SloInputSchema>;

/** Imported observations remain unverified; this reporter cannot issue a real SLO certificate. */
export function buildSloReport(raw: unknown) {
  const input = SloInputSchema.parse(raw);
  const routes = input.allowedRouteTemplates.map((routeTemplate) => {
    const events = input.events.filter((event) => event.routeTemplate === routeTemplate);
    const count = events.length;
    const serverErrors = events.filter((event) => event.status >= 500 || event.internalError).length;
    const latencies = events.map((event) => event.durationMs).sort((a, b) => a - b);
    const enough = count >= input.minimumSamples;
    const p95Ms = enough ? latencies[Math.ceil(count * 0.95) - 1] : null;
    const availability = enough ? (count - serverErrors) / count : null;
    const status = !enough ? 'INSUFFICIENT_SAMPLE' : input.targets === null ? 'TARGETS_UNSET'
      : availability! >= input.targets.availability && p95Ms! <= input.targets.p95Ms ? 'TARGET_MET' : 'TARGET_MISSED';
    return { routeTemplate, count, serverErrors, clientErrors: events.filter((event) => event.status >= 400 && event.status < 500).length,
      availability, p95Ms, status, exclusions: 0 };
  });
  return { schemaVersion: 1, classification: input.classification, deploymentSha: input.deploymentSha,
    windowStart: input.windowStart, windowEnd: input.windowEnd,
    windowSeconds: (Date.parse(input.windowEnd) - Date.parse(input.windowStart)) / 1000,
    samplingRatio: input.samplingRatio, minimumSamples: input.minimumSamples, targets: input.targets,
    externalAcceptance: 'PENDING_EXTERNAL_EVIDENCE', productionSloCertified: false,
    denominator: 'All imported completed invocations; 4xx remain visible, 5xx/internal failures reduce availability.',
    routes };
}
