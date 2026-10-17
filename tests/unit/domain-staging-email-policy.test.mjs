import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { captureBindings } from '../../scripts/domain/bindings.mjs';
import { prepareConfig } from '../../scripts/domain/prepare.mjs';
import { configHash } from '../../scripts/domain/release-config.mjs';
import { verifyUploadedVersion } from '../../scripts/domain/staging-release.mjs';
import {
  stagingEmailRecipient, expectedStagingBindings, preserveStagingEmailConfig,
  addStagingEmail, uploadTypedBindings, serializeStagingReceipt, hydrateStagingReceipt,
} from '../../scripts/domain/staging-email-policy.mjs';

const address = 'approved-inbox@example.test';
const email = { name: 'SEND_EMAIL', type: 'send_email', destination_address: address };
const baseline = JSON.parse(readFileSync('docs/domain-integration/evidence/live-runtime.json', 'utf8'));
const previous = baseline.workers.staging;
function candidate() {
  const plan = prepareConfig('staging', baseline, 'a'.repeat(40));
  addStagingEmail(plan, previous, address);
  const version = { id: '22222222-2222-4222-8222-222222222222', resources: {
    bindings: [...plan.expectedTypedBindings,
      ...Object.entries(plan.config.vars).map(([name, text]) => ({ name, type: 'plain_text', text })),
      ...previous.secretNames.map((name) => ({ name, type: 'secret_text' }))],
    script_runtime: { ...structuredClone(previous.runtime), assets: {
      ...structuredClone(previous.runtime.assets), raw_run_worker_first: true } },
  } };
  return { plan, version };
}

