# Nutrition evidence policy

Nutrition is version-bound and per-serving. A publishable profile requires
complete certified nutrients, an evidence reference for the ingredient basis,
an edible portion/yield basis, and no unresolved quantity or absorption blocker.

Allowed states:

- `REPORTED_BY_SOURCE`
- `CALCULATED_WITH_EVIDENCE`
- `ESTIMATED_UNCERTAIN`
- `NOT_AVAILABLE`
- `BLOCKED`

Current V2 counts are 1 publishable, 288 blocked, and 211 truthful null.
Blocked or null values remain null in runtime. Oil absorption, cooking yield,
package mass, and qualitative amounts are not silently estimated.
