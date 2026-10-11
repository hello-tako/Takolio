# B01a - A1 implemented, A2 integration next

Current status: `B01a_A1_DORMANT_LOCAL_VERIFIED`, 2026-10-11 JST.
Implementation `0649324a729b57019df61da6bceec40cd9ba1135`; base 8a9b386f46f245c727b9ac2f885bab842d5796b5.
[Accepted dormant A1 ADR](../b01a/ADR-B01a-001.md), [result/A2sequence](../b01a/RESULT.md),
[actual local checks](../b01a/LOCAL_VALIDATION.md). Final committed full
291 files / 6908 tests PASS; six additive 0040 tables and typed coordinator verified.

The target/draft packet below is historical design input. A1 does not supersede
legacy challenges or wire any auth/client/send path. Full CODE_COMPLETE remains
open. A2 must finish guarded registration, route-wide issuance/verify/reset,
authorized guest handling, context/error/Turnstile/cookie-loss/terminal delivery
contracts and compatible cutover/cleanup. Hosted D1 proof / hardened rollback / inbox
and separately authorized release remain distinct gates. Current release/recovery
scripts stay pinned 0039; do not use them to certify 0040 without a new reviewed packet.

---

# B01a - D1 Strict OTP: Admission, Issuance Và Finalization

Ngày lập: 2026-10-11 JST. Trạng thái: `PACKET_READY_ADR_DRAFT`.
Owner: Security/backend. Integration owner: B00 coordinator.

## 1. Baseline Và Quyền Thực Thi

- Repository ID: `1385308553`; canonical repository: `vn-tak/Tako-san`.
- Base nguồn: `652e0d7632745e9b77cda4b5b3caac83a3ec1015`.
- Branch implementation bắt đầu từ canonical checkout đã pin. Checkout legacy `/Users/tunbee27/Documents/frigo` ở `f6a48a1f65f8303fe41463ef0dce442a1aed2c24` không phải nền triển khai.
- Coordinator xác minh lại base/head, lockfile checksum, migration tip trước code. Nếu main thay đổi, ghi delta/rebase qua review; cached branch label không tự chứng minh authority.
- Packet này là sản phẩm docs-only B00: chưa triển khai B01a, remote migration, deployment, flag change, email thật hoặc provider calls.
- Trước code đọc canonical AGENTS, AGENT_RULES, MASTER_SPEC, ARCHITECTURE, DOMAIN_MODEL, DECISIONS, CURRENT_STATE, TASK_BOARD, HANDOFF và packet này. Policy ở mục5 là ADR draft; ghi nhận review trước merge B01a.

## 2. Kết Quả Cần Đạt

Mọi candidate OTP phải được D1 admit trước khi so với expected challenge. Tối đa5 candidate mới được so trong bất kỳ cửa sổ15 phút trên cùng account/purpose, kể cả concurrency, IP khác nhau, resend và preliminary/final reset. Cooldown và generation có một authority chung. Finalize thành công phải commit business effects, consume challenge và durable outcome trong cùng transaction.

Counter cuối cùng bằng5 không chứng minh strict admission nếu nhiều request đã so HMAC trước khi tăng counter.

## 3. Scope Và Ownership

### OWNED_PATHS

- `src/worker/services/auth-otp.ts`: coordinator service mới; tên theo repository convention.
- `packages/db/src/auth-otp.ts`: typed raw-D1 repository/commands; không thêm ORM.
- `src/worker/config/otp-policy.ts`: policy constants.
- `src/worker/routes/auth.ts`: chỉ issuance/verify/reset adapters và hooks cần thiết; không sửa Plus activation.
- `src/worker/utils/otp-digest.ts`: candidate/request binding; giữ compatibility outstanding expected HMAC v1/v2 theo gate.
- `tests/integration/auth-hardening.test.ts`, `tests/integration/auth-otp-coordinator.test.ts` mới; unit policy tests chỉ khi kiểm tra behavior có ý nghĩa.
- Callers auth tối thiểu trong services/pages sau khi coordinator xác minh tên file và giao ownership: timestamped key/retry contract, không redesign UI.
- Packet/auth docs liên quan. Coordinator tích hợp DECISIONS/CURRENT_STATE/TASK_BOARD/HANDOFF.
- Migration additive có số do coordinator cấp sau khi kiểm tra các branch phụ thuộc. Base có39 migrations; không tự giả định số0040 còn trống.

