#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { lookup } from 'node:dns';
import { get as httpGet } from 'node:http';
import { get as httpsGet } from 'node:https';
import { BlockList, isIP } from 'node:net';
import path from 'node:path';

const ROOT = process.cwd();
const V2_ROOT = path.join(ROOT, 'data/recipe-refresh/v2');
const OUTPUT = path.join(ROOT, 'data/recipe-intelligence/v3/research/source-scan.json');
const CONCURRENCY = 8;
const TIMEOUT_MS = 12000;
const MAX_BYTES = 8 * 1024 * 1024;
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
const sourceId = (url) => `source-${sha256(url).slice(0, 16)}`;
const isTimestamp = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const isHash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
const states = ['URL_REACHABLE', 'SOURCE_CONTENT_READ', 'SOURCE_UNAVAILABLE'];

function publicUrl(value) {
  const url = new URL(value);
  assert(['http:', 'https:'].includes(url.protocol), 'public HTTP(S) source required');
  assert(!url.username && !url.password, 'source credentials forbidden');
  assert(!url.port || ['80', '443'].includes(url.port), 'nonstandard source port forbidden');
  const host = url.hostname.toLowerCase().replace(/\.$/u, '');
  assert(!isIP(host.replace(/^\[|\]$/gu, '')) && host.includes('.') && !/\.(?:local|localhost|internal|test|invalid)$/u.test(host), 'public source hostname required');
  url.hostname = host;
  return url;
}

const privateAddresses = new BlockList();
for (const [network, prefix] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24],
  ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 3]]) {
  privateAddresses.addSubnet(network, prefix, 'ipv4');
}
function assertPublicAddress(address) {
  assert(isIP(address) === 4 && !privateAddresses.check(address, 'ipv4'), 'public IPv4 source address required');
}
function publicLookup(hostname, options, callback) {
  // ponytail: IPv4 sources only; add reviewed IPv6 ranges when an IPv6-only source is needed.
  lookup(hostname, { family: 4 }, (error, address, family) => {
    if (error) { callback(error); return; }
    try { assertPublicAddress(address); } catch (failure) { callback(failure); return; }
    callback(null, options.all ? [{ address, family }] : address, family);
  });
}
function publicGet(url, signal) {
  return new Promise((resolve, reject) => {
    const request = (url.protocol === 'https:' ? httpsGet : httpGet)(url, { signal, lookup: publicLookup, agent: false,
      headers: { 'User-Agent': 'Takolio-Recipe-Research/3.0', Accept: 'text/html,application/xhtml+xml;q=0.9', 'Accept-Encoding': 'identity' } }, resolve);
    request.on('error', reject);
  });
}

function sourcePlan() {
  const manifestBytes = readFileSync(path.join(V2_ROOT, 'manifest.json'));
  const manifest = JSON.parse(manifestBytes);
  const ids = manifest.orderedRecipeIds;
  assert(ids.length === 500 && new Set(ids).size === 500, 'exactly 500 source recipe IDs required');
  const recipes = ids.map((recipeId) => {
    assert(/^[a-z0-9-]+$/u.test(recipeId), 'invalid source recipe ID');
    const recipe = readJson(path.join(V2_ROOT, 'recipes', `${recipeId}.json`));
    assert(recipe.identity.id === recipeId, 'recipe identity mismatch');
    const declaredIndex = recipe.research.sources.findIndex((source) => source.role === 'declared');
    assert(declaredIndex >= 0, `declared source missing: ${recipeId}`);
    const url = recipe.research.sources[declaredIndex].url;
    publicUrl(url);
    return { recipeId, sourceId: sourceId(url), url, declaredSourceIndex: declaredIndex };
  });
  return { manifestSha256: sha256(manifestBytes), selectionSha256: sha256(JSON.stringify(recipes)), recipes };
}

