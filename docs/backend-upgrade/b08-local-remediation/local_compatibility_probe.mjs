import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmod, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync, inflateSync } from 'node:zlib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const require = createRequire(resolve(root, 'package.json'));
const mode = process.argv[2];
assert(['native', 'brand', 'd1', 'browser', 'pwa'].includes(mode), 'Select native, brand, d1, browser, or pwa');
assert.equal(Number(process.versions.node.split('.')[0]), 24, 'This packet is bounded to Node 24');
const out = resolve(root, process.argv[3] ?? `.artifacts/backend-b08-local-remediation/compatibility-${mode}`);
const artifactRoot = resolve(root, '.artifacts/backend-b08-local-remediation');
const outputRelative = relative(artifactRoot, out);
assert(outputRelative && !outputRelative.startsWith('..') && !isAbsolute(outputRelative));
await mkdir(out, { recursive: true });
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const packageVersion = async (name) => {
  let directory = dirname(require.resolve(name));
  for (;;) {
    try {
      const metadata = JSON.parse(await readFile(resolve(directory, 'package.json'), 'utf8'));
      if (metadata.name === name) return metadata.version;
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const parent = dirname(directory);
    assert.notEqual(parent, directory, `Package metadata unavailable for ${name}`);
    directory = parent;
  }
};
const sourceHashes = async (names) => Object.fromEntries(await Promise.all(names.map(async (name) => [name, sha(await readFile(resolve(root, name)))])));
const crc32 = (bytes) => {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  }
  return (value ^ 0xffffffff) >>> 0;
};
const pngChunk = (type, data) => {
  const tag = Buffer.from(type);
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc32(Buffer.concat([tag, data])));
  return Buffer.concat([length, tag, data, checksum]);
};
const pngChunks = (bytes) => {
  assert.deepEqual(bytes.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const chunks = [];
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    assert(offset + length + 12 <= bytes.length);
    const type = bytes.subarray(offset + 4, offset + 8).toString('ascii');
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    assert.equal(bytes.readUInt32BE(offset + 8 + length), crc32(bytes.subarray(offset + 4, offset + 8 + length)));
    chunks.push({ type, data });
    offset += length + 12;
  }
  assert.equal(chunks.at(-1).type, 'IEND');
  return chunks;
};

async function nativeProbe() {
  const { default: sharp } = await import('sharp');
  const width = 32, height = 18, color = [24, 128, 72, 255];
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  const rows = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    for (let channel = 0; channel < 4; channel++) rows[y * (width * 4 + 1) + 1 + x * 4 + channel] = color[channel];
  }
  // The trusted PNG is encoded independently of sharp; each row uses filter 0.
  const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(rows, { level: 0 })), pngChunk('IEND', Buffer.alloc(0))]);
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="18"><rect width="32" height="18" fill="#188048"/></svg>');
  const checks = [];
  for (const [format, fixture] of [['png', png], ['svg', svg]]) {
    const metadata = await sharp(fixture).metadata();
    assert.deepEqual([metadata.format, metadata.width, metadata.height], [format, width, height]);
    const decoded = await sharp(fixture).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.deepEqual([decoded.info.width, decoded.info.height, decoded.info.channels], [width, height, 4]);
    for (let offset = 0; offset < decoded.data.length; offset += 4) assert.deepEqual([...decoded.data.subarray(offset, offset + 4)], color);
    const resized = await sharp(fixture).resize(13, 9, { fit: 'fill' }).png().toBuffer();
    const resizedMetadata = await sharp(resized).metadata();
    assert.deepEqual([resizedMetadata.format, resizedMetadata.width, resizedMetadata.height], ['png', 13, 9]);
    const pixels = await sharp(resized).ensureAlpha().raw().toBuffer();
    for (let offset = 0; offset < pixels.length; offset += 4) assert.deepEqual([...pixels.subarray(offset, offset + 4)], color);
    checks.push({ inputFormat: format, fixtureSha256: sha(fixture), decodedPixelSha256: sha(decoded.data),
      inputDimensions: [width, height], resizedDimensions: [13, 9], allExpectedPixelsMatched: true, outputSha256: sha(resized) });
  }
  return { checks, sharpVersion: await packageVersion('sharp'), nativeLibraryVersions: sharp.versions,
    limits: ['Two self-contained trusted synthetic fixtures; not an untrusted-image decoder security certificate.', 'No provider calls or external source bytes.'] };
}