describe('private restricted staging email policy', () => {
  it.each([undefined, '', ' ', 'Name <qa@example.test>', 'QA@example.test', 'qa@example.test\n',
    'qa@example.test,other@example.test', 'qa@example.test/path', 'qa@a..test', 'qa..name@example.test', 'qa.@example.test', '__TAKOLIO_PRIVATE_STAGING_EMAIL_RECIPIENT__'])
  ('fails closed for non-canonical or missing private recipient %j', (value) => {
    expect(() => stagingEmailRecipient(value)).toThrow('private canonical');
  });

  it('allows exactly one native recipient and preserves every other binding and secret', () => {
    const { plan, version } = candidate();
    expect(plan.config.send_email).toEqual([{ name: 'SEND_EMAIL', destination_address: address }]);
    expect(plan.emailPolicy).toEqual({ provider: 'workers-email', recipientCount: 1, alternateProvider: false });
    expect(verifyUploadedVersion(version, plan, previous)).toBe(version.id);
    expect(captureBindings(plan.expectedTypedBindings).bindings).toEqual(previous.bindings);
    expect(plan.expectedTypedBindings.filter((entry) => entry.type !== 'send_email')).toEqual(previous.typedBindings);
    expect(uploadTypedBindings({}, previous)).toEqual(previous.typedBindings);
  });

  it.each([
    { name: 'SEND_EMAIL', type: 'send_email' },
    { name: 'SEND_EMAIL', type: 'send_email', destination_address: 'other@example.test' },
    { name: 'SEND_EMAIL', type: 'send_email', allowed_destination_addresses: [address, 'other@example.test'] },
    { name: 'SEND_EMAIL', type: 'send_email', destination_address: address, allowed_sender_addresses: [] },
    { name: 'OTHER_EMAIL', type: 'send_email', destination_address: address },
  ])('rejects wider, alternate or contradictory native bindings %j', (entry) => {
    expect(() => expectedStagingBindings(previous.typedBindings, [...previous.typedBindings, entry], address)).toThrow('restricted');
  });

  it('accepts only the exact restricted live addition and keeps unrelated drift visible', () => {
    const observed = captureBindings([...previous.typedBindings, email]).typedBindings;
    expect(expectedStagingBindings(previous.typedBindings, observed, address)).toEqual(observed);
    expect(expectedStagingBindings(previous.typedBindings, previous.typedBindings)).toEqual(previous.typedBindings);
    expect(() => expectedStagingBindings(previous.typedBindings, observed)).toThrow();
    expect(() => expectedStagingBindings(previous.typedBindings, [...observed, { ...email, name: 'SECOND' }], address)).toThrow();
    const changed = structuredClone(observed);
    changed.find((entry) => entry.name === 'DB').database_id = 'production-database';
    expect(expectedStagingBindings(previous.typedBindings, changed, address)).not.toEqual(changed);
  });

  it('can prepare a later release while preserving the same private live restriction', () => {
    const snapshot = structuredClone(baseline);
    snapshot.workers.staging.typedBindings = captureBindings([...previous.typedBindings, email]).typedBindings;
    const plan = prepareConfig('staging', snapshot, 'b'.repeat(40), { stagingEmailRecipient: address });
    expect(plan.config.send_email).toEqual([{ name: 'SEND_EMAIL', destination_address: address }]);
    expect(() => prepareConfig('staging', snapshot, 'b'.repeat(40))).toThrow();
    const base = { name: 'frigo-staging' };
    expect(preserveStagingEmailConfig(base, previous)).toBe(base);
    expect(() => preserveStagingEmailConfig({ name: 'frigo' }, snapshot.workers.staging, address)).toThrow('separate reviewed');
  });

  it('refuses production, an alternate provider and unrelated config transitions', () => {
    for (const alter of [
      (plan) => { plan.config.name = 'frigo'; },
      (plan) => { plan.config.vars.ENVIRONMENT = 'production'; },
      (plan) => { plan.config.send_email = [{ name: 'SEND_EMAIL' }]; },
    ]) {
      const plan = prepareConfig('staging', baseline, 'a'.repeat(40)); alter(plan);
      expect(() => addStagingEmail(plan, previous, address)).toThrow();
    }
    const plan = prepareConfig('staging', baseline, 'a'.repeat(40));
    expect(() => addStagingEmail(plan, { ...previous, secretNames: [...previous.secretNames, 'RESEND_API_KEY'] }, address)).toThrow('alternate');
    expect(() => addStagingEmail(plan, baseline.workers.production, address)).toThrow('isolated staging');
  });

  it('rejects upload metadata with another recipient, storage drift or missing native binding', () => {
    for (const alter of [
      (f) => { f.version.resources.bindings.find((entry) => entry.type === 'send_email').destination_address = 'other@example.test'; },
      (f) => { f.version.resources.bindings = f.version.resources.bindings.filter((entry) => entry.type !== 'send_email'); },
      (f) => { f.plan.expectedTypedBindings.find((entry) => entry.name === 'DB').database_id = 'other'; },
      (f) => { f.plan.config.send_email[0].allowed_destination_addresses = [address, 'other@example.test']; },
      (f) => { f.plan.config.name = 'frigo'; },
    ]) {
      const fixture = candidate(); alter(fixture);
      expect(() => verifyUploadedVersion(fixture.version, fixture.plan, previous)).toThrow();
    }
  });

  it('redacts nested binding and serialized config addresses but restores exact rollback bytes', () => {
    const { plan } = candidate();
    plan.bytes = `${JSON.stringify(plan.config, null, 2)}\n`;
    plan.sha256 = configHash(plan.bytes);
    const context = { plan, audit: { worker: previous }, failure: `failed for ${address}` };
    const json = serializeStagingReceipt(context, address);
    expect(json).not.toContain(address);
    expect(JSON.parse(json).plan.config.send_email[0].destination_address).toBe('__TAKOLIO_PRIVATE_STAGING_EMAIL_RECIPIENT__');
    const restored = hydrateStagingReceipt(json, address);
    expect(restored).toEqual(context);
    expect(configHash(restored.plan.bytes)).toBe(plan.sha256);
    expect(() => hydrateStagingReceipt(json, 'other@example.test')).toThrow('commitment');
    expect(() => hydrateStagingReceipt(json)).toThrow();
    expect(hydrateStagingReceipt(serializeStagingReceipt({ state: 'preflight-failed' }))).toEqual({ state: 'preflight-failed' });
    expect(() => hydrateStagingReceipt(JSON.stringify({ mutationAttempted: true }))).toThrow('commitment');
  });

  it('keeps native addition opt-in, target-scoped and private in workflow wiring', () => {
    const workflow = readFileSync('.github/workflows/domain-staging-release.yml', 'utf8');
    expect(workflow).toContain('enable_staging_email:');
    expect(workflow).toContain('ENABLE_STAGING_EMAIL: ${{ inputs.enable_staging_email }}');
    expect(workflow).toContain('STAGING_OTP_TEST_RECIPIENT: ${{ secrets.STAGING_OTP_TEST_RECIPIENT }}');
    expect(workflow).not.toContain('environment: production');
    expect(workflow).not.toContain(address);
    expect(workflow).toContain('path: .artifacts/domain/staging-release/receipt.json');
  });
});
