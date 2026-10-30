# Recipe V3 protected integration review matrix - 2026-10-31 JST

Live read-only GitHub snapshot. Review requests already sent; do not duplicate.
PR51 approval covers ae68f7e5 only. No merge/deployment has been executed.

| PR | Exact HEAD | Independent approval | Exact-head checks |
|---|---|---|---|
| [PR33](https://github.com/hello-tako/Takolio/pull/33) | `0b427865117eabb28e014208c5fbb897763f4507` | Absent | validate-admin SUCCESS; validate SUCCESS |
| [PR34](https://github.com/hello-tako/Takolio/pull/34) | `363d856293ec0022b561ebfbd18471d9917ea0cb` | Absent | No check run on this HEAD |
| [PR35](https://github.com/hello-tako/Takolio/pull/35) | `7a9bdb0907476fb83cb24c26d87dd398fcfc9b90` | Absent | No check run on this HEAD |
| [PR36](https://github.com/hello-tako/Takolio/pull/36) | `9b12eeebbd63d95604fb6bb3353860ae33697dcb` | Absent | No check run on this HEAD |
| [PR37](https://github.com/hello-tako/Takolio/pull/37) | `3acb22a0ba064cf16cb410c0ff67e3dcbafbde61` | Absent | No check run on this HEAD |
| [PR38](https://github.com/hello-tako/Takolio/pull/38) | `0e466f949f48727bf02d3f608a5dea4cd06b57e7` | Absent | No check run on this HEAD |
| [PR39](https://github.com/hello-tako/Takolio/pull/39) | `49139fb8b4aa51b4a7a986653897c1a3924b3b3c` | Absent | No check run on this HEAD |
| [PR40](https://github.com/hello-tako/Takolio/pull/40) | `6a5edda340acef9cf53cc6515f4d2e009dc9fcba` | Absent | No check run on this HEAD |
| [PR41](https://github.com/hello-tako/Takolio/pull/41) | `78f3ffda0a1327a0c79b6917646d96055a2cccac` | Absent | No check run on this HEAD |
| [PR42](https://github.com/hello-tako/Takolio/pull/42) | `73bfbf5fe4dc2f3a927d09e735f3ddcc76e0afa9` | Absent | No check run on this HEAD |
| [PR43](https://github.com/hello-tako/Takolio/pull/43) | `d7ed5cf8900212915246d151d8095602a40a225e` | Absent | No check run on this HEAD |
| [PR44](https://github.com/hello-tako/Takolio/pull/44) | `f637134b4a337443b375985021d0d3bfc42a9e87` | Absent | No check run on this HEAD |
| [PR45](https://github.com/hello-tako/Takolio/pull/45) | `904eb0872103524711e63d9fb74a1beeea6b9646` | Absent | validate-admin SUCCESS; validate SUCCESS |
| [PR46](https://github.com/hello-tako/Takolio/pull/46) | `9049f346372dbc9ed515e572f3d66fbc75c2fc18` | Absent | validate-admin SUCCESS; validate SUCCESS |
| [PR47](https://github.com/hello-tako/Takolio/pull/47) | `555ce63d87dc354664ede8fb998fbb9567e5c71a` | Absent | validate-admin SUCCESS; validate SUCCESS |
| [PR48](https://github.com/hello-tako/Takolio/pull/48) | `680502cc7aa64a4d11abca1ae0625ee9f5166d66` | Absent | validate-admin FAILURE; validate SUCCESS |
| [PR49](https://github.com/hello-tako/Takolio/pull/49) | `744b4e25b2d710e573dac7d82610c363acd6194b` | Absent | validate-admin SUCCESS; validate SUCCESS |
| [PR50](https://github.com/hello-tako/Takolio/pull/50) | `5cf2d197f03999dd74fc088c035c40ef4de3899f` | Absent | validate-admin SUCCESS; validate SUCCESS |
| [PR51](https://github.com/hello-tako/Takolio/pull/51) | `ae68f7e5a4bc987155aaeed577f07f95b893359b` | vn-taphoanhatung | validate-admin SUCCESS; validate SUCCESS |

PR34-44 predate the dedicated V3 push workflow; no hosted PASS is inferred.
PR48 Admin failure40960869319 remains a real historical failure. Its baseline fix
is present in descendants49-51; it does not relabel PR48 green.

Protected integration must validate each actual integration source after the
required independent review. CI workflows, branch protection and Environment
approval stay intact. Exact-main checks and fresh hosted staging/catalog/recovery
certification remain required. Code review is separate from culinary approval.

## PR52 and protection scope - 2026-10-31 JST

| PR | Exact HEAD | Independent approval | Exact-head checks |
|---|---|---|---|
| [PR52](https://github.com/hello-tako/Takolio/pull/52) | `f55172363970e88b38a7bb9c77f5b544e9c0778c` | Absent; vn-taphoanhatung requested | Recipe41087966158/Admin41087965933 SUCCESS |

Review requests remain on PR33-50 and PR52; reviewer has write access. All PRs
remain Draft/open. Resolve later documentation HEADs/checks from GitHub, not this
snapshot. PR51's approved HEAD is unchanged.

Main protection requires approval on the actual main-targeting PR, strict
validate/validate-admin, stale/last-push review, admin enforcement and resolved
conversations. It does not impose an independent ancestor-approval rule. Review
coverage for each small slice remains a program requirement; do not consolidate
the whole stack into a giant PR or infer ancestor/content approval from PR51.