async function brandProbe() {
  const { default: sharp } = await import('sharp');
  const { generateBrand } = await import(resolve(root, 'scripts/generate-takosan-brand.mjs'));
  const generated = await mkdtemp(resolve(tmpdir(), 'takosan-b08-brand-'));
  await chmod(generated, 0o700);
  const names = await generateBrand(generated);
  assert.equal(names.length, 36);
  const checks = [], encoderCandidates = [];
  for (const name of names) {
    const committed = await readFile(resolve(root, 'public/takosan/rebuild', name));
    const current = await readFile(resolve(generated, name));
    const check = { name, committedSha256: sha(committed), generatedSha256: sha(current), bytesEqual: committed.equals(current) };
    if (name.endsWith('.png')) {
      const oldMetadata = await sharp(committed).metadata();
      const newMetadata = await sharp(current).metadata();
      const identity = ({ format, width, height, channels, space, depth, hasAlpha }) => ({ format, width, height, channels, space, depth, hasAlpha });
      assert.deepEqual(identity(newMetadata), identity(oldMetadata), name);
      assert.equal(newMetadata.hasAlpha, false, name);
      check.metadataEqual = true; check.generatedMetadata = identity(newMetadata);
      const oldPixels = await sharp(committed).raw().toBuffer({ resolveWithObject: true });
      const newPixels = await sharp(current).raw().toBuffer({ resolveWithObject: true });
      check.dimensions = [oldPixels.info.width, oldPixels.info.height, oldPixels.info.channels];
      check.generatedDimensions = [newPixels.info.width, newPixels.info.height, newPixels.info.channels];
      check.decodedPixelsEqual = oldPixels.data.equals(newPixels.data);
      assert.deepEqual([newPixels.info.width, newPixels.info.height, newPixels.info.channels], [oldPixels.info.width, oldPixels.info.height, oldPixels.info.channels], name);
      assert(check.decodedPixelsEqual, name);
      check.committedPixelSha256 = sha(oldPixels.data); check.generatedPixelSha256 = sha(newPixels.data);
      const oldChunks = pngChunks(committed), newChunks = pngChunks(current);
      const oldIdat = Buffer.concat(oldChunks.filter((chunk) => chunk.type === 'IDAT').map((chunk) => chunk.data));
      const newIdat = Buffer.concat(newChunks.filter((chunk) => chunk.type === 'IDAT').map((chunk) => chunk.data));
      const oldScanlines = inflateSync(oldIdat), newScanlines = inflateSync(newIdat);
      check.pngChunks = { committed: oldChunks.map(({ type, data }) => ({ type, length: data.length })),
        generated: newChunks.map(({ type, data }) => ({ type, length: data.length })) };
      check.idatHeaders = { committed: oldIdat.subarray(0, 2).toString('hex'), generated: newIdat.subarray(0, 2).toString('hex') };
      check.filteredScanlineBytesEqual = oldScanlines.equals(newScanlines);
      if (name === 'app-icons/icon-16.png') {
        for (let level = 0; level <= 9; level++) for (let strategy = 0; strategy <= 4; strategy++) {
          const bytes = deflateSync(oldScanlines, { level, strategy, windowBits: 15 });
          encoderCandidates.push({ name, encoder: 'node:zlib', level, strategy, windowBits: 15, idatLength: bytes.length, idatBytesEqual: bytes.equals(oldIdat) });
        }
        for (let compressionLevel = 0; compressionLevel <= 9; compressionLevel++) {
          const bytes = await sharp(resolve(generated, 'app-icons/favicon.svg')).resize(16, 16)
            .flatten({ background: '#F7F3EC' }).png({ compressionLevel, adaptiveFiltering: false, palette: false }).toBuffer();
          encoderCandidates.push({ name, encoder: 'sharp', compressionLevel, adaptiveFiltering: false, palette: false, bytesEqual: bytes.equals(committed) });
        }
      }
    } else { assert(check.bytesEqual, name); }
    checks.push(check);
  }
  const generatedChecksumManifest = Object.fromEntries(checks.map((check) => [check.name, check.generatedSha256]));
  await writeFile(resolve(out, 'generated-checksums.json'), JSON.stringify(generatedChecksumManifest, null, 2) + '\n');
  await writeFile(resolve(out, 'generated-private-pointer.json'), JSON.stringify({ directory: generated, directorySha256: sha(generated) }), { mode: 0o600 });
  return { checks, encoderCandidates, generatedChecksumManifestSha256: sha(await readFile(resolve(out, 'generated-checksums.json'))), byteEqualCount: checks.filter((check) => check.bytesEqual).length,
    pngCount: checks.filter((check) => check.name.endsWith('.png')).length,
    pngPixelEqualCount: checks.filter((check) => check.decodedPixelsEqual).length,
    pngScanlineEqualCount: checks.filter((check) => check.filteredScanlineBytesEqual).length,
    allCommittedFilesPreserved: true, sharpVersion: await packageVersion('sharp'), nativeLibraryVersions: sharp.versions,
    sourceHashes: await sourceHashes(['scripts/generate-takosan-brand.mjs', 'tests/unit/ui07-brand-exports.test.mjs']),
    limits: ['Reports compatibility evidence; does not replace the existing byte-identity gate.', 'No generator source or public asset changed.'] };
}

