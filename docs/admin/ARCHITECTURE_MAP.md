# Admin Console V1 - current R2 architecture

Authority: [production-readiness/03_SYSTEM_ARCHITECTURE.md](production-readiness/03_SYSTEM_ARCHITECTURE.md)
and [06_WORKER_ISOLATION.md](production-readiness/06_WORKER_ISOLATION.md).
Frozen runtime: `066c35ad670bc877756150c2055e3844dd7a17ce`.

| Component | Responsibility / boundary |
| --- | --- |
| Existing customer Worker | Customer APIs and existing customer auth; no Admin routing or assets |
| Admin Worker | Separate origin, Access, sessions, server RBAC, audit, settings/governance, frontend assets |
| ADMIN_DB | Independent identity/session/role/approval/bootstrap/recovery/audit authority; schema 3 |
| CUSTOMER_READ binding | Internal RPC to AdminCustomerReadFacade; signed exact-input named operations |
| Read Facade Worker | Fifteen read operations with strict input/output/projections and query budgets; customer D1 binding; HTTP always 404 |
| React frontend | Vietnamese Takolio interface, nine primary destinations plus details and auth/state surfaces |
| Local test tooling | Fixed synthetic fixtures, loopback preview/actual workerd and local D1 only |

Request flow: dedicated Worker host/policy/asset gate -> Access + independent
Admin session -> fresh server permissions -> Origin/CSRF on mutations -> handler.
Sensitive disclosure requires audit first and a signed facade capability; mutation
and its audit use one durable batch or statement-trigger transition. Local
password authority is compiled out of production and is not customer credential
authority. No Admin path directly binds/queries customer D1.

Customer data is projected and bounded in the facade. It has a technically
writable platform binding, so source and deployment access remain trust-critical.
Current live identity, binding, routing and release adapter certification is
blocked. Historical original/R1 diagrams do not authorize restoring a customer
DB binding or placing Admin schema into migrations/.
