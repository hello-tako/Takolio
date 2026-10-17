# DNS and TLS Plan

Use Worker Custom Domains on the existing combined Workers. Default Wrangler files remain unchanged; only local generated candidates contain new routes.

1. Verify staging data, sandbox provider credentials and Access coverage before connecting `staging.takolio.app` and `api-staging.takolio.app` to `frigo-staging`.
2. After staging acceptance and explicit production approval, connect `takolio.app`, `www.takolio.app` and `api.takolio.app` to `frigo` through the reviewed deployment mechanism.
3. Preserve the legacy route and existing resources; leave `admin.takolio.app` unconfigured.
4. Verify Cloudflare-managed DNS records, domain ownership, certificate issuance and conflicts for every attachment. Do not add arbitrary A records.

Universal SSL is Active, but all five new hosts currently fail HTTP probes because no DNS/custom-domain connection exists. Live TLS handshake, certificate chain, mixed content and 525/526 checks are NOT RUN on new hosts. The .app TLD requires working HTTPS; do not bypass certificate validation.

The activated application intentionally emits one-year HSTS without includeSubDomains/preload, for new hosts during this migration, while preserving the previous strict response header on legacy hosts. This limits new app policy to the serving host while subdomains remain unaudited; browser-cached earlier policies may persist. Edge HSTS is UNKNOWN. No edge HSTS/preload setting was changed. Review any final policy tightening separately.

Rollback must restore the previous Worker and recorded route/domain snapshot together. The old Worker does not implement new host boundaries, so restoring its code alone is insufficient. See `13-rollback-runbook.md`; never delete the zone or unrelated DNS records.