async function d1Probe() {
  for (const key of ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_API_KEY', 'CLOUDFLARE_ACCOUNT_ID', 'CF_API_TOKEN', 'CF_API_KEY']) assert(!process.env[key], `${key} must be unset`);
  const tempRelative = relative(root, resolve(tmpdir()));
  assert(tempRelative.startsWith('..') || isAbsolute(tempRelative), 'Local persistence must be outside the repository');
  const { unstable_dev } = await import('wrangler');
  const directory = await mkdtemp(resolve(tmpdir(), 'takosan-b08-wrangler-'));
  await chmod(directory, 0o700);
  const script = resolve(directory, 'worker.mjs');
  await writeFile(script, `export default { async fetch(request, env) {
    if (request.method !== 'POST') return new Response('Unsupported', {status:405});
    const {statements} = await request.json();
    const results = await env.DB.batch(statements.map(({sql, values=[]}) => env.DB.prepare(sql).bind(...values)));
    return Response.json({results});
  }};\n`, { mode: 0o600 });
  const options = { ip: '127.0.0.1', port: 0, inspectorPort: 0, local: true, persist: true,
    logLevel: 'error', experimental: { disableExperimentalWarning: true, disableDevRegistry: true, forceLocal: true, watch: false,
      d1Databases: [{ binding: 'DB', database_name: 'b08-compatibility-synthetic', database_id: '00000000-0000-4000-8000-000000000008' }] } };
  let worker;
  const start = async (name) => {
    const partition = resolve(directory, name); await mkdir(partition, { recursive: true });
    const config = resolve(partition, 'wrangler.json');
    await writeFile(config, JSON.stringify({ name: `b08-compatibility-${name}`, compatibility_date: '2025-03-01' }));
    worker = await unstable_dev(script, { ...options, config, persistTo: resolve(partition, 'state') });
  };
  const stop = async () => { if (worker) { const active = worker; worker = undefined; await active.stop(); } };
  const batch = async (statements) => {
    const response = await worker.fetch('http://localhost/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ statements }) });
    assert.equal(response.status, 200); const body = await response.json(); assert(body.results.every((result) => result.success)); return body.results;
  };
  const read = async () => (await batch([{ sql: 'SELECT id, value FROM compatibility_probe ORDER BY id' }]))[0].results;
  const checks = [];
  try {
    await start('a');
    await batch([{ sql: 'CREATE TABLE compatibility_probe (id INTEGER PRIMARY KEY, value TEXT NOT NULL)' },
      { sql: 'INSERT INTO compatibility_probe VALUES (?, ?)', values: [1, 'synthetic-a'] }]);
    assert.deepEqual(await read(), [{ id: 1, value: 'synthetic-a' }]); await stop();
    await start('b');
    const absent = (await batch([{ sql: "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'compatibility_probe'" }]))[0].results[0].count;
    assert.equal(absent, 0);
    await batch([{ sql: 'CREATE TABLE compatibility_probe (id INTEGER PRIMARY KEY, value TEXT NOT NULL)' },
      { sql: 'INSERT INTO compatibility_probe VALUES (?, ?)', values: [1, 'synthetic-b'] }]);
    assert.deepEqual(await read(), [{ id: 1, value: 'synthetic-b' }]); await stop();
    checks.push({ case: 'same_database_id_different_persistTo_directories', status: 'PASS', foreignTableCount: absent });
    await start('a'); assert.deepEqual(await read(), [{ id: 1, value: 'synthetic-a' }]);
    await batch([{ sql: 'INSERT INTO compatibility_probe VALUES (?, ?)', values: [2, 'synthetic-a-restart'] }]); await stop();
    await start('a'); assert.deepEqual(await read(), [{ id: 1, value: 'synthetic-a' }, { id: 2, value: 'synthetic-a-restart' }]); await stop();
    checks.push({ case: 'persistTo_survives_two_workerd_restarts', status: 'PASS', survivingRowCount: 2 });
    const { startLocalD1Worker } = await import(resolve(root, 'tests/helpers/local-d1-worker.mjs'));
    const helper = await startLocalD1Worker({ name: 'b08-compatibility', databaseName: 'b08-compatibility-synthetic',
      databaseId: '00000000-0000-4000-8000-000000000008', token: 'synthetic-local-probe-only', script });
    try {
      const response = await helper.fetch('http://localhost/', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ statements: [{ sql: 'CREATE TABLE helper_probe (id INTEGER PRIMARY KEY)' },
          { sql: 'INSERT INTO helper_probe VALUES (8)' }, { sql: 'SELECT id FROM helper_probe' }] }) });
      assert.equal(response.status, 200); const body = await response.json(); assert.deepEqual(body.results.at(-1).results, [{ id: 8 }]);
      checks.push({ case: 'actual_existing_local_D1_helper_with_tiny_synthetic_schema', status: 'PASS', survivingRowCount: 1 });
    } finally { await helper.stop(); }
  } finally { await stop(); }
  await writeFile(resolve(out, 'persistence-private-pointer.json'), JSON.stringify({ directory, directorySha256: sha(directory) }), { mode: 0o600 });
  return { checks, wranglerVersion: await packageVersion('wrangler'), persistenceOutsideRepository: true,
    persistenceOptions: { local: true, persist: true, persistTo: 'two distinct OS-private-temp directories', forceLocal: true, watch: false },
    sourceHashes: await sourceHashes(['tests/helpers/local-d1-worker.mjs']),
    limits: ['Tiny synthetic schema only; full 40-migration replay and remote D1 are separate gates.', 'Local durable restart proof does not certify production persistence or rollout.'] };
}

