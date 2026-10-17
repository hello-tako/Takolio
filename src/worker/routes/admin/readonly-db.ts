import type { D1DatabaseBinding } from '@frigo/db';

export class ReadOnlyViolation extends Error {
  constructor() {
    super('Admin access to the customer database is read-only');
    this.name = 'ReadOnlyViolation';
  }
}

const MUTATING = /\b(INSERT|UPDATE|DELETE|REPLACE|UPSERT|CREATE|DROP|ALTER|ATTACH|DETACH|PRAGMA|VACUUM|REINDEX|ANALYZE|SAVEPOINT|RELEASE|BEGIN|COMMIT|ROLLBACK|TRIGGER)\b/i;

export function assertReadOnlySql(sql: string): void {
  if (!/^\s*(SELECT|WITH)\b/i.test(sql) || MUTATING.test(sql) || sql.includes(';')) throw new ReadOnlyViolation();
}

/**
 * Wraps the customer database so admin code can only run single SELECT
 * statements. D1 has no read-only binding; this is the enforcement point in code.
 */
export function readOnlyDatabase(db: D1DatabaseBinding): D1DatabaseBinding {
  return {
    prepare(sql: string) {
      assertReadOnlySql(sql);
      return db.prepare(sql);
    },
    async batch() {
      throw new ReadOnlyViolation();
    },
    async exec() {
      throw new ReadOnlyViolation();
    },
  };
}
