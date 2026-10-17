# Security Review

## Local controls

- Domain activation requires exact environment, APP_URL and `PUBLIC_DOMAIN_ROUTING=true`; invalid configuration returns sanitized 503.
- Host and redirect targets use exact configured origins; `Host`, `X-Forwarded-Host`, `Origin` and `Referer` cannot rewrite them.
- WWW redirects only safe document GET/HEAD requests. API, webhook, auth and mutating requests do not redirect.
- API host rejects static/SPA fallback; Admin and `.well-known` paths are 404.
- CORS/CSRF share exact trusted origins, credentials stay enabled without wildcard origin, and `Vary: Origin` is retained.
- Cookies remain host-only. No sibling-domain cookie expansion was introduced.
- Generated candidates run the Worker before assets and remove stale HTML validators before metadata rewriting.
- Supported bindings are captured without secret values; unknown types and fields fail closed.
- Domain-enabled responses intentionally use `Strict-Transport-Security: max-age=31536000` without subdomains/preload while unaudited new subdomains are being evaluated. Legacy hosts retain the existing two-year includeSubDomains/preload header. This is a documented policy decision; edge HSTS setting remains UNKNOWN and was not changed.

## External controls not certified

Cloudflare custom domains/DNS, live TLS, Access for Takolio staging, Google GIS live sign-in, OTP inbox delivery, PayOS sandbox/provider registration, mobile association payloads and broad browser journeys are NOT RUN. Cloudflare WAF custom/rate-limit rules are empty on the observed surface. These are release blockers, not local test failures.

No source-level finding remains after the binding-inventory and SHA-cleanliness fixes. Independent review still must recheck the final branch head. Production mutation remains explicitly gated.
