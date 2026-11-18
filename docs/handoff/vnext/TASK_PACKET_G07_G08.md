# TASK_PACKET_G07_G08.md — Recipes, Cooking, Planner & Shopping (`C15–C29`)

- **Gates:** `G07` (`C15–C22`) & `G08` (`C23–C29`)
- **Screen IDs in Scope (`15`):**
  - `C15 / C16 / C17`: `/recipes`, `/recipes?q=...`, `/recipes?view=saved` (`C15RecipesDiscoveryVNext` — URL-driven filters, cursor pagination, verified 12-slug culinary media + honest vector fallback, registered vs guest `FavoritesCollection`)
  - `C18 / C19`: `/recipes/:slug` & `/recipes/id/:id` (`C18RecipeDetailPilot` — dynamic serving scale `1..20`, quantity+unit `evaluateRecipeAvailability` shortfall check, `+ Mua phần thiếu`, sourced nutrition)
  - `C20 / C21`: `/cook/:slug` & `/cooking/:id` (`C20C21CookingStudioVNext` — prep & immersive step-by-step timer/voice/WakeLock with zero stock deduction)
  - `C22`: `/cooking/complete` (`C22CookingCompleteVNext` — explicit actual-use review & single idempotent server deduction)
  - `C23`: `/planner` & `/planner/:planId` (`C23PlannerPilot` — desktop 7-day workbench + mobile day cards + `/week` redirects)
  - `C24`: `/planner/new` (`C24PlannerSetupVNext` — deterministic server plan generation)
  - `C25 / C26`: `/planner/:planId/meal/:slotId` (`C25C26PlannerMealVNext` — swap delta preview & Meal Composition V2 picker)
  - `C27 / C28`: `/shopping` (`C27C28ShoppingVNext` — needed vs acquired, `pendingSync` offline outbox, item edit/delete)
  - `C29`: `/planner/:planId/shopping` (`C29ShoppingImportVNext` — server-confirmed post-shopping stock import)
- **Protected Red-Zone Impact:** `NONE` (`0` protected files modified).
