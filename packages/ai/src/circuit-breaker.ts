export const CIRCUIT_PROVIDERS = [
  'qwen',
  'cloudflare',
  'deepseek',
  'groq',
  'culinary_knowledge_engine',
] as const;

export type CircuitProviderId = (typeof CIRCUIT_PROVIDERS)[number];
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  /** Sliding window size in calls (default: 25). */
  windowSize?: number;
  /** Sliding window retention duration in milliseconds (default: 300_000 / 5 min). */
  windowDurationMs?: number;
  /** Minimum calls in window before error-rate tripping applies (default: 4). */
  minCallsBeforeTrip?: number;
  /** Error rate [0..1] that trips CLOSED -> OPEN (default: 0.5). */
  errorRateThreshold?: number;
  /** Consecutive timeout streak that immediately trips CLOSED -> OPEN (default: 3). */
  maxTimeoutStreak?: number;
  /** Consecutive failure streak that trips CLOSED -> OPEN (default: 4). */
  maxConsecutiveFailures?: number;
  /** Base cooldown in OPEN before HALF_OPEN probe (default: 20_000 ms). */
  baseCooldownMs?: number;
  /** Maximum exponential cooldown in OPEN (default: 120_000 ms). */
  maxCooldownMs?: number;
  /** Default HTTP 429 rate-limit cooldown when Retry-After is absent (default: 30_000 ms). */
  rateLimitCooldownMs?: number;
  /** Degraded p95 latency warning threshold in ms (default: 8_500 ms). */
  degradedP95LatencyMs?: number;
}

interface CallSample {
  timestampMs: number;
  ok: boolean;
  latencyMs: number;
  isTimeout: boolean;
  isRateLimited: boolean;
  errorCode?: string;
}

export interface ProviderCircuitSnapshot {
  provider: CircuitProviderId;
  state: CircuitState;
  healthy: boolean;
  degradedLatency: boolean;
  windowSampleCount: number;
  errorRate: number;
  p95LatencyMs: number | null;
  avgLatencyMs: number | null;
  consecutiveFailures: number;
  consecutiveTimeouts: number;
  rateLimitedUntilIso: string | null;
  nextAttemptAtIso: string | null;
  lastErrorCode: string | null;
  totalCalls: number;
  totalFallbacksOrErrors: number;
}

export interface FailureMetadata {
  isTimeout?: boolean;
  isRateLimited?: boolean;
  retryAfterMs?: number;
  errorCode?: string;
  status?: number;
}

class SingleProviderCircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private samples: CallSample[] = [];
  private consecutiveFailures = 0;
  private consecutiveTimeouts = 0;
  private openStreak = 0;
  private nextAttemptAtMs = 0;
  private rateLimitUntilMs = 0;
  private halfOpenProbeInFlight = false;
  private lastErrorCode: string | null = null;
  private totalCalls = 0;
  private totalFailures = 0;

  private readonly windowSize: number;
  private readonly windowDurationMs: number;
  private readonly minCallsBeforeTrip: number;
  private readonly errorRateThreshold: number;
  private readonly maxTimeoutStreak: number;
  private readonly maxConsecutiveFailures: number;
  private readonly baseCooldownMs: number;
  private readonly maxCooldownMs: number;
  private readonly rateLimitCooldownMs: number;
  private readonly degradedP95LatencyMs: number;

  constructor(
    readonly provider: CircuitProviderId,
    config: CircuitBreakerConfig = {},
  ) {
    this.windowSize = Math.max(5, config.windowSize ?? 25);
    this.windowDurationMs = Math.max(10_000, config.windowDurationMs ?? 5 * 60_000);
    this.minCallsBeforeTrip = Math.max(2, config.minCallsBeforeTrip ?? 4);
    this.errorRateThreshold = Math.min(1, Math.max(0.1, config.errorRateThreshold ?? 0.5));
    this.maxTimeoutStreak = Math.max(1, config.maxTimeoutStreak ?? 3);
    this.maxConsecutiveFailures = Math.max(2, config.maxConsecutiveFailures ?? 4);
    this.baseCooldownMs = Math.max(1_000, config.baseCooldownMs ?? 20_000);
    this.maxCooldownMs = Math.max(this.baseCooldownMs, config.maxCooldownMs ?? 120_000);
    this.rateLimitCooldownMs = Math.max(2_000, config.rateLimitCooldownMs ?? 30_000);
    this.degradedP95LatencyMs = Math.max(1_000, config.degradedP95LatencyMs ?? 8_500);
  }

  private pruneWindow(nowMs: number): void {
    const cutoff = nowMs - this.windowDurationMs;
    if (this.samples.length > 0 && this.samples[0].timestampMs < cutoff) {
      this.samples = this.samples.filter((sample) => sample.timestampMs >= cutoff);
    }
    if (this.samples.length > this.windowSize) {
      this.samples = this.samples.slice(this.samples.length - this.windowSize);
    }
  }

  private syncStateForTime(nowMs: number): void {
    if (this.provider === 'culinary_knowledge_engine') {
      this.state = 'CLOSED';
      return;
    }
    if (this.state === 'OPEN') {
      const effectiveUnlock = Math.max(this.nextAttemptAtMs, this.rateLimitUntilMs);
      if (nowMs >= effectiveUnlock) {
        this.state = 'HALF_OPEN';
        this.halfOpenProbeInFlight = false;
      }
    }
  }

  canExecute(nowMs = Date.now()): boolean {
    if (this.provider === 'culinary_knowledge_engine') return true;
    this.syncStateForTime(nowMs);
    if (nowMs < this.rateLimitUntilMs) return false;
    if (this.state === 'CLOSED') return true;
    if (this.state === 'HALF_OPEN') return !this.halfOpenProbeInFlight;
    return false;
  }

  acquireSlot(nowMs = Date.now()): boolean {
    if (!this.canExecute(nowMs)) return false;
    if (this.state === 'HALF_OPEN') {
      this.halfOpenProbeInFlight = true;
    }
    return true;
  }

  recordSuccess(latencyMs: number, nowMs = Date.now()): void {
    const boundedLatency = Math.max(0, Math.round(latencyMs));
    this.totalCalls += 1;
    this.pruneWindow(nowMs);
    this.samples.push({
      timestampMs: nowMs,
      ok: true,
      latencyMs: boundedLatency,
      isTimeout: false,
      isRateLimited: false,
    });
    this.pruneWindow(nowMs);

    this.consecutiveFailures = 0;
    this.consecutiveTimeouts = 0;
    this.halfOpenProbeInFlight = false;
    if (this.state === 'HALF_OPEN' || this.state === 'OPEN') {
      this.state = 'CLOSED';
      this.openStreak = 0;
      this.nextAttemptAtMs = 0;
    }
  }

  recordFailure(latencyMs: number, meta: FailureMetadata = {}, nowMs = Date.now()): void {
    if (this.provider === 'culinary_knowledge_engine') return;

    const boundedLatency = Math.max(0, Math.round(latencyMs));
    const isRateLimited = meta.isRateLimited === true || meta.status === 429 || meta.errorCode === 'RATE_LIMITED';
    const isTimeout = meta.isTimeout === true || meta.status === 408 || meta.errorCode === 'REQUEST_TIMEOUT';

    this.totalCalls += 1;
    this.totalFailures += 1;
    this.lastErrorCode = meta.errorCode ?? (isRateLimited ? 'RATE_LIMITED' : isTimeout ? 'REQUEST_TIMEOUT' : 'UPSTREAM_ERROR');
    this.consecutiveFailures += 1;
    this.consecutiveTimeouts = isTimeout ? this.consecutiveTimeouts + 1 : 0;
    this.halfOpenProbeInFlight = false;

    this.pruneWindow(nowMs);
    this.samples.push({
      timestampMs: nowMs,
      ok: false,
      latencyMs: boundedLatency,
      isTimeout,
      isRateLimited,
      errorCode: this.lastErrorCode,
    });
    this.pruneWindow(nowMs);

    if (isRateLimited) {
      const cooldown = Math.min(
        this.maxCooldownMs,
        Math.max(1_000, meta.retryAfterMs ?? this.rateLimitCooldownMs),
      );
      this.rateLimitUntilMs = Math.max(this.rateLimitUntilMs, nowMs + cooldown);
    }

    const errorCount = this.samples.filter((s) => !s.ok).length;
    const errorRate = this.samples.length > 0 ? errorCount / this.samples.length : 0;

    const shouldTrip =
      this.state === 'HALF_OPEN' ||
      isRateLimited ||
      this.consecutiveTimeouts >= this.maxTimeoutStreak ||
      this.consecutiveFailures >= this.maxConsecutiveFailures ||
      (this.samples.length >= this.minCallsBeforeTrip && errorRate >= this.errorRateThreshold);

    if (shouldTrip) {
      this.state = 'OPEN';
      this.openStreak += 1;
      const exponentialCooldown = Math.min(
        this.maxCooldownMs,
        this.baseCooldownMs * Math.pow(2, Math.max(0, this.openStreak - 1)),
      );
      this.nextAttemptAtMs = Math.max(this.rateLimitUntilMs, nowMs + exponentialCooldown);
    }
  }

  snapshot(nowMs = Date.now()): ProviderCircuitSnapshot {
    this.syncStateForTime(nowMs);
    this.pruneWindow(nowMs);

    const count = this.samples.length;
    const errorCount = this.samples.filter((s) => !s.ok).length;
    const errorRate = count > 0 ? Math.round((errorCount / count) * 1000) / 1000 : 0;

    let p95LatencyMs: number | null = null;
    let avgLatencyMs: number | null = null;
    if (count > 0) {
      const sorted = this.samples.map((s) => s.latencyMs).sort((a, b) => a - b);
      const p95Index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * 0.95) - 1));
      p95LatencyMs = sorted[p95Index];
      const sum = sorted.reduce((acc, val) => acc + val, 0);
      avgLatencyMs = Math.round(sum / count);
    }

    const rateLimitedActive = nowMs < this.rateLimitUntilMs;
    const effectiveNextAttempt = Math.max(this.nextAttemptAtMs, this.rateLimitUntilMs);

    return {
      provider: this.provider,
      state: this.state,
      healthy: this.state === 'CLOSED' && !rateLimitedActive,
      degradedLatency: p95LatencyMs !== null && p95LatencyMs >= this.degradedP95LatencyMs,
      windowSampleCount: count,
      errorRate,
      p95LatencyMs,
      avgLatencyMs,
      consecutiveFailures: this.consecutiveFailures,
      consecutiveTimeouts: this.consecutiveTimeouts,
      rateLimitedUntilIso: rateLimitedActive ? new Date(this.rateLimitUntilMs).toISOString() : null,
      nextAttemptAtIso:
        this.state === 'OPEN' && effectiveNextAttempt > nowMs
          ? new Date(effectiveNextAttempt).toISOString()
          : null,
      lastErrorCode: this.lastErrorCode,
      totalCalls: this.totalCalls,
      totalFallbacksOrErrors: this.totalFailures,
    };
  }

  reset(): void {
    this.state = 'CLOSED';
    this.samples = [];
    this.consecutiveFailures = 0;
    this.consecutiveTimeouts = 0;
    this.openStreak = 0;
    this.nextAttemptAtMs = 0;
    this.rateLimitUntilMs = 0;
    this.halfOpenProbeInFlight = false;
    this.lastErrorCode = null;
    this.totalCalls = 0;
    this.totalFailures = 0;
  }
}

