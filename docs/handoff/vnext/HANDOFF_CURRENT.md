# HANDOFF_CURRENT.md — Gate G12 Final Production Receipt (`PRODUCTION_LIVE_AND_VERIFIED`)

- **Generated at JST:** `2026-11-18T20:33:00+09:00`
- **Repo:** `hello-tako/Takolio` (`/Users/tunbee27/.gemini/antigravity/scratch/Takolio-vnext`)
- **Source main SHA at start:** `87f279a055e028336ea334cc51c7ab4224f30ef4`
- **Deployed Pure-vNext Commit SHA:** `02d9c3e29a1e5d485aeec42002de9c41ac04b7e7` (`feat/takolio-vnext-ui-architecture`)
- **Pull Request (`OPEN — awaiting independent collaborator review on GitHub`):**
  - **PR #61:** `https://github.com/hello-tako/Takolio/pull/61` (`feat/takolio-vnext-ui-architecture` → `main`)
- **Live Cloudflare Production (`frigo` — `100%` Traffic):**
  - **Primary Origins:** `https://takolio.app`, `https://api.takolio.app`, `https://www.takolio.app` (`308` → `https://takolio.app`), `https://frigo.tungjpstore.net`
  - **Production Deployment ID:** `b40fc159-47d5-4ed2-89e1-dbbde62e1e54` (`2026-11-18T11:29:28.438024Z`)
  - **Active Production Worker Version ID (`100%`):** **`4d7f4f83-aa1e-4a56-a027-b7e64ade428e`** (`Worker Startup Time: 71 ms`, `GIT_COMMIT=02d9c3e29a1e5d485aeec42002de9c41ac04b7e7`, `RECIPE_CATALOG_MODE=d1`, `MEAL_PLANNER_ENABLED=true`, `MEAL_COMPOSITION_V2_ENABLED=true`, `PUBLIC_DOMAIN_ROUTING=true`)
  - **Previous Rollback Worker Version ID (Version `#161`):** **`904851f4-e3b6-4881-8c9a-78cdf88d5740`** (`GIT_COMMIT=cedeec779db51bf24a25543d72c6ca00f1026aea`)
  - **Instant 1-Command Production Rollback Path:**
    ```bash
    pnpm exec wrangler rollback 904851f4-e3b6-4881-8c9a-78cdf88d5740 --name frigo --message "Rollback to pre-vNext Worker version #161"
    # or:
    pnpm exec wrangler versions deploy 904851f4-e3b6-4881-8c9a-78cdf88d5740@100% --name frigo --yes
    ```
- **Legacy Frontend Purge Status:** **`COMPLETE`** — **`164` obsolete legacy Frontend files (`-21,224` lines)** deleted across legacy pages (`20`), G02 preview toggles (`7`), old components/mascot/navigation/auth/week-v1 (`48`), legacy stylesheets (`8`), legacy Frigo public assets (`53`), and legacy-DOM unit tests (`28`).
- **Protected Red-Zone Files Changed?** **`NO`** (`0 / 341` protected files modified; `341/341` SHA-256 verified in `PROTECTED_FILE_HASHES.json`).
- **Live Production Verification (`2026-11-18T20:31:28+09:00`):**
  - `GET https://takolio.app/api/v1/health` → `200 OK` `{"status":"ok","app":"Frigo"}`
  - `GET https://api.takolio.app/api/v1/health` → `200 OK` `{"status":"ok","app":"Frigo"}`
  - `GET https://takolio.app/sw.js` → serves exact `02d9c3e29a1e5d485aeec42002de9c41ac04b7e7`
  - `26 / 26` live Playwright checks across `13` routes × Desktop (`1440×900`) & Mobile (`390×844`): **`0` `pageerror`s, `0` HTTP `5xx`, `0px` horizontal overflow, `0` legacy UI traces** (`/?vnext=0` and `/fridge?vnext=0` stay 100% vNext; `/studio` cleanly renders `S02` 404).
