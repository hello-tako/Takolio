import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { classifyDeploymentFailure, deploymentArguments, deployWithSafeRetry } from '../../scripts/cloudflare-deploy-retry.mjs';

const accountId = 'a'.repeat(32);
const manifest = () => ({ sha: 'b'.repeat(40), environment: 'production', recipeCatalogMode: 'd1',
  recipeCatalogCanaryPercent: 0, recipeCatalogCutoverEnabled: true, mealCompositionV2Enabled: true });
const endpoint = `/accounts/${accountId}/workers/scripts/frigo/secrets`;
const service = `/accounts/${accountId}/workers/services/frigo`;
const trace = (path, method = 'GET') => `-- START CF API REQUEST: ${method} https://api.cloudflare.com/client/v4${path}\n-- END CF API REQUEST\n`;
const failure = (path = endpoint, status = 504) => `${trace(service)}${trace(path)}Received a malformed response from the API\n  GET ${path} -> ${status} Gateway Timeout\n  Cloudflare Ray ID: a4965246bbbdb9cf-IAD\n`;
const classify = (output) => classifyDeploymentFailure(output, { accountId, scriptName: 'frigo' });

function harness(results, options = {}) {
  let clock = 0;
  const order = [];
  const m = manifest();
  return { m, order, args: { manifest: m, accountId, now: () => clock,
    sleep: async (ms) => { clock += ms; order.push('sleep'); }, log: () => {},
    recheck: async () => { order.push('guard'); },
    run: async () => { order.push('deploy'); return results.shift(); }, ...options } };
}

