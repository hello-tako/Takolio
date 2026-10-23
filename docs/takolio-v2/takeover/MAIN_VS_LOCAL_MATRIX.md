# Main versus local matrix

| Source | Identity | Decision |
|---|---|---|
| Latest GitHub main | `90b94129113b41e34701d99f51175cfa81cb73de` | Authority for protected backend, inventory fixes, Admin, auth, data, config and dependencies |
| Argon WIP | `5db70a578764ccdb9ad458a21833fec5b6c04741` plus 11 modified and 42 untracked files | Preserve in private full snapshot; port reviewed UI/assets/tests selectively |
| Salvage integration | `279d8af7` and `752ee35a` above latest main | Retain reviewed culinary source, original vectors and measured icon-size correction |
| UI-C6 planner | `30693884c3b66ebe3d4fcd48fb57100853703826` | Refine existing main picker CSS after measured nested-scroll defect; add isolated API/browser coverage for rows 23-27; no protected code changed |
| UI-C5 cooking | `6276a6b929304c1c207b3355c3827fdd762ef287` | Retain Argon review; preserve servings on review return/reload; one product path and new isolated E2E |
| UI-C5 recipe detail | `61150c83e5a97882aaf31d700f01a28f52ed8393` | Retain Argon detail/cooking; preserve servings on exit and whole action words at 320/text200 |
| UI-C5 saved recipes | `f11a244ca0964a63618c1fc3a3f30b8a670ec90a` | Retain Argon recipe page and main favorites/dialog; fix servings handoff and measured narrow-layout defects |
| UI-C5 filters | `89b0a3312104a4064ad42462098c6bda2802085e` | Refine existing RecipesPage/CSS; add isolated browser behavior/visual evidence |

Preflight Argon divergence was five ahead/four behind 0322a919. Latest divergence is five ahead/six behind 90b94129; merge base remains `96c4236e572a94df4977a686e20e31312191a321`. The two newer main commits fix inventory D1 acknowledgement and retained-history visibility. Neither is overwritten by the UI work.

Current protected-main audit: 5,845 unchanged tracked paths outside the explicit UI/test/handoff allowlist; zero failures. Cooking's historical 5,846 count predates allowlisting kitchen-planning.css. FILE_DECISIONS.csv classifies 83 paths; selected-source-manifest.json retains 54 Argon hashes alongside current integration hashes. RecipesPage, kitchen-recipes.css, CookingModePage and CookingReview record refinement instead of byte parity with Argon. FavoritesCollection, kitchen-family.css and kitchen-planning.css are MAIN_REFINEMENT; added continuation E2E files are Codex-authored. Argon ledger remains 69 rows and asset provenance 12 rows. No blind tree copy or destructive history operation was used.