export class ProviderCircuitBreakerRegistry {
  private readonly breakers = new Map<CircuitProviderId, SingleProviderCircuitBreaker>();

  constructor(config: CircuitBreakerConfig = {}) {
    for (const provider of CIRCUIT_PROVIDERS) {
      this.breakers.set(provider, new SingleProviderCircuitBreaker(provider, config));
    }
  }

  canExecute(provider: CircuitProviderId, nowMs = Date.now()): boolean {
    return this.breakers.get(provider)?.canExecute(nowMs) ?? false;
  }

  acquireSlot(provider: CircuitProviderId, nowMs = Date.now()): boolean {
    return this.breakers.get(provider)?.acquireSlot(nowMs) ?? false;
  }

  recordSuccess(provider: CircuitProviderId, latencyMs: number, nowMs = Date.now()): void {
    this.breakers.get(provider)?.recordSuccess(latencyMs, nowMs);
  }

  recordFailure(provider: CircuitProviderId, latencyMs: number, meta: FailureMetadata = {}, nowMs = Date.now()): void {
    this.breakers.get(provider)?.recordFailure(latencyMs, meta, nowMs);
  }

  getSnapshot(provider: CircuitProviderId, nowMs = Date.now()): ProviderCircuitSnapshot {
    const breaker = this.breakers.get(provider);
    if (!breaker) {
      throw new Error(`Unknown circuit provider: ${String(provider)}`);
    }
    return breaker.snapshot(nowMs);
  }

  getAllSnapshots(nowMs = Date.now()): Record<CircuitProviderId, ProviderCircuitSnapshot> {
    return {
      qwen: this.getSnapshot('qwen', nowMs),
      cloudflare: this.getSnapshot('cloudflare', nowMs),
      deepseek: this.getSnapshot('deepseek', nowMs),
      groq: this.getSnapshot('groq', nowMs),
      culinary_knowledge_engine: this.getSnapshot('culinary_knowledge_engine', nowMs),
    };
  }

  reset(provider?: CircuitProviderId): void {
    if (provider) {
      this.breakers.get(provider)?.reset();
      return;
    }
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }
}

export const globalCircuitBreakerRegistry = new ProviderCircuitBreakerRegistry();
