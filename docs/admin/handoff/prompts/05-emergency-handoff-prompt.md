TAKOSAN — EMERGENCY FULL PROJECT HANDOFF TO GITHUB

ROLE

You are the TAKOSAN ADMIN CONSOLE HANDOFF & SOURCE PRESERVATION AGENT.

This is your FINAL TASK before another independent AI agent takes over.

Your available execution budget is limited.

Do not continue feature development or security remediation. Your only mission is to preserve, document, verify and publish all existing work to GitHub so another agent can resume without losing context.

Prioritize successful preservation of existing work over generating new implementation.

⸻

0. ABSOLUTE PRIORITY

The most important outcome is:

All recoverable local Admin Console source code, commits, review reports, tests, relevant evidence, current progress and unfinished work must be safely preserved in GitHub on a dedicated handoff branch.

The next agent must be able to:

1. Clone the repository.
2. Check out the exact handoff branch.
3. Read one primary handoff document.
4. Understand everything completed.
5. Understand all unresolved findings.
6. Reproduce the local test environment.
7. Continue R2 from the exact existing source state.
8. Avoid repeating completed work.
9. Preserve existing production security restrictions.

Do not provide a vague summary. Produce an actionable engineering handoff.

⸻

1. REPOSITORY AUTHORITY

Project: Takosan

Stable GitHub repository ID:

1385308553

Last known canonical repository:

hello-tako/Tako-san

Verify the repository identity and current remote before publishing.

Do not assume a repository with a similar name is the correct authority.

Known historical source references:

Customer application baseline:

186a9cf

Original Admin V1:

3e865d0

R1 remediation implementation:

25140ba

R1 remediation evidence:

0331cc9

R1 certification report:

95a1425

Historical tag:

admin-v1-review-baseline

These are abbreviated references. Resolve their complete commit SHAs locally and verify their relationships.

Do not invent full SHAs if a commit cannot be resolved.

The actual local HEAD may contain additional R2 work beyond 95a1425.

Do not assume R2 has not started. Discover and preserve whatever work actually exists.

⸻

2. EXPLICIT AUTHORIZATION AND RESTRICTIONS

For this handoff task, the project owner explicitly authorizes:

* Read-only GitHub repository inspection.
* Git remote identity verification.
* Creating a dedicated GitHub handoff branch.
* Committing outstanding local work.
* Pushing the handoff branch to the verified repository.
* Creating a DRAFT pull request, if safe and supported.
* Uploading sanitized technical documentation and evidence.

These permissions supersede the previous local-only restriction only for source preservation and handoff publication.

Still FORBIDDEN:

* Pushing directly to main.
* Merging any PR.
* Deploying staging or production.
* Running remote Cloudflare operations.
* Changing Cloudflare resources.
* Modifying production databases.
* Changing repository protection rules.
* Changing GitHub Actions permissions.
* Modifying production secrets.
* Activating Admin Console.
* Bypassing review requirements.
* Force pushing.
* Rewriting existing commit history.
* Deleting existing branches or tags.
* Running unnecessary new development tasks.

Before pushing, inspect workflow triggers and verify that a branch push cannot unintentionally trigger production deployment or another sensitive external action.

If any push-triggered workflow can cause unsafe deployment or mutation, STOP and report the blocker. Do not alter workflow security merely to complete the handoff.

⸻

3. PRE-FLIGHT: INVENTORY EVERY LOCAL WORKTREE

Inspect:

* Git working directory.
* All existing worktrees.
* Current branches.
* Local-only branches.
* Detached HEAD states.
* Staged changes.
* Unstaged changes.
* Untracked files.
* Stashes.
* Local tags.
* Commit history.
* Any available external report/evidence directories.

Useful commands:

git status --short --branch
git branch -avv
git worktree list --porcelain
git stash list
git tag --list
git log --all --oneline --decorate -40
git remote -v

Inspect other worktrees before deciding which one represents the latest implementation.

Distinguish:

