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

Matrix version: `2026-10-12.v1`.


## Escalation rules (server-enforced)

- No self-grant, no self-revoke; the last active `SUPER_ADMIN` cannot be revoked.
- `SUPER_ADMIN` grants create a pending approval (72h) that a *different* `SUPER_ADMIN` (not the requester, not the target) must approve.
- Roles are re-read from `admin_role_assignments` on every request; revoking the last role revokes that user's admin sessions.
- The only grant without a granting admin is the local CLI bootstrap (`grant_source = 'local_bootstrap'`, DB CHECK-enforced), which is one-time and refuses non-development environments.
