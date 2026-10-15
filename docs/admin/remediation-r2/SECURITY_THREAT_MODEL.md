# R2 threat model

Source/proof status: REPORT.md and SOURCE_MANIFEST.md. No independent PASS.

## Protected assets and trust boundaries

Customer D1 integrity and credentials, ADMIN_DB authority, operator identity,
PII and audit persistence are protected independently. Customer cookies and
email addresses are not administrator authority. Access verifies a signature,
issuer, audience, lifetime and human subject; a service token is not a human.

An Admin Worker compromise must not acquire customer D1 write capability or
credential columns. The internal facade can read customer data and physically
holds a writable D1 binding. A compromise of the facade itself can therefore
write D1: service bindings do not remove that residual infrastructure capability.
No facade mutation API or arbitrary SQL operation is exposed. Cloudflare account
administrators remain privileged and require separate operational controls.

## Governance assumptions

Distinct Access subjects are necessary but cannot prove distinct people.
Approved enrollment records must be established outside the application through
an independently reviewed ceremony. A caller-supplied operator ID, approval
boolean or signature-verifier stub is not a production approval.
Recovery is offline only and requires two independent enrolled signing keys
bound to the exact action, source/database identity and expiry. Audit failure
must roll back every authority mutation, not permit a partial recovery.

## Remaining external proof

Real tenant Access claims, identity reassignment/rotation, logout, enrollment
ceremony, protected operator-key custody, deployed binding/route inspection and
independent review are separately authorized staging/release gates. Local
synthetic identities do not establish those operational facts.
