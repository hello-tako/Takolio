# Root review: local mitigation and candidate rejection

No separate agent review is claimed in this packet. The root inspected the exact
pnpm diff, five upstream library files, installed consumer paths, original source
integrity, differential results, requested/captured route identities and six
local screenshots. Existing immutable parent reviews are not reused as approval
of this patch. Independent hosted/release review remains required.

The fixed128 bound counts all parser containers before allocating the next AST
node. Escapes, quoted/bracket literals stay on their original iterative branches.
Parser-generated containers have depth<=128; child leaf depth129 does not recurse.
compile/expand/stringify also reject ordinary programmatic child-chain depth>128.
Direct lib imports retain these checks. Caller options cannot disable the bound.

All shallow upstream behavior is compared through756 method/pattern/option vectors,
including the exact128 boundary, numeric ranges, invalid/quoted/escaped patterns.
The installed chokidar and micromatch paths resolve the same patched braces owner.
The patch changes only5lib files; package identity/dependencies/license stay intact.
Pnpm patch hash is content-bound in the lock; no resolution version is refreshed.

The known string pattern does not exhaust default Node24's stack on this host.
The first control failed its assumption and is retained. A separate explicitly
512KiB-stack child reproduces6/6 unpatched walker exhaustion cases; both default
and constrained children produce12/12 controlled patched rejections. AST depth
regressions are tested independently. Never present constrained-stack evidence
as a default/hosted crash, or this as all-resource-exhaustion protection.

Residual scope: AST getters/malformed parent graphs, expansion combinatorics,
other CPU/memory exhaustion, programmatic mutation of dependency internals and
future upstream changes are outside this patch. No application request accepts
untrusted glob patterns in the affected build-owner chain. The high published
advisory remains reported by audit; no version spoofing/ignore/waiver is added.

Tailwind4 native layers and defaults have actual visible regressions in the
minimal candidate. Zero audits/build success do not authorize its promotion.
Baseline recovery controls distinguish source-compiler changes from unsettled
DOM/image/hover effects; original failed control and route-fallback probe remain
retained with their limitations. Corrected final26pairs use actual routes and
report zero page errors, forbidden API writes and baseline control drift.

The first full run fails2files/11 assertions because this new receipt helper did
not pin TMPDIR: Node returned /var/folders, while production receipt helpers
correctly canonicalized to /private/var/folders. Retain the11 failures and use the
same explicit TMPDIR=/private/tmp as the prior verified program. No test assertion
or production path/security logic changes. Recovery/final runs follow separately.
Evidence documentation was prepared during that first run; its tree was not clean
at completion. Later final-clean checks certify their actual committed source.

The generated .patch contains standard one-space diff context for blank lines.
Git diff --check treats those artifact lines as trailing whitespace, although
applied source has no new whitespace-only lines. The raw warning is retained;
check the applied library bytes/diff and other tracked changes separately rather
than alter a correct pnpm-generated patch or suppress global lint/audit.