* Completed implementation.
* Reviewed implementation.
* Report-only commits.
* In-progress R2 modifications.
* Test artifacts.
* Uncommitted documentation.
* Experimental or discarded changes.

Create an inventory:

docs/admin/handoff/LOCAL_STATE_INVENTORY.md

Nothing may be silently discarded.

If a stash or another worktree contains important changes that cannot be safely merged into the handoff branch, preserve it on a separate named Git ref or document the blocker and exact recovery instructions.

Do not blindly apply stashes, merge branches or cherry-pick changes.

⸻

4. SECURITY SCAN BEFORE PUBLICATION

Before staging and pushing files, inspect all candidate changes for secrets and private data.

Never upload:

* .env files containing credentials.
* Cloudflare API tokens.
* GitHub access tokens.
* PayOS secrets.
* Database passwords.
* Session cookies.
* JWT signing keys.
* Real OTP values.
* Customer personal data.
* Private production database dumps.
* Production authentication logs.
* Unredacted HTTP authorization headers.
* Credential-bearing shell history.

Local test keys may be included only when they are clearly synthetic, non-production and safe to publish.

Do not use git add -A blindly.

Inspect every untracked file and determine whether it belongs in the handoff.

Check for credentials in both current files and any new history that would be pushed. Existing local commits containing secrets require a safety stop and a controlled remediation plan, not an accidental push.

If the target repository is public, apply public-repository disclosure standards to all reports and PoCs.

Redact sensitive values while preserving reproducible technical evidence.

Do not fabricate sanitized evidence.

⸻

5. CREATE THE AUTHORITATIVE HANDOFF BRANCH

Preferred branch:

handoff/admin-v1-r2-20261015

The branch must contain the latest legitimate Admin V1 implementation, R1 remediation, R1 certification reports and any actual R2 progress.

Preserve commit ancestry whenever possible.

Do not start a fresh branch from main that excludes the Admin implementation.

Verify that:

* 3e865d0 is recoverable.
* 25140ba is recoverable.
* 0331cc9 is recoverable.
* 95a1425 is recoverable.
* Any subsequent R2 commits remain recoverable.

If the latest implementation is committed:

Create the handoff branch from that verified commit.

If important work is uncommitted:

Preserve it in one or more clearly labeled WIP commits on the handoff branch.

Do not present WIP as finished or reviewed.

Use meaningful commit messages, for example:

docs(admin): preserve R1 certification and project handoff

wip(admin): preserve incomplete R2 isolation changes

docs(admin): add successor onboarding and evidence index

Do not squash, rebase or amend historical implementation/review commits.

⸻

6. MANDATORY HANDOFF DOCUMENTATION

Create:

docs/admin/handoff/

With the following files.

6.1 START_HERE.md

This is the primary entry point for the next agent.

Include:

* Project identity.
* Repository URL and ID.
* Exact Git branch.
* Full handoff HEAD SHA.
* Implementation/review commit SHAs.
* Current implementation status.
* Current security certification status.
* What is complete.
* What remains unfinished.
* What must NOT be done.
* How to run locally.
* How to reproduce tests.
* Where all reports are located.
* Immediate next actions for the successor.
* Explicit prohibition against production operations without authorization.

The successor should understand the project in less than one document-reading session.

6.2 PROJECT_HISTORY.md

Document the complete recoverable Admin Console development history.

Cover:

Phase A — Initial Admin V1

* Original architecture.
* Nine frontend screens.
* Admin API.
* Authentication.
* RBAC.
* Local database.
* Audit.
* Super Admin governance.
* Unit/integration/E2E testing.
* Original implementation commit.

Phase B — Initial Security Review

Describe:

* S1: environment fail-open.
* S2: static asset bypass.
* S3: origin/CSRF boundary problems.
* Migration 0042 deployment deadlock.
* Other security and UI findings.

Explain how findings were reproduced and why remediation was required.

Phase C — R1 Remediation

Describe:

