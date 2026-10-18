# Admin Console V1 — RBAC permission matrix

Generated from `src/shared/admin.ts` (`ADMIN_PERMISSION_MATRIX`), which the Worker evaluates server-side on every request. Deny by default: unknown roles/permissions grant nothing. Household roles (`household_members.role`) are never consulted.

| Permission | Mô tả | SUPER | OPS | CONTENT | SUPPORT | AUDITOR |
|---|---|:-:|:-:|:-:|:-:|:-:|
| `admin.self.read` | Xem phiên quản trị của chính mình | ✓ | ✓ | ✓ | ✓ | ✓ |
| `overview.read` | Xem tổng quan | ✓ | ✓ | ✓ | ✓ | ✓ |
| `users.read` | Xem danh sách người dùng (đã che thông tin nhạy cảm) | ✓ | ✓ | — | ✓ | ✓ |
| `users.pii.reveal` | Hiện email đầy đủ của người dùng (có ghi nhật ký) | ✓ | — | — | ✓ | — |
| `households.read` | Xem tóm tắt hộ gia đình | ✓ | ✓ | — | ✓ | ✓ |
| `billing.read` | Xem thanh toán và gói đăng ký (chỉ đọc) | ✓ | ✓ | — | — | ✓ |
| `ai.read` | Xem vận hành AI & OCR | ✓ | ✓ | — | — | ✓ |
| `recipes.read` | Xem danh mục công thức | ✓ | ✓ | ✓ | — | ✓ |
| `recipes.review` | Tạo ghi chú biên tập/duyệt công thức | ✓ | — | ✓ | — | — |
| `system.read` | Xem trạng thái hệ thống | ✓ | ✓ | — | — | ✓ |
| `audit.read` | Xem nhật ký kiểm toán | ✓ | ✓ | — | — | ✓ |
| `admin.roles.read` | Xem phân quyền quản trị | ✓ | — | — | — | ✓ |
| `admin.roles.manage` | Cấp/thu hồi vai trò quản trị | ✓ | — | — | — | — |
| `admin.approvals.decide` | Phê duyệt yêu cầu cấp quyền cao | ✓ | — | — | — | — |
| `admin.sessions.revoke` | Thu hồi phiên quản trị | ✓ | — | — | — | — |
| `admin.preferences.write` | Lưu tùy chọn cá nhân | ✓ | ✓ | ✓ | ✓ | ✓ |

Roles: `SUPER_ADMIN` (SUPER) — Quản trị viên cấp cao; `OPERATIONS_ADMIN` (OPS) — Quản trị vận hành; `CONTENT_EDITOR` (CONTENT) — Biên tập nội dung; `SUPPORT_AGENT` (SUPPORT) — Nhân viên hỗ trợ; `READ_ONLY_AUDITOR` (AUDITOR) — Kiểm toán (chỉ đọc).

Matrix version: `2026-10-13.v2`.


## Escalation rules (server- and database-enforced, schema 4)

- No self-grant or self-revoke by the affected account.
- SUPER_ADMIN grants/revocations require an expiring request and explicit confirmation. The requesting owner may confirm; the target may not. Current issuer, enrollment and roles are rechecked inside the atomic D1 batch; decisions are final.
- Normal revocation must leave one active approved enrolled SUPER_ADMIN in the configured issuer. Role, identity and operator-status guards protect the last usable owner.
- First authority uses audited owner enrollment, then one atomic single-owner bootstrap with grants, closure marker and audit. No HTTP bootstrap exists.
- Immutable issuer/subject enrollment and roles are checked on requests; identity/operator status, authority epoch and role changes revoke Admin sessions.
- Offline recovery accepts one enrolled Ed25519 owner key; existing two-key recovery remains supported. Release artifacts require one rostered owner signature. Existing main review and GitHub Environment approval protections remain enforced.
- Household roles and customer sessions never grant Admin authority. Actual Access, owner enrollment and live recovery remain PENDING_EXTERNAL_EVIDENCE; see production-readiness/19_SINGLE_OWNER_RELEASE.md.