describe('safe recovery of Cloudflare pre-upload metadata 504', () => {
  it.each([service, endpoint])('classifies the observed pre-upload read failure %s', (path) => {
    expect(classify(failure(path))).toMatchObject({ retryable: true, hasMutation: false, httpStatus: 504,
      rayId: 'a4965246bbbdb9cf-IAD', requestCount: 2 });
  });
  it('rechecks exact main/CI before each attempt and preserves sanitized evidence', async () => {
    const h = harness([{ exitCode: 1, output: failure() }, { exitCode: 0, output: trace(service) }]);
    await expect(deployWithSafeRetry(h.args)).resolves.toHaveLength(2);
    expect(h.order).toEqual(['guard', 'deploy', 'sleep', 'guard', 'deploy']);
    expect(h.m.cloudflareDeployAttempts[0]).toMatchObject({ retryable: true, endpoint: 'secrets', httpStatus: 504 });
    expect(JSON.stringify(h.m.cloudflareDeployAttempts)).not.toContain(accountId);
    expect(JSON.stringify(h.m.cloudflareDeployAttempts)).not.toContain('malformed response');
  });
  it.each(['POST', 'PUT', 'PATCH', 'DELETE', 'UNKNOWN'])('never retries after a %s even if the final GET returned 504', async (method) => {
    const output = `${trace(`/accounts/${accountId}/workers/scripts/frigo/versions`, method)}${failure()}`;
    expect(classify(output).retryable).toBe(false);
    const h = harness([{ exitCode: 1, output }]);
    await expect(deployWithSafeRetry(h.args)).rejects.toThrow('unsafe or exhausted');
    expect(h.order).toEqual(['guard', 'deploy']);
  });
  it.each([401, 403, 404, 409, 400, 200])('does not retry non-transient HTTP %s', (status) => {
    expect(classify(failure(endpoint, status)).retryable).toBe(false);
  });
  it.each([429, 500, 502, 503, 504])('retries a proven read-only metadata HTTP %s', (status) => {
    expect(classify(failure(endpoint, status)).retryable).toBe(true);
  });
  it.each([
    'GET /accounts/other/workers/scripts/frigo/secrets -> 504',
    'Received a malformed response from the API',
    `${trace(endpoint)}GET ${endpoint} -> 504\n-- START CF API REQUEST: broken`,
    `${trace(endpoint)}GET ${endpoint} -> 504\nUploaded frigo`,
    `${trace(endpoint)}GET ${endpoint} -> 504\nUploading assets`,
    `${trace('/user')}GET /user -> 504`,
    failure().replaceAll('api.cloudflare.com', 'example.com'),
    failure().replace(`GET ${endpoint} -> 504`, `POST ${endpoint} -> 504`),
  ])('fails closed on an incomplete, ambiguous or later-stage trace', (output) => {
    expect(classify(output).retryable).toBe(false);
  });
  it('does not retry a killed, timed out or truncated child process', async () => {
    const h = harness([{ exitCode: 1, output: failure(), incomplete: true }]);
    await expect(deployWithSafeRetry(h.args)).rejects.toThrow('unsafe or exhausted');
    expect(h.order).toEqual(['guard', 'deploy']);
  });
  it('stops after three transient failures', async () => {
    const h = harness(Array.from({ length: 3 }, () => ({ exitCode: 1, output: failure() })));
    await expect(deployWithSafeRetry(h.args)).rejects.toThrow('unsafe or exhausted');
    expect(h.order.filter((v) => v === 'deploy')).toHaveLength(3);
  });
  it('obeys the total deadline before a delayed retry', async () => {
    const h = harness([{ exitCode: 1, output: failure() }], { deadlineMs: 1_000 });
    await expect(deployWithSafeRetry(h.args)).rejects.toThrow('deadline exceeded');
    expect(h.order).toEqual(['guard', 'deploy']);
  });
  it('retains current attempt evidence even if a recheck refresh restores an old receipt', async () => {
    const m = manifest();
    let calls = 0;
    await deployWithSafeRetry({ manifest: m, accountId, log: () => {}, sleep: async () => {},
      recheck: async () => { m.cloudflareDeployAttempts = [{ attempt: 9, exitCode: 1 }]; },
      run: async () => (++calls === 1 ? { exitCode: 1, output: failure() } : { exitCode: 0, output: '' }),
    });
    expect(m.cloudflareDeployAttempts.map((v) => v.attempt)).toEqual([1, 2]);
  });
  it('rejects a changed manifest after the release recheck before executing a deploy', async () => {
    const h = harness([]);
    h.args.recheck = async () => { h.m.mealCompositionV2Enabled = false; };
    await expect(deployWithSafeRetry(h.args)).rejects.toThrow('configuration changed');
    expect(h.order).toEqual([]);
  });
  it('does not restart a child terminated by signal even with complete retry-looking output', async () => {
    const h = harness([{ exitCode: 0, signal: 'SIGTERM', output: failure() }]);
    await expect(deployWithSafeRetry(h.args)).rejects.toThrow('unsafe or exhausted');
    expect(h.order).toEqual(['guard', 'deploy']);
    expect(h.m.cloudflareDeployAttempts[0].terminationSignal).toBe('SIGTERM');
  });
  it('never deploys after a failed release recheck', async () => {
    const h = harness([], { recheck: async () => { throw new Error('main moved'); } });
    await expect(deployWithSafeRetry(h.args)).rejects.toThrow('main moved');
    expect(h.order).toEqual([]);
  });
  it('derives flags only from the guarded immutable manifest', () => {
    const m = manifest();
    expect(deploymentArguments(m)).toEqual(['exec', 'wrangler', 'deploy', '--var', `GIT_COMMIT:${m.sha}`,
      '--var', 'STRICT_OTP_FAIL_CLOSED:false', '--var', 'RECIPE_CATALOG_MODE:d1', '--var', 'RECIPE_CATALOG_D1_CANARY_PERCENT:0',
      '--var', 'RECIPE_CATALOG_CUTOVER_ENABLED:true', '--var', 'MEAL_PLANNER_ENABLED:true', '--var', 'MEAL_COMPOSITION_V2_ENABLED:true']);
    expect(deploymentArguments({ ...m, environment: 'staging' })).toContain('wrangler.staging.jsonc');
    expect(() => deploymentArguments({ ...m, sha: 'main' })).toThrow();
    expect(() => deploymentArguments({ ...m, recipeCatalogCutoverEnabled: false })).toThrow();
  });
  it('pins the trace parser to the reviewed pre-upload implementation', () => {
    const cli = readFileSync(new URL('../../node_modules/wrangler/wrangler-dist/cli.js', import.meta.url), 'utf8');
    const start = cli.indexOf('async function preUploadApiChecks(');
    const block = cli.slice(start, cli.indexOf('var init_validate_worker_props', start));
    expect(block).toContain('`/accounts/${accountId}/workers/services/${name2}`');
    expect(block).toContain('await checkRemoteSecretsOverride(');
    const deploy = cli.slice(cli.indexOf('async function deployWorker('));
    expect(deploy.indexOf('await preUploadApiChecks(')).toBeLessThan(deploy.indexOf('await syncAssets('));
  });
});
