import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { pathToFileURL } from 'node:url';
import { validateMigrationCandidate } from './d1-migration-check.mjs';
import { hostedCi, requireCurrentHostedMain } from './release-check.mjs';
import { run, stagingConfig } from './staging-d1-migration-check.mjs';

export const PRE_TIP = '0039_meal_composition_v2.sql';
export const TIP = '0040_strict_otp_foundation.sql';
const schemaSql = "SELECT type, name, sql FROM sqlite_master WHERE tbl_name LIKE 'auth_otp_%' AND tbl_name <> 'auth_otps' AND sql IS NOT NULL ORDER BY name";
export const schemaQuery = () => schemaSql;

export function verifyStrictOtpSchema(statements) {
  const database = new DatabaseSync(':memory:');
  try {
    database.exec(readFileSync(`migrations/${TIP}`, 'utf8'));
    const expected = database.prepare(schemaSql).all();
    const actual = statements?.[0]?.results;
    if (!Array.isArray(statements) || statements.length !== 1 || statements[0]?.success !== true || !Array.isArray(actual))
      throw new Error('Expected one successful strict OTP schema result');
    const normalize = (rows) => rows.map(({ type, name, sql }) => ({ type, name, sql: sql.replace(/\s+/g, ' ').trim() }));
    if (JSON.stringify(normalize(actual)) !== JSON.stringify(normalize(expected)))
      throw new Error('Strict OTP tables, indexes or constraints differ from reviewed migration 0040');
    return { objects: expected.map((row) => row.name), constraints: 'PASS' };
  } finally { database.close(); }
}

export async function gate(ref) {
  if (process.env.GITHUB_REF !== 'refs/heads/main') throw new Error('Dispatch must run from main');
  if (process.env.GITHUB_REPOSITORY !== 'vn-tak/Tako-san') throw new Error('Canonical repository required');
  const candidate = validateMigrationCandidate({ ref, expectedPreTip: PRE_TIP, migration: TIP });
  if (candidate.sha !== candidate.mainSha) throw new Error('Migration ref must equal current main');
  const ci = await hostedCi(candidate.sha, process.env.GITHUB_REPOSITORY);
  await requireCurrentHostedMain({ sha: candidate.sha, repository: process.env.GITHUB_REPOSITORY });
  return { sha: candidate.sha, schema: candidate.schema, chain: candidate.chain,
    database: stagingConfig(), ci, checkedAt: new Date().toISOString() };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [command, file, ...args] = process.argv.slice(2);
  run(command, file, args, { preTip: PRE_TIP, tip: TIP, gate, schemaQuery,
    verifySchema: verifyStrictOtpSchema, status: 'STAGING_0040_CERTIFIED' }).then((value) => {
    if (command === 'query') process.stdout.write(value);
    else console.log(`Staging strict OTP ${command}: ${value.status ?? 'PASS'}`);
  }).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
