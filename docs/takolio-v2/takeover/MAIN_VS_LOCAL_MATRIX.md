# Main versus local matrix

| Source | Identity | Decision |
|---|---|---|
| Latest GitHub main | `90b94129113b41e34701d99f51175cfa81cb73de` | Authority for protected backend, inventory fixes, Admin, auth, data, config and dependencies |
| Argon WIP | `5db70a578764ccdb9ad458a21833fec5b6c04741` plus 11 modified and 42 untracked files | Preserve in private full snapshot; port reviewed UI/assets/tests selectively |
| Salvage integration | `279d8af7` and `752ee35a` above latest main | Retain reviewed culinary source, original vectors and measured icon-size correction |
| UI-C5 filters | `89b0a3312104a4064ad42462098c6bda2802085e` | Refine existing RecipesPage/CSS; add isolated browser behavior/visual evidence |

Preflight Argon divergence was five ahead/four behind `0322a919`. Latest divergence is five ahead/six behind `90b94129`; merge base remains `96c4236e572a94df4977a686e20e31312191a321`. The two newer main commits fix inventory D1 acknowledgement and retained-history visibility. Neither is overwritten by the UI work.

Protected-main audit: 5,847 unchanged tracked paths outside the explicit UI/test/handoff allowlist; zero failures. FILE_DECISIONS.csv classifies the original source paths, and selected-source-manifest.json retains Argon hashes alongside current integration hashes. The RecipesPage and kitchen-recipes.css entries now explicitly record refinement rather than byte parity with Argon. No blind tree copy or destructive history operation was used.
