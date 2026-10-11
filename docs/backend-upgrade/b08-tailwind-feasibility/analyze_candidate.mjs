import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd(), out = resolve(root, '.artifacts/backend-b08-tailwind-feasibility');
const candidate = JSON.parse(await readFile(resolve(out, 'candidate-private.json'), 'utf8')).directory;
const require = createRequire(resolve(root, 'package.json'));
const postcss = require('postcss');
const tailwindRequire = createRequire(require.resolve('tailwindcss'));
const selectorParser = tailwindRequire('postcss-selector-parser');
const yaml = createRequire(require.resolve('eslint'))('js-yaml');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function stylesheet(directory) {
  const assets = resolve(directory, 'dist/client/assets');
  const names = (await readdir(assets)).filter((name) => name.endsWith('.css'));
  assert.equal(names.length, 1);
  const css = await readFile(resolve(assets, names[0]), 'utf8');
  const ast = postcss.parse(css), classes = new Set();
  let rules = 0, declarations = 0, layers = 0, properties = 0, hoverQueries = 0;
  ast.walkRules((rule) => {
    rules++;
    selectorParser((selectors) => selectors.walkClasses((node) => classes.add(node.value))).processSync(rule.selector);
  });
  ast.walkDecls(() => declarations++);
  ast.walkAtRules((rule) => {
    if (rule.name === 'layer') layers++;
    if (rule.name === 'property') properties++;
    if (rule.name === 'media' && rule.params.includes('hover:')) hoverQueries++;
  });
  return { cssBytes: Buffer.byteLength(css), cssSha256: hash(css), rules, declarations, layers,
    registeredProperties: properties, hoverQueries, classes: [...classes].sort() };
}
const baseline = await stylesheet(root), changed = await stylesheet(candidate);
const missing = baseline.classes.filter((name) => !changed.classes.includes(name));
const inputs = JSON.parse(await readFile(resolve(out, 'source-inputs.json'), 'utf8')).inputs;
const changedInputs = [], unchangedInputs = [];
for (const input of inputs) {
  const raw = await readFile(resolve(candidate, input.path));
  const digest = hash(raw);
  (digest === input.sha256 ? unchangedInputs : changedInputs).push({ ...input, candidateSha256: digest });
}
assert.deepEqual(changedInputs.map((i) => i.path).sort(),
  ['package.json', 'pnpm-lock.yaml', 'postcss.config.js', 'src/web/styles/index.css']);
const usedMissing = [];
for (const name of missing) {
  const pattern = new RegExp(`(^|[^\\w-])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\w-])`);
  const locations = [];
  for (const input of inputs.filter((i) => i.path.startsWith('src/web/') && /\.(tsx?|jsx?)$/.test(i.path))) {
    const source = await readFile(resolve(root, input.path), 'utf8');
    source.split('\n').forEach((line, index) => { if (pattern.test(line)) locations.push({ path: input.path, line: index + 1 }); });
  }
  if (locations.length) usedMissing.push({ utility: name, occurrences: locations.length, locations });
}
const baseLock = yaml.load(await readFile(resolve(root, 'pnpm-lock.yaml'), 'utf8'));
const candidateLock = yaml.load(await readFile(resolve(candidate, 'pnpm-lock.yaml'), 'utf8'));
const before = Object.keys(baseLock.packages), after = Object.keys(candidateLock.packages);
const graph = { declaredBefore: before.length, declaredAfter: after.length,
  removed: before.filter((p) => !after.includes(p)).sort(), added: after.filter((p) => !before.includes(p)).sort(),
  candidateHasBraces: after.some((p) => p.startsWith('braces@')),
  canonicalHasBraces: before.some((p) => p.startsWith('braces@')) };
const receipt = { baseline, candidate: changed, missingClasses: missing, usedMissing, graph,
  changedInputs, unchangedInputCount: unchangedInputs.length,
  browserSupport: { source: 'https://github.com/tailwindlabs/tailwindcss.com/blob/main/src/docs/upgrade-guide.mdx',
    officialSourceSha256: hash(await readFile(resolve(out, 'upgrade-guide-private.mdx'))),
    minimum: { Safari: '16.4', Chrome: '111', Firefox: '128' }, acceptance: 'NOT_ESTABLISHED' },
  limits: ['Generated selector inventory; lexical source locations are candidates, not dynamic class execution proof.',
    'Resolved manifest/lock graph; not an installed native binary/Linux/license attestation.'] };
await writeFile(resolve(out, 'candidate-analysis.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify({ changedInputs: changedInputs.length, unchangedInputs: unchangedInputs.length,
  missingClasses: missing.length, usedMissing: usedMissing.length, graph, baselineCssBytes: baseline.cssBytes,
  candidateCssBytes: changed.cssBytes }));
