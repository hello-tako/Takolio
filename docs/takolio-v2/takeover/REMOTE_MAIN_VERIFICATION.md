# Remote main verification

Latest read-only `git ls-remote https://github.com/hello-tako/Takolio.git refs/heads/main` returned `90b94129113b41e34701d99f51175cfa81cb73de` on 2026-10-23 JST. After revalidating the private snapshot, `git fetch origin main` imported only main. The original Argon branch remains at `5db70a578764ccdb9ad458a21833fec5b6c04741`.

Original preflight main was `0322a9197bee4a4a42d95cc150f8d4fff6d53ba8`: Argon had five local-only and four main-only commits. Against latest main, `git rev-list --left-right --count origin/main...feat/takolio-culinary-experience` is `6 5`. The merge base is still `96c4236e572a94df4977a686e20e31312191a321`.

The first four main-only changes retain Admin migration, PR24 merge, responsive coverage and narrow overflow/accessibility work. The two newer changes are `01c372b4` (D1 inventory CAS acknowledgement) and `90b94129` (hide zero-stock retained history). They remain intact in integration. The original Argon UI paths have no application-source conflict with these main changes.

The two Codex-only salvage checkpoints were rebased locally, without conflicts, onto verified latest main. They are now `279d8af7` and `752ee35a`; the old tip is preserved by `codex/takolio-v2-rescue-recovery-e4ac2b02`. UI-C5 implementation `89b0a331` follows them. No original WIP branch/history was rewritten.

G2 PASS for source divergence. Protected-scope evidence pins latest main and verifies 5,847 unchanged paths. Runtime results and inherited failures are separated in TEST_BASELINES.md; historical baseline runs pin `0322a919`, while UI-C5 runs use `90b94129` plus the integration commits.

Environment remains macOS, Node v25.9.0 and pnpm 10.33.2, with unchanged main dependencies/lockfile. Earlier integration installation was `pnpm install --frozen-lockfile --ignore-scripts`, exit 0, 312 packages. Repository SQLite tests require Node >=22.13. No remote write occurred.
