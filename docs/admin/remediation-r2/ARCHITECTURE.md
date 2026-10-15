# R2 architecture

Implementation provenance and current verification status: REPORT.md and
SOURCE_MANIFEST.md. This document is a design description, not runtime proof.

- Customer Worker: unchanged from main merged into the handoff.
- Admin Worker: UI, API, RBAC, audit, roles and sessions; ADMIN_DB only.
- Internal read facade: separate Worker with customer DB binding; named RPC
  entrypoint `AdminCustomerReadFacade` reached through `CUSTOMER_READ`.
- Facade configs have no routes, workers.dev or preview URLs. The default HTTP
  entrypoint refuses all requests, even when reached directly in local workerd.
- The facade accepts named operations, validates bounded inputs and projected
  outputs, and never transports SQL or a generic database interface.
- Admin roles remain explicit ADMIN_DB assignments; Access authority is exact
  verified issuer/subject plus an independently approved human enrollment.

The previous plan to export a facade from the customer Worker is superseded:
a separate Worker avoids an unnecessary customer entrypoint/config change.
Cloudflare service bindings isolate invocation; they do not make D1 read-only.
The facade remains the trusted code boundary for its writable D1 capability.

Authoritative references:
https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/rpc/
https://developers.cloudflare.com/workers/local-development/multi-workers/
The installed Wrangler is 4.149.0; local multi-config execution is required.
