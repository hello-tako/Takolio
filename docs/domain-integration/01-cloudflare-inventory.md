# Cloudflare Inventory

Baseline observed 2026-10-17 through authenticated dashboard and read-only Wrangler metadata. Credential provisioning and secret-only versions were subsequently verified; see `14-release-operations.md`. Snapshot timestamps and current version IDs are in `evidence/live-runtime.json`. Secret values are excluded from this inventory.

| Resource | Status | Verified evidence or limit |
| --- | --- | --- |
| Account | FOUND | `ef250a88911fd24073cb73d1c07e0218` |
| Zone | FOUND | `takolio.app`, Active, ID `9284fb2186987f14f810818583acaa46` |
| Registrar | FOUND | Cloudflare; expiry displayed 2027-10-17 |
| Nameservers | FOUND | `dayana.ns.cloudflare.com`, `jasper.ns.cloudflare.com` |
| Universal SSL | FOUND | Active certificate for apex and wildcard; does not prove a live hostname handshake |
| TLS settings | FOUND | TLS 1.3 enabled; minimum TLS 1.0; Always Use HTTPS disabled |
| Edge HSTS setting | UNKNOWN | Card exists but its actual setting was not inspected |
| DNS | FOUND | Dashboard: 0 records, No DNS records found |
| Zone Worker routes | FOUND | 0, no routes configured |
| New-domain Worker connection | NOT_USED | Zone overview: No Workers connected |
| Redirect rules | FOUND | 0/10, no rules |
| WAF | FOUND | 0 custom, 0 rate-limit rules; no managed rules visible on this surface |
| Pages projects | NOT_ACCESSIBLE | Existing OAuth request returned authentication error 10000 |
| Account-wide D1 list | NOT_ACCESSIBLE | Existing OAuth request returned authentication error 10000 |
| Durable Objects / Workflows | UNKNOWN | No binding in inspected versions; account-wide inventory not established |
| Cron / queue consumers / observability | UNKNOWN live | Source config exists, but version metadata does not prove current account-level settings |
| GitHub deployment integration | FOUND | Manual workflow_dispatch; separate protected staging/production Environments now contain Cloudflare/account-ID/release-verification secrets |

## Workers and bindings

| Resource | Production | Staging |
| --- | --- | --- |
| Combined Worker | `frigo` | `frigo-staging` |
| Version | `01b81140-3162-47e0-8573-88b679877f8a` | `b4257b5c-dddf-4093-b969-f5bc09888bf6` |
| D1 | `f975ec39-b2c8-4a2a-80e1-0366054599d3` | `7854298a-20f5-46aa-9cbf-917079c2a3dd` |
| KV | `cbcd186cb63d4729ac23b04f1a539f2d` | `5582086f94e34e0ca9c4ef6fc6f0016e` |
| R2 | `frigo-images` | `frigo-images-staging` |
| Queue producer | `frigo-scan-queue` | `frigo-scan-queue-staging` |
| AI / Assets | FOUND, `AI` / `ASSETS` | FOUND, `AI` / `ASSETS` |
| Send Email | FOUND, `SEND_EMAIL` | NOT_USED in this version |
| Handler exports | fetch, queue, scheduled | fetch, queue, scheduled |

The complete supported typed binding set is captured; unknown types or fields now fail capture. Preparation compares the exact typed set and compatibility settings to source. No binding is silently discarded. Source cron is daily 03:00 UTC, but its live registration and consumers must be audited before deploying. Preparation explicitly reports `operationalSettingsVerified=false` and `deployAuthorized=false`.

## Access

The Applications dashboard lists 3 self-hosted apps: roomAgent Staging (`api-staging.tungjp.store`), MailVault (`mail.omnipos.tech`, `mail.tungjp.store` and their paths), TUNG Portfolio Admin (`tungjpstore.net/admin`, `tung.codes/admin` and their paths). None covers either Takolio staging hostname or the existing workers.dev hostname. No Access policy was edited. Sensitive staging must not be exposed until the operator verifies its data and access controls.

## Available authorization

Existing Wrangler OAuth permits user/account read and Worker scripts access, but lacks zone/routes/Pages/D1 scopes needed for this task. The owner subsequently authorized two scoped, 30-day account-owned tokens; they are saved in matching GitHub Environments. Release verification keys were also synchronized and proven live without changing code/runtime/bindings/assets. No Global API Key, domain attachment, DNS change, application cutover or data migration was performed. Complete operational scope verification through the reviewed current-schema read-only audit before any activation.
