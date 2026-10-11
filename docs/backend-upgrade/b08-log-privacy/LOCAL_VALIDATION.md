# Final local checks and retained failures

Implementation:41da180a941b348c6385895628b2bdd61b666763.
Exact commands, environment, timestamps, clean-source receipts, raw byte hashes and
all15 observed receipt-runner logs are in validation.json and logs/.
Node24 /pnpm10.33.2; CI=true, NODE_OPTIONS=--no-experimental-webstorage,
WRANGLER_SEND_METRICS=false; remote check flags unset.

| Check | Actual outcome |
| --- | --- |
| First focused9files |130tests PASS |
| First lint |PASS |
| First typecheck |FAIL TS7006, new test arg implicit any |
| Focused recovery9files |132tests PASS after two media descriptor regressions |
| Typecheck recovery |PASS after unknown callback annotation |
| Clean committed full suite |312files/7523tests PASS;134.956s command |
| Final frozen install/lint/types |PASS, exact committed implementation and clean before/after |
| Final40-migration smoke |PASS; no new/schema/remote migration |
| Sequential build |PASS;7.953s command, GIT_COMMIT=actual implementation |
| Full audit |FAIL/exit1,1high0critical0moderate0low |
| Production audit |PASS,0 findings |
| Pinned implementation scan |FAIL/exit1 retained; SG849/849/0errors/0findings, GL17, zizmor2HIGH, Syft518 |
| First private reconciliation |FAIL digest ordering assertion; bounded actual receipt preserved |
| Corrected exact scan reconciliation |PASS byte-sorted4511 snapshot/current files, all17 provenance unchanged |
| CSS/protected-surface check |134861bytes byte-identical; source/config/package/workflow/assets unchanged |
| Bounded export privacy review |38 exact inputs,15 command/log pairs,8 selected inputs;0 issues/0 overlaps |

New tests add60 cases to the parent7463. They exercise real route/status/data failure
behavior plus cleanup/shadow/media privacy boundaries; they do not certify all41
catch permutations or platform-owned invocation capture. Independent inventory
has87 direct producer records and42 caller proof inputs. Existing applied cleanup
SQL, catalog/scheduler/throttle semantics, payment/auth business logic and prior
source evidence stay protected. Frozen/source proofs use NUL-delimited Git traversal
and verify file bytes/executable modes without quoting Unicode filenames.

Final packet export/verification is reproducible with Python3. Raw secret/SAST/
workflow/SBOM reports and private source pointers stay ignored. Final-documentation
scan and postcommit verifier results are saved privately after the receipt commit;
no repeated export is used to relabel earlier scan evidence as a newer SHA.
