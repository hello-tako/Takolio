import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  verifyCompositionFlagPair,
  verifyCompositionRelease,
  verifyStagingPlannerPrerequisite,
} from '../../scripts/composition-flags.mjs';
import { deploymentArguments } from '../../scripts/cloudflare-deploy-retry.mjs';
import { resolveMealCompositionV2Release } from '../../scripts/release-check.mjs';
import { parseWranglerJsonc } from '../../scripts/d1-migration-check.mjs';

// Reuse the YAML parser owned by the locked ESLint dependency, without adding tooling.
const require = createRequire(import.meta.url);
const { load } = createRequire(require.resolve('eslint/package.json'))('js-yaml');
const read = (file) => readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
const deploySource = read('.github/workflows/deploy.yml');
const deploy = load(deploySource);
const OUTPUT = '${{ needs.release.outputs.meal_composition_v2_enabled }}';
const stepIndex = (steps, name) => steps.findIndex((step) => step.name === name);
const GUARD = 'Require matching Meal Composition V2 server and UI flags';

describe('T20 composition flags: Wrangler defaults', () => {
  it.each(['wrangler.jsonc', 'wrangler.staging.jsonc', 'wrangler.staging.jsonc.example'])(
    '%s defaults MEAL_COMPOSITION_V2_ENABLED to "false"',
    (file) => {
      expect(parseWranglerJsonc(read(file), file).vars.MEAL_COMPOSITION_V2_ENABLED).toBe('false');
    },
  );
});

describe('T20 staging planner prerequisites', () => {
  const staging = parseWranglerJsonc(read('wrangler.staging.jsonc'), 'wrangler.staging.jsonc');
  it('configures the planner on the staging Worker and in the staging UI build', () => {
    expect(staging.vars.MEAL_PLANNER_ENABLED).toBe('true');
    const build = deploy.jobs.staging.steps.find((step) => step.name === 'Build');
    expect(build.env.VITE_MEAL_PLANNER_ENABLED).toBe('true');
    const productionBuild = deploy.jobs.production.steps.find((step) => step.name === 'Build');
    expect(productionBuild.env.VITE_MEAL_PLANNER_ENABLED).toBe(OUTPUT);
  });
  it('rejects T20 when either staging planner flag is missing or the wrong environment is supplied', () => {
    const built = { VITE_MEAL_PLANNER_ENABLED: 'true' };
    expect(() => verifyStagingPlannerPrerequisite({ composition: 'true', config: staging, buildRecord: built })).not.toThrow();
    expect(() => verifyStagingPlannerPrerequisite({ composition: 'true', config: { vars: { ...staging.vars, MEAL_PLANNER_ENABLED: 'false' } }, buildRecord: built })).toThrow(/MEAL_PLANNER_ENABLED/);
    expect(() => verifyStagingPlannerPrerequisite({ composition: 'true', config: staging, buildRecord: {} })).toThrow(/VITE_MEAL_PLANNER_ENABLED/);
    expect(() => verifyStagingPlannerPrerequisite({ composition: 'true', config: { vars: { ENVIRONMENT: 'production' } }, buildRecord: built })).toThrow(/staging Wrangler/);
    expect(() => verifyStagingPlannerPrerequisite({ composition: 'false', config: { vars: { ENVIRONMENT: 'staging' } }, buildRecord: {} })).not.toThrow();
  });
});

describe('T20 composition flags: release gate normalization', () => {
  it('is off for pushes, missing input and the default dispatch', () => {
    expect(resolveMealCompositionV2Release({ eventName: 'workflow_run', input: 'false' })).toBe('false');
    expect(resolveMealCompositionV2Release({ eventName: 'workflow_run', input: 'true' })).toBe('false');
    expect(resolveMealCompositionV2Release({ eventName: 'workflow_dispatch', input: undefined })).toBe('false');
    expect(resolveMealCompositionV2Release({ eventName: 'workflow_dispatch', input: 'false' })).toBe('false');
    expect(resolveMealCompositionV2Release({ eventName: undefined, input: 'true' })).toBe('false');
  });
  it('is on only for an explicit dispatch opt-in', () => {
    expect(resolveMealCompositionV2Release({ eventName: 'workflow_dispatch', input: 'true' })).toBe('true');
  });
  it('treats any non-canonical value as off', () => {
    for (const input of ['TRUE', 'True', ' true', 'true ', '1', 'yes', 'on', '', true, 1, null]) {
      expect(resolveMealCompositionV2Release({ eventName: 'workflow_dispatch', input }), String(input)).toBe('false');
    }
  });
  it('the gate emits the normalized value as a step output and records it in the manifest', () => {
    const script = read('scripts/release-check.mjs');
    expect(script).toContain('input: process.env.MEAL_COMPOSITION_V2_ENABLED_INPUT');
    expect(script).toContain('eventName: process.env.GITHUB_EVENT_NAME');
    expect(script).toContain("mealCompositionV2Enabled: mealCompositionV2Enabled === 'true'");
    expect(script).toContain('meal_composition_v2_enabled=${mealCompositionV2Enabled}');
  });
});

