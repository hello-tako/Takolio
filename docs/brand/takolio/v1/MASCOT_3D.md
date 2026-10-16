# Takolio V1 mascot 3D candidate

Date: 2026-10-16 JST. Status: `3D_CANDIDATE_REVIEW_REQUIRED`.

The operator accepted a first genuine Blender candidate for continued implementation. The candidate is a static illustration layer for the Takolio contract; it is not a premium production rig, a 100% concept-board match, a trademark clearance or a native app release.

## Source and provenance

- One editable procedural Blender source with eight articulated tentacles, chef hat, leaf mark, starter 33-joint rig and one animation is preserved in the local handoff package, together with the GLB export.
- Six 2048x2048 RGBA PNG masters are pinned in `source/3d/render-manifest.json`: `welcome`, `cooking`, `thinking`, `excited`, `completed` and `cheering`.
- The source manifest records SHA256 for every PNG and authoring script, the supplied kit SHA256, and native handoff hashes. Boards were used for style reference only; no board pixels were cropped, traced or shipped.
- Runtime contains only 18 responsive WebP exports (256, 512 and 1024px per pose). Native `.blend`/`.glb` and Blender are excluded from the repository and service-worker precache.

## Runtime behavior

`TakoMascot` selects WebP for illustrations at least 96 CSS pixels, reserves the requested dimensions, and keeps the canonical SVG in the `<img>` element. If WebP fails or the browser does not support it, the source is removed and the SVG remains. Small controls stay on the kit's vector mascot. The existing Plus/payment mascot consumer remains vector and protected.

Consumers are intentionally limited to landing, login/register decoration, the three onboarding steps, the unplanned Home card and generic non-error empty states. Error states retain the semantic alert icon. No auth credentials, OTP/session behavior, payment, Worker, database, recipe, household, Week or flag logic changed.

## QA receipt

- `pnpm brand:icons`: PASS; 87 runtime entries, 1,012,952 bytes, 18 WebP entries, 534,078 WebP bytes.
- Focused brand/asset/mascot suite: PASS, 6 files / 51 tests, 5.22s.
- Full unit suite: PASS, 365 files / 8,479 tests, 149.83s, bundled Node 24.19.0 and `TMPDIR=/private/tmp`.
- `pnpm lint`: PASS; `pnpm typecheck`: PASS; local migration smoke: PASS; default/paired ON/OFF production builds: PASS.
- Local protected E2E: 94/94 tests pass across mobile 390 and desktop 1440; payment-authority tests remain in the run and pass.
- Mascot browser matrix: 72 screens pass at 320, 375, 390, 768, 1024 and 1440px. Axe violations, page errors, broken mascot images and horizontal overflow: zero.
- State checks: 15 local checks pass, including delayed inventory, error, cooking review and completion; the final flags-OFF check passes12/12 screens.
- PWA check: 3 checks pass, including cached WebP 512/1024, SVG fallback, manifest icons and offline decoded 224x224 landing mascot.
- Final network fallback: PASS after clearing synthetic cookies/storage; `/takolio/v1/mascot/tako-welcome.svg` loads with reserved dimensions. The earlier authenticated-harness failure is preserved under `after-attempt1/` and is not counted as a runtime failure.

Review screenshots and receipts are in `evidence/mascot-3d/`. The six-state contact sheet and local handoff ZIP are generated outside the public runtime. The local output ZIP is `Takolio_Tako_3D_Candidate_v1.zip`; its SHA256 and package CRC result are recorded in the separate delivery receipt and adjacent `.sha256` file.

## Open limits

Premium mascot finishing remains open: facial controls, rig weights, prop gripping, mesh polish, exact concept fidelity, LOD/device performance and physical-device acceptance. The 64px proof is for review only; the app deliberately keeps the vector micro asset at that size. A future polish pass must replace pinned masters and rerun the generator/visual matrix; it must not silently edit reference-board pixels.