### SHARED_PATHS - Coordinator Integration Only

`src/worker/index.ts`, `src/worker/types.ts`, `src/worker/config/validation.ts`, `src/worker/validation/schemas.ts`, migration ledger/schema gate, `tests/helpers/sqlite-d1.ts`, DECISIONS và ba handoff docs. Agent gửi diff nhỏ để owner tích hợp; không đồng thời ghi shared paths.

### FORBIDDEN_PATHS Và Effects

PayOS, billing, checkout/payment UI/webhooks, `src/worker/payment`, `/auth/plus/activate`, subscription grant rules, recipe/ingredient authority, planner scoring, Inventory Truth, Week dual-write, dependencies/toolchain, Wrangler bindings/config, workflows/release policy, production credentials và remote resources. Không thêm Durable Object, sửa applied migrations hoặc tự drop/backfill OTP/session data.

B01b email lifecycle và B01c membership là packets riêng. B01b checkpoint adapter policy phải đi trước B01a issuance wiring: native ambiguous exception không tự fall-through Resend. Coordinator giao email.ts cho B01b owner, không để B01a sửa cùng file. Adapter contracts/mock work B01b chỉ phụ thuộc B00 + draft delivery DTO; E2E B01b sau B01a. B01a cung cấp generation/delivery hooks để challenge không active trước khi persist provider acceptance; chưa chứng nhận delivered.

## 4. Source Evidence Và Compatibility

Các line references là source ở base đã pin:

- `src/worker/routes/auth.ts:430` / `:800` đọc OTP; `:442` / `:812` so HMAC; `:444` / `:814` mới ghi failure. Hiện chỉ durable counter được cap.
- Resend KV cooldown `:561`-`:580` fail-open. Register `:371`, unverified login `:700`, forgot `:94` cùng issue nhưng không có strict shared cooldown.
- Resend invalidation/insert tách bước `:600` / `:606`. `getLatestOtp` `:156` sắp theo `created_at`; migration0017 `:14` timestamp theo giây, không có generation authority.
- Register retry sửa account/password/profile/household `:318`-`:368` trước issue. Request bị strict denial không được vẫn commit những thay đổi này.
- Register consume `:469` trước activate/session `:475`/`:488`. Reset consume `:831` trước password/revocation batch `:839` và session mới `:856`.
- Concurrent test `tests/integration/auth-hardening.test.ts:950` chỉ assert counter5, chưa đo số comparisons.
- ADR-028 giữ cookie/CSRF, HMAC-only OTP, sanitized errors và production không devOtp. Server Turnstile hiện chỉ account creation; test `:424` không yêu cầu challenge mới trên login/reset/resend. Không mô tả resend server Turnstile gate như guarantee sẵn có.

Giữ paths/API-v1 fields có thể giữ, ghi rõ semantic failed-only -> admitted candidates. Preliminary forgot verify không tạo API session. Reset JWT hiện `typ=reset`; final reset nhận raw code. Không cho reset token thành access credential hoặc bỏ qua final-payload authorization.

## 5. ADR Draft - Chính Sách Đã Chọn Cho Implementation Review

| Chính sách | Giá trị / semantics |
| --- | --- |
| Candidate scope | normalized email + purpose; abuse tables/logs dùng opaque HMAC scope, không thêm raw email |
| Admission window | rolling900 giây; D1 lấy một `now`; đếm tickets có `admitted_at > now-900` và `<=now` |
| Maximum | 5 NEW admissions; đúng/sai/preliminary/final đều tính; cùng key/body replay không tính lại |
| Exhaustion | Admission thứ5 đặt `locked_until=admitted_at+900`; khóa NEW admissions, không hủy ticket đã admit |
| Challenge TTL | 600 giây từ issuance; `now >= expires_at` không finalize |
| Issuance cooldown | 60 giây/account/purpose, xuyên register retry/unverified login/forgot/all resends |
| Generation | Monotonic integer + current-challenge pointer; generation mới không reset window/lock |
| Ticket deadline | 30 giây từ admission, không vượt challenge expiry; hết hạn không hoàn budget |
| Request-key validity | `<epochMillis>:<128-bit-random-nonce>`; age<=30 phút, tối đa30 giây tương lai; malformed400, expired410, body conflict409 |
| Receipt retention | Ít nhất24 giờ; literal key cũ vẫn bị timestamp gate reject sau cleanup, không biến thành request mới |

