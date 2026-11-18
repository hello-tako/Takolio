# BACKEND_GAP_RFCS.md — Standalone Backend RFCs for Unsupported Wireframe Capabilities

> Per `SYSTEM/01_NON_NEGOTIABLE_RULES.md` (Rule 4) and `HANDOFF/04_BACKEND_GAPS_AND_DEPENDENCIES.md`, these capabilities are **NOT** implemented in Worker/D1 during frontend vNext and are represented in the UI strictly as honest `UnavailableState` / `PENDING_CONTENT` surfaces until owner authorization.

---

## RFC-001: Household Invitations, Member Roster & Role Revocation (`U06`)
- **API Routes & Methods:** `GET /api/v1/households/current/members`, `POST /api/v1/households/current/invites`, `POST /api/v1/households/invites/:token/accept`, `DELETE /api/v1/households/current/members/:userId`.
- **Auth & Abuse Prevention:** Registered non-guest session required; `owner` role required to mint/revoke invites; Turnstile + per-household/IP rate limit (`5 invites/hour`); short-lived SHA-256 hashed single-use invite token (`TTL = 48h`).
- **DTO / Schema:** `{ inviteId, role: 'member', expiresAt, status }`; member list returns `{ userId, displayName, role, joinedAt }` (email redacted for non-owners).
- **Idempotency & Ownership:** `Idempotency-Key` on invite creation & acceptance; switching household requires explicit decision on orphaned personal inventory (`DEC-012` extension) and full client cache purge.
- **Migrations:** Additive table `household_invites` + index on `(household_id, status, expires_at)`; rollback via feature flag `HOUSEHOLD_SHARING_ENABLED=false`.
- **Current UI Treatment (`U06`):** Honest `UnavailableState` cards for *Mời thành viên*, *Tham gia hộ khác*, and *Danh sách thành viên*; displays verified session `householdId` only.

---

## RFC-002: Self-Service Personal Data Export & Verifiable Account Deletion (`U10`)
- **API Routes & Methods:** `POST /api/v1/privacy/exports`, `GET /api/v1/privacy/exports/:jobId`, `POST /api/v1/privacy/account-deletion`.
- **Auth & Re-authentication:** Recent step-up verification required (`OTP` or password/Google re-auth within `5 minutes`); blocked for active unresolved billing disputes until settled.
- **DTO / Schema:** Export generates time-limited signed JSON/ZIP archive of household-owned records created by user; deletion schedules/executes cryptographic erasure of `users`, `auth_accounts`, `profiles`, `sessions_v2`, private R2 scan media, and solo-household rows while preserving anonymized statutory billing ledger hashes if legally required.
- **Current UI Treatment (`U10`):** Honest `UnavailableState` explaining export and account deletion are not yet self-service in app, distinguishing *Đăng xuất* (session termination) from account deletion.

---

## RFC-003: Public Unauthenticated Plan Catalog & Signed Editorial/Legal Feed (`M09, M11, M12`)
- **API Routes & Methods:** `GET /api/v1/public/plans` (read-only cacheable projection of published Plus tiers/prices without requiring session cookie); static build-time signed markdown collection for `M11` Stories and `M12` Legal policies (`/privacy`, `/terms`, `/cookies`).
- **Safety:** Zero mutation to PayOS/billing tables; prices originate strictly from server billing configuration; legal effective dates and company contact address require owner/legal signoff prior to public indexing (`noindex` on preview).