* Dedicated Admin Worker.
* Dedicated ADMIN_DB.
* Customer Worker baseline restoration.
* Removal of Admin migration 0042 from customer ledger.
* Strict environment validation.
* Worker-first asset routing.
* Origin and CSRF isolation.
* Super Admin protection.
* Session/audit hardening.
* Login rate limiting.
* Frontend fixes.
* Regression evidence.

Phase D — R1 Certification

Record:

* Exact reviewed commit.
* 342 test files.
* 7865 passing tests.
* Workerd probes.
* 51 original PoCs.
* Frontend E2E results.
* Flaky E2E behavior.
* Findings F1–F11.
* Why the review result is CHANGES_REQUIRED.

Phase E — R2

Discover actual R2 progress.

If no R2 code has been written, explicitly state:

R2 IMPLEMENTATION NOT STARTED

If R2 is partially implemented, document every change, its location, validation status and remaining work.

Never claim work has been performed unless Git/source evidence supports it.

6.3 CURRENT_ARCHITECTURE.md

Document:

* Customer Worker.
* Admin Worker.
* Customer D1.
* ADMIN_DB.
* Authentication architecture.
* Cloudflare Access contract.
* Admin sessions.
* RBAC.
* Audit.
* Data access boundaries.
* Frontend routing.
* Build and deployment separation.
* Worker configuration files.
* Local execution commands.

Include Mermaid diagrams where useful.

Clearly distinguish current implementation from the proposed R2 architecture.

6.4 SECURITY_FINDINGS.md

Create a full findings table.

Mandatory findings:

F1:
Admin Worker has writable customer D1 binding and reads password hashes.

F2:
Two-Super-Admin deadlock without an adequate recovery ceremony.

F3:
Two-account bootstrap does not guarantee two human operators.

F4:
Approver privileges are not revalidated inside the write transaction.

F5:
Bootstrap is not atomic.

F6:
Account-level authentication throttling can be abused for account lockout.

F7:
Full-table customer database aggregation.

F8:
Flaky keyboard E2E.

F9:
E2E overwrites Git-tracked screenshots.

F10:
Deep-link handling fails for certain identifiers.

F11:
Admin privileges are tied to email rather than a stable verified Access identity.

For every finding include:

* Severity.
* Affected files.
* Root cause.
* Exploitability or operational impact.
* Reproduction steps.
* Existing evidence.
* Proposed remediation.
* Current state.
* Acceptance criteria.

Do not automatically mark findings RESOLVED based on unreviewed code.

6.5 R2_IMPLEMENTATION_PLAN.md

Define the intended R2 architecture and work packages.

Highest priorities:

1. Remove direct customer D1 binding from Admin Worker.
2. Implement an internal read facade through a Service Binding.
3. Use fixed authorized read operations with strict input/output schemas.
4. Eliminate password_hash exposure to Admin.
5. Implement Super Admin break-glass governance.
6. Bind administrator identity to verified Cloudflare Access issuer and subject.
7. Ensure two-person authorization represents independently approved human operators.
8. Make approval and bootstrap operations atomic.
9. Resolve the remaining P2 findings.

Define the acceptance tests for each package.

Do not implement new R2 work during this emergency handoff unless needed to preserve already existing changes.

6.6 TEST_AND_EVIDENCE.md

Document exact previously observed test results with source attribution.

R1 certification report stated:

* Full suite: 342 files / 7865 tests PASS.
* Lint/typecheck/build: PASS.
* Migration and rollback matrix: 11/11.
* Original workerd assertions: 108/108.
* Independent runtime probes: 1169/1169.
* E2E: 11/12, with the keyboard test flaky.
* Original 51 PoCs: detailed matrix required.

Explicitly state these are historical results, not a fresh execution during handoff unless actually rerun.

Include the exact test commands, fixtures, prerequisites, relevant evidence paths, and known limitations.

Preserve all existing detailed PoC matrices and regression reports.

Do not change test expectations to create a passing report.

6.7 LOCAL_RUNBOOK.md

Document how another agent can start the system from a clean clone.

