// Persistent write-outbox for offline-safe mutations.
// The queue stores the exact request and owner scope, without auth tokens.
// A native localStorage write must succeed before callers report pending sync.

const STORAGE_KEY = 'frigo_sync_outbox_v1';

import { onPrivateSessionReset, privateSessionBlocked } from './private-session';

export interface PendingOp {
  id: string;
  /** Stable operation identifier used for server idempotency/audit. */
  operationId?: string;
  ts: number;
  /** API path relative to BASE_URL, e.g. "/inventory" */
  path: string;
  method: string;
  /** JSON request body string, if any */
  body?: string;
  /** Headers required to preserve a command contract during replay. */
  headers?: Record<string, string>;
  /** Human-readable label for the UI ("Thêm thịt ba chỉ") */
  label: string;
  /** Identity that created the operation; prevents replay into another tenant. */
  userId?: string;
  householdId?: string;
  /** Optional caller-provided key for mutations that are safe to coalesce. */
  dedupeKey?: string;
}

export interface PendingScope {
  userId: string;
  householdId: string;
}

export class OutboxPersistenceError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'OutboxPersistenceError';
  }
}

type Listener = (count: number | null) => void;
const listeners = new Set<Listener>();

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function validateRecord(value: unknown): asserts value is PendingOp {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new OutboxPersistenceError('Invalid offline outbox record');
  }
  const op = value as Record<string, unknown>;
  if (!nonEmptyString(op.id) || !nonEmptyString(op.operationId) ||
      !nonEmptyString(op.userId) || !nonEmptyString(op.householdId) ||
      typeof op.ts !== 'number' || !Number.isFinite(op.ts) ||
      !nonEmptyString(op.path) || !nonEmptyString(op.method) || typeof op.label !== 'string' ||
      (op.body !== undefined && typeof op.body !== 'string') ||
      (op.dedupeKey !== undefined && typeof op.dedupeKey !== 'string') ||
      (op.headers !== undefined && (!op.headers || typeof op.headers !== 'object' ||
        Array.isArray(op.headers) || Object.values(op.headers).some((value) => typeof value !== 'string')))) {
    throw new OutboxPersistenceError('Invalid offline outbox record');
  }
}

function load(): PendingOp[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return [];
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr)) throw new OutboxPersistenceError('Offline outbox must contain an array');
    arr.forEach(validateRecord);
    return arr as PendingOp[];
  } catch (cause) {
    if (cause instanceof OutboxPersistenceError) throw cause;
    throw new OutboxPersistenceError('Cannot read offline outbox', { cause });
  }
}

function notify(count: number | null): void {
  listeners.forEach((fn) => {
    try {
      fn(count);
    } catch {
      // Listener failures must not change the durable write result.
    }
  });
}

function emit(): void {
  notify(pendingCount());
}

function save(ops: PendingOp[]): void {
  ops.forEach(validateRecord);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ops));
  } catch (cause) {
    notify(null);
    throw new OutboxPersistenceError('Cannot persist offline outbox', { cause });
  }
  // Native setItem success accepts the write; diagnostic reads cannot reject it.
  emit();
}

