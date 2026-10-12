# B01a A2 - Git and evidence verification

Final implementation: `dcc0e1a74d2f5e3b67e13ecbb241bc04c8fafdde` on `codex/backend-b01a-integration`.
Base A1 receipt: `8f55a745e08c800898555be829b93c8f1a7a5d18`. Initial A2 implementation: `15ee1c5ca8bbaa792f7a3fe3936c5c8c0ae1dcc7`.
The final full test and sequential build started/ended on a clean committed tree.
Full: 293 files / 7037 tests PASS.
Recovery focused: 15 files / 454 tests PASS on the precommit tree;
the subsequent type-only annotation fix is covered by the committed full suite.

`git-verification.json` pins 23 source/test hashes and 369 protected hashes.
All source files match final implementation Git blobs. Protected backend authority,
40 applied migrations, dependency files, config and workflows match the A1 baseline.
The packet manifest includes each exported receipt/log gzip hash and synchronized
status checksum. Logs decompress to the exact SHA256 recorded by their actual runner.
The main branch was read-only reverified at `652e0d7632745e9b77cda4b5b3caac83a3ec1015`.

The documentation receipt is a later docs-only commit. Its own final SHA is
reported by the finishing Git check; it cannot be embedded in files inside itself.
This manifest and this note exclude their own hash to avoid recursive self-hashing.
After that commit, verification checks all packet/status files against committed blobs
and confirms the clean canonical tree. The untracked original-workspace plan is
synchronized separately; its existing historical bytes and all other user changes
are preserved. The masterplan input hash remains unchanged.

Source and evidence review reports no blocking local findings. Dependency audits
remain FAIL and are explicitly assigned to B08. This record does not certify
hosted D1, browser E2E, real inbox/delivery, production release or rollback.
No remote D1/R2 write, real mail, paid AI, push, PR, merge or deploy was performed.

See [result](RESULT.md), [executed validation](LOCAL_VALIDATION.md),
[raw metadata and gzip map](validation.json), [fixture review](recovery-review.json),
[independent DB/coordinator review](independent-db-coordinator-review.json) and
[plan synchronization](plan-sync.json).
