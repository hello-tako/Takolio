# Scan V3 evaluation receipt template

Classification: TEST_ONLY / MANIFEST_READY / SCORER_CODE_COMPLETE / DATASET_CERTIFIED
(future independent evidence review). Never infer a certificate from fixture PASS.

Record dataset version and original document count, manifest/file/input hashes,
evaluator source hashes, exact command and environment. Report each task/locale/
quality slice with schema first/final denominators, usable successes, occurrence
recall/precision, quantity amount/unit/basis correctness, Money currency+amount,
canonical accepted precision/coverage and name text error. Report timeout, missing,
malformed and abstention counts rather than excluding them.

Report UNKNOWN asserted-known count/slots, original documents and 95% uncertainty;
slot fields are correlated. Record latency sample denominators, queue/provider/
end-to-end p50/p95, all attempt costs and estimated/billed/unknown pricing evidence.
Zero successes or unknown usage => NOT_COMPUTABLE. Preserve report bytes/hash.

List actual license/redaction/retention/access/human-label/adjudication evidence,
pilot throughput/disagreement/rework, sample-size/coverage preregistration and
budget owner/calls/tokens/spend ceilings. Leave missing evidence MISSING. Review
and certify these separately; a synthetic score never clears these gates.
