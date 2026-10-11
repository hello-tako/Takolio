import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd(), out = resolve(root, '.artifacts/backend-b08-tailwind-feasibility');
const require = createRequire(resolve(root, 'package.json'));
const tailwindRequire = createRequire(require.resolve('tailwindcss'));
const consumerRequire = createRequire(tailwindRequire.resolve('micromatch'));
const patchedPath = consumerRequire.resolve('braces');
const patchedRequire = createRequire(patchedPath);
const control = resolve(out, 'braces-unpatched');
// Only the unchanged fill-range owner is shared; the tarball control has its own
// independently verified original braces sources.
await mkdir(resolve(control, 'node_modules'), { recursive: true });
const { symlink, realpath } = await import('node:fs/promises');
const dependencyPath = resolve(patchedRequire.resolve('fill-range'), '..');
try { await symlink(dependencyPath, resolve(control, 'node_modules/fill-range')); }
catch (error) { if (error.code !== 'EEXIST') throw error; }
assert.equal(await realpath(resolve(control, 'node_modules/fill-range')), await realpath(dependencyPath));
const upstreamPath = resolve(control, 'index.js');
const upstream = require(upstreamPath), patched = require(patchedPath);
const vectors = [];
const patterns = ['src/{web,worker}/**/*.{js,ts,jsx,tsx}', 'a{b,c}d', '{a,{b,c}}',
  '{1..9..2}', '{9..1..2}', '{a..f..2}', '{01..05}', '{-2..2}', '${literal}',
  '\\{escaped\\}', '[{a,b}]', '"{literal}"', 'a(b(c))', '{', '{a,b', 'a}b',
  '{{x}}', '{1..4,z}', '{a,,b}', '{}', '', 'plain', '{a,a,b}', '{2..x}', '{..}',
  '{'.repeat(128) + 'x' + '}'.repeat(128), '('.repeat(128) + 'x' + ')'.repeat(128)];
const options = [{}, { expand: true }, { keepEscaping: true }, { keepQuotes: true },
  { escapeInvalid: true }, { nodupes: true }, { noempty: true }];
function result(library, method, input, opts) {
  try { return { value: method === 'default' ? library(input, opts) : library[method](input, opts) }; }
  catch (error) { return { errorClass: error.constructor.name, errorMessage: error.message }; }
}
for (const method of ['default', 'compile', 'expand', 'stringify']) for (const pattern of patterns) for (const opts of options) {
  const before = result(upstream, method, pattern, opts), after = result(patched, method, pattern, opts);
  assert.deepEqual(after, before, `${method} shallow compatibility`);
  vectors.push({ method, input: pattern, options: opts, outcome: before });
}
const hash = (raw) => createHash('sha256').update(raw).digest('hex');
const child = resolve(out, 'braces-control-child.cjs');
await writeFile(child, `const library = require(process.argv[2]);
const method = process.argv[3], kind = process.argv[4];
const pattern = kind === 'braces' ? '{'.repeat(4000) + 'x' + '}'.repeat(4000) : '('.repeat(4000) + 'x' + ')'.repeat(4000);
try { library[method](pattern); process.stdout.write(JSON.stringify({ outcome: 'RETURNED' })); }
catch (error) { process.stdout.write(JSON.stringify({ outcome: error instanceof RangeError && error.message === 'Maximum call stack size exceeded' ? 'HOST_STACK_EXHAUSTION' : error.message === 'Brace nesting exceeds fixed depth limit (128)' ? 'BOUNDED_REJECTION' : 'OTHER_ERROR', errorClass: error.constructor.name })); }
`);
const controls = [];
for (const stackBudget of ['default', '512KiB']) for (const method of ['compile', 'expand', 'stringify']) for (const kind of ['braces', 'parentheses']) {
  const values = {};
  for (const [name, path] of [['published', upstreamPath], ['patched', patchedPath]]) {
    const childResult = spawnSync(process.execPath, [...(stackBudget === 'default' ? [] : ['--stack-size=512']), child, path, method, kind], { timeout: 5000, encoding: 'utf8' });
    assert.equal(childResult.status, 0);
    values[name] = JSON.parse(childResult.stdout);
  }
  assert.equal(values.patched.outcome, 'BOUNDED_REJECTION');
  controls.push({ stackBudget, method, kind, ...values });
}
assert(controls.some((c) => c.published.outcome === 'HOST_STACK_EXHAUSTION'));
const sourceFiles = [];
for (const name of (await readdir(resolve(control, 'lib'))).sort()) {
  const original = await readFile(resolve(control, 'lib', name));
  const installed = await readFile(resolve(patchedPath, '..', 'lib', name));
  sourceFiles.push({ path: 'lib/' + name, upstreamSha256: hash(original), installedSha256: hash(installed), changed: !original.equals(installed) });
}
const receipt = { node: process.version, differentialVectors: vectors.length,
  vectorSha256: hash(JSON.stringify(vectors)), mismatches: 0, controls, sourceFiles,
  patchSha256: hash(await readFile(resolve(root, 'patches/braces@3.0.3.patch'))),
  limits: ['Bounded nested strings/ordinary AST child recursion; not all resource exhaustion or hostile AST parent graphs.',
    'Official unpatched source integrity verified; no production provider/data used.',
    'Default Node 24 strings may not exhaust this host; 512KiB child stack is an explicit constrained-host test.',
    'Audit advisory remains high; the local patch does not alter the upstream version.'] };
await writeFile(resolve(out, 'braces-comparison.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify({ vectors: vectors.length, mismatches: 0,
  defaultUnpatchedStackExhaustion: controls.filter((c) => c.stackBudget === 'default' && c.published.outcome === 'HOST_STACK_EXHAUSTION').length,
  unpatchedStackExhaustion: controls.filter((c) => c.published.outcome === 'HOST_STACK_EXHAUSTION').length,
  patchedBoundedRejections: controls.length, changedLibraryFiles: sourceFiles.filter((f) => f.changed).length }));
