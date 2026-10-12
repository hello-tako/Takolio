import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { pathToFileURL } from 'node:url';
import { validateMigrationCandidate } from './d1-migration-check.mjs';
import { hostedCi, requireCurrentHostedMain } from './release-check.mjs';
import { run, stagingConfig } from './staging-d1-migration-check.mjs';
import { requireCanonicalStagingDispatch } from './staging-otp-migration-check.mjs';

export const PRE_TIP = '0040_strict_otp_foundation.sql';
export const TIP = '0041_checkout_admission.sql';
export const schemaQuery = () => "SELECT type, name, sql FROM sqlite_master WHERE tbl_name IN ('checkout_admissions','payment_reconciliation_records') AND sql IS NOT NULL ORDER BY name";

export function verifyCheckoutSchema(statements) {
  if (!Array.isArray(statements) || statements.length !== 1 || statements[0]?.success !== true || !Array.isArray(statements[0].results))
    throw new Error('Expected one successful checkout schema result');
  const database = new DatabaseSync(':memory:');
  try {
    database.exec(readFileSync(`migrations/${TIP}`, 'utf8'));
    const expected = database.prepare(schemaQuery()).all();
    const normalize = (rows) => rows.map(({ type, name, sql }) => ({ type, name, sql: sql.replace(/\s+/g, ' ').trim() }));
    if (JSON.stringify(normalize(statements[0].results)) !== JSON.stringify(normalize(expected)))
      throw new Error('Checkout schema differs from reviewed migration 0041');
    return { objects: expected.map((row) => row.name), constraints: 'PASS' };
  } finally { database.close(); }
}

export async function gate(ref) {
  requireCanonicalStagingDispatch();
  const candidate = validateMigrationCandidate({ ref, expectedPreTip: PRE_TIP, migration: TIP });
  if (candidate.sha !== candidate.mainSha) throw new Error('Migration ref must equal current main');
  if (candidate.chain.length !== 1 || candidate.chain[0] !== TIP) throw new Error('Only migration 0041 is authorized');
  const ci = await hostedCi(candidate.sha, process.env.GITHUB_REPOSITORY);
  await requireCurrentHostedMain({ sha: candidate.sha, repository: process.env.GITHUB_REPOSITORY });
  return { sha: candidate.sha, schema: candidate.schema, chain: candidate.chain,
    database: stagingConfig(), ci, checkedAt: new Date().toISOString() };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [command, file, ...args] = process.argv.slice(2);
  run(command, file, args, { preTip: PRE_TIP, tip: TIP, gate, schemaQuery,
    verifySchema: verifyCheckoutSchema, status: 'STAGING_0041_CERTIFIED' }).then((value) => {
    if (command === 'query') process.stdout.write(value);
    else console.log(`Staging checkout schema ${command}: ${value.status ?? 'PASS'}`);
  }).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
