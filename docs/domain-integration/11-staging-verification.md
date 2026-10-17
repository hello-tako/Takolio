# Staging Verification

| Check | Result | Evidence or blocker |
| --- | --- | --- |
| Isolated D1/KV/R2/Queue IDs | PASS locally | Snapshot comparison rejects production overlap |
| Typed bindings and compatibility | PASS locally | Candidate checks AI, Assets, Send Email, storage, vars and runtime settings |
| `staging.takolio.app` TLS/HTTP | BLOCKED | No DNS/custom domain; not live |
| `api-staging.takolio.app` API boundary | BLOCKED | No DNS/custom domain; not live |
| Cloudflare Access protection | BLOCKED | 3 existing unrelated Access apps; none covers Takolio staging |
| Google GIS | NOT RUN | Need restricted test client/console and live host |
| OTP inbox | NOT RUN | Need approved test inbox/provider isolation |
| PayOS sandbox | NOT RUN | Need verified sandbox credentials and explicit operator authorization |
| PWA/mobile/browser matrix | PARTIAL local | Mobile/desktop synthetic planner + nested refresh; new-origin install/offline/provider tests NOT RUN |
| Full repository suite | PASS before final review fixes | 367 files / 8,496 tests; final 86 focused PASS, hosted CI pending |

The prepared staging configuration is a local dry-run only. Do not claim `DOMAIN_STAGING_VERIFIED` until custom-domain DNS/TLS, Access/isolation, auth, OTP, sandbox PayOS and browser regression evidence exist. Existing workers.dev staging remains the only live staging host.
