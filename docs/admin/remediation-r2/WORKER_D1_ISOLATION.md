# Worker and D1 isolation

Provenance/proof status: REPORT.md and SOURCE_MANIFEST.md.

Admin configs bind only ADMIN_DB and an internal CUSTOMER_READ service.
The dedicated facade configs alone bind customer DB. The customer Worker and
its configs are not modified. Local state seeding selects the appropriate
config explicitly, without adding a customer binding back to the Admin Worker.

The facade must reject public HTTP requests, unknown operations, arbitrary SQL,
malformed/over-limit inputs, credential-field outputs and production local-login
calls. Admin read services merge ADMIN_DB-owned metadata on the Admin side;
ADMIN_DB is never passed into the facade. Credential-change invalidation uses
an opaque facade-computed account-state value, never credential columns in the
Admin Worker. Customer auth/schema modifications remain unauthorized.

Required current-source proof includes static configuration checks, every named
operation's adversarial unit/integration tests, customer write capture, real
multi-Worker workerd and a browser session. See REGRESSION.md for actual runs;
an architectural statement above alone is not proof that a check passed.