function cleanTitle(value) {
  const named = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };
  return value.replace(/&#(x[0-9a-f]+|[0-9]+);|&(amp|quot|apos|lt|gt|nbsp);/giu, (match, code, name) => {
    if (name) return named[name.toLowerCase()];
    const number = code.toLowerCase().startsWith('x') ? Number.parseInt(code.slice(1), 16) : Number(code);
    return number > 0 && number <= 0x10ffff && !(number >= 0xd800 && number <= 0xdfff) ? String.fromCodePoint(number) : match;
  }).replace(/<[^>]*>/gu, ' ').replace(/\s+/gu, ' ').trim().slice(0, 500);
}

function instructionCount(value) {
  if (typeof value === 'string') return value.trim() ? 1 : 0;
  if (Array.isArray(value)) return value.reduce((count, item) => count + instructionCount(item), 0);
  if (!value || typeof value !== 'object') return 0;
  if (value.itemListElement) return instructionCount(value.itemListElement);
  return typeof value.text === 'string' && value.text.trim() ? 1 : 0;
}

function inspectHtml(html) {
  const result = { title: cleanTitle(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/iu.exec(html)?.[1] ?? '') || null,
    jsonLdScriptCount: 0, parsedJsonLdCount: 0, invalidJsonLdCount: 0, recipeNodeCount: 0,
    readableRecipeNodeCount: 0, ingredientLineCount: 0, instructionCount: 0 };
  const walk = (node) => {
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (!node || typeof node !== 'object') return;
    const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
    if (types.some((type) => typeof type === 'string' && /^(?:(?:https?:\/\/schema\.org\/)|schema:)?Recipe$/u.test(type))) {
      result.recipeNodeCount += 1;
      const ingredients = Array.isArray(node.recipeIngredient) ? node.recipeIngredient.filter((item) => typeof item === 'string' && item.trim()).length : 0;
      const steps = instructionCount(node.recipeInstructions);
      result.ingredientLineCount += ingredients;
      result.instructionCount += steps;
      if (ingredients > 0 && steps > 0) result.readableRecipeNodeCount += 1;
    }
    Object.values(node).forEach(walk);
  };
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/giu)) {
    if (!/\btype\s*=\s*(?:["']application\/ld\+json["']|application\/ld\+json)(?:\s|$)/iu.test(match[1])) continue;
    result.jsonLdScriptCount += 1;
    try { walk(JSON.parse(match[2].trim())); result.parsedJsonLdCount += 1; }
    catch { result.invalidJsonLdCount += 1; }
  }
  return result;
}

function evidenceState(source) {
  if (!source.retrievalComplete || source.httpStatus < 200 || source.httpStatus >= 300) return 'SOURCE_UNAVAILABLE';
  return source.jsonLd.readableRecipeNodeCount > 0 ? 'SOURCE_CONTENT_READ' : 'URL_REACHABLE';
}

async function retrieve(url) {
  const result = { sourceId: sourceId(url), url, retrievedAt: new Date().toISOString(), completedAt: null,
    httpStatus: null, finalUrl: null, redirects: [], contentType: null, contentSha256: null,
    byteLength: null, retrievalComplete: false, title: null, jsonLd: null, status: null, reason: null, error: null };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    let target = publicUrl(url);
    let response;
    for (let redirect = 0; redirect <= 5; redirect += 1) {
      response = await publicGet(target, controller.signal);
      result.httpStatus = response.statusCode;
      result.finalUrl = target.href;
      if (![301, 302, 303, 307, 308].includes(response.statusCode)) break;
      const location = response.headers.location;
      response.destroy();
      assert(location, 'redirect location missing');
      assert(redirect < 5, 'redirect limit exceeded');
      target = publicUrl(new URL(location, target).href);
      result.redirects.push(target.href);
    }
    result.contentType = response.headers['content-type'] ?? null;
    const chunks = [];
    let bytes = 0;
    for await (const chunk of response) {
      bytes += chunk.byteLength;
      assert(bytes <= MAX_BYTES, 'source body exceeds 8 MiB limit');
      chunks.push(chunk);
    }
    const body = Buffer.concat(chunks);
    result.contentSha256 = sha256(body);
    result.byteLength = body.byteLength;
    result.retrievalComplete = true;
    const inspection = inspectHtml(body.toString('utf8'));
    result.title = inspection.title;
    const { title: ignoredTitle, ...counts } = inspection;
    void ignoredTitle;
    result.jsonLd = counts;
    result.status = evidenceState(result);
    result.reason = result.status === 'SOURCE_UNAVAILABLE' ? `HTTP_${response.statusCode}`
      : result.status === 'SOURCE_CONTENT_READ' ? 'RECIPE_JSON_LD_INGREDIENTS_AND_INSTRUCTIONS_READ'
        : counts.recipeNodeCount > 0 ? 'RECIPE_JSON_LD_WITHOUT_BOTH_INGREDIENTS_AND_INSTRUCTIONS' : 'NO_READABLE_RECIPE_JSON_LD';
  } catch (error) {
    result.status = 'SOURCE_UNAVAILABLE';
    result.reason = controller.signal.aborted ? 'TIMEOUT' : error.code === 'ERR_ASSERTION' ? 'SOURCE_POLICY_OR_SIZE_LIMIT' : 'FETCH_ERROR';
    result.error = `${error.name}: ${error.message}${error.cause?.code ? ` (${error.cause.code})` : ''}`.slice(0, 500);
  } finally {
    clearTimeout(timeout);
    result.completedAt = new Date().toISOString();
  }
  return result;
}

function summary(recipes, sources) {
  const recipeStatusCounts = Object.fromEntries(states.map((status) => [status, recipes.filter((entry) => entry.status === status).length]));
  const sourceStatusCounts = Object.fromEntries(states.map((status) => [status, sources.filter((entry) => entry.status === status).length]));
  return { recipeCount: recipes.length, attemptedRecipeCount: recipes.length, uniqueUrlAttemptCount: sources.length,
    recipeStatusCounts, sourceStatusCounts, humanApprovedCount: 0, contentVerifiedRecipeCount: 0, productionMutations: 0 };
}

async function selfCheck() {
  const sample = '<title>Fish &amp; rice &#x1F35A;</title><script type="application/ld+json">'
    + JSON.stringify({ '@graph': [{ '@type': ['Thing', 'Recipe'], recipeIngredient: ['fish', 'rice'],
      recipeInstructions: [{ '@type': 'HowToSection', itemListElement: [{ text: 'Cook.' }, { text: 'Serve.' }] }] }] })
    + '</script><script type="application/ld+json">{broken</script>';
  assert.deepEqual(inspectHtml(sample), { title: 'Fish & rice \u{1F35A}', jsonLdScriptCount: 2, parsedJsonLdCount: 1,
    invalidJsonLdCount: 1, recipeNodeCount: 1, readableRecipeNodeCount: 1, ingredientLineCount: 2, instructionCount: 2 });
  const sparse = inspectHtml('<script type=application/ld+json>{"@type":"Recipe","name":"Unreviewed"}</script>');
  assert.equal(sparse.recipeNodeCount, 1);
  assert.equal(sparse.readableRecipeNodeCount, 0);
  assert.equal(evidenceState({ retrievalComplete: true, httpStatus: 200, jsonLd: sparse }), 'URL_REACHABLE');
  assert.equal(evidenceState({ retrievalComplete: true, httpStatus: 404, jsonLd: { readableRecipeNodeCount: 1 } }), 'SOURCE_UNAVAILABLE');
  assert.equal(evidenceState({ retrievalComplete: false, httpStatus: 200 }), 'SOURCE_UNAVAILABLE');
  assert.throws(() => publicUrl('file:///etc/passwd'));
  assert.throws(() => publicUrl('http://127.0.0.1/a'));
  assert.throws(() => publicUrl('https://name:password@example.com/a'));
  assert.throws(() => publicUrl('http://example.local/a'));
  assert.throws(() => publicUrl('http://localhost./'));
  assert.throws(() => publicUrl('http://private.local./'));
  for (const address of ['0.0.0.0', '10.1.2.3', '100.64.0.1', '127.0.0.1', '169.254.169.254', '172.16.0.1',
    '192.168.1.1', '198.18.0.1', '224.0.0.1', '255.255.255.255', '::1', '::ffff:127.0.0.1']) assert.throws(() => assertPublicAddress(address));
  assertPublicAddress('93.184.216.34');
  await assert.rejects(publicGet(new URL('http://localhost/'), AbortSignal.timeout(1000)), /public IPv4 source address required/u);
  assert.equal(publicUrl('https://www.example.com./a').hostname, 'www.example.com');
  assert.equal(publicUrl('https://www.example.com/a').hostname, 'www.example.com');
}

function validate(evidence, plan) {
  assert.equal(evidence.schemaVersion, 1);
  assert.equal(evidence.program, 'TAKOLIO_RECIPE_INTELLIGENCE_V3');
  assert.equal(evidence.scope, 'AUTOMATED_DECLARED_PRIMARY_URL_SCAN');
  assert.equal(evidence.sourcePromotionAllowed, false);
  assert.equal(evidence.humanReview, 'PENDING');
  assert.equal(evidence.relevanceReview, 'PENDING');
  assert.equal(evidence.claimReview, 'PENDING');
  assert.equal(evidence.v2ManifestSha256, plan.manifestSha256);
  assert.equal(evidence.selectionSha256, plan.selectionSha256);
  assert(isTimestamp(evidence.startedAt) && isTimestamp(evidence.completedAt));
  assert.equal(evidence.recipes.length, 500);
  const expectedUrls = [...new Set(plan.recipes.map((entry) => entry.url))];
  assert.deepEqual(evidence.sources.map((entry) => entry.url), expectedUrls);
  const byId = new Map(evidence.sources.map((entry) => [entry.sourceId, entry]));
  assert.equal(byId.size, expectedUrls.length);
  for (const source of evidence.sources) {
    assert.equal(source.sourceId, sourceId(source.url));
    publicUrl(source.url);
    assert(states.includes(source.status));
    assert(isTimestamp(source.retrievedAt) && isTimestamp(source.completedAt));
    assert(Date.parse(source.completedAt) >= Date.parse(source.retrievedAt));
    assert(source.httpStatus === null || Number.isInteger(source.httpStatus) && source.httpStatus >= 100 && source.httpStatus <= 599);
    assert.equal(typeof source.retrievalComplete, 'boolean');
    assert(source.title === null || typeof source.title === 'string' && source.title.length <= 500);
    assert(typeof source.reason === 'string' && source.reason.length > 0);
    assert(source.error === null || typeof source.error === 'string' && source.error.length <= 500);
    if (source.finalUrl !== null) publicUrl(source.finalUrl);
    assert(Array.isArray(source.redirects) && source.redirects.length <= 5);
    source.redirects.forEach(publicUrl);
    if (source.retrievalComplete) {
      assert(isHash(source.contentSha256));
      assert(Number.isInteger(source.byteLength) && source.byteLength >= 0 && source.byteLength <= MAX_BYTES);
      const fields = ['jsonLdScriptCount', 'parsedJsonLdCount', 'invalidJsonLdCount', 'recipeNodeCount', 'readableRecipeNodeCount', 'ingredientLineCount', 'instructionCount'];
      assert.deepEqual(Object.keys(source.jsonLd), fields);
      assert(fields.every((field) => Number.isInteger(source.jsonLd[field]) && source.jsonLd[field] >= 0));
      assert.equal(source.jsonLd.jsonLdScriptCount, source.jsonLd.parsedJsonLdCount + source.jsonLd.invalidJsonLdCount);
      assert(source.jsonLd.readableRecipeNodeCount <= source.jsonLd.recipeNodeCount);
      assert.equal(source.status, evidenceState(source));
    } else {
      assert.equal(source.status, 'SOURCE_UNAVAILABLE');
      assert.equal(source.contentSha256, null);
      assert.equal(source.byteLength, null);
      assert.equal(source.jsonLd, null);
    }
    assert.deepEqual(source.recipeIds, plan.recipes.filter((entry) => entry.url === source.url).map((entry) => entry.recipeId));
  }
  evidence.recipes.forEach((recipe, index) => {
    const expected = plan.recipes[index];
    assert.equal(recipe.recipeId, expected.recipeId);
    assert.equal(recipe.sourceId, expected.sourceId);
    assert.equal(recipe.url, expected.url);
    assert.equal(recipe.declaredSourceIndex, expected.declaredSourceIndex);
    assert.equal(recipe.status, byId.get(recipe.sourceId).status);
    assert.equal(recipe.relevanceReview, 'PENDING');
    assert.equal(recipe.claimReview, 'PENDING');
    assert.equal(recipe.contentVerification, 'NOT_VERIFIED');
    assert.equal(recipe.humanReview, 'PENDING');
  });
  assert.deepEqual(evidence.summary, summary(evidence.recipes, evidence.sources));
}

await selfCheck();
const command = process.argv[2];
if (command === 'self-check' && process.argv.length === 3) {
  console.log('recipe-v3-source-scan-self-check=ok');
} else if (command === 'check' && process.argv.length === 3) {
  const evidence = readJson(OUTPUT);
  validate(evidence, sourcePlan());
  console.log(`recipe-v3-source-scan-check=ok recipes=${evidence.recipes.length} uniqueUrls=${evidence.sources.length} network=none`);
} else if (command === 'fetch' && process.argv.length === 3) {
  const plan = sourcePlan();
  const urls = [...new Set(plan.recipes.map((entry) => entry.url))];
  const sources = new Array(urls.length);
  const startedAt = new Date().toISOString();
  let next = 0;
  let completed = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (next < urls.length) {
      const index = next++;
      sources[index] = { ...await retrieve(urls[index]), recipeIds: plan.recipes.filter((entry) => entry.url === urls[index]).map((entry) => entry.recipeId) };
      completed += 1;
      if (completed % 40 === 0 || completed === urls.length) console.log(`source-scan-progress=${completed}/${urls.length}`);
    }
  }));
  const byId = new Map(sources.map((entry) => [entry.sourceId, entry]));
  const recipes = plan.recipes.map((recipe) => ({ ...recipe, status: byId.get(recipe.sourceId).status,
    relevanceReview: 'PENDING', claimReview: 'PENDING', contentVerification: 'NOT_VERIFIED', humanReview: 'PENDING' }));
  const evidence = { schemaVersion: 1, program: 'TAKOLIO_RECIPE_INTELLIGENCE_V3', scope: 'AUTOMATED_DECLARED_PRIMARY_URL_SCAN',
    startedAt, completedAt: new Date().toISOString(), v2ManifestSha256: plan.manifestSha256, selectionSha256: plan.selectionSha256,
    selectionPolicy: 'First declared URL in V2 source order; V2 declares no primary source role. One selected URL per recipe, exact URL deduplication.',
    limits: { concurrency: CONCURRENCY, timeoutMs: TIMEOUT_MS, maxBodyBytes: MAX_BYTES, maxRedirects: 5 },
    interpretation: 'SOURCE_CONTENT_READ means a parsed Recipe JSON-LD node contained ingredients and instructions. It does not establish dish relevance, claim support, content verification, human approval or reuse rights. No full source text retained.',
    sourcePromotionAllowed: false, humanReview: 'PENDING', relevanceReview: 'PENDING', claimReview: 'PENDING',
    summary: summary(recipes, sources), sources, recipes };
  validate(evidence, plan);
  mkdirSync(path.dirname(OUTPUT), { recursive: true });
  const temporary = `${OUTPUT}.tmp-${process.pid}`;
  writeFileSync(temporary, `${JSON.stringify(evidence, null, 2)}\n`);
  renameSync(temporary, OUTPUT);
  console.log(`recipe-v3-source-scan-fetch=ok ${JSON.stringify(evidence.summary)}`);
} else {
  console.error('usage: node scripts/recipe-intelligence-v3-source-scan.mjs self-check | check | fetch');
  process.exitCode = 1;
}
