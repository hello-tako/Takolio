# Recovered exact source — 2026-10-16

- Recovered incomplete source: `9f3e59a6ed3a9b6b6041fef2e0a83340d1db1dd5`.
- Integration checks before the matrix import-only correction:
  `9ade6a1593016e99ecd6cd4044495c95ed7cccb9`.
- Verdict: **ADMIN_V1_R2_BLOCKED**; no final acceptance SHA or review PASS.
- Deployment/artifact publication: none authorized or performed.

The following hashes describe files present at the recovered source, not a
complete R2 package. Missing required modules are listed in REPORT.md.

| File | SHA-256 |
|---|---|
| `src/worker/routes/admin/auth.ts` | `c7a2a0d36f03ee5071028cf565a67149c54e0c334b1d11978cabef1a7bbccfb2` |
| `src/worker/routes/admin/index.ts` | `a375d02804eef395bdab73f74b5fa8d1c3069dcfe15dac7da07df67e88565628` |
| `scripts/admin-migration-matrix.mjs` | `bb258957dc65fdc2b088e487e02ee83d5c44070dfa36f584a823c3bf09bc5200` |
| `wrangler.admin.jsonc` | `c3bc3f78a2653b8a16c7fcfb134fde1be31a69c85249c19f302d7c2aed03a119` |
| `wrangler.admin-facade.jsonc` | `5eb0792fe082143efd96621858cc51c20989784ef562a7f53ee310d15f0e7a01` |

---

# R2 source manifest

**Current package is incomplete. No final tested R2 implementation SHA yet.**

- Initial full SHA: `87d6d3d2acc69a6ca3f0409c3c22753469807222`.
- Integrated main: `0ff82edb7c251be340b5e00fbcf0ae8703b22a55`.
- Merge full SHA: `a2f47c5cb22230d242d47d135ec6861964232c00`.
- WP0 local checkpoint: `a066204047d0ec4c306987db9c82fb5aa3ac4d5e`.
- Implementation branch: `feat/admin-v1-r2-isolation-governance`.

Do not equate a commit title or an uncommitted tree to executed exact-SHA proof.
Final verification must freeze an implementation commit, record per-file hashes
and commands/results, then add a separate documentation checkpoint referring to
that implementation commit. A document cannot contain its own future SHA.
