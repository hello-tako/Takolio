# ADR-FINAL-LOCAL-001 - Close available security and compiler work

Accepted for local implementation, 2026-10-12 JST; production acceptance remains.
Supersedes the Tailwind3 preservation choice of ADR-B08-LOCAL-001 for this packet.

Registry evidence confirms Tailwind4.3.3 stable; braces remains3.0.3 with no patched
published range and Tailwind3.4.19 remains the newest3release. The existing depth
mitigation stays in rollback history; masking/renumbering an advisory is rejected.
Adopt the official Tailwind4/PostCSS4.3.3 owner graph only after deliberate theme,
source, layer/default and actual browser compatibility corrections. Preserve
React18/Vite6 and all backend semantics. Native-layer changes require selective
presentation fixes and reviewed comparisons; no global layer flattening.

Official compiler browser floor is Safari16.4/Chrome111/Firefox128. This local
migration targets maintained engines at/above that floor. It does not establish
support on all existing devices; lower-device acceptance remains an explicit
release question. New compiler installation/browser errors stay visible.

For deploy steps, upgrade only the two artifact-producing jobs to pinned official
setup-node6commit249970729cb0ef3589644e2896645e5dc5ba9c38, whose action metadata
supports package-manager-cache:false. Keep cache:'' too. Existing setup-node4
metadata does not expose this option, so inserting it under v4 would be unsupported.
No release authority/gates or online workflow dispatch changes. The action uses
Node24 runner runtime; application/tooling target remains Node22 where configured.
Local YAML/tests/scanners cannot certify hosted runner compatibility.

Rollback restores the prior reviewed compiler artifact and fixed-depth mitigation;
retain durable data/schema/queues and paired UI/server flags. No migration or
provider activation is part of either change. Full audit/scanners must bind the
new source; real/human/provider/hosted certificates retain their independent scope.

Compiler compatibility choice: retain the existing single JS theme authority via
official @config support instead of duplicating it as CSS. Native @theme owns
only explicit v3 default compatibility values. The utilities are emitted through
the official top-level @tailwind utilities directive at their existing author
precedence; imported kitchen rules retain their original source order. Preflight
and existing custom base/utility layers remain native layers. No post-build layer
flattening, blanket !important or source rename hides a visual difference. Use
explicit v3 spacing-child selectors and defaults where measured behavior changes.
