# TASK_PACKET_G04.md — Authentication & Onboarding (`A01–A08`, `O01–O06`)

- **Gate:** `G04`
- **Screen IDs in Scope (`14`):** `A01, A02, A03, A04, A05, A06, A07, A08, O01, O02, O03, O04, O05, O06`
- **Routes & States:**
  - `A01`: `/auth?mode=choose` (Entry chooser: Email, Google, Guest trial, preserving `returnTo`)
  - `A02`: `/auth` & `/auth?mode=login` (`api.login`, `capturePrivateSession`, `GoogleAuthSection`)
  - `A03`: `/auth?provider=google` & `/auth?mode=google` (Real `GoogleAuthSection` + honest SDK unavailable fallback)
  - `A04`: `/auth?mode=register` (`api.register` + Cloudflare `TurnstileWidget` + `writeVerifyContext`)
  - `A05`: `/auth/verify` (6 individual OTP boxes with clipboard paste, arrow/backspace nav, `resendSecondsRemaining` cooldown, tab-scoped refresh recovery via `readVerifyContext`)
  - `A06`: `/auth?mode=forgot` (`api.forgotPassword` anti-enumeration OTP request)
  - `A07`: `/auth?mode=reset` (`api.resetPassword` with 6-digit OTP + new password)
  - `A08`: `/auth?mode=transfer-deferred` + live `DEC-012` `409 INVENTORY_TRANSFER_DEFERRED` state (never fakes guest data merge)
  - `O01`: `/onboarding` & `/onboarding/welcome` (Step 1/6 Welcome)
  - `O02`: `/onboarding/goals` (Step 2/6 `primaryGoal`: `fridge` / `today` / `week`)
  - `O03`: `/onboarding/household` (Step 3/6 `1..20` household size + ingredient scaling preview)
  - `O04`: `/onboarding/preferences` (Step 4/6 Cuisines, spicy level, dietary restrictions)
  - `O05`: `/onboarding/start` (Step 5/6 Starter path + authoritative `familyPreferencesApi.save` + `api.completeOnboarding`)
  - `O06`: `/onboarding/ready` (Step 6/6 Server-confirmed completion -> routes to chosen first-value screen)
- **Protected Red-Zone Impact:** `NONE` (`0` protected files modified).