describe('T20 composition flags: deploy workflow wiring', () => {
  it('requires an explicit dispatch so a main push cannot turn off live staging T20', () => {
    expect(Object.keys(deploy.on)).toEqual(['workflow_dispatch']);
    expect(deploy.jobs.release.if).toContain("github.ref == 'refs/heads/main'");
    expect(deploy.jobs.release.if).toContain("inputs.environment == 'staging'");
  });
  it('declares a boolean dispatch input defaulting to false', () => {
    const input = deploy.on.workflow_dispatch.inputs.meal_composition_v2_enabled;
    expect(input.type).toBe('boolean');
    expect(input.default).toBe(false);
    expect(input.description).toMatch(/BOTH/);
  });
  it('the release job derives one normalized output from the gate', () => {
    const release = deploy.jobs.release;
    expect(release.outputs.meal_composition_v2_enabled).toBe(
      '${{ steps.gate.outputs.meal_composition_v2_enabled }}',
    );
    const gate = release.steps.find((step) => step.id === 'gate');
    expect(gate.run).toBe('node scripts/release-check.mjs gate');
    expect(gate.env.MEAL_COMPOSITION_V2_ENABLED_INPUT).toBe(
      "${{ github.event_name == 'workflow_dispatch' && inputs.meal_composition_v2_enabled || false }}",
    );
  });
  it.each(['staging', 'production'])(
    '%s builds the UI flag and deploys the Worker var from the same output, guarded in between',
    (job) => {
      const steps = deploy.jobs[job].steps;
      const build = stepIndex(steps, 'Build');
      const guard = stepIndex(steps, GUARD);
      const deployStep = steps.findIndex((step) => step.run === 'node scripts/cloudflare-deploy-retry.mjs release-manifest.json');
      expect(build).toBeGreaterThan(-1);
      expect(steps[build].run).toBe('pnpm build');
      expect(steps[build].env.VITE_MEAL_COMPOSITION_V2_ENABLED).toBe(OUTPUT);
      expect(guard).toBeGreaterThan(build);
      expect(deployStep).toBeGreaterThan(guard);
      expect(steps[guard].run).toBe(job === 'staging'
        ? 'node scripts/composition-flags.mjs verify release-manifest.json dist/composition-flags.json wrangler.staging.jsonc'
        : 'node scripts/composition-flags.mjs verify release-manifest.json dist/composition-flags.json');
      expect(steps[guard].env).toEqual({
        MEAL_COMPOSITION_V2_ENABLED: OUTPUT,
        VITE_MEAL_COMPOSITION_V2_ENABLED: OUTPUT,
        ...(job === 'production' ? { MEAL_PLANNER_ENABLED: OUTPUT } : {}),
      });
      if (job === 'staging') expect(steps[guard].if).toBe(steps[build].if);
      for (const enabled of [true, false]) {
        expect(deploymentArguments({ sha: 'a'.repeat(40), environment: job, recipeCatalogMode: 'd1',
          recipeCatalogCanaryPercent: 0, recipeCatalogCutoverEnabled: true, mealCompositionV2Enabled: enabled }))
          .toContain(`MEAL_COMPOSITION_V2_ENABLED:${enabled}`);
      }
      const builders = steps.filter((step) => /pnpm build\b/.test(String(step.run ?? '')));
      expect(steps[build].env.VITE_MEAL_PLANNER_ENABLED).toBe(job === 'staging' ? 'true' : OUTPUT);
      if (job === 'staging') {
        expect(builders.map((step) => step.name)).toEqual(['Build']);
      } else {
        const recoveryName = 'Prepare compatible family-meal recovery before serving traffic';
        expect(builders.map((step) => step.name)).toEqual(['Build', recoveryName]);
        const recovery = builders[1];
        expect(recovery.env.COMPOSITION_ENABLED).toBe(OUTPUT);
        expect(recovery.env.DEPLOY_SHA).toBe('${{ needs.release.outputs.deploy_sha }}');
        const compileLines = recovery.run.match(/^[^\n]*\bpnpm build\b.*$/gm);
        expect(compileLines).toHaveLength(2);
        expect(compileLines[0]).toContain('GIT_COMMIT="${DEPLOY_SHA}" VITE_MEAL_PLANNER_ENABLED=false VITE_MEAL_COMPOSITION_V2_ENABLED=false pnpm build');
        expect(compileLines[1]).toContain('GIT_COMMIT="${DEPLOY_SHA}" VITE_MEAL_PLANNER_ENABLED="${COMPOSITION_ENABLED}" VITE_MEAL_COMPOSITION_V2_ENABLED="${COMPOSITION_ENABLED}" pnpm build');
        const proof = recovery.run.indexOf('node scripts/family-meal-release.mjs build-proof');
        const inactiveUpload = recovery.run.indexOf('pnpm wrangler versions upload');
        const certify = recovery.run.indexOf('node scripts/family-meal-release.mjs certify');
        const activeCompile = recovery.run.indexOf(compileLines[1]);
        const activeGuard = recovery.run.indexOf('MEAL_PLANNER_ENABLED="${COMPOSITION_ENABLED}" MEAL_COMPOSITION_V2_ENABLED="${COMPOSITION_ENABLED}" VITE_MEAL_COMPOSITION_V2_ENABLED="${COMPOSITION_ENABLED}" node scripts/composition-flags.mjs verify release-manifest.json dist/composition-flags.json');
        expect(proof).toBeGreaterThan(recovery.run.indexOf(compileLines[0]));
        expect(inactiveUpload).toBeGreaterThan(proof);
        expect(certify).toBeGreaterThan(inactiveUpload);
        expect(activeCompile).toBeGreaterThan(certify);
        expect(activeGuard).toBeGreaterThan(activeCompile);
        expect(inactiveUpload).toBeLessThan(activeCompile);
        expect(recovery.run).toContain('--var MEAL_PLANNER_ENABLED:false --var MEAL_COMPOSITION_V2_ENABLED:false');
        expect(stepIndex(steps, recoveryName)).toBeGreaterThan(guard);
        expect(stepIndex(steps, recoveryName)).toBeLessThan(deployStep);
      }
    },
  );
  it('never reads the dispatch input anywhere but the normalizing gate', () => {
    expect(deploySource.match(/inputs\.meal_composition_v2_enabled/g)).toHaveLength(1);
    expect(deploySource.match(/run: node scripts\/cloudflare-deploy-retry\.mjs release-manifest\.json/g)).toHaveLength(2);
  });
});

