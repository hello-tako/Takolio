# Main versus local matrix

| Source | Identity | Decision |
|---|---|---|
| GitHub `main` | `0322a9197bee4a4a42d95cc150f8d4fff6d53ba8` | Authority for protected backend, Admin, auth, data, config and dependencies |
| Argon WIP | `5db70a578764ccdb9ad458a21833fec5b6c04741` plus dirty/untracked work | Preserve in private backup; port reviewed UI/assets/tests selectively |
| Integration | `codex/takolio-v2-rescue` from fresh main | Reviewable continuation containing the selected culinary/UI changes |

Protected-main audit: 5,842 unchanged tracked paths outside the explicit allowlist; no blind tree copy or destructive history operation.
