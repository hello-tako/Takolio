> **Recovery status (2026-10-16): ADMIN_V1_R2_BLOCKED.** Source
> `9f3e59a6ed3a9b6b6041fef2e0a83340d1db1dd5` is incomplete; required modules were lost in sandbox replacement.
> The design/checklist below is not proof of implementation. Actual checks and
> next action: REPORT.md, REGRESSION.md and SOURCE_MANIFEST.md. No independent PASS.

# R2 findings matrix

Provenance/proof status: REPORT.md and SOURCE_MANIFEST.md.
All findings remain open pending completed local verification and independent
review; the implementer does not certify their own remediation.

| Finding | Intended remediation | Current evidence boundary |
|---|---|---|
| F1 | Separate internal read facade; no Admin customer D1/credential columns | Integration/checks pending |
| F2 | Three enrolled production operators; dual-approved offline recovery | Synthetic verification pending |
| F3 | Independently approved human enrollment distinct from Access subject | Staging ceremony not executed |
| F4 | Acting authority and identity rechecked inside mutation transaction | Concurrent race checks pending |
| F5 | Atomic bootstrap closure, grants and audit; replay refused | Failure-injection proof pending |
| F6 | Failed-login accounting cannot block a correct login | Regression pending |
| F7 | Bounded named reads and coalesced cached rollups; no customer migration | Query-budget proof pending |
| F8 | Poll completed keyboard scrolling rather than read animation early | Ten repeats pending |
| F9 | Ignored screenshots unless explicit documentation opt-in | Clean-tree proof pending |
| F10 | API/shell identifier agreement and traversal refusal | Routing/workerd proof pending |
| F11 | Stable verified issuer/subject bound to approved operator and role | Synthetic tests pending; real Access not verified |