Ticket deadline, request-key horizon/format và retention là lựa chọn ADR draft bổ sung cần review; không phải cấu hình production đã áp dụng.

Timestamp là replay horizon, không tạo quyền tăng quota: mint key mới vẫn phải qua scope admission. Client dùng epoch từ server issuance metadata mới `otpKeyIssuedAtMs`, có cùng shape ở known/unknown forgot response. Retry một operation giữ key; thao tác mới tạo nonce mới. Request key không được dùng lại sang purpose/operation khác.

Legacy request thiếu Idempotency-Key được server cấp unique ticket, vẫn strict admission/cooldown; mỗi retry là candidate mới. Không giữ legacy bypass. Completion replay không tạo session mới hoặc trả lại raw cookie credential; nếu response cookie ban đầu mất, client có thể phải login. Ghi UX/contract này rõ trong fixtures.

Auth IP limiter hiện tại là secondary best-effort control. KV absent/down không đổi strict invariants. D1/secret/admission uncertainty fail-closed trước expected-digest comparison và provider work, trả sanitized503. Exhaustion trả429 với Retry-After còn lại thực tế.

## 6. Data Và Commands

### 6.1 Durable Records

Expand-first schema:

1. Scope: opaque account/purpose key, generation/current challenge, issuance/cooldown timestamps, locked-until, revision.
2. Issuance receipt: scope/key/fingerprint/generation/challenge, immutable expiry, trạng thái `reserved | delivery_pending | accepted | rejected | delivery_unknown | superseded`, sanitized category. Không lưu OTP/email body.
3. Verification ticket: ID, scope/operation/request key, payload fingerprint, contextual candidate digest, challenge/generation, admitted-at/deadline, state/outcome/finalized-at. Unique(scope,key); index(scope,admitted-at).
4. Existing `auth_otps` giữ expected contextual digest/version; additive generation/issuance binding nếu cần. Strict path không dùng newest-created_at làm authority.

Fingerprint bind operation (`register_verify`, `login_verify`, `reset_preliminary`, `reset_final`), account/purpose, generation/challenge và validated body. Dùng keyed HMAC/domain separation; không persist plaintext password/code. Reset-final bind cả newPassword; đổi password với cùng key phải409. Expected HMAC v1 compatibility không làm candidate/request digest mất account/purpose/generation binding.

Replay tra cứu receipt trước khi chọn generation mới; không dùng same key để tự động admit vào generation khác. Request đã hết validity hoặc trỏ generation bị supersede trả typed stale/expired outcome, không thực thi lại effects. Khóa scope HMAC version phải ổn định trong wave; secret rotation nằm ngoài B01a.

### 6.2 Issuance

1. Validate Origin/Zod/Turnstile theo path policy và size. Chuẩn bị cryptographic code/digest, password hash khi register và command inputs trước batch. Không giữ network/email trong transaction.
2. D1 transaction reserve cooldown, bump generation, invalidate generation trước, insert challenge/receipt và registration effects khi admitted. Tất cả writes có chung claim guard. Guard lại existing account identity và `is_verified=0`; retry race không overwrite account vừa được verified.
3. Cooldown/lock/conflict/missing-protection denial không sửa account/password/profile/current pointer. Khi scope locked, issuance không xoay generation; budget/lock không reset.
4. Unknown forgot account nhận generic response/metadata và cùng durable admission/cooldown policy, không tạo account hoặc gửi mail. Quyết định eligibility không trở thành response oracle.
5. Sau commit mới dispatch delivery. `delivery_pending` chưa verify được. Persist provider acceptance bằng generation-fenced command rồi active. Forgot response giữ generic waitUntil path.
6. Definitive reject invalidate exact issuance/generation. Timeout/crash sau dispatch có thể là `delivery_unknown`; không suy email chưa gửi, không clear cooldown/hoàn budget/blind resend hoặc fallback. Late result generation cũ không active generation mới.

