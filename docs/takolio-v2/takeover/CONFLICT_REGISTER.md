# Conflict register and integration strategy

1. Root/AI handoff and state documents have main Admin and Argon culinary histories.
   Keep main history; prepend actual takeover checkpoint. Do not copy older whole files.
2. Source paths for selected UI have no main-side changes after the merge base.
   Explicit reviewed paths were ported from the snapshot after the main runtime baseline; final scope audit passes.
3. `src/web/main.tsx` dev SW cleanup remains in original/snapshot only: unnecessary
   runtime cache mutation outside A01/S08 and culinary presentation scope.
4. Historical S08 verification/plan status disagree. Preserve evidence and mark
   it historical; fresh local tests do not grant owner visual approval.
5. Payment, Admin, Worker, packages/domain, services/stores, migrations, auth,
   Cloudflare, CI, config and dependencies retain main bytes. Any needed protected
   fix requires a separate authorized task; no such change is selected.

No blind tree copy or blanket cherry-pick. Reuse existing components, SVG geometry,
mascot and resolver assets. New artwork only if an actual missing/weak asset is
shown by runtime review. No concept image crops.