export function pushOp(op: Omit<PendingOp, 'id' | 'ts'>): PendingOp {
  if (privateSessionBlocked() || !op.userId || !op.householdId) {
    throw new Error('Private operation requires an active owner');
  }
  const operationId = op.operationId || `op_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const full: PendingOp = {
    ...op,
    operationId,
    id: operationId,
    ts: Date.now(),
  };
  validateRecord(full);
  const ops = load();

  // Only callers that explicitly opt in may coalesce operations. Blindly
  // deduplicating by body would lose legitimate repeated actions (for example,
  // cooking the same recipe twice while offline).
  if (full.dedupeKey) {
    const duplicate = ops.find(
      (existing) =>
        existing.dedupeKey === full.dedupeKey &&
        existing.userId === full.userId &&
        existing.householdId === full.householdId
    );
    if (duplicate) {
      emit();
      return duplicate;
    }
  }

  ops.push(full);
  save(ops);
  return full;
}

/** Return a snapshot for diagnostics/UI without exposing the mutable queue. */
export function getPendingOps(): PendingOp[] {
  return load().map((op) => ({ ...op, headers: op.headers ? { ...op.headers } : undefined }));
}

/**
 * Adopt queued mutations when a guest household is migrated into a newly
 * authenticated household. Only an exact source scope can be rebound.
 */
export function rebindPendingOps(from: PendingScope, to: PendingScope): number {
  if (from.userId === to.userId && from.householdId === to.householdId) return 0;

  const ops = load();
  let rebound = 0;
  let changed = false;
  const next: PendingOp[] = [];
  for (const op of ops) {
    if (op.userId !== from.userId || op.householdId !== from.householdId) {
      next.push(op);
      continue;
    }

    const candidate = { ...op, ...to };
    if (
      candidate.dedupeKey &&
      next.some(
        (existing) =>
          existing.dedupeKey === candidate.dedupeKey &&
          existing.userId === to.userId &&
          existing.householdId === to.householdId
      )
    ) {
      // The source operation is intentionally discarded because an equivalent
      // target-scope command is already queued. Persist this removal even when
      // no operation was rebound; otherwise it would remain stranded forever.
      changed = true;
      continue;
    }
    next.push(candidate);
    rebound++;
    changed = true;
  }

  if (changed) save(next);
  return rebound;
}

export function removeOp(id: string): void {
  const ops = load();
  const next = ops.filter((o) => o.id !== id);
  if (next.length !== ops.length) save(next);
}

/** null means the queue cannot be read; it must never be shown as empty. */
export function pendingCount(scope?: PendingScope): number | null {
  try {
    const ops = load();
    if (!scope) return ops.length;
    return ops.filter((op) => op.userId === scope.userId && op.householdId === scope.householdId).length;
  } catch {
    return null;
  }
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  // fire immediately with current count
  try {
    fn(pendingCount());
  } catch {
    /* ignore */
  }
  return () => {
    listeners.delete(fn);
  };
}

/**
 * Replay all queued writes. A rejected replay stops the flush unless the HTTP
 * classifier permits dropping it. Persistence errors reject and retain the op.
 */
async function flushOnce(
  replay: (op: PendingOp) => Promise<void>,
  isNonRetryable?: (err: unknown) => boolean,
  options?: { scope?: PendingScope | (() => PendingScope); canReplay?: () => boolean }
): Promise<{ attempted: number; remaining: number }> {
  const ops = load();
  let attempted = 0;
  for (const op of ops) {
    if (privateSessionBlocked() || options?.canReplay?.() === false) break;
    // Operations from a different account/household stay queued for that
    // identity. Replaying them with another session would be a data leak.
    const scope = typeof options?.scope === 'function' ? options.scope() : options?.scope;
    if (
      !scope || !scope.userId || !scope.householdId ||
      op.userId !== scope.userId || op.householdId !== scope.householdId
    ) {
      continue;
    }

    try {
      await replay(op);
    } catch (err) {
      if (isNonRetryable && isNonRetryable(err)) {
        // Server definitively rejected this op; removal failures must escape.
        removeOp(op.id);
        continue;
      }
      // Still offline or transient error - stop, keep the rest queued.
      break;
    }
    attempted++;
    // Storage failure after replay must not enter the HTTP classifier.
    removeOp(op.id);
  }
  return { attempted, remaining: load().length };
}

// Serialize flushes in this tab. Without a mutex, online, load, and the
// manual retry action can all observe the same operation before it is removed.
let flushChain: Promise<void> = Promise.resolve();

export function flush(
  replay: (op: PendingOp) => Promise<void>,
  isNonRetryable?: (err: unknown) => boolean,
  options?: { scope?: PendingScope | (() => PendingScope); canReplay?: () => boolean }
): Promise<{ attempted: number; remaining: number }> {
  const result = flushChain.then(() => flushOnce(replay, isNonRetryable, options));
  flushChain = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

/**
 * Wire browser connectivity events so queued writes auto-replay when the device
 * comes back online. `retry` should call services/api retryPendingWrites().
 * Safe to call more than once (idempotent guard).
 */
let initialized = false;
export function initSync(retry: () => Promise<unknown>): void {
  if (initialized) return;
  initialized = true;
  const onUp = () => {
    void retry().catch(() => emit());
  };
  window.addEventListener('online', onUp);
  // Opportunistic flush shortly after load too (covers already-online restarts).
  window.addEventListener('load', () => {
    if (navigator.onLine) onUp();
  });
}

onPrivateSessionReset(emit);