B01a dùng conservative unknown cho generic provider exception chưa phân biệt được commit. B01b mới bổ sung authenticated delivery events/status khi provider có capability. Không lưu/log recipients, codes, passwords, email bodies hoặc provider exception text; message IDs được phân loại private/sanitized.

### 6.3 Admit Trước Compare

1. Parse key, tính candidate contextual digest/body fingerprint. Tính digest input chưa phải so với expected challenge.
2. D1 batch atomically reserve unique ticket theo rolling budget, lock, current generation, accepted issuance và expiry. Trong cùng transaction phân biệt NEW admission, same-key replay, fingerprint conflict và denial.
3. Chỉ NEW admission winner chạy expected-digest comparison một lần. Same-key ticket đang chạy trả typed in-progress/poll outcome; không chạy comparison song song. Instrument boundary này trực tiếp.
4. Wrong/expired/deadline/crash vẫn tiêu budget. Persist outcome bằng exact ticket CAS. Không dùng verify-first rồi conditional failure counter.

### 6.4 Finalize Và Ticket Thứ5

Guard gồm exact ticket/state/operation/scope/fingerprints, current generation/challenge, accepted delivery, ticket deadline và OTP expiry. Không check global count<5 hay scope lock để chặn ticket đã admit. Ticket thứ5 đúng code vẫn finalize nếu guards hợp lệ; request thứ6 không so HMAC.

- Register-final: cùng transaction consume + activate account + session hash + durable outcome. Chuẩn bị random session token/hash trước batch; Set-Cookie sau commit. Raw token không ở receipt/log/JSON. Login-purpose verify giữ baseline behavior: consume + durable success outcome, không tạo OTP-only login session; user tiếp tục password login. Đổi hành vi này cần ADR riêng, không thuộc B01a.
- Reset-preliminary: durable verified outcome, chưa consume final challenge, không đổi password/revoke session. Reset JWT chỉ reset flow. Replay không admission/compare mới.
- Reset-final: candidate reservation riêng, fingerprint gồm newPassword. Chuẩn bị password/session hash; cùng guarded batch consume + password update + revoke old sessions + insert fresh session + durable outcome. Không đổi final payload dưới preliminary proof.
- Superseded/expired/stale/used/conflict không tạo effects. Lỗi giữa required writes rollback challenge/account/password/sessions/outcome; no Set-Cookie. Timeout response không chứng minh DB chưa commit: retry dựa durable receipt.

### 6.5 D1 Conditional UPDATE0 Không Rollback

`db.batch` atomic khi constraint error, nhưng conditional UPDATE0 vẫn commit writes trước đó. `tests/integration/auth-hardening.test.ts:223` chứng minh behavior này.

First CAS tạo transient finalization claim. Mỗi account/challenge/session/effect statement đều `WHERE/SELECT EXISTS` cùng exact claim. Cuối batch persist terminal outcome rồi consume claim. Không commit claim intermediate.

Nếu required write có0rows sau khi claim thành công, assertion/trigger constraint `RAISE(ABORT)` phải chạy trong SAME batch để rollback. Claim không thắng thì business effects/assertion rows không chạy. Không kiểm meta sau commit rồi gọi đó là atomic safety. Test missing account, stale generation, CAS0 và forced constraints.

D1 không chạy arbitrary application callback trong SQL transaction. SELECT -> await crypto/network -> UPDATE không phải transaction. Crypto ở ngoài; authorization/CAS/claims nằm trong SQL batch.

## 7. Compatibility Và Migration

Không rewrite39 applied migrations. Migration additive và local replay trước route integration. Existing reader/cleanup phải hiểu expanded schema; B01a không mở generic auth data cleanup scope.

Legacy cutover decision TARGET/DRAFT: current schema không lưu durable provider-acceptance receipt, nên không adopt old challenge dựa digest/created_at. Initialization atomically supersedes unprovable outstanding legacy challenges trong scope, imports accounting/lock trước, đánh dấu một cutover receipt và trả OTP_REISSUE_REQUIRED cho verification. Client hiển thị cần yêu cầu mã mới; lần issue mới vẫn qua preserved cooldown/budget/lock. Đây là one-time invalidation được document và test, không silent drop hoặc tự gửi lại toàn bộ. Chỉ challenge có receipt evidence hợp lệ từ expanded readers được adopt; created_at tie không chọn tùy ý. HMAC v1 parser/unit compatibility được giữ, nhưng không hứa outstanding old OTP usability khi acceptance evidence không tồn tại. Production cutover chỉ ở release riêng sau ADR/client/staging proof.

