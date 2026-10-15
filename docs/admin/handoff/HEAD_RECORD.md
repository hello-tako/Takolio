# Published handoff record

| Item | Value |
|---|---|
| Repository | `hello-tako/Tako-san` (public), repository ID `1385308553` |
| Branch | `handoff/admin-v1-r2-20261015` |
| Documentation commit (first publication, `ffcb0b2`) | `ffcb0b27236685a5c51199512c9b78a1ae35096a` |
| Published handoff receipt (pre-merge) | `9ee4c49` (after `a2c7b5c`) |
| Merge with `origin/main` | `a2f47c5` |
| Observed remote handoff tip | `87d6d3d` |
| Preservation commit | `45cbec8281692b560bae6ce3b2fe6ad0749d196a` |
| R1 certification report | `95a1425cc149346d6b8e17ac18bb32990338ef9b` |
| R1 evidence and report | `0331cc9f4e247446dd1a99715047fe00866d8e2a` |
| R1 remediation | `25140baa99ef0aecc5e8d0e53206132e01e0f765` |
| Review record (amended) | `6889f8da71591c49bfdac30a14108426ea05dd57` |
| Original Admin V1 | `3e865d009ee62a92ed1d9c8d225a36893035670b` (tag `admin-v1-review-baseline`, local only) |
| Customer baseline | `186a9cf05de7c91ed3289e13130feb3b38a264ac` |
| `origin/main` when published | `0ff82edb7c251be340b5e00fbcf0ae8703b22a55` (not changed by this handoff) |

## Verify from a clean clone

```sh
git fetch origin handoff/admin-v1-r2-20261015
git ls-remote origin refs/heads/handoff/admin-v1-r2-20261015
git merge-base --is-ancestor 3e865d009ee62a92ed1d9c8d225a36893035670b FETCH_HEAD && echo "original Admin V1 reachable"
git merge-base --is-ancestor 25140baa99ef0aecc5e8d0e53206132e01e0f765 FETCH_HEAD && echo "R1 remediation reachable"
git merge-base --is-ancestor 95a1425cc149346d6b8e17ac18bb32990338ef9b FETCH_HEAD && echo "R1 certification reachable"
git diff --quiet 186a9cf FETCH_HEAD -- src/worker/index.ts src/worker/types.ts migrations wrangler.jsonc && echo "customer Worker and ledger identical to baseline"
```
