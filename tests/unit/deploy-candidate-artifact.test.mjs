import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { load } = createRequire(require.resolve('eslint/package.json'))('js-yaml');
const workflow = load(readFileSync('.github/workflows/deploy.yml', 'utf8'));
const evaluate = (expression, context) => runInNewContext(expression.match(/^\$\{\{ (.*) \}\}$/)[1], context);

describe('immutable deployment candidate artifact selection', () => {
  it.each(['staging', 'production'])('failed-only %s rerun consumes the successful producer artifact instead of the consumer attempt', (environment) => {
    const upload = workflow.jobs.release.steps.find((step) => step.uses?.startsWith('actions/upload-artifact@'));
    expect(upload.id).toBe('candidate');
    const produced = evaluate(workflow.jobs.release.outputs.candidate_artifact_id,
      { steps: { candidate: { outputs: { 'artifact-id': '5819221' } } } });
    const download = workflow.jobs[environment].steps.find((step) => step.uses?.startsWith('actions/download-artifact@'));
    const selected = evaluate(download.with['artifact-ids'],
      { github: { run_id: '38245609645', run_attempt: '2' }, needs: { release: { outputs: { candidate_artifact_id: produced } } } });
    expect(selected).toBe('5819221');
    expect(download.with.name).toBeUndefined();
    expect(download.with['merge-multiple']).toBe(true);
    const guardIndex = workflow.jobs[environment].steps.findIndex((step) => step.name === 'Require immutable candidate artifact ID');
    const downloadIndex = workflow.jobs[environment].steps.indexOf(download);
    expect(guardIndex).toBe(downloadIndex - 1);
    const guard = workflow.jobs[environment].steps[guardIndex];
    expect(guard.env.CANDIDATE_ARTIFACT_ID).toBe(download.with['artifact-ids']);
    const command = guard.run.match(/-e '(.*)'$/)[1];
    for (const invalid of ['', undefined, '0', '10,20', '5819221garbage', 'release-candidate-1-2']) {
      expect(() => runInNewContext(command, { process: { env: { CANDIDATE_ARTIFACT_ID: invalid } } })).toThrow('missing or malformed');
    }
    expect(() => runInNewContext(command, { process: { env: { CANDIDATE_ARTIFACT_ID: selected } } })).not.toThrow();
    expect(upload.with.name).toBe('release-candidate-${{ github.run_id }}-${{ github.run_attempt }}');
    expect(upload.with['if-no-files-found']).toBe('error');
    expect(upload.with.overwrite).toBeUndefined();
  });
});
