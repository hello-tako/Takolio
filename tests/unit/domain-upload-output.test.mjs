import { describe, expect, it } from 'vitest';
import { uploadedWorkerVersion } from '../../scripts/domain/upload-output.mjs';

const session = { type: 'wrangler-session', version: 1, wrangler_version: '4.149.0',
  command_line_args: ['versions', 'upload', '--config', '/runner/wrangler.json', '--strict'],
  log_file_path: '/runner/wrangler.log', timestamp: '2026-10-17T22:09:55.000Z' };
const versionId = 'cf5aaef5-d83d-4dcf-b817-dfe41341cf18';
const result = (worker) => ({ type: 'version-upload', version: 1, worker_name: worker,
  version_id: versionId, worker_name_overridden: false, preview_url: 'https://preview.example.test' });

describe.each(['frigo-staging', 'frigo'])('Wrangler upload output for %s', (worker) => {
  it('accepts the pinned Wrangler session followed by one matching upload', () => {
    expect(uploadedWorkerVersion([session, result(worker)], worker)).toBe(versionId);
    expect(uploadedWorkerVersion([result(worker)], worker)).toBe(versionId);
  });

  it('rejects ambiguous, incomplete, wrong-worker and unexpected-operation output', () => {
    const upload = result(worker);
    for (const records of [
      null, [], [session], [null], [session, session, upload], [upload, session],
      [session, upload, upload], [session, { ...upload, worker_name: 'another-worker' }],
      [session, { ...upload, version_id: null }], [session, { ...upload, version_id: [versionId] }], [session, { ...upload, version_id: '../../settings' }],
      [session, { ...upload, version_id: 'x'.repeat(36) }],
      [session, { ...upload, version_id: `${versionId}?secret=private-value` }],
      [{ ...session, version: 2 }, upload], [session, { ...upload, version: 2 }],
      [session, upload, { type: 'deploy', version: 1 }],
    ]) expect(() => uploadedWorkerVersion(records, worker)).toThrow('reconciliation');
  });

  it('does not disclose command metadata or malformed output in an error', () => {
    const bad = [session, { ...result(worker), type: 'unknown-private-value' }];
    expect(() => uploadedWorkerVersion(bad, worker)).toThrow('Upload response requires reconciliation');
  });
});
