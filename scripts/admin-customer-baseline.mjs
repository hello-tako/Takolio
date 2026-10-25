export const CUSTOMER_BASELINE = '526596a8cd857984ad2b69901a8c7b0e9d6bccc2';
export const REVIEWED_DOMAIN_BASELINE = '352a4211afe7f70bf75115e0688ff9f4e1e232ee';
// Candidate bytes are frozen here; independent PR review remains required.
export const V2_RELEASE_BASELINE = '9b031f05c34a3f27f7a5d9958c65eb8a4405d227';

export function selectGuardedCustomerBaseline({ git, originalBaseline, reviewedBaseline, releaseBaseline, guardedPaths }) {
  const head = git('rev-parse', 'HEAD');
  const mainBase = git('merge-base', head, 'origin/main');
  git('merge-base', '--is-ancestor', originalBaseline, head);
  git('merge-base', '--is-ancestor', originalBaseline, mainBase);
  let baseline = originalBaseline;
  for (const pinned of [reviewedBaseline, releaseBaseline].filter(Boolean)) {
    try {
      git('merge-base', '--is-ancestor', pinned, head);
      baseline = pinned;
    } catch {
      // Branches without a pinned checkpoint retain their earlier guard.
    }
  }
  const common = git('merge-base', baseline, mainBase);
  const changed = git('diff', '--name-only', common, mainBase, '--', ...guardedPaths);
  if (changed) throw new Error('Protected customer history changed on main: ' + changed);
  return { baseline, mainBase };
}
