import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { SqliteD1 } from '../helpers/sqlite-d1';

const databases: SqliteD1[] = [];
afterEach(() => { for (const db of databases.splice(0)) db.close(); });
function migrated() {
  const db = new SqliteD1({ through: '0045_week_swap_receipts.sql' });
  databases.push(db);
  db.seed(`INSERT INTO users(id) VALUES ('content-user');
    INSERT INTO households(id,name,created_by) VALUES ('content-house','Content','content-user');
    INSERT INTO cooked_meals(id,household_id,user_id,recipe_id,servings_cooked,deductions_applied)
    VALUES ('old-cook','content-house','content-user','gl-03',2,'[]');`);
  const before = db.query('SELECT * FROM cooked_meals');
  db.seed(readFileSync('migrations/0046_recipe_content_versions.sql', 'utf8'));
  return { db, before };
}
const fingerprint = 'a'.repeat(64);
function archive(db: SqliteD1) {
  db.execute('INSERT INTO recipe_content_versions(fingerprint,recipe_id,slug,content_json) VALUES (?,?,?,?)',
    [fingerprint, 'gl-03', 'archived-egg', JSON.stringify({ id: 'gl-03', slug: 'archived-egg' })]);
}
describe('0046 cooking history and old Worker coexistence', () => {
  it('preserves populated history; an old Worker can still insert an unknown version', () => {
    const { db, before } = migrated();
    expect(db.query('SELECT * FROM cooked_meals')).toEqual(before.map(row => ({ ...row,
      recipe_content_fingerprint: null, request_fingerprint: null })));
    db.seed(`INSERT INTO cooked_meals(id,household_id,user_id,recipe_id,servings_cooked,deductions_applied)
      VALUES ('old-worker','content-house','content-user','gl-03',2,'[]');`);
    expect(db.query('SELECT recipe_content_fingerprint,request_fingerprint FROM cooked_meals WHERE id = ?', 'old-worker'))
      .toEqual([{ recipe_content_fingerprint: null, request_fingerprint: null }]);
    expect(db.query('PRAGMA foreign_key_check')).toEqual([]);
    expect(db.query('PRAGMA integrity_check')).toEqual([{ integrity_check: 'ok' }]);
  });
  it('retains immutable archive bytes and rejects identity mismatches and replacement', () => {
    const { db } = migrated(); archive(db);
    expect(() => db.seed('DELETE FROM recipe_content_versions')).toThrow('retained');
    expect(() => db.seed("UPDATE recipe_content_versions SET slug = 'changed'")).toThrow('immutable');
    expect(() => db.execute('INSERT OR REPLACE INTO recipe_content_versions(fingerprint,recipe_id,slug,content_json) VALUES (?,?,?,?)',
      [fingerprint, 'gl-03', 'changed', '{"id":"gl-03","slug":"changed"}'])).toThrow('already exists');
    expect(() => db.execute('INSERT INTO recipe_content_versions(fingerprint,recipe_id,slug,content_json) VALUES (?,?,?,?)',
      ['b'.repeat(64), 'gl-03', 'wrong', '{"id":"gl-04","slug":"wrong"}'])).toThrow();
  });
  it('guards household access and immutable receipt identity independently of mutable recipes', () => {
    const { db } = migrated(); archive(db);
    expect(() => db.execute('INSERT INTO recipe_content_access(household_id,fingerprint) VALUES (?,?)',
      ['other-house', fingerprint])).toThrow('FOREIGN KEY');
    db.execute('INSERT INTO recipe_content_access(household_id,fingerprint) VALUES (?,?)', ['content-house', fingerprint]);
    expect(() => db.execute(`INSERT INTO cooked_meals(id,household_id,user_id,recipe_id,servings_cooked,deductions_applied,recipe_content_fingerprint)
      VALUES ('wrong-cook','content-house','content-user','gl-04',2,'[]',?)`, [fingerprint])).toThrow('does not match');
    db.execute(`INSERT INTO cooked_meals(id,household_id,user_id,recipe_id,servings_cooked,deductions_applied,recipe_content_fingerprint,request_fingerprint)
      VALUES ('new-cook','content-house','content-user','gl-03',2,'[]',?,'original-request')`, [fingerprint]);
    expect(() => db.seed("UPDATE cooked_meals SET request_fingerprint = 'changed' WHERE id = 'new-cook'")).toThrow('immutable');
    expect(() => db.seed("UPDATE cooked_meals SET recipe_content_fingerprint = NULL WHERE id = 'new-cook'")).toThrow('immutable');
    db.seed("UPDATE recipes SET title = 'Future catalog title' WHERE id = 'gl-03'");
    expect(db.query('SELECT content_json FROM recipe_content_versions')).toEqual([
      { content_json: '{"id":"gl-03","slug":"archived-egg"}' },
    ]);
    expect(db.query('PRAGMA foreign_key_check')).toEqual([]);
  });
});
