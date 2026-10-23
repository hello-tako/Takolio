# Main versus local matrix

| Source | Identity | Decision |
|---|---|---|
| Latest GitHub main | `90b94129113b41e34701d99f51175cfa81cb73de` | Authority for protected backend, inventory fixes, Admin, auth, data, config and dependencies |
| Argon WIP | `5db70a578764ccdb9ad458a21833fec5b6c04741` plus 11 modified and 42 untracked files | Preserve in private full snapshot; port reviewed UI/assets/tests selectively |
| Salvage integration | `279d8af7` and `752ee35a` above latest main | Retain reviewed culinary source, original vectors and measured icon-size correction |
| UI-C5 recipe detail | `61150c83e5a97882aaf31d700f01a28f52ed8393` | Retain Argon detail/cooking; preserve servings on exit and whole action words at 320/text 200; three-path implementation |
| UI-C5 saved recipes | `f11a244ca0964a63618c1fc3a3f30b8a670ec90a` | Retain Argon recipe page and main favorites/dialog; fix servings handoff and measured narrow-layout defects |
| UI-C5 filters | `89b0a3312104a4064ad42462098c6bda2802085e` | Refine existing RecipesPage/CSS; add isolated browser behavior/visual evidence |

Preflight Argon divergence was five ahead/four behind `0322a919`. Latest divergence is five ahead/six behind `90b94129`; merge base remains `96c4236e572a94df4977a686e20e31312191a321`. The two newer main commits fix inventory D1 acknowledgement and retained-history visibility. Neither is overwritten by the UI work.

Protected-main audit: 5,846 unchanged tracked paths outside the explicit UI/test/handoff allowlist; zero failures. FILE_DECISIONS.csv classifies the original source paths, and selected-source-manifest.json retains Argon hashes alongside current integration hashes. The RecipesPage and kitchen-recipes.css entries now explicitly record refinement rather than byte parity with Argon. FavoritesCollection and kitchen-family.css are classified MAIN_REFINEMENT; the added E2E is Codex-authored. FavoritesCollection is now explicitly reviewed, reducing the audit count by one. No blind tree copy or destructive history operation was used.

CookingModePage now explicitly records PORTED_AND_REFINED_REVIEWED with original Argon hash retained. Recipe-action CSS refinement follows existing filter refinements; new recipe-detail E2E is Codex-authored. File decisions now 80 rows; protected-path count remains 5,846.