Include:

* Required Node/pnpm versions.
* Dependency installation.
* Local environment configuration.
* Local Admin Worker startup.
* Local customer Worker startup.
* Local D1/ADMIN_DB initialization.
* Safe synthetic fixture generation.
* Local Admin bootstrap.
* Frontend preview.
* Unit tests.
* Security tests.
* Browser E2E.
* Workerd probes.
* Migration smoke.
* Common errors and troubleshooting.

Do not include real credentials.

6.8 PRODUCTION_BLOCKERS.md

List everything that still blocks staging or production:

* R2 findings.
* Independent security review.
* Cloudflare Access live verification.
* Production Super Admin bootstrap and recovery process.
* Real Cloudflare binding identity verification.
* Dedicated Admin CI and deployment workflow.
* Data isolation certification.
* Staging E2E.
* Production authorization and rollback approval.

Keep:

STAGING_NOT_CERTIFIED

PRODUCTION_NOT_CERTIFIED

6.9 SESSION_HANDOFF.md

Write a detailed account of this agent’s recoverable work sessions.

Include:

* Significant user instructions.
* Technical decisions.
* Major implementation steps.
* Errors encountered.
* What was tested.
* What was reverted.
* Why each important decision was made.
* Current unresolved uncertainties.
* Planned next actions.

If actual chat/session transcripts are accessible through an authorized export, preserve only relevant sanitized extracts.

If transcripts are not accessible, reconstruct from available commit history and reports.

Clearly label reconstruction versus exact source evidence.

Never invent missing conversations or test outcomes.

6.10 FILE_MANIFEST.md

List all significant Admin-related files and their purposes.

Include implementation source, tests, configuration, migrations, docs, fixtures, scripts and evidence.

Identify the precise commit introducing or changing each critical component when possible.

⸻

7. PRESERVE ACTUAL SOURCE AND EVIDENCE

The handoff must include the code, not just documentation.

Verify that the handoff branch contains:

* src/admin/
* Admin backend routes.
* Authentication and RBAC code.
* Admin database migrations.
* Admin Wrangler configuration.
* Admin bootstrap scripts.
* Admin test suites.
* Local fixtures.
* Workerd probes.
* E2E tests.
* Relevant screenshots.
* Security reports.
* R1 remediation reports.
* R1 certification reports.
* R2 work, if any.

Do not commit:

* node_modules/
* Local databases with private data.
* Unnecessary build caches.
* Credential files.
* Temporary secrets.
* Large redundant generated files.

If essential evidence is too large or cannot safely be committed, create a manifest identifying what is missing and why.

Do not claim a complete handoff when essential source or evidence has been omitted.

⸻

8. VERIFY BEFORE PUSH

Perform a lightweight but meaningful pre-push verification.

Required:

1. Correct repository identity.
2. Correct target remote.
3. Expected commits reachable.
4. Working tree state documented.
5. No unintentional customer runtime changes.
6. No secrets in files being published.
7. No unsafe remote workflows triggered by branch push.
8. Handoff documentation references correct SHAs.
9. Git diff contains no accidental destructive changes.
10. Git integrity check passes.

Run:

git diff --check
git status --short
git log --oneline --decorate -15

A full 7865-test rerun is not required solely for this handoff if execution budget is limited.

Prioritize preserving existing evidence.

If source changes remain untested, mark them explicitly as UNVERIFIED/WIP.

⸻

9. PUSH TO GITHUB

Once safety checks pass, publish the dedicated handoff branch to the verified repository.

Target:

handoff/admin-v1-r2-20261015

Use a normal non-force push with upstream tracking.

Do not push to main.

Do not publish temporary secrets or raw production evidence.

After push:

* Verify the remote branch exists.
* Verify its HEAD SHA matches the local handoff commit.
* Verify the expected implementation and report commits are reachable from that remote branch.
* Verify the primary handoff documentation exists on GitHub.
* Confirm no protected branch was modified.

If permissions allow, create a DRAFT PR targeting main.

