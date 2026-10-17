# Domain activation preparation

This change unblocks complete read-only infrastructure capture and supplies a
reviewable hostname operation primitive. It does not activate a deployment path.
The default Deploy workflow continues to consume its legacy Wrangler configs.

## Verified checkpoint

PR #3 merged as `0de18ff90963ae84dbaa4dc16eb0257a250510d1`; merge CI runs
39025377241 and 39025377368 passed. Read-only staging audit 39026886923 failed
safely on paginated deployment history. The fix requests 100 records per page,
reads at most 100 pages and rejects changing metadata, partial counts and duplicate
IDs. Other incomplete inventories continue to block evidence production.

Production Google origin `https://takolio.app` is saved. Separate staging client
`Takolio Staging Web` has only `https://staging.takolio.app`, no redirect URI and
public ID `509963441971-c8ij1hv901p0fsljhd2ur1qc4t63432g.apps.googleusercontent.com`.
Provider configuration does not certify real login; staging still needs its
runtime binding and a successful real browser flow.

Cloudflare Access application `Takolio Staging Access` (ID
`bd0bae35-56b4-4766-a3b5-9de378ba93ad`) now protects both new staging hosts
and the production/preview URLs of Worker `frigo-staging`. Policy
`Takolio staging approved tester` (ID `814bebea-4fcf-4582-88ea-d21fd12d153c`)
has one exact-email Allow rule for the privately recorded owner-approved inbox,
with a 24-hour session. The owner confirmed this security change before creation.
An unauthenticated HTTPS request to the existing Worker returns HTTP 302 to
Cloudflare Access. Both new staging hosts are still unreachable; this Access
configuration does not attach domains or provision DNS. A local read-only
Wrangler-OAuth diagnostic read real deployment history with the new code, then
stopped on DNS-read scope (HTTP 403 / code 10000). Scoped Environment-token audit
remains required; no complete cloud-audit PASS is claimed.

## Domain ownership and rollback

Pinned Wrangler 4.149.0 publishes custom domains with `replace_state=true` and
`override_scope:true`; unattended execution can also override existing origins
and DNS. A config listing only Takolio hosts cannot prove preservation of the
existing legacy hostname. Do not send the generated candidate's routes through
that bulk reconciler for first activation.

`scripts/domain/hosts.mjs` is deliberately an I/O-injected primitive. A reviewed
caller must supply complete account domains, current zone DNS/routes, a fresh
release gate, per-host API operations and durable receipt persistence. The gate
must prove the exact deployed fenced SHA/version and recheck the canonical
current main and normal environment approval before every mutation. A regex
identity check inside this primitive is not live release certification.

Only absent profile hostnames can be added. Every intent is persisted before the
API call and every successful returned ID before the next operation. Full
projected account inventory is compared after each mutation. A timeout or an
uncertain ownership result stops without retries. The operator must reconcile
uncertain outcomes against the durable receipt before continuing.

Rollback removes created hosts in reverse order, checking each exact ID,
hostname, zone, Worker, environment and exposure settings against both the receipt
and full current inventory. A pre-existing correct attachment is never owned by
the run and cannot be removed. Detach completes before reverting to a Worker
without the domain host fence. No DNS zone, legacy attachment, schema or data
rollback is performed by this primitive.

## Remaining integration gates

- Merge with fresh independent human approval and successful exact-head checks;
  run the audited code on canonical main through scoped Environment credentials.
- Capture complete runtime, flags, bindings, schedules, consumers/DLQ,
  observability, exposure, domain and migration state. Stop on unknown drift.
- Preserve the verified Cloudflare Access policy while enabling authenticated
  automated release proofs through reviewed credentials and application-scoped
  policy. No broad public or authentication bypass rule is permitted.
- Implement the explicit opt-in Deploy adapter that binds audit/config hashes to
  the immutable release manifest, preserves all existing release authority and
  recovery checks, uploads fenced code before attaching hosts, and rolls back
  only attachments proven to belong to that run.
- Configure reviewed staging Google/email bindings, restrict email to the
  owner-approved inbox, prove real Google login/OTP and separate PayOS sandbox
  behavior. No real payment is authorized.
- Prove TLS/host boundaries, sessions/CORS, PWA, critical flows and rollback on
  staging. Then require the independent production Environment approval, deploy
  the same accepted release and observe for at least 15 minutes.

Local focused checks: 17/17 tests, targeted ESLint, both TypeScript checks and
whitespace checks pass. No live hostname operation or Worker application deploy
was run. Status remains `DOMAIN_IMPLEMENTED_LOCAL_VERIFIED`.
