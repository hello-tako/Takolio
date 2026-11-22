# Takolio Global Expansion — Production Rollout & Operational Runbook

Branch: `feat/takolio-global-expansion`  
Billing Architecture: **Dodo Payments (Global Merchant of Record)** + **PayOS (Vietnam VND)**  
Target Markets: **Japan (`ja-JP` / `JPY` / `Asia/Tokyo`)** & **Europe (`EEA + UK + CH` / `EUR`, `GBP`, `CHF`, `PLN`, `SEK` / `Europe/*`)**

---

## 1. Partner Credentials & Environment Secrets Checklist

### A. Dodo Payments (Merchant of Record — Japan, Europe & Rest-of-World)
1. Create two recurring Subscription Products in the **Dodo Payments Dashboard** (first in **Test Mode**, then in **Live Mode**):
   - Monthly Plan (`¥480` JPY / `€4.99` EUR / `£4.49` GBP / `$4.99` USD with Adaptive Currency enabled) -> `DODO_PRODUCT_ID_MONTHLY`
   - Annual Plan (`¥4,800` JPY / `€49.90` EUR / `£44.90` GBP / `$49.90` USD with Konbini enabled for Japan) -> `DODO_PRODUCT_ID_ANNUAL`
2. Configure Webhook Endpoint under **Developer -> Webhooks**:
   - URL: `https://<your-domain>/api/v1/billing/dodo/webhook`
   - Subscribed events:
     - `subscription.active`
     - `subscription.renewed`
     - `subscription.on_hold`
     - `subscription.failed`
     - `subscription.cancelled`
     - `subscription.expired`
     - `payment.processing` *(Konbini cash voucher state)*
     - `payment.succeeded`
     - `payment.failed`
   - Copy the signing key (`whsec_...`) -> `DODO_PAYMENTS_WEBHOOK_KEY`.
3. Set Worker secrets & vars:
   - `DODO_PAYMENTS_API_KEY` (Worker secret)
   - `DODO_PAYMENTS_WEBHOOK_KEY` (Worker secret, `whsec_...`)
   - `DODO_PRODUCT_ID_MONTHLY` (var or secret)
   - `DODO_PRODUCT_ID_ANNUAL` (var or secret)
   - `DODO_PAYMENTS_ENVIRONMENT`: `"test"` on Staging, `"live"` on Production.
4. Before charging live customers in Japan, verify legal contact details in `buildTokushohoDisclosure` (`src/worker/payment/global-providers.ts`).

### B. Global Social Authentication (Apple & LINE)
- **Sign in with Apple** (mandatory under App Store Review Guideline 4.8):
  - Set `APPLE_CLIENT_ID` (iOS Bundle ID or Web Services ID).
- **LINE Login** (Japan consumer login):
  - Set `LINE_CHANNEL_ID` and `LINE_CHANNEL_SECRET`.

---

## 2. Provisioning Cloudflare Sovereign Cells (`EU` & `JP`)

### European Sovereign Cell (`wrangler.eu.jsonc`)
Run with explicit Product Owner authorization when provisioning the live EU cell:
```bash
pnpm wrangler d1 create frigo-db-eu --jurisdiction=eu
pnpm wrangler r2 bucket create frigo-images-eu --jurisdiction=eu
pnpm wrangler kv namespace create CACHE
pnpm wrangler queues create frigo-scan-queue-eu
pnpm wrangler queues create frigo-scan-dlq-eu
```
Copy the returned `database_id` and KV `id` into `wrangler.eu.jsonc` (leaving `"jurisdiction": "eu"` intact on both D1 and R2).

### Japan / APAC Cell (`wrangler.jp.jsonc`)
```bash
pnpm wrangler d1 create frigo-db-jp --location=apac
pnpm wrangler r2 bucket create frigo-images-jp --location=apac
pnpm wrangler kv namespace create CACHE
pnpm wrangler queues create frigo-scan-queue-jp
pnpm wrangler queues create frigo-scan-dlq-jp
```
Copy the returned `database_id` and KV `id` into `wrangler.jp.jsonc`.

---

## 3. Standardized Release Sequence (Staging -> Production)

1. **Local Pre-Release Verification**:
   ```bash
   pnpm check && pnpm admin:migration:matrix && git diff --check
   ```
2. **Pull Request & Hosted GitHub Actions CI**:
   - Push `feat/takolio-global-expansion` and open a PR into `main`.
   - Require green status on `ci.yml`, `admin-ci.yml`, and `recipe-v3-ci.yml` before merging.
3. **Staging D1 Migration (`0048 -> 0051`) & E2E Rehearsal**:
   - Temporarily grant `D1 Write` on the Staging Cloudflare token, dispatch `.github/workflows/staging-v2-migrate.yml` with `migration = 0051_privacy_erasure_portability_and_consent_ledger.sql`, then immediately restore `D1 Read`.
   - Deploy Staging via `.github/workflows/domain-staging-release.yml`.
   - Rehearse on Staging:
     - `GET /api/v1/billing/tokushoho` (`200 OK`)
     - Dodo Sandbox checkout (`test.dodopayments.com`) for `JP` (`JPY`) & `DE` (`EUR` with 14-day withdrawal waiver) + webhook delivery
     - `GET /api/v1/barcodes/4902777000008` (JAN-13 lookup & D1 cache)
     - `GET /api/v1/account/export` & `DELETE /api/v1/account` (GDPR Art. 20 & Art. 17)
4. **Catalog Localization Batch Compile**:
   ```bash
   node scripts/localize-catalog.mjs validate --input data/localizations/batch-ja-eu.json
   node scripts/localize-catalog.mjs compile --input data/localizations/batch-ja-eu.json --out build/localizations-seed.sql
   ```
5. **Production Cutover (Requires Separate Explicit Owner Command)**:
   - Run `.github/workflows/production-certify.yml` (read-only baseline).
   - Temporarily enable `D1 Write` on the Production token, run `.github/workflows/production-d1-migrate.yml` to `0051_privacy_erasure_portability_and_consent_ledger.sql`, and restore `D1 Read` immediately.
   - Deploy via `.github/workflows/domain-production-release.yml` and monitor `/api/v1/health/ready` + Dodo/PayOS webhook telemetry.
