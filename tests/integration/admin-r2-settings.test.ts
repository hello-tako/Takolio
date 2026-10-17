import { afterAll, afterEach, beforeAll, expect, it } from 'vitest';
import { call, closeDatabases, createDatabases, fx, localEnv, login, setLocalAuthBuild, type Databases } from '../helpers/admin-harness';

let dbs: Databases | undefined;
beforeAll(() => setLocalAuthBuild(true));
afterAll(() => setLocalAuthBuild(false));
afterEach(() => { closeDatabases(dbs); dbs = undefined; });

it('governance labels use enrolled Admin identities without depending on customer records', async () => {
  dbs = createDatabases();
  const env = localEnv(dbs);
  const session = await login(env, fx('super'));
  dbs.admin.seed("UPDATE operator_identity_bindings SET display_name='Independent operator' WHERE user_id='fx_admin_super2'");
  dbs.main.hooks.beforeStatement = () => { throw new Error('Customer database unavailable'); };
  const settings = await call('/api/v1/admin/settings', { env, session });
  expect(settings.status).toBe(200);
  const assignments = (settings.json as { data: { assignments: Array<{ userId: string; userDisplayName: string }> } }).data.assignments;
  expect(assignments.find(row => row.userId === 'fx_admin_super2')?.userDisplayName).toBe('Independent operator');
});
