# TASK_PACKET_G09_G10.md — Notifications, Account, Honest Gaps, System States & Admin Console (`C30, U01–U10, S01–S08, AD01–AD11`)

- **Gates:** `G09` (`19` screens) & `G10` (`11` screens)
- **Screen IDs in Scope (`30`):**
  - `C30`: `/notifications` (`C30NotificationsVNext` — real household notifications, zero fake unread badges)
  - `U01`: `/me` & `/profile` (`U01ProfileHubVNext` — identity, household ID, Plus status, session-fenced logout)
  - `U02–U05`: `/me/preferences`, `/settings/planning`, `/settings/app`, `/settings/notifications` (wrapped inside `ConsumerStudioShell`)
  - `U06`: `/me/household` & `/family` (`U06HouseholdHonestPage` — `BLOCKED_BACKEND` `RFC-001` honest unavailable cards for invite/join/member list)
  - `U07 / U08`: `/plus` (`U07U08PlusReadOnlyWrapper` — `PlusPaywallPage.tsx` & `VietQRModal.tsx` 100% untouched in Red Zone)
  - `U09 / U10`: `/settings/privacy` & `/settings/privacy#data-rights` (`U09U10PrivacyAndDataRightsPage` — privacy truth, opt-in local consent switch, and `BLOCKED_BACKEND` `RFC-002` honest unavailable cards for export/delete)
  - `S01–S08`: Live `S02` `404` catch-all route + `/vnext/states/s01..s08` (`VNextSystemStatePage` — Unauthorized, 404, 500, Offline + Outbox, 409 Conflict, Loading/Empty, Permissions/Consent, PWA/SW safe update)
  - `AD01–AD11`: Separate `dist/admin` bundle (`LoginPage`, `AdminOverviewVNext`, `UsersPage`, `UserDetailPage`, `HouseholdsPage`, `BillingPage` read-only, `AiPage`, `RecipesPage` + `RecipeDetailPage`, `SystemPage`, `AuditPage`, `SettingsPage`) styled in Kitchen Studio Control Tower Direction A (`admin-vnext.css`) preserving 100% of RBAC, CSRF, and E2E `data-testid` contracts.
- **Protected Red-Zone Impact:** `NONE` (`0` protected files modified).
