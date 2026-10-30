# Rollback plan

Current sidecar artifacts are removed from consideration by selecting the prior
V1 release; no user data is touched.

For a future promoted version:

1. stop promotion;
2. restore the previous approved content fingerprint;
3. keep recipe IDs, slugs, plans, shopping rows, favorites, and cooking history;
4. revalidate only new operations against the restored authority;
5. reconcile any stale candidate reads explicitly;
6. verify catalog fingerprint and consumer snapshots.

A schema migration would need additive forward-compatible rollback. Down-migration
or deletion of user rows is prohibited.