Suggested title:

[HANDOFF / DO NOT MERGE] Takosan Admin Console V1 + R1 + R2 continuation

The PR must clearly state:

* Work in progress.
* Security findings remain open.
* Not approved for production.
* Do not merge.
* Do not deploy.
* Independent review required.
* R2 remediation incomplete unless proven otherwise.

A Draft PR is useful for discoverability, but the pushed source branch is the primary deliverable.

If creating a Draft PR would trigger an unsafe workflow, skip it and report why.

⸻

10. HANDOFF SUCCESS VERIFICATION

Do not report success merely because git push returned exit code 0.

Verify from GitHub:

* Repository identity.
* Branch name.
* Remote HEAD SHA.
* Presence of Admin source files.
* Presence of reports.
* Presence of tests.
* Presence of successor documentation.
* Reachability of relevant implementation commits.

Return links for:

1. Handoff branch.
2. START_HERE.md.
3. SECURITY_FINDINGS.md.
4. R2_IMPLEMENTATION_PLAN.md.
5. LOCAL_RUNBOOK.md.
6. Draft PR, if created.

Never invent links.

⸻

11. FINAL HANDOFF RECEIPT

Produce the following receipt in your final response:

TAKOSAN_ADMIN_HANDOFF_RECEIPT
STATUS =
HANDOFF_PUSHED_UNREVIEWED
or
HANDOFF_PARTIAL
or
HANDOFF_BLOCKED
REPOSITORY_ID =
REPOSITORY =
REMOTE_BRANCH =
REMOTE_HEAD_SHA =
LOCAL_SOURCE_SHA =
ORIGINAL_ADMIN_SHA =
R1_REMEDIATION_SHA =
R1_EVIDENCE_SHA =
R1_CERTIFICATION_SHA =
R2_STATUS =
R2_WORK_PRESERVED =
SOURCE_FILES_INCLUDED =
TEST_FILES_INCLUDED =
REPORTS_INCLUDED =
EVIDENCE_INCLUDED =
SECRET_SCAN =
REMOTE_SHA_VERIFIED =
CUSTOMER_RUNTIME_UNCHANGED =
WORKFLOW_SAFETY_VERIFIED =
DRAFT_PR_URL =
OUTSTANDING_P0 =
OUTSTANDING_P1 =
OUTSTANDING_P2 =
STAGING_STATUS = NOT_CERTIFIED
PRODUCTION_STATUS = NOT_CERTIFIED
SUCCESSOR_START_HERE =
SUCCESSOR_NEXT_TASK =

Provide actual values and links.

Do not claim a test or source verification happened unless it actually happened.

⸻

12. EXECUTION PRIORITY IF CREDIT RUNS OUT

If you cannot complete everything, execute in this order:

P0 — Preserve actual source

Locate the latest code, preserve uncommitted work, verify remote identity, prevent secret leaks, push the safe handoff branch.

P1 — Preserve reports

Commit R1 certification, existing remediation reports, evidence indexes and unresolved findings.

P2 — Create START_HERE.md

Include exact SHA, current status, blockers and next instructions.

P3 — Expand documentation

Complete architecture, runbook, history, PoCs and implementation plan.

P4 — Create Draft PR

Only if safe, time and permissions permit.

Do not spend remaining execution budget rerunning long test suites if that would prevent source preservation.

If remote publication is blocked, produce a local Git bundle and a recovery manifest as a fallback. Report its exact location; do not imply GitHub handoff succeeded.

⸻

FINAL INSTRUCTION

STOP DEVELOPMENT NOW. SWITCH TO HANDOFF MODE.

Preserve every recoverable piece of Takosan Admin V1, R1 and R2 work.

Publish everything safe and relevant to a dedicated GitHub handoff branch.

Produce detailed, truthful, reproducible handoff documentation.

Verify that another agent can continue from the published source.

Do not merge, deploy or modify production.

Your task is complete only when the successor has an identifiable source commit, a documented starting point, and an accurate list of unresolved work.