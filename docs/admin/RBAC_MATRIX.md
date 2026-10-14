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


## Escalation rules (server- and database-enforced, R1)

- No self-grant, no self-revoke.
- SUPER_ADMIN **grants and revocations** are requests that a *different* SUPER_ADMIN must approve; neither the
  requester nor the affected user may decide; the requester must still be an active SUPER_ADMIN when it is decided
  (otherwise the request is cancelled); every guard is re-checked inside the D1 batch; decisions are final.
- The database keeps at least two active SUPER_ADMINs (trigger), so a single administrator can never be left alone
  or locked out, and approvals cannot deadlock.
- The first two SUPER_ADMINs come from a one-time, two-person operator bootstrap (`grant_source = 'operator_bootstrap'`);
  a trigger rejects any later bootstrap grant. There is no HTTP bootstrap.
- Roles are re-read on every request; any role change or credential/verification change revokes that user's admin sessions.
- Household roles (`household_members.role`) and customer sessions are never consulted.
