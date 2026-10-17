export const CUSTOMER_BASELINE = '526596a8cd857984ad2b69901a8c7b0e9d6bccc2';
export const REVIEWED_DOMAIN_BASELINE = '352a4211afe7f70bf75115e0688ff9f4e1e232ee';

export function selectGuardedCustomerBaseline({ git, originalBaseline, reviewedBaseline, guardedPaths }) {
  const head = git('rev-parse', 'HEAD');
  const mainBase = git('merge-base', head, 'origin/main');
  git('merge-base', '--is-ancestor', originalBaseline, head);
  git('merge-base', '--is-ancestor', originalBaseline, mainBase);
  let baseline = originalBaseline;
  if (reviewedBaseline) {
    try {
      git('merge-base', '--is-ancestor', reviewedBaseline, head);
      baseline = reviewedBaseline;
    } catch {
      // Branches without the reviewed domain commit retain the original guard.
    }
  }
  const common = git('merge-base', baseline, mainBase);
  const changed = git('diff', '--name-only', common, mainBase, '--', ...guardedPaths);
  if (changed) throw new Error('Protected customer history changed on main: ' + changed);
  return { baseline, mainBase };
}