describe('T20 composition flags: build consistency guard', () => {
  const manifest = (enabled) => ({ mealCompositionV2Enabled: enabled });
  const record = (value) => ({ VITE_MEAL_COMPOSITION_V2_ENABLED: value });
  it('passes off/off and on/on', () => {
    expect(verifyCompositionFlagPair({ server: 'false', ui: 'false' })).toBe('false');
    expect(verifyCompositionFlagPair({ server: 'true', ui: 'true' })).toBe('true');
    expect(verifyCompositionRelease({ server: 'false', ui: 'false', manifest: manifest(false), buildRecord: record('false') })).toBe('false');
    expect(verifyCompositionRelease({ server: 'true', ui: 'true', manifest: manifest(true), buildRecord: record('true') })).toBe('true');
  });
  it('fails any mismatch', () => {
    expect(() => verifyCompositionFlagPair({ server: 'true', ui: 'false' })).toThrow(/mismatch/);
    expect(() => verifyCompositionFlagPair({ server: 'false', ui: 'true' })).toThrow(/mismatch/);
  });
  it('fails non-canonical or missing values', () => {
    for (const bad of [undefined, null, '', 'TRUE', 'True', '1', '0', 'yes', ' true', true, false]) {
      expect(() => verifyCompositionFlagPair({ server: bad, ui: bad }), String(bad)).toThrow(/exactly/);
      expect(() => verifyCompositionFlagPair({ server: 'false', ui: bad }), String(bad)).toThrow(/exactly/);
    }
  });
  it('fails when the manifest or the compiled UI disagrees with the deploy value', () => {
    expect(() => verifyCompositionRelease({ server: 'true', ui: 'true', manifest: manifest(false), buildRecord: record('true') })).toThrow(/manifest/);
    expect(() => verifyCompositionRelease({ server: 'true', ui: 'true', manifest: {}, buildRecord: record('true') })).toThrow(/manifest/);
    expect(() => verifyCompositionRelease({ server: 'true', ui: 'true', manifest: manifest('true'), buildRecord: record('true') })).toThrow(/manifest/);
    expect(() => verifyCompositionRelease({ server: 'true', ui: 'true', manifest: manifest(true), buildRecord: record('false') })).toThrow(/Built UI/);
    expect(() => verifyCompositionRelease({ server: 'false', ui: 'false', manifest: manifest(false), buildRecord: record(null) })).toThrow(/Built UI/);
    expect(() => verifyCompositionRelease({ server: 'false', ui: 'false', manifest: manifest(false), buildRecord: {} })).toThrow(/Built UI/);
  });

  const dir = mkdtempSync(path.join(tmpdir(), 'composition-flags-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  const runCli = ({ server, ui, enabled, built }) => {
    const manifestFile = path.join(dir, 'manifest.json');
    const recordFile = path.join(dir, 'record.json');
    writeFileSync(manifestFile, JSON.stringify(manifest(enabled)));
    writeFileSync(recordFile, JSON.stringify({ ...record(built), VITE_MEAL_PLANNER_ENABLED: 'true' }));
    const env = { PATH: process.env.PATH, MEAL_PLANNER_ENABLED: 'true' };
    if (server !== undefined) env.MEAL_COMPOSITION_V2_ENABLED = server;
    if (ui !== undefined) env.VITE_MEAL_COMPOSITION_V2_ENABLED = ui;
    return spawnSync(process.execPath, ['scripts/composition-flags.mjs', 'verify', manifestFile, recordFile], {
      env,
      encoding: 'utf8',
    }).status;
  };
  it('CLI exits 0 for off/off and on/on, non-zero for mismatch or missing flags', () => {
    expect(runCli({ server: 'false', ui: 'false', enabled: false, built: 'false' })).toBe(0);
    expect(runCli({ server: 'true', ui: 'true', enabled: true, built: 'true' })).toBe(0);
    expect(runCli({ server: 'true', ui: 'false', enabled: true, built: 'false' })).not.toBe(0);
    expect(runCli({ server: 'false', ui: 'true', enabled: false, built: 'true' })).not.toBe(0);
    expect(runCli({ server: 'true', ui: 'true', enabled: true, built: 'false' })).not.toBe(0);
    expect(runCli({ server: undefined, ui: undefined, enabled: false, built: 'false' })).not.toBe(0);
  });
});


describe('T20 production planner prerequisite', () => {
  it('binds the production backend, compiled UI and pre-upload guard to the normalized T20 decision', () => {
    const steps = deploy.jobs.production.steps;
    const build = steps.find((step) => step.name === 'Build');
    const guard = steps.find((step) => step.name === GUARD);
    const upload = steps.find((step) => step.run === 'node scripts/cloudflare-deploy-retry.mjs release-manifest.json');
    expect(build.env.VITE_MEAL_PLANNER_ENABLED).toBe(OUTPUT);
    expect(guard.env.MEAL_PLANNER_ENABLED).toBe(OUTPUT);
    expect(upload.run).toBe('node scripts/cloudflare-deploy-retry.mjs release-manifest.json');
    for (const enabled of [true, false]) {
      expect(deploymentArguments({ sha: 'a'.repeat(40), environment: 'production', recipeCatalogMode: 'd1',
        recipeCatalogCanaryPercent: 0, recipeCatalogCutoverEnabled: true, mealCompositionV2Enabled: enabled }))
        .toContain(`MEAL_PLANNER_ENABLED:${enabled}`);
    }
    // Production defaults remain off; no config edit activates a runtime.
    expect(parseWranglerJsonc(read('wrangler.jsonc'), 'wrangler.jsonc').vars.MEAL_PLANNER_ENABLED).not.toBe('true');
  });
  it('cannot pass the production CLI guard with T20 on while the compiled planner or Worker prerequisite is missing', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 't20-prerequisite-'));
    try {
      const manifest = path.join(dir, 'manifest.json');
      const built = path.join(dir, 'built.json');
      writeFileSync(manifest, JSON.stringify({ mealCompositionV2Enabled: true }));
      const run = (server, ui) => {
        writeFileSync(built, JSON.stringify({ VITE_MEAL_COMPOSITION_V2_ENABLED: 'true', VITE_MEAL_PLANNER_ENABLED: ui }));
        return spawnSync(process.execPath, ['scripts/composition-flags.mjs', 'verify', manifest, built], {
          encoding: 'utf8', env: { PATH: process.env.PATH, MEAL_COMPOSITION_V2_ENABLED: 'true',
            VITE_MEAL_COMPOSITION_V2_ENABLED: 'true', ...(server === undefined ? {} : { MEAL_PLANNER_ENABLED: server }) },
        });
      };
      expect(run(undefined, 'true').status).not.toBe(0);
      expect(run('false', 'true').status).not.toBe(0);
      expect(run('true', undefined).status).not.toBe(0);
      expect(run('true', 'false').status).not.toBe(0);
      expect(run('true', 'true').status).toBe(0);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
