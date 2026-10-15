import ts from 'typescript';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve, extname } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const baselineSha = process.env.TAKOLIO_BASELINE_SHA ?? '03428467cdd5e93d27a3a27e5edaf7d512eef71d';
const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', 'src/web', 'src/worker', 'index.html', 'public/manifest.json', 'public/sw.js'], { cwd: root, encoding: 'utf8' }).trim().split('\n');
const baselineFiles = new Set(execFileSync('git', ['ls-tree', '-r', '--name-only', baselineSha, '--', 'src/web', 'src/worker'], { cwd: root, encoding: 'utf8' }).trim().split('\n'));
const oldBrand = /\b(?:takosan|tako-san|frigo)\b/i;
const visible = (text) => oldBrand.test(text) && !/(?:[./_-](?:takosan|frigo)|(?:takosan|frigo)[/_-]|@frigo|X-Frigo|TAKOSAN_BUILD_ID)/i.test(text);
const audit = [];
for (const path of files) {
  if (!['.ts', '.tsx'].includes(extname(path))) continue;
  const before = baselineFiles.has(path) ? execFileSync('git', ['show', `${baselineSha}:${path}`], { cwd: root, encoding: 'utf8', maxBuffer: 8e6 }) : '';
  const after = await readFile(resolve(root, path), 'utf8');
  for (const [stage, source] of [['before', before], ['after', after]]) {
    const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, path.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const visit = (node) => {
      if ((ts.isStringLiteralLike(node) || ts.isJsxText(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) && oldBrand.test(node.text ?? '')) {
        const text = node.text.trim();
        const productCopy = visible(text.replaceAll('frigo.tungjpstore.net', '[unchanged-domain]')) && !['src/worker/routes/health.ts', 'src/worker/services/meal-planning-explanation.ts'].includes(path) && !text.includes('API Worker Running');
        const line = ast.getLineAndCharacterOfPosition(node.getStart()).line + 1;
        const decision = !productCopy ? (/takosan-brand|takosan-kitchen/.test(text) ? 'ALIAS' : 'KEEP') : stage === 'before' ? 'REPLACE' : 'DEFER';
        audit.push({ stage, path, line, text, productCopy, decision, reason: !productCopy ? 'Technical path/class/module/header/storage compatibility' : stage === 'before' ? 'Display copy candidate; protected exclusions evaluated in after inventory' : path.startsWith('src/worker/') ? 'Protected Worker/auth/email/notification surface' : 'Protected payment UI' });
      }
      ts.forEachChild(node, visit);
    };
    visit(ast);
  }
}
const remaining = audit.filter((x) => x.stage === 'after' && x.productCopy);
const consumers = [];
for (const path of files.filter((x) => ['.ts', '.tsx'].includes(extname(x)))) {
  const source = await readFile(resolve(root, path), 'utf8');
  for (const match of source.matchAll(/from ['"]([^'"]*(?:takolio-brand|takosan-brand|takosan-kitchen))['"]/g)) consumers.push({ consumer: path, contract: match[1] });
}
const out = resolve(root, '.artifacts/takolio-v1/inventory');
await mkdir(out, { recursive: true });
await writeFile(resolve(out, 'occurrences.json'), JSON.stringify({ baselineSha, note: 'Source literals/JSX text; counts locations rather than unique rendered strings. Technical values remain. Metadata/assets separately audited.', remainingProductLocations: remaining.length, remaining, consumers, occurrences: audit }, null, 2) + '\n');
console.log(JSON.stringify({ baselineSha, beforeProductLocations: audit.filter(x => x.stage === 'before' && x.productCopy).length, afterProductLocations: remaining.length, remaining, consumers }, null, 2));
