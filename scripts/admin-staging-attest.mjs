#!/usr/bin/env node
// Package operator evidence; this script never runs or invents staging checks.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { loadContext, validateGitHub, validateStagingReport, validateTarget } from './admin-release-adapter.mjs';
import { createProvider } from './admin-release-provider.mjs';

try {
  const context = loadContext('staging', 'deploy-disabled');
  if (process.env.GITHUB_ACTIONS !== 'true' || process.env.ADMIN_RELEASE_EXECUTION_ENABLED !== 'true' ||
      process.env.GITHUB_REF !== 'refs/heads/main' || process.env.GITHUB_SHA !== context.sourceSha ||
      process.env.GITHUB_WORKFLOW_SHA !== context.sourceSha || context.runAttempt !== '1') throw new Error('Protected exact-main staging dispatch required');
  const policy = JSON.parse(readFileSync('admin/release-policy.json', 'utf8'));
  const report = JSON.parse(process.env.ADMIN_STAGING_REPORT ?? 'null');
  validateStagingReport(report, policy, context);
  const provider = createProvider({ target: validateTarget(policy, 'staging') }, context);
  validateGitHub(await provider.githubFacts(), { ...context, requireAudit: false });
  mkdirSync('.artifacts/admin-release', { recursive: true });
  writeFileSync('.artifacts/admin-release/staging-report.json', JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify({ sourceSha: context.sourceSha, report: 'SIGNED_COMPLETED_REPORT_VALIDATED', remoteExecuted: false }));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
