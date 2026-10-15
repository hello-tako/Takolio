# Takolio V1 rollback

Rollback is additive and safe for installed clients:

1. Revert the Takolio migration PR on its feature branch or revert its merged commit sequence under normal protected-main review. Do not delete `/takosan/v3` or persisted keys.
2. Before any rollback release, explicitly retain or re-add both `/takosan/v3` and `/takolio/v1` asset trees in the reviewed rollback commit so installed clients can finish loading their cached references. Restore the previous contract adapter pointers and `public/manifest.json`/`public/sw.js` asset references to `/takosan/v3` in that same reviewed release; keep both trees available while old service-worker clients drain.
3. Preserve `start_url`, manifest `id`, scope, OAuth callbacks, local-storage names and API endpoints. Do not invalidate sessions or rewrite database state.
4. Increment the existing service-worker build identifier through the normal release process so clients receive the reviewed shell. The old cache lifecycle already retains `/takosan/` fallback handling; no manual cache deletion is required.
5. Re-run lint, typecheck, full tests, migration smoke, build, PWA and matched browser checks before any approved deployment.

This task did not merge, push main, deploy, dispatch workflows or mutate production. A hosted reviewer must approve any rollback or release action.
