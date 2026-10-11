# Scan V3 offline dataset and evaluator

Status: SCORER_CANDIDATE / TEST_ONLY. No image corpus or provider certificate.

The strict executable contracts are `ScanV3DatasetSchema` and
`ScanV3PredictionsSchema` in `scripts/scan-v3-scoring.ts`, importing the actual
candidate `ScanV3Schema`. The two JSON schemas document metadata for annotation
editors. The annotation JSON schema intentionally delegates semantic Scan V3
validation to the executable schema; metadata-only validation cannot accept labels.

`manifest.candidate.json` and the matching fixtures contain nine symbolic synthetic
cases. Hashes identify fixture symbols, not image bytes. Missing license, permission,
human transcript/reviewer and adjudication are explicitly MISSING. Synthetic labels
are TEST_ONLY and cannot count toward the 240-original-asset pilot or heldout gates.

Run from repository root:

```sh
node scripts/scan-v3-eval.mjs --dataset tests/fixtures/scan-v3/dataset.json --predictions tests/fixtures/scan-v3/predictions.json --dry-run
```

The tool only reads local JSON/source files, scores supplied outputs, and optionally
writes a report with `--output`. It does not read provider credentials or invoke a
provider. `--live` fails with exit 2 before reading input. Default mode is offline.
Input files and evaluator/dependency sources receive SHA256 receipts. Reports have
no timestamp so the same inputs and command produce identical bytes.

All dataset cases remain in the denominator, including omitted submissions,
timeouts, malformed output and provider errors. First/final schema pass and usable
success are separate. Usable success follows the candidate assessment (USABLE or CONFIRMABLE); this evaluation
classification grants no inventory authority. Occurrences match source position
and one-to-one ordinal within a position, preserving identical purchases. Known values are
compared exactly: amount plus currency, and quantity amount plus unit plus basis.
Name character error is separate from semantic field scoring. Canonical precision
and coverage do not confer runtime ingredient authority.

UNKNOWN hallucination is known assertion over truth-unknown slots. Slot Wilson
intervals are descriptive because fields correlate. Document-level intervals and
unique document counts are reported separately; missing predictions cannot erase
unknown denominators. No finite sample establishes zero production risk. Latency
reports queue/provider/end-to-end sample counts separately. Costs include all
primary/repair/retry/shadow attempts and report supplied ESTIMATED/BILLED provenance.
Missing job cost evidence, unknown attempt cost or zero usable successes makes cost per 100 successes NOT_COMPUTABLE.

For real assets, assemble 60 VN receipts, 60 JP receipts, 60 labels and 60 fridge
images across clean/blur/tilt/low-light/missing-field slices. Original document,
source group and original asset hash each fence splits; variants of one document
must remain together. Require permitted source provenance, actual original and
preprocessing hashes, access/retention/redaction review, independent labels and
adjudication. Record review minutes, rework and disagreements. Final statistical
sample size, coverage floors, quality targets and paid budget must be fixed before
heldout/provider execution. This evaluator always returns NOT_CERTIFIED; a future
separately reviewed certificate consumes evidence rather than accepting a flag.
