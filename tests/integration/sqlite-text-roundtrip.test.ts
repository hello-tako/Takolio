import { describe, expect, it } from 'vitest';
import { SqliteD1 } from '../helpers/sqlite-d1';

describe('SQLite test runtime text fidelity', () => {
  it('retains embedded NUL when reading text used by adoption validation', () => {
    const db = new SqliteD1({ migrate: false });
    try {
      const value = 'spice\0forged';
      expect(db.query('SELECT ? AS value, hex(?) AS bytes', value, value))
        .toEqual([{ value, bytes: '737069636500666F72676564' }]);
    } finally { db.close(); }
  });
});
