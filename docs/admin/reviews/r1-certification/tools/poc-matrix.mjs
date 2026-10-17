#!/usr/bin/env node
// Builds the 51-PoC verification matrix from two vitest JSON reports (before = 3e865d0, after = R1 via adapter).
//   node poc-matrix.mjs before.json after.json out.md
import { readFileSync, writeFileSync } from 'node:fs';

const [beforeFile, afterFile, outFile] = process.argv.slice(2);
function load(file) {
  const report = JSON.parse(readFileSync(file, 'utf8'));
  const rows = [];
  for (const f of report.testResults) {
    const base = f.name.split('/').pop();
    for (const a of f.assertionResults) {
      const failure = (a.failureMessages ?? []).join('\n');
      const line = (failure.match(new RegExp(`${base.replace(/\./g, '\\.')}:(\\d+):\\d+`)) ?? [])[1] ?? null;
      const first = failure.split('\n').find((l) => l.trim()) ?? '';
      rows.push({ key: `${base} › ${a.fullName}`, file: base, title: a.title, status: a.status, line, message: first.replace(/\x1b\[[0-9;]*m/g, '').slice(0, 150) });
    }
  }
  return rows;
}

// type: attack (asserts a defect) | control (asserts a property). verify: independent re-verification.
const C = [
  ['H1a CONFIRMED', 'attack', 'S3', 'R1C-C4, R1C-C5'], ['H1b CONFIRMED', 'attack', 'S3', 'R1C-C5'],
  ['H1c control', 'control', '', 'R1C-C5', 'adapter maps this to ENVIRONMENT=development on a public host, which R1 disables (S1); admin-origin login re-verified under a valid production split host'],
  ['H1d CONFIRMED', 'attack', 'S3', 'R1C-C5'], ['H1e CONFIRMED', 'attack', 'S3', 'R1C-C5'],
  ['accepts a trusted Referer only as fallback', 'control', '', 'R1C-C4', 'the Referer fallback was intentionally removed (exact Origin only); the refusals in this PoC still hold'],
  ['refuses a wrong CSRF token', 'control'],
  ['H2a CONFIRMED', 'attack', 'S1', 'workerd NEGATIVE ENVIRONMENT missing'], ['H2b CONFIRMED', 'attack', 'S1', 'workerd NEGATIVE ENVIRONMENT empty string'],
  ['H2c CONFIRMED', 'attack', 'S1', 'workerd NEGATIVE ENVIRONMENT "Production"'], ['H2d CONFIRMED', 'attack', 'S1', 'tests/integration/admin-remediation.test.ts decision matrix (staging password)'],
  ['H2e control', 'control', '', 'R1C-C3, workerd NEGATIVE scenarios', 'a production config with a loopback/http origin is now refused earlier with an opaque plain-text 404, so the PoC cannot read a JSON body'],
  ['H8a CONFIRMED', 'attack', 'S3'], ['H8b CONFIRMED', 'attack', 'S3'], ['H8c CONFIRMED', 'attack', 'S3/S2', 'workerd NEGATIVE foreign host'],
  ['H8d control', 'control', '', 'R1C-C5 (customer host → 404)', 'foreign hosts receive an opaque plain-text 404 instead of a JSON error, so the PoC fails reading .code; the status is still 404'],
  ['a full admin workflow writes only admin_', 'control', '', 'R1C-B1', 'SUPER_ADMIN revocation now returns 201 (four-eyes request) instead of 200, aborting the PoC before its write-set assertion'],
  ['admin_audit_events is append-only', 'control'],
  ['cannot be deleted from users', 'attack', 'S10', 'R1C-B4', null, 'still blocked, but by the pre-existing customer FK households.created_by → users(id); the admin DB has no foreign keys'],
  ['cascades away their admin grant history', 'attack', 'S10', 'R1C-B4'], ['cascades its editorial review history', 'attack', 'S10', 'R1C-B4'],
  ['creates a cloudflare_access session', 'control', '', 'R1C-C2', 'the PoC parses the removed __Host-takosan_admin_csrf cookie; its earlier assertions (200, authMethod cloudflare_access) passed'],
  ['non-admin identity is refused', 'control'], ['password login is not offered in Access mode', 'control'],
  ['denied when the assertion header is absent', 'control', '', 'R1C-C2', 'consequence of the previous PoC: no cookie was parsed, so the request is anonymous (401 ADMIN_UNAUTHENTICATED instead of ADMIN_ACCESS_DENIED)'],
  ['but no AUD fails closed', 'control', '', 'R1C-C3, workerd NEGATIVE ADMIN_ACCESS_AUD empty', 'the PoC config is a loopback/http production origin, refused earlier with 404 instead of 503'],
  ['logout revokes the session server-side', 'control'], ['absolute-expired session is rejected', 'control'], ['idle-expired session is rejected', 'control'],
  ['H5 CONFIRMED', 'attack', 'S5'], ['control: with audit available the reveal is recorded', 'control'], ['H6 CONFIRMED', 'attack', 'S6'],
  ['H9a CONFIRMED', 'attack', 'S7', 'R1C-C6', null, 'the PoC makes exactly 10 attempts; the per-account budget is 10 per 15 minutes, so the 11th attempt is 429'],
  ['H9b control', 'control'], ['H9c CONFIRMED', 'attack', 'S7'], ['H10 CONFIRMED', 'attack', 'S8'], ['denied the explicit reveal', 'control'],
  ['accepts a correctly signed token', 'control'], ['rejects alg=none', 'control'], ['rejects wrong audience', 'control'], ['reuses the trusted kid', 'control'],
  ['audience array', 'control'], ['unknown kid forces a JWKS refetch', 'attack', 'S9'],
  ['anonymous requests are 401', 'control'], ['each role gets exactly the reads', 'control'], ['each role is denied mutations', 'control'], ['revoked admin, household owner', 'control'],
  ['H3 CONFIRMED', 'attack', 'S4', 'R1C-D7'], ['H4 CONFIRMED', 'attack', 'S4', 'R1C-D7, R1C-B1, R1C-D5'], ['cannot revoke its own grant', 'control'], ['H7 CONFIRMED', 'attack', 'S4', 'R1C-D6'],
];
const classify = (title) => {
  const hit = C.filter(([k]) => title.includes(k));
  if (hit.length !== 1) throw new Error(`classification ${hit.length === 0 ? 'missing' : 'ambiguous'} for: ${title}`);
  const [, type, ref = '', verify = '', change = null, still = null] = hit[0];
  return { type, ref, verify, change, still };
};

const before = load(beforeFile);
const after = new Map(load(afterFile).map((r) => [r.key, r]));
const rows = [];
let unexplained = 0;
before.forEach((b, i) => {
  const a = after.get(b.key);
  const c = classify(b.title);
  const expected = c.type === 'attack' ? 'fail (defect absent)' : (c.change ? 'fail (contract change)' : 'pass');
  let verdict;
  if (!a) { verdict = 'MISSING AFTER RUN'; unexplained += 1; }
  else if (c.type === 'attack' && a.status === 'failed') verdict = `Defect not reproducible${c.verify ? `; absence independently verified by ${c.verify}` : ''}`;
  else if (c.type === 'attack' && a.status === 'passed') {
    if (c.still) verdict = `Attack PoC still passes — explained: ${c.still}; verified by ${c.verify}`; else { verdict = 'UNEXPLAINED SUCCESSFUL ATTACK'; unexplained += 1; }
  } else if (c.type === 'control' && a.status === 'passed') verdict = 'Control holds';
  else if (c.change) verdict = `Contract change: ${c.change}; property re-verified by ${c.verify}`;
  else { verdict = 'UNEXPECTED CONTROL FAILURE'; unexplained += 1; }
  if (b.status !== (c.type === 'attack' ? 'passed' : 'passed')) { verdict = `BEFORE-RUN ANOMALY (${b.status}); ${verdict}`; unexplained += 1; }
  rows.push({ n: i + 1, b, a, c, expected, verdict });
});

const esc = (s) => String(s ?? '').replace(/\|/g, '\\|');
const md = ['| # | PoC (file › title) | Type / finding | Before (3e865d0) | Expected after | Actual after | After evidence (first failure line @ PoC line) | Verdict |', '|---|---|---|---|---|---|---|---|'];
for (const r of rows) {
  md.push(`| ${r.n} | ${esc(r.b.file)} › ${esc(r.b.title)} | ${r.c.type}${r.c.ref ? ` (${r.c.ref})` : ''} | ${r.b.status} | ${r.expected} | ${r.a?.status ?? 'missing'} | ${r.a?.status === 'failed' ? `${esc(r.a.message)} @${r.a.line}` : '—'} | ${esc(r.verdict)} |`);
}
const totals = { total: rows.length, beforePassed: rows.filter((r) => r.b.status === 'passed').length, afterPassed: rows.filter((r) => r.a?.status === 'passed').length,
  attacks: rows.filter((r) => r.c.type === 'attack').length, attacksStillPassing: rows.filter((r) => r.c.type === 'attack' && r.a?.status === 'passed').length,
  controlsFailing: rows.filter((r) => r.c.type === 'control' && r.a?.status === 'failed').length, unexplained };
writeFileSync(outFile, `${md.join('\n')}\n\n\`${JSON.stringify(totals)}\`\n`);
console.log(JSON.stringify(totals));
if (unexplained) process.exitCode = 1;
