import { describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({ record: {}, build: vi.fn() }));
vi.mock('node:fs', async (original) => {
  const fs = await original();
  return { ...fs, readFileSync: (file, ...args) => file === 'dist/composition-flags.json'
    ? JSON.stringify(fixture.record) : fs.readFileSync(file, ...args) };
});
vi.mock('../../scripts/cloudflare-deploy-retry.mjs', () => ({
  capturedCommand: async (command, args, options) => {
    if (command !== 'pnpm' || args.join(' ') !== 'build') throw new Error('Only compilation needs a subprocess');
    fixture.build(command, args, options.env);
    return { exitCode: 0, output: '' };
  },
}));
const { productionProvider } = await import('../../scripts/domain/production-provider.mjs');

function context(enabled = true) {
  const value = String(enabled);
  fixture.record = { VITE_MEAL_COMPOSITION_V2_ENABLED: value, VITE_MEAL_PLANNER_ENABLED: value };
  return { manifest: { environment: 'production', mealCompositionV2Enabled: enabled },
    plan: { config: { vars: { ENVIRONMENT: 'production', MEAL_COMPOSITION_V2_ENABLED: value, MEAL_PLANNER_ENABLED: value } },
      buildEnvironment: { VITE_MEAL_COMPOSITION_V2_ENABLED: value, VITE_MEAL_PLANNER_ENABLED: value } } };
}

describe('production candidate build flags', () => {
  it.each([true, false])('accepts an audited production candidate with matched flags (%s)', async (enabled) => {
    const candidate = context(enabled);
    await expect(productionProvider.build(candidate)).resolves.toBeUndefined();
    expect(fixture.build).toHaveBeenLastCalledWith('pnpm', ['build'], expect.objectContaining(candidate.plan.buildEnvironment));
  });

  it.each([
    ['server composition', (candidate) => { candidate.plan.config.vars.MEAL_COMPOSITION_V2_ENABLED = 'false'; }],
    ['requested UI composition', (candidate) => { candidate.plan.buildEnvironment.VITE_MEAL_COMPOSITION_V2_ENABLED = 'false'; }],
    ['manifest', (candidate) => { candidate.manifest.mealCompositionV2Enabled = false; }],
    ['compiled composition', () => { fixture.record.VITE_MEAL_COMPOSITION_V2_ENABLED = 'false'; }],
    ['server planner', (candidate) => { candidate.plan.config.vars.MEAL_PLANNER_ENABLED = 'false'; }],
    ['compiled planner', () => { fixture.record.VITE_MEAL_PLANNER_ENABLED = 'false'; }],
    ['missing compiled flags', () => { fixture.record = {}; }],
  ])('rejects a mismatched %s before upload', async (_name, alter) => {
    const candidate = context(); alter(candidate);
    await expect(productionProvider.build(candidate)).rejects.toThrow();
  });
});

it.each(['manifest', 'config'])('rejects the wrong %s environment', async (target) => {
  const candidate = context();
  if (target === 'manifest') candidate.manifest.environment = 'staging';
  else candidate.plan.config.vars.ENVIRONMENT = 'staging';
  await expect(productionProvider.build(candidate)).rejects.toThrow('audited production');
});