Không reset legacy failure budget khi strict wave bắt đầu: seed imported accounting rows ở cutover/init-time tương ứng attempt_count (bounded5), giữ lock hiện tại; nếu count>=5 thì khóa admissions mới thêm15 phút. Ghi imported accounting riêng, không giả đó là HMAC comparisons do code mới thực hiện. Initialization và fresh issue cạnh tranh phải serialized theo scope. Chính sách này cần ADR/migration review trước staging.

## 8. Thứ Tự Thực Hiện

1. Chốt ADR/key/error/cookie-replay contract, snapshot current bodies/callers. Coordinator giao shared ownership và migration number.
2. Add schema + typed commands; local replay/FK/quick_check; concurrency/instrumentation tests trước routes.
3. B01b ambiguous-send adapter checkpoint hoàn tất rồi tất cả issue paths qua coordinator; account registration effects guarded. KV không còn quyết định strict cooldown.
4. Tất cả verify/preliminary/final reset qua coordinator; bỏ unguarded control paths; transaction auth effects. Giữ Origin và guest-transfer fences.
5. Minimal caller key/retry integration theo ownership; no-key compatibility tests. Đổi assertions sang admitted semantics, giữ adversarial coverage.
6. Focused/full gates, diff/protected/applied-migration review, independent review, PR/exact-head CI.
7. Isolated staging D1 certification + rollback packet riêng. Production theo authorization và DEPLOYMENT.md; local PASS không tự cấp quyền release.

## 9. Kiểm Thử Có Ý Nghĩa

| Case | Acceptance |
| --- | --- |
| 20/100 concurrent distinct keys, đổi IP, KV absent/down | <=5 NEW tickets và <=5 expected-digest comparisons; request6+ zero compare |
| Mixed verify/preliminary/final | Một account/purpose window; không budget riêng theo route |
| 4 sai rồi candidate5 đúng; lock đã set | Candidate5 finalize; candidate6 reject trước HMAC |
| Same-key/body20 racers/retry | Một ticket/compare/outcome; không duplicate activation/password/session |
| Same key đổi code/password/purpose/operation | 409; không admission/compare/effect mới |
| Key horizon/cleanup | Key cũ410 trước reservation; không reuse; receipt24h |
| Mọi issue path race/same-second | Một cooldown winner/current pointer; generation monotonic; denied register không đổi password/profile |
| Resend lúc locked/exhausted và đang verify | Không reset scope; old ticket không finalize vào generation mới |
| Repeated preliminary rồi final | Mỗi candidate mới tính budget; final-password bind; reset JWT không API access |
| TTL/deadline/window/lock equality | D1 time boundaries đúng, expired không finalize, crash không refund |
| D1/secret unavailable/query/batch failure | No compare/email/partial effect; sanitized503 |
| Account/password/revoke/session/outcome constraint failure | Rollback tất cả gồm OTP consume; no Set-Cookie |
| CAS0/later required UPDATE0 | No unauthorized effect; actual constraint abort khi required |
| Provider accepted/rejected/unknown/post-dispatch crash | Exact generation state; unknown không blind fallback/resend |
| Known/unknown forgot | Generic status/body/metadata/error shape; cùng cooldown/admission; no unknown mail/account |
| Legacy no-key/v1 digest parser/legacy cutover | Strict admission; unprovable old challenge OTP_REISSUE_REQUIRED; no reset budget/no created_at tie guess |
| Cookie/logout/CSRF/expiry/guest transfer | Existing regressions pass; credentials/PII absent from logs/receipts |

Harness `tests/helpers/sqlite-d1.ts:20` có barrier/hooks ngoài batch. `:85` dùng BEGIN IMMEDIATE, không await/per-statement hooks trong transaction, constraint error rollback. Barriers chỉ tạo interleavings ngoài atomic batch. Spy/inject comparison count tại service boundary; SQL counter assertions chưa đủ.

## 10. Commands Và Evidence Levels

