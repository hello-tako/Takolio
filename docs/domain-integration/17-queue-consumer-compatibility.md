# Queue consumer API compatibility

## Reproduction and scope

The read-only staging consumers endpoint returned a single worker consumer:

```json
{
  "type": "worker",
  "script": "frigo-staging",
  "settings": {
    "batch_size": 5,
    "max_retries": 3,
    "max_wait_time_ms": 10000,
    "retry_delay": 0
  },
  "dead_letter_queue": "frigo-scan-dlq-staging"
}
```

The consumer ID was present and retained in operational evidence. The legacy
`environment` and automatic `max_concurrency` fields were absent. The Cloudflare
Queue UI independently confirms automatic concurrency. No setting was edited and
no application code or traffic was changed. This diagnostic uses the existing
local OAuth credential and does not replace the canonical GitHub Environment
audit.

`prepareReleaseConfig` previously rejected the response first for absent legacy
environment and then for absent concurrency. Two focused tests reproduce both
failures on unmodified main. The fix accepts only an exact modern script identity
with absent/production environment; a supplied service must agree. Legacy service
identity still requires production environment. Missing identity, a different
Worker, conflicting fields, wrong environment, extra consumers and wrong DLQ
remain rejected.

Omitted or null max concurrency means automatic behavior, so the generated config
omits that override. An explicit positive integer is preserved. Zero, negative,
fractional, string and boolean values remain invalid. Other queue settings,
unknown-field rejection, source/CI/environment gates and operational drift checks
are unchanged.

Official API reference:
https://developers.cloudflare.com/api/resources/queues/subresources/consumers/methods/list/

## Validation and next action

- Before fix: targeted config tests 15 PASS / 2 FAIL, demonstrating both omissions.
- After fix: 9 focused domain/release/SW regression files, 363/363 PASS.
- Changed-module ESLint, public added-text scan and git diff whitespace checks PASS.
- Hosted exact-head CI and independent review are pending.

PR #5 merged at 0900b013 after both required checks and independent approval.
Its exact-main CI/Admin CI are pending. Finish those and the complete fixed cloud
audit, then merge this compatibility fix through the same protections and verify
its exact main before any staging upload. No application upload, traffic/domain,
DNS, data, email, payment or Admin mutation was performed for this fix.