async function pwaProbe() {
  const { chromium } = await import('@playwright/test');
  const { runBuiltPwaCompatibility } = await import('./local_pwa_browser_probe.mjs');
  const browser = await chromium.launch(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {});
  try { return await runBuiltPwaCompatibility({ root, browser, sourceHashes }); }
  finally { await browser.close(); }
}

async function browserProbe() {
  const { runBrowserCompatibility } = await import('./local_router_browser_probe.mjs');
  return runBrowserCompatibility({ root, out, sha, packageVersion, sourceHashes });
}

const receipt = { schemaVersion: 1, classification: 'BOUNDED_LOCAL_DEPENDENCY_COMPATIBILITY_PROBE', mode,
  nodeVersion: process.version, platform: process.platform, architecture: process.arch,
  startedAtUtc: new Date().toISOString(), sourceHashes: await sourceHashes(['package.json', 'pnpm-lock.yaml', 'docs/backend-upgrade/b08-local-remediation/local_compatibility_probe.mjs']),
  sourceValuesOrCredentialsPublished: false, externalCredentialValidation: false };
try {
  receipt.result = await ({ native: nativeProbe, brand: brandProbe, d1: d1Probe, browser: browserProbe, pwa: pwaProbe })[mode]();
  receipt.status = 'PASS';
} catch (error) {
  receipt.status = 'FAIL'; receipt.failure = { name: error.name, message: String(error.message).slice(0, 700) };
  process.exitCode = 1;
} finally {
  receipt.finishedAtUtc = new Date().toISOString();
  await writeFile(resolve(out, 'receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(JSON.stringify({ mode, status: receipt.status, receiptPath: relative(root, resolve(out, 'receipt.json')),
    receiptSha256: sha(await readFile(resolve(out, 'receipt.json'))), ...(receipt.failure ? { failure: receipt.failure } : {}),
    ...(receipt.result?.checks ? { checkCount: receipt.result.checks.length } : {}),
    ...(mode === 'brand' && receipt.result ? { byteEqualCount: receipt.result.byteEqualCount, pngCount: receipt.result.pngCount,
      pngPixelEqualCount: receipt.result.pngPixelEqualCount, pngScanlineEqualCount: receipt.result.pngScanlineEqualCount } : {}) }));
}
