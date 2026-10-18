# Takolio Admin Console

Current authority: [single-owner release](production-readiness/19_SINGLE_OWNER_RELEASE.md)
and [current verification](production-readiness/20_CURRENT_VERIFICATION.md).
Status: `ADMIN_SINGLE_OWNER_IMPLEMENTED_LIVE_ACCEPTANCE_PENDING`.
The owner removed mandatory three-person administration and two-key release custody.

One enrolled SUPER_ADMIN can administer and confirm changes to another account.
The affected account cannot approve itself; the last usable owner is protected.
Cloudflare Access, RBAC, CSRF, session revocation and atomic audit remain required.
Schema 4 preserves the historical authority records. No customer payment,
authentication, runtime or customer migration change belongs in this work.

The separate Admin Worker owns ADMIN_DB, rate storage and protected assets.
Customer reads use a restricted internal Service Binding to a nonpublic read
facade; Admin has no direct customer D1 binding. Production password login is
compiled out. Current templates/policy remain disabled until real targets,
owner identity, protected approval and staging certification are supplied.

| Resource | Location |
| --- | --- |
| UI and contract | src/admin/, admin/index.html, src/shared/admin.ts |
| Admin Worker/API | src/worker/admin-worker.ts, src/worker/routes/admin/ |
| Internal read facade | src/worker/admin-read-facade-worker.ts, src/worker/facade/ |
| Admin schema | migrations-admin/0001-0004; schema version 4 |
| Local startup | LOCAL_SETUP.md |
| API and permissions | API_REFERENCE.md, RBAC_MATRIX.md |
| Current release and remaining evidence | production-readiness/19_SINGLE_OWNER_RELEASE.md |
| Current executed checks | production-readiness/20_CURRENT_VERIFICATION.md |
| Historical source-specific evidence | production-readiness/01-18 and evidence/; handoff/; remediation-r1/ |

Historical staffing and GitHub suspension statements are superseded by the current
release document. Their old test receipts remain historical. Generated browser
screenshots stay in ignored .hoplite/artifacts/admin-e2e; tracked screenshots are
older reference imagery. Admin has not been deployed by this change.
