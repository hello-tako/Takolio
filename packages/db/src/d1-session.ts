import type { D1DatabaseBinding, D1DatabaseSession, D1SessionConstraint } from './index';

const VALID_BOOKMARK_RE = /^[A-Za-z0-9._:-]{1,256}$/;

export function sanitizeD1Bookmark(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || !VALID_BOOKMARK_RE.test(trimmed)) return null;
  return trimmed;
}

export interface ResolvedD1Session {
  db: D1DatabaseBinding;
  isNativeSession: boolean;
  getBookmark(): string | null;
}

/**
 * Wraps a Cloudflare D1 binding with the D1 Sessions API (`db.withSession(...)`)
 * when available in the runtime so read-only queries hit the nearest regional
 * read replica (Tokyo `NRT`, Frankfurt `FRA`, London `LHR`, etc.) while writes
 * and subsequent reads preserve sequential read-your-own-writes consistency
 * via `X-D1-Bookmark`. Falls back transparently on local/test SQLite bindings.
 */
export function openD1Session(
  rawDb: D1DatabaseBinding | undefined,
  options?: {
    bookmark?: string | null;
    defaultConstraint?: D1SessionConstraint;
  },
): ResolvedD1Session | null {
  if (!rawDb) return null;
  if (typeof rawDb.withSession !== 'function') {
    return {
      db: rawDb,
      isNativeSession: false,
      getBookmark: () => null,
    };
  }

  const sanitized = sanitizeD1Bookmark(options?.bookmark);
  const constraintOrBookmark = sanitized ?? options?.defaultConstraint ?? 'first-unconstrained';
  let session: D1DatabaseSession;
  try {
    session = rawDb.withSession(constraintOrBookmark);
  } catch {
    session = rawDb.withSession(options?.defaultConstraint ?? 'first-unconstrained');
  }

  const wrapped: D1DatabaseBinding = {
    prepare: (query: string) => session.prepare(query),
    batch: (statements) => session.batch(statements),
    exec: (query: string) => rawDb.exec(query),
  };

  return {
    db: wrapped,
    isNativeSession: true,
    getBookmark: () => session.getBookmark(),
  };
}
