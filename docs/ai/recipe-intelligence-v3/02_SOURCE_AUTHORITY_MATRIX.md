# Source authority matrix

| Source | Path | Role | Current authority | Write policy | Rollback |
|---|---|---|---|---|---|
| V1 static/import catalog | `packages/recipes/src/data.ts`, approved batches | Runtime recipe content | Current runtime authority | Preserve; promotion requires a release decision | Restore prior release manifest/fingerprint |
| V1 release manifest | `packages/recipes/src/import/catalog-release.current.json` | Identity/order/fingerprint contract | Identity authority | Never edit to hide drift | Revert to prior reviewed manifest |
| V2 research package | `data/recipe-refresh/v2/` | Candidate enriched source | Research authority only | Additive candidate changes | Retain source artifact and hashes |
| V3 audit manifests | `docs/ai/recipe-intelligence-v3/manifests/` | Audit evidence | Evidence authority for this worktree | Regenerate from source | Re-run compiler from same base |
| D1 recipe rows | Worker/D1 runtime paths | Deployed projection | Production authority when separately certified | No mutation in this task | Existing release rollback |
| User plan/shopping/cooking records | Domain/database snapshots | User-owned state | User snapshot authority | No rewrite from content audit | Existing versioned command recovery |

The same recipe ID is an identity key only. It is not permission to replace
content, ingredient identity, nutrition, or saved user snapshots.
