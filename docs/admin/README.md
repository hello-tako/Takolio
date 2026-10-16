# Takolio Admin Console V1 - R2

Status: `ADMIN_V1_PRODUCTION_READINESS_BLOCKED`.
Frozen tested runtime source: `066c35ad670bc877756150c2055e3844dd7a17ce`.
Start with [the executive status](production-readiness/00_EXECUTIVE_STATUS.md),
[exact regression results](production-readiness/12_REGRESSION_RESULTS.md) and
[remaining blockers](production-readiness/17_REMAINING_BLOCKERS.md).
Historical handoff/R1 reports retain their original source attribution and are
not current R2 operational instructions.

The console runs as a separate Admin Worker with ADMIN_DB, rate storage, assets
and a restricted internal Service Binding. A separate nonpublic customer read
facade owns the customer D1 binding. Customer runtime, customer migration ledger,
billing/PayOS authority and customer release workflows are preserved.

R2 uses independent approved-human issuer/subject enrollment, three eligible
SUPER_ADMIN operators, atomic audited bootstrap and four-eyes decisions, session
revocation and an offline two-custodian recovery verifier. These are locally
implemented and reviewed controls. Real Access, operator independence, live
release adapters and staging have not been certified.

| Resource | Location |
| --- | --- |
| UI and contract | src/admin/, admin/index.html, src/shared/admin.ts |
| Admin Worker/API | src/worker/admin-worker.ts, src/worker/routes/admin/ |
| Read facade | src/worker/admin-read-facade-worker.ts, src/worker/facade/ |
| Admin schema | migrations-admin/0001, 0002 and 0003 (version 3) |
| Build artifacts | dist/client (customer) and dist/admin (Admin) |
| Local startup | LOCAL_SETUP.md |
| Full readiness evidence | production-readiness/00 through 18 and evidence/ |
| Current architecture | ARCHITECTURE_MAP.md |
| API and permissions | API_REFERENCE.md, RBAC_MATRIX.md |
| Current release/rollback plan | production-readiness/10, 14, 15 and 16 |

Generated screenshots are ignored test artifacts copied into the reviewed
readiness packet; docs/admin/screenshots remains historical reference imagery.
No Admin foundation migration belongs in the customer ledger. Production
workflows currently produce offline plans only. No deployment, remote D1,
production bootstrap, flag enablement or PR merge is authorized by this packet.