Đây là commands dự kiến, packet chưa thực thi chúng. Chạy từ canonical root với Node>=22.13 (Node24 đã được repository xác minh), pnpm theo lockfile, SQLite CLI. Giữ CHECK_REMOTE_SCHEMA/CHECK_WEEK_PARITY_REMOTE unset; không đưa production vars/credentials vào tests.

```sh
pnpm install --frozen-lockfile
pnpm exec vitest run tests/integration/auth-otp-coordinator.test.ts tests/integration/auth-hardening.test.ts tests/integration/auth-me-quota.test.ts tests/integration/browser-security.test.ts tests/integration/frontend-security-integration.test.ts tests/unit/auth.test.ts
pnpm lint
pnpm typecheck
NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run --maxWorkers=2
pnpm check:migrations
pnpm build
git diff --check
```

Nếu callers thay đổi, thêm auth frontend suites theo actual files: auth-resend-turnstile, auth-verify-route, auth-guest-transfer-deferred, auth-google-credential và HTTP/session retry tests. Browser smoke dùng isolated preview/private DB/no outbound mail: retry/expired-key, register/resend/preliminary/final reset, cookie-loss recovery trên desktop/mobile. Không dùng E2E URL production mặc định.

| Evidence | Ý nghĩa |
| --- | --- |
| SOURCE_VERIFIED | Assertions trên pinned source/docs, exact diff reviewed |
| LOCAL_VERIFIED | Commands/tests/counts/timings/migration/FK/quick_check thực chạy; ghi failures và reruns |
| STAGING_CERTIFIED | Separately authorized isolated D1 apply, actual CAS/RETURNING/constraint semantics,20+ concurrency/mixed paths/retry/rollback trên tested SHA |
| PRODUCTION_UNVERIFIED | Mặc định; production proof chỉ sau authorized release + exact SHA/schema/flags/smoke |

SQLite local không chứng nhận hosted D1 semantics. Packet B00 không chạy paid providers/mail/remote SQL/migrations/deploy. Không có test execution result nào được claimed ở đây.

## 11. First Strict Release Và Hardened Rollback

Expand-first readers/cleanup/receipts trước writers. Có thể flag OFF để review offline; production security chỉ certify khi tất cả verification/issuance entry points qua strict coordinator. Không chứng nhận partial cohort khi alternate old path vẫn mở brute-force/cooldown bypass.

First strict release chưa có previous strict artifact. Release packet phải pin named hardened rollback artifact đã review/test, hoặc fail-closed fallback, hiểu expanded schema và giữ coordinator admission/cooldown. Không rollback về control path cũ hoặc flag OFF để reopen bypass.

Khi coordinator lỗi, reject OTP workflows503 theo tested fallback; đánh giá riêng sessions/API khác. Retain tickets/scopes/generations/sessions; không reset counts, purge receipts, drop schema hoặc restore toàn DB. Ghi rollback SHA/Worker version, compatibility, retention, rehearsal và operator procedure. Failure không authorize Time Travel.

## 12. B01c Companion - Revoke Boundaries

B01c viết route-wide adversarial tests, không cùng ghi B01a owned paths:

- Auth middleware session query chưa recheck membership (`src/worker/middleware/auth.ts:75`). Xóa membership default `hh_user` có thể được tenancyGuard tự link lại (`src/worker/middleware/tenancy.ts:43`); phải chốt revocation semantics, test cả default/nondefault.
- Recipe detail/recommendations đọc inventory không tenancy middleware (`src/worker/routes/recipes.ts:232`, `:254`). Native reader có actor membership; legacy chỉ household filter/KV fallback (`src/worker/routes/inventory.ts:515`). Test cả hai sau revoke với cookie còn valid.
- Notifications legacy stock/shopping thiếu current-membership guard (`src/worker/routes/notifications.ts:25`, `:47`). Removed member không được đọc summaries.
- Inventory/scans/shopping/Week dùng guard; modern planner registered-only/creator-private phải test same-household member/foreign household. Guests skip membership guard nhưng cookie/row predicates vẫn phải isolation.
- Role SELECT chưa propagate/enforce family policy; ghi rõ membership-vs-owner authorization, không thêm RBAC product redesign vào B01a.
- Test session rotate/revoke/expire, partial/mismatched expected-owner headers, forged IDs, missing/hostile Origin, default/nondefault revoke, guests và creator privacy.

