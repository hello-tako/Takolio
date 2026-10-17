import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { captureBindings } from './bindings.mjs';

const marker = '__TAKOLIO_PRIVATE_STAGING_EMAIL_RECIPIENT__';
const binding = (recipient) => ({ name: 'SEND_EMAIL', type: 'send_email', destination_address: recipient });

export function stagingEmailRecipient(value) {
  if (typeof value !== 'string' || value.length > 254 ||
      !/^[a-z0-9][a-z0-9._+-]*@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/.test(value)) {
    throw new Error('A private canonical staging email recipient is required');
  }
  const [local, domain] = value.split('@');
  if (local.length > 64 || local.endsWith('.') || local.includes('..') ||
      domain.split('.').some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) {
    throw new Error('A private canonical staging email recipient is required');
  }
  return value;
}

// A secret authorizes one exact restricted binding, never arbitrary binding drift.
export function expectedStagingBindings(previous, observed, recipient) {
  const existing = previous.filter((entry) => entry.type === 'send_email');
  const current = observed.filter((entry) => entry.type === 'send_email');
  if (existing.length || !current.length) return previous;
  const expected = binding(stagingEmailRecipient(recipient));
  if (current.length !== 1 || !isDeepStrictEqual(current[0], expected)) {
    throw new Error('Staging email must be restricted to the approved private recipient');
  }
  return captureBindings([...previous, expected]).typedBindings;
}

export function preserveStagingEmailConfig(base, live, recipient) {
  const current = live.typedBindings.filter((entry) => entry.type === 'send_email');
  if (!current.length) return base;
  if (base.name !== 'frigo-staging' || base.send_email || live.name !== 'frigo-staging' ||
      live.secretNames.includes('RESEND_API_KEY')) {
    throw new Error('Staging email requires its separate reviewed target without an alternate provider');
  }
  expectedStagingBindings([], current, recipient);
  return { ...base, send_email: [{ name: 'SEND_EMAIL', destination_address: stagingEmailRecipient(recipient) }] };
}

export function addStagingEmail(plan, previous, recipient) {
  if (plan.config.name !== 'frigo-staging' || previous.name !== 'frigo-staging' ||
      plan.config.vars.ENVIRONMENT !== 'staging' || previous.secretNames.includes('RESEND_API_KEY')) {
    throw new Error('Restricted email requires isolated staging without an alternate email provider');
  }
  const address = stagingEmailRecipient(recipient);
  const existing = previous.typedBindings.filter((entry) => entry.type === 'send_email');
  if (existing.length) expectedStagingBindings([], existing, address);
  if (plan.config.send_email && !isDeepStrictEqual(plan.config.send_email, [{ name: 'SEND_EMAIL', destination_address: address }])) {
    throw new Error('Unreviewed staging email configuration');
  }
  plan.config.send_email = [{ name: 'SEND_EMAIL', destination_address: address }];
  plan.expectedTypedBindings = captureBindings([
    ...previous.typedBindings.filter((entry) => entry.type !== 'send_email'), binding(address),
  ]).typedBindings;
  plan.emailPolicy = { provider: 'workers-email', recipientCount: 1, alternateProvider: false };
  return plan;
}

export function uploadTypedBindings(plan, previous) {
  if (plan.expectedTypedBindings === undefined) return previous.typedBindings;
  if (!plan.emailPolicy || plan.config.name !== 'frigo-staging' || previous.name !== 'frigo-staging' ||
      previous.secretNames.includes('RESEND_API_KEY') || !Array.isArray(plan.config.send_email) || plan.config.send_email.length !== 1) {
    throw new Error('Unreviewed upload binding transition');
  }
  const [email] = plan.config.send_email;
  const recipient = stagingEmailRecipient(email.destination_address);
  if (!isDeepStrictEqual(email, { name: 'SEND_EMAIL', destination_address: recipient })) {
    throw new Error('Unreviewed upload email restrictions');
  }
  const expected = captureBindings([
    ...previous.typedBindings.filter((entry) => entry.type !== 'send_email'), binding(recipient),
  ]).typedBindings;
  const oldEmail = previous.typedBindings.filter((entry) => entry.type === 'send_email');
  if (oldEmail.length) expectedStagingBindings([], oldEmail, recipient);
  if (!isDeepStrictEqual(plan.expectedTypedBindings, expected)) throw new Error('Upload changed non-email bindings');
  return expected;
}

export function serializeStagingReceipt(value, recipient) {
  const json = `${JSON.stringify(value, null, 2)}\n`;
  return recipient ? json.replaceAll(stagingEmailRecipient(recipient), marker) : json;
}

export function hydrateStagingReceipt(json, recipient) {
  const context = JSON.parse(json.includes(marker) ? json.replaceAll(marker, stagingEmailRecipient(recipient)) : json);
  if (context.plan || context.mutationAttempted) {
    const bytes = context.plan?.bytes;
    if (typeof bytes !== 'string' || createHash('sha256').update(bytes).digest('hex') !== context.plan.sha256) {
      throw new Error('Recovery configuration commitment changed');
    }
  }
  return context;
}
