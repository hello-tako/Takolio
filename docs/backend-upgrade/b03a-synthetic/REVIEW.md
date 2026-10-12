# Local implementation review

The release surface is offline tooling and test fixtures. Product source,
40 migration files, package/lock, provider flags and production bindings are
protected. SYNTHETIC_IMAGE extends only the evaluator metadata enum; all new
labels remain TEST_ONLY and reports retain NOT_CERTIFIED blockers.

Ground truth is generated independently of OCR. Missing receipt/label facts are
UNKNOWN, duplicate purchases retain distinct occurrences, VND/JPY is explicit.
Fridge drawings are marked illustrations, quantities and covered contents unknown.
Rotated visual boxes are recomputed for final image coordinates. OCR operates on
actual hash-checked files and never reads expected text. Region hints are template
segmentation; the report labels this limitation instead of product accuracy.

The scorer does not reuse one observation across occurrences, retains missing text
in expected-field denominators, rejects hash/matrix/engine/latency/coordinate drift,
and cannot claim fridge semantics. The browser uses actual native decoding/canvas
with existing preprocessing and requires loopback-only requests. Intercepted
provider responses are transport/schema fixtures, not OCR measurements.

Discovery failures: the initial test assumed a nested certification output instead
of the actual string; four adapter tests supplied null to strict legacy V1.
They now test valid transport separately from explicit UNKNOWN rejection.
Three TypeScript Buffer typing errors were corrected with Buffer.from; no runtime
or old assertions were weakened. Raw first-failure logs remain in ignored evidence.
No human, subagent, hosted or independent release review is claimed.

Measured issue: current browser JPEG processing reduces VN receipt region-text
accuracy on this synthetic template; full results preserve that paired loss.
This is grounds for a separate preprocessing comparison on real permitted images,
not automatic authority to change runtime quality/cap from a local template.

Rollback: stop using these new offline tools; old receipt/evaluator tools continue
to accept their original corpus. No data writes or coordinated deployment required.
