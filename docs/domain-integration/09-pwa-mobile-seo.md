# PWA, Mobile and SEO

## PWA

Manifest and service-worker paths are root-relative and origin-scoped. A new domain creates a separate service-worker registration and browser storage; users sign in again. Candidate routing runs before assets and keeps build-ID cache cleanup; it does not purge user data. Installability, offline behavior, nested refresh and external provider requests on new hosts are NOT RUN.

## Mobile

`/.well-known/assetlinks.json` and `/.well-known/apple-app-site-association` return 404 until package name, Android signing fingerprint, Apple Team ID, bundle ID and supported paths are supplied and verified. Status: `MOBILE_ASSOCIATION_PENDING`.

## SEO

Production apex responses receive canonical/OG/Twitter metadata, a landing-only sitemap and robots rules for API/auth/account paths. Nested app pages and legacy responses are noindex. Staging is noindex and `robots.txt` disallows all. WWW document redirects are safe 308s; legacy documents are not redirected. New-host TLS/HTTP/social preview/browser verification is blocked by absent DNS/custom domains.