Đây là source risks, chưa phải production exploit certificate. Membership/RBAC fixes cần packet/ADR riêng.

## 13. Definition Of Done Và Handoff

CODE_COMPLETE: mọi issue/verify/reset paths covered; policy/schema/key contract recorded; local meaningful concurrency/fault/security gates thực pass; protected/applied-migration diff inspected. PR_REVIEWED/STAGING_CERTIFIED/PRODUCTION_VERIFIED là gates riêng.

Trước kết thúc task coordinator cập nhật CURRENT_STATE/TASK_BOARD/HANDOFF theo canonical format: exact base/head, commands/counts/failures, limits, next action. Preserve unrelated user changes, coherent checkpoint khi phù hợp; không direct/force push main.

Next action sau B00: review ADR draft/shared ownership, cấp migration number, triển khai typed repository commands với comparison instrumentation trước route integration. Inbox/budget/staging credentials thiếu không chặn offline B01a; chúng chặn certification tương ứng.

## 14. Ràng Buộc Trước Integration

Known/unknown account parity cần một virtual challenge cho unknown forgot scope: nó cho phép cùng admission/cooldown work nhưng không có account principal và không được activate account, consume thành công, issue reset proof hoặc create session. Có thể so candidate với random expected digest rồi ép generic invalid outcome khi principal không tồn tại; trạng thái internal `synthetic` không phải provider accepted/delivered evidence. Không trả trạng thái này qua response. Implementer phải test unknown candidates vẫn tiêu cùng durable budget; không để guard `delivery accepted` loại riêng unknown trước admission và tạo oracle qua 429/timing/metadata.

B01a không kéo dài ticket deadline bằng retry, không clear lock sau một successful preliminary verify và không xóa window khi account chuyển unverified -> verified. Cleanup giữ accounting rows đủ window/lock/key horizon; pruning không được giải phóng admissions còn hiệu lực. Secret/scope-HMAC rotation, full delivery events và production retention cleanup thuộc packets riêng.

Policy mới đổi từ failed-only sang total admissions: bình thường preliminary + final reset dùng 2 admissions. Năm lần preliminary mới có thể khóa final request thứ 6, dù cả năm đúng. UI phải dùng cùng key cho transport retry để không lãng phí budget; không silently gọi preliminary verify nhiều lần. Ghi thay đổi này trong ADR và UX fixture trước merge.

Các con số bổ sung (ticket 30 giây, key 30 phút/future skew 30 giây, receipt 24 giờ) là đề xuất có lý do về crash/replay/retention, chưa có SLO measurement. Review có thể đổi chúng trước integration; phải cập nhật packet và assertions đồng bộ, không đổi runtime âm thầm.

## 15. Pre-Implementation Review Sau B01b A1

Source review bổ sung: [B01a preflight](../b01b/B01a_PREIMPLEMENTATION_REVIEW.md).
B01a vẫn ADR_DRAFT, chưa có schema/runtime/client changes. Trước implementation
phải chốt account-wide request registry: UNIQUE(scope,key) không đủ để bảo đảm
cùng key đổi purpose/operation trả409. Abuse budget vẫn account+purpose; registry
unique opaque account HMAC+key chung issuance/verify/reset và purposes.

ADR phải chốt conservative legacy aggregate cả used/superseded retained rows
(no exact per-failure time), một DB time captured trong winning claim, cleanup
không cascade xóa budget/outcomes, first-request server epoch bootstrap, context
version/parser, Retry-After/body metadata, Turnstile receipt replay, guest-deferred
new payload/key và cookie-loss sessionRequired recovery. Normal reset UI hiện đi
trực tiếp final reset; không thêm preliminary call để tiêu thêm admission.

Các review inputs là đề xuất cần quyết định/test trong B01a, không thay thế policy
đã deploy hoặc khẳng định full strict OTP đã triển khai.

### Additional first-ADR gate after independent preflight

The linked B01a pre-implementation review additionally requires an explicit
unknown-generation recovery rule, known/unknown forgot budget parity during every
delivery state, non-renewable preliminary-reset proof replay, and non-cascading
abuse history across cleanup/account recreation. First slice includes a dormant
real coordinator comparison boundary; repository-only conditional loops are not
proof that runtime compares only admitted candidates. No B01a runtime is added by
this packet update.
