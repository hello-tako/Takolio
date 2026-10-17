# PayOS Migration

PayOS business logic is unchanged. The server derives return/cancel URLs from trusted `APP_URL` and verifies webhook signatures, payment status, duplicate handling and entitlement rules. The exact webhook route is `POST /api/v1/billing/payos/webhook`; return and cancel URLs are `${APP_URL}/plus`.

For a future cutover, keep `https://frigo.tungjpstore.net/api/v1/billing/payos/webhook` available until provider reconciliation confirms the new endpoint `https://api.takolio.app/api/v1/billing/payos/webhook`. Do not register or remove a provider URL in this task. Existing new-domain return/cancel behavior is only prepared by config; it is not live.

Production and staging credentials are not interchangeable. Staging sandbox identity/secret isolation is not fully verified from available metadata; no real or sandbox payment was initiated. Required tests are signed initiation, invalid/duplicate webhook, return/cancel navigation and reconciliation on an authorized staging sandbox. No prices, billing rules or provider secrets were changed.
