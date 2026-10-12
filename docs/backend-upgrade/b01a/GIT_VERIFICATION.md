# B01a A1 - Git object and receipt verification

Implementation `0649324a729b57019df61da6bceec40cd9ba1135`, base `8a9b386f46f245c727b9ac2f885bab842d5796b5`; 2026-10-11 JST.
This receipt records the implementation; it excludes its own commit hash.

Verified 21 tested source records against worktree and implementation Git blobs.
Verified 319 protected records against base/implementation/current bytes, including
all 39 applied migrations/config/workflows/lock/authority. Kernel remains dormant.
The implementation has 22 paths including the ADR; documentation subsequently changes
ADR acceptance status only. No source/test/schema change follows implementation.

Verified 67 staged documentation/evidence payloads against their bytes
and Git blobs; 10 historical documents retain their full original suffix bytes.
Verified 41 deterministic gzip logs and raw SHA256 receipts. Initial failed full,
interrupted intermediate full, typecheck/SW build/audit-selector failures remain separate
from actual committed-HEAD full PASS. No raw-log normalization.

Manifest [git-verification.json](git-verification.json): 93372 bytes,
SHA256 `48180a498b2e1f2dc0a6aaa178b243086684cd6976789ca5674188e17e74c2aa`. Manifest and this text exclude their own hashes to avoid
circular receipts; their stored blobs must also match the documentation commit.
Full evidence and limits are in validation.json/LOCAL_VALIDATION.md. These checks
do not certify production strict OTP, hosted D1, mail inbox or human PR approval.
