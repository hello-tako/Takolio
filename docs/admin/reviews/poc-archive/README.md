# Archived review PoCs (not executed by `pnpm test`)

These are the 2026-10-12 review PoCs (51 assertions across 7 files plus harnesses), archived as `*.ts.txt`
so Vitest does not collect them from the repository tree. They are unmodified copies of the files used in
the reviews, except that the `adapter-25140ba/` set is the adapter run used for the R1 regression check.

- `original-3e865d0/`: run against the original implementation (`3e865d0`); each defect PoC asserts the defect.
- `adapter-25140ba/`: run against R1 (`25140ba`) through `harness.ts`; expected results are in
  `../r1-certification/evidence/poc-original-vs-remediated.summary.txt` (or `poc-after.json`).

## Restore and run

The PoCs import repository modules with three `../` segments, so restore them three levels below the root:

```sh
mkdir -p .hoplite/artifacts/review-poc
for f in docs/admin/reviews/poc-archive/original-3e865d0/*.txt; do cp "$f" ".hoplite/artifacts/review-poc/$(basename "$f" .txt)"; done
pnpm exec vitest run .hoplite/artifacts/review-poc/ --silent
```

Use `adapter-25140ba/` and `.hoplite/artifacts/review-poc-r1/` for the adapter run. Restored copies stay in
the git-ignored `.hoplite/artifacts/` tree and must not be re-committed.
