# Decision-complete Tailwind 4 migration follow-up

Status: NOT_APPLIED; minimal 4.3.3 candidate rejected by measured compatibility.
This plan is separate from the accepted braces fixed-depth mitigation.

## Prerequisites and scope

Keep React18/Vite6, theme values, UI routes/state/guards, product behavior and
release authority. Choose and record the supported browser floor before changing
runtime: upstream4 requires Safari16.4/Chrome111/Firefox128. Actual older-device
support is unknown. Native Oxide/lightningcss must install on hosted Node22/Linux
amd64 and the supported developer platform. No remote deploy is implied.

Own package/lock/PostCSS and existing theme/style/class declarations only. Any
change to auth/payment/domain behavior needs its own scope. No brand redesign,
new assets, runtime flags, schema/provider/data cutover or release-gate bypass.

## Ordered implementation

1. Pin official tailwindcss/@tailwindcss/postcss4.3.3 (or a subsequently verified
   owner) and a frozen graph; remove obsolete exact-owner parser overrides only
   when their owners disappear. In the measured graph437 declared packages replace
   460,55 removed/32 added; braces/chokidar3/micromatch/fast-glob leave the graph.
   Preserve all other owner versions. Full and production audits must both pass.
2. Put every CSS @import before @config/@source/@theme directives. Explicitly limit
   content to the same src/web and index authority. The initial faulty import
   ordering built with warnings but dropped kitchen imports; never accept it.
3. Resolve native-layer precedence against the existing unlayered kitchen styles
   one affected selector at a time. The measured planning-setup-form changes from
   white/16px radius/16px padding to cream/14px/22px despite identical JSX and JS
   theme: its kitchen rule now wins over utilities. Preserve accepted visible
   outcomes deliberately; moving all kitchen CSS to one layer blindly can reverse
   specificity in a different way. No blanket flattening/postprocessor workaround.
4. Migrate the JS theme to one CSS-owned theme with exact existing rgb alpha/token
   values, scales and custom utilities. Update the contrast-audit consumer together
   so theme authority is not duplicated. Keep semantic/brand dynamic vars and all
   current numeric scale values. Audit custom @layer utility variants, transitions,
   spacing, gradients and important/dynamic candidate syntax.
5. Resolve v3/v4 defaults explicitly: border gray200 vs currentColor; pointer cursor;
   shadow/blur/radius scales; changed space/divide selectors; placeholder and hidden
   behavior; focus:outline-hidden vs focus:outline-none (forced colors); ring width/
   color and hover-capable media. Use source/caller/actual-state evidence. Inventory
   lexical misses !container/ring are comment/identifier extraction artifacts, not
   demonstrated missing user-facing classes; do not "fix" those source comments.
6. Use the paired browser_probe baseline/recovery control as a diagnostic, then
   extend actual application coverage to320/390/768/1280px, all responsive shells,
   keyboard/tab/forced-colors/reduced-motion/hover/touch and enlarged text. Include
   actual cooking/shopping/review/modal flows with identical permitted fixtures.
   Canonical styles, geometry and visible pixels must match reviewed expectations;
   semantically equivalent invisible shadow/radius serializations can be documented,
   but no visible/cascade/focus regression is waived. Assert actual route/query
   identity; /auth/register is not a current route (use /auth?mode=register).
7. Freeze accepted source; run install/lint/both TS/full tests/40-migration smoke/
   sequential production build, local native/device and hosted toolchain checks.
   Confirm JS behavior/assets, matching service-worker build token and all original
   SHA/main/environment/approval/migration/rollback gates. Audit/scanner must bind
   the actual implementation and subsequent receipt SHA before separate release.

## Acceptance and rollback

The minimal candidate has20/20 computed-style differences,15/20 visible pixel
changes and6/6 focus/hover/forced-color differences with exact baseline recovery.
These are discovery findings, not a certification of every possible screen.
A later migration must explain every material difference and test its correction.
Browser support and Linux native compatibility remain external facts, not assumed.

Rollback uses the reviewed Tailwind3 artifact with its owned fixed-depth patch,
paired UI/server flags and matching SW token. It never removes durable data or
restores unmitigated braces. Keep separate receipts for both compatible artifacts;
no migration/queue/history reset is involved. The current high audit and retained
scanner findings remain visible until a published patch or certified owner removal
satisfies the release policy; this plan is not a waiver or deployment permission.
