# Performance report

No production reader or runtime payload changed. No performance claim is made.

The audit loads the existing Vite runtime catalog once, reads the 500 V2 JSON
files, and writes bounded text/JSON/CSV artifacts. The command is local and
deterministic. A future runtime promotion must measure catalog load, recipe
detail payload, D1 reads, worker CPU/memory, planner projection, shopping
aggregation, cooking response size, and offline hydration against a recorded
V1 baseline.
