import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { SqliteD1 } from '../helpers/sqlite-d1';

const databases: SqliteD1[] = [];
afterEach(() => { for (const db of databases.splice(0)) db.close(); });
const fingerprint = 'a'.repeat(64);

function migrated() {
  const db = new SqliteD1({ through: '0046_recipe_content_versions.sql' });
  databases.push(db);
  db.seed(`INSERT INTO users(id) VALUES ('content-user');
    INSERT INTO households(id,name,created_by) VALUES ('content-house','Content','content-user');
    INSERT INTO household_members(id,household_id,user_id,role) VALUES ('content-member','content-house','content-user','owner');
    INSERT INTO generated_meal_plans(id,household_id,creator_user_id,request_key,request_fingerprint,intent_json,result_json,source_json)
    VALUES ('content-plan','content-house','content-user','request','hash','{"version":1,"data":{}}','{"version":1,"data":{}}','{"version":1,"data":{}}');
    INSERT INTO generated_meal_plan_compositions(plan_id,household_id,creator_user_id,slot_id,mode,created_revision,updated_revision)
    VALUES ('content-plan','content-house','content-user','slot','manual',1,1);
    INSERT INTO generated_meal_plan_components(plan_id,id,slot_id,ordinal,kind,role,recipe_id,locked,provenance,created_revision,updated_revision)
    VALUES ('content-plan','old-recipe','slot',0,'recipe','main','gl-03',1,'manual',1,1);
    INSERT INTO generated_meal_plan_components(plan_id,id,slot_id,ordinal,kind,role,simple_food_id,locked,provenance,created_revision,updated_revision)
    VALUES ('content-plan','old-food','slot',1,'simple_food','simple_food','sf-rice',1,'manual',1,1);`);
  db.execute('INSERT INTO recipe_content_versions(fingerprint,recipe_id,slug,content_json) VALUES (?,?,?,?)',
    [fingerprint, 'gl-03', 'archived-egg', JSON.stringify({ id: 'gl-03', slug: 'archived-egg' })]);
  db.execute('INSERT INTO recipe_content_access(household_id,fingerprint) VALUES (?,?)', ['content-house', fingerprint]);
  const before = db.query('SELECT * FROM generated_meal_plan_components ORDER BY id');
  const archive = db.query('SELECT * FROM recipe_content_versions');
  const grants = db.query('SELECT * FROM recipe_content_access');
  db.seed(readFileSync('migrations/0047_saved_recipe_content.sql', 'utf8'));
  return { db, before, archive, grants };
}

describe('0047 saved recipe content references', () => {
  it('preserves populated legacy rows, archive and grants without inferring a pin', () => {
    const { db, before, archive, grants } = migrated();
    expect(db.query('SELECT * FROM generated_meal_plan_components ORDER BY id')).toEqual(before.map(row => ({ ...row, recipe_content_fingerprint: null })));
    expect(db.query('SELECT * FROM recipe_content_versions')).toEqual(archive);
    expect(db.query('SELECT * FROM recipe_content_access')).toEqual(grants);
    expect(db.query('PRAGMA foreign_key_check')).toEqual([]);
    expect(db.query('PRAGMA integrity_check')).toEqual([{ integrity_check: 'ok' }]);
  });
  it('accepts matching recipe pins and rejects missing, mismatched and simple-food references on insert and update', () => {
    const { db } = migrated();
    db.execute('UPDATE generated_meal_plan_components SET recipe_content_fingerprint = ? WHERE id = ?', [fingerprint, 'old-recipe']);
    expect(db.query('SELECT recipe_content_fingerprint FROM generated_meal_plan_components WHERE id = ?', 'old-recipe'))
      .toEqual([{ recipe_content_fingerprint: fingerprint }]);
    expect(() => db.execute('UPDATE generated_meal_plan_components SET recipe_id = ? WHERE id = ?', ['gl-04', 'old-recipe'])).toThrow('does not match');
    expect(() => db.execute('UPDATE generated_meal_plan_components SET recipe_content_fingerprint = ? WHERE id = ?', [fingerprint, 'old-food'])).toThrow('does not match');
    expect(() => db.execute(`INSERT INTO generated_meal_plan_components(plan_id,id,slot_id,ordinal,kind,role,recipe_id,locked,provenance,created_revision,updated_revision,recipe_content_fingerprint)
      VALUES ('content-plan','wrong','slot',2,'recipe','side','gl-04',1,'manual',1,1,?)`, [fingerprint])).toThrow('does not match');
    expect(() => db.execute(`INSERT INTO generated_meal_plan_components(plan_id,id,slot_id,ordinal,kind,role,simple_food_id,locked,provenance,created_revision,updated_revision,recipe_content_fingerprint)
      VALUES ('content-plan','wrong-food','slot',2,'simple_food','simple_food','sf-other',1,'manual',1,1,?)`, [fingerprint])).toThrow('does not match');
    expect(() => db.execute('UPDATE generated_meal_plan_components SET recipe_content_fingerprint = ? WHERE id = ?', ['b'.repeat(64), 'old-recipe'])).toThrow('does not match');
    expect(db.query('PRAGMA foreign_key_check')).toEqual([]);
  });
});
