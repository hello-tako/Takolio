# Takolio V1 asset manifest

Source/runtime provenance is machine-readable in `docs/brand/takolio/v1/source/provenance.json` and `public/takolio/v1/asset-manifest.json`.

- Input ZIP SHA256: `d2f77b552c07570d846a20d2602dd3a6c41ebb4fd9c66328234bf86da8ca1142`.
- Selected source files: 58.
- Runtime entries: 69; total runtime bytes: 478,874.
- Generator: `sharp 0.35.5; offline pinned SVG/path masters`.
- Font: `plus-jakarta-sans-vietnamese-latin-wght.woff2`, SHA256 `a435079ca1bd7818134bf75b4c18b9dd9fa0af659d39b47d7cd5d71fb572343b`, SIL OFL 1.1; upstream Google Fonts commit `94301472b4d809299b4775bc6502592b83dd6934`.
- Existing Nunito assets remain under `/takosan/v3/fonts/` with their existing OFL manifest and hashes.

Runtime groups in the manifest:

- `logo/`: primary, wordmark, horizontal/stacked, mono, reverse and micro symbols.
- `mascot/`: welcome, cooking, thinking, excited, completed, cheering, front, side, back and three-quarter poses.
- `ui-icons/`: 19 source icons and reverse scan icon.
- `app-icons/`: favicon, all requested size PNGs, iOS/Google Play, maskable and Android adaptive sources.
- `social/`: OG 1200x630.
- `fonts/`: Plus Jakarta Sans subset and OFL notice.

Every manifest SHA was checked after generation and by `tests/unit/takolio-brand.test.mjs`. No source PDF, reference board, ZIP, embedded-image mockup or native project is in runtime.

## Runtime outputs

| Path | Bytes | SHA256 |
|---|---:|---|
| `logo/primary.svg` | 15086 | `e20955fcf7482cd2676d795e19b30129edabcd3235479c7f97ed6743572419d7` |
| `logo/horizontal-primary.svg` | 14424 | `77a37be66e9dd91e943ec8c82a53371c641eabafffb8564d2878c1e17e645f79` |
| `logo/stacked-primary.svg` | 6320 | `fbb8e40c2e24d4fbb85054b5c6ccf25a1ed9793ad40044776c1491e150fee4a4` |
| `logo/wordmark-primary.svg` | 3274 | `e8b150c284036d9321d6888fd8b3d0d1b998974a967c056835e22c697fd8a81e` |
| `logo/wordmark-mono-dark.svg` | 3273 | `789a50a4ba89c1f1667f5027aa4d114d192c3f76dfbf773fc17378d93668c34d` |
| `logo/wordmark-mono-white.svg` | 3273 | `b8c79ff0a646502a3fbc4192de602e13ff09661512d6d88072b73824e173e93c` |
| `logo/symbol-primary.svg` | 3101 | `1499a9c036e6a2d7daf4cab40f543177cacb5daa0d7758f76d284c4a101964b5` |
| `logo/wordmark-on-coral.svg` | 3323 | `eb701fec21920c0158f13316b8efb33ceb3911cf81fec80000cbc639155451ae` |
| `logo/wordmark-on-cream.svg` | 3325 | `2ed0b6b916e4b7f133803fe42b2483fedbfab6391f716689c4e698c3e801fb60` |
| `logo/wordmark-on-navy.svg` | 3323 | `2ff04538a18777b95c8e277c167dd2297aaa83223a58c9355603ca96a40b31b0` |
| `logo/horizontal-reverse.svg` | 14424 | `9ce0484068298aa9adbfe2e6f90501de11a01abbdd26f59ad1abe755b60da23d` |
| `logo/horizontal-mono-dark.svg` | 4466 | `fc75386943b68359c5ad3cadb7c85dc45879d6b2caebb51869e9635d096db31d` |
| `logo/horizontal-mono-white.svg` | 4466 | `e64edd911908be0ff632d2875a9e1c3681e94795c05a81faf307de326d6d5dfd` |
| `logo/stacked-reverse.svg` | 6320 | `13eb20649b7164d1715e8855a826f6ad0896deb443d1e59937b051affe763b40` |
| `logo/stacked-mono-dark.svg` | 4470 | `cea5056303b0b89eccd37d3f94a0f38a7550b338f4f59d872151a8e82ffcaa47` |
| `logo/stacked-mono-white.svg` | 4470 | `6ea2689e2df0b0b8442411989081a81a6937f202ea11ccf511ea43a8a04da881` |
| `logo/symbol-micro.svg` | 1128 | `658950332be743f440f639e4e821e6718b86327125f7674005f1829c4cc4c874` |
| `mascot/tako-welcome.svg` | 4639 | `cb9d7f8f745b2a521ba8ba7597a96dfbfceece42d14f0d95388fbaf69d7f4ebf` |
| `mascot/tako-cooking.svg` | 5829 | `1091ccdf496b87235cbaf884e0652c5fd083885d5a8c790845b6197fa2bce844` |
| `mascot/tako-thinking.svg` | 5233 | `03c30f53b780c7122e74625ef1134c193fbbbbda5c44c14f6bc1d466bd1f0ea9` |
| `mascot/tako-excited.svg` | 4730 | `dbdaa7045bf3e168ee2ab780cebbfca8272ab4804762347c7d9907a5a2456dbb` |
| `mascot/tako-completed.svg` | 5559 | `afe3ec6c0382bc3fffdac1d63dad5ab3bb1847a72a28dd7336af12e063dd9fa4` |
| `mascot/tako-cheering.svg` | 4835 | `73b3de68102150e646f6920e6c2c7ddfcc9452093793cfa33a3b3fb8630884db` |
| `mascot/tako-master-front.svg` | 4639 | `cb9d7f8f745b2a521ba8ba7597a96dfbfceece42d14f0d95388fbaf69d7f4ebf` |
| `mascot/tako-mascot-side.svg` | 4457 | `ba0e96daf223f401b28ea64d6a592856a1f7236b6e6f959b8ff592b7ca6cdf2c` |
| `mascot/tako-mascot-back.svg` | 3746 | `3905e1720821ca75baa159c33215d7b69f71e98dea484c7a39f7394335d5e8fa` |
| `mascot/tako-mascot-three-quarter.svg` | 4667 | `e3a1ce1de47696c4bd4aae9072cd41d855fad8762897278fd4f117f9c4ea3025` |
| `ui-icons/ai-suggestion.svg` | 401 | `6f4809003a6b288dfa58d002c11c3bb43c918a1a24cf3da060e0166a7810a401` |
| `ui-icons/analytics.svg` | 447 | `547a504eef51e7d5f7bee075a0bdd85d50f0e3dc959c9ec6bc7dae084b6b7939` |
| `ui-icons/calendar.svg` | 493 | `0cc3ad2c4ac5b20cce32327a8d9fd707a62ab8299aff0907fe1ca9fa0ba859db` |
| `ui-icons/camera.svg` | 356 | `c2def4136de5ccbb943803c9790e3debdc1edce993b4c86f0bc3530ee884d2f1` |
| `ui-icons/cook.svg` | 380 | `5b3ce43424ad7e33903557b51b51adb36caafd0ed99bcf2596dc5d0ac1f72b0c` |
| `ui-icons/favorites.svg` | 325 | `f3cfd2a2c9fb364d4cf9fe6f1b3ff78376a534197432a16d46b416fe530341b8` |
| `ui-icons/filter.svg` | 421 | `c159d227fb16db01e7cc466354712ff57fd8b56302e38741c788069222f5df85` |
| `ui-icons/fridge.svg` | 356 | `49bb7a430d19b8c5ab66d8ccc1302a6ebd96aa15107436c020527910727dca17` |
| `ui-icons/history.svg` | 337 | `e1854abf5b81a3c47dd3d7a5b4a46d34ed2111e373e056f9b10c53d3cb46d5a0` |
| `ui-icons/ingredient.svg` | 342 | `e78588d18a1fd32c2a2edd85fd68edfbd7476c9573b206b18bd2451b9c0fd4fc` |
| `ui-icons/meal-plan.svg` | 395 | `4ace4e5f30776c3b9d434043a6125f4fb54459e7d36febf160272fea1ac06d21` |
| `ui-icons/notifications.svg` | 349 | `778b64634f9cbe82cbd80f88fa49d3c499b240fb387bcd4e12933e23756528cd` |
| `ui-icons/nutrition.svg` | 418 | `0e168981ba1a69ffa6a36b1a5597c084eb61c6c4d0d022f6cb0388275b3456af` |
| `ui-icons/profile.svg` | 357 | `22fa64537c1c5c57557e5d3ca7e4e1e29bee618b400adadecbe78239c73d1951` |
| `ui-icons/recipe.svg` | 403 | `904a382dfed1854752828217370c64c11be511ab4e1484f97839bc21c554e3fa` |
| `ui-icons/scan-label.svg` | 351 | `8f08384c78a991db6ab215db454460bc27a98585ed10eeaa10406b54c534c7fa` |
| `ui-icons/search.svg` | 333 | `fe7bbaf9621c59a1b7ba7e58331456968f7f37111b2c990fd4d724d08a43418f` |
| `ui-icons/settings.svg` | 446 | `cfa9e5c46772d9b4db3001e5201c8d764258bf88c90a8ca0fc96639bc131172b` |
| `ui-icons/shopping.svg` | 395 | `c0283b8a5386c1a6b01e56f7468a36abb23aba430b6d929f68ced07b69cbb411` |
| `ui-icons/scan-label-reverse.svg` | 351 | `1f1ef97ff07a592c738a818299c9f83286a4eaec52139daf0c49d87c1c1ec828` |
| `app-icons/icon-master.svg` | 3273 | `8b6f4386e2215cdb37bcc0f0865963fad127cbcdb87e42da78c002e1bb652e12` |
| `app-icons/icon-maskable.svg` | 3200 | `4db6a69bbffaa092f5da115476d72d81924abb4b4b64d60a2a7c20acdb925384` |
| `app-icons/favicon.svg` | 1177 | `e970731624ccdb1ff44227cff342e06508319c485d31f4c6b132e968b3e1af6c` |
| `app-icons/android-adaptive-foreground.svg` | 3204 | `c02b9b5b9feda210603f08ed1c7a80a0970ac5402b55cc5418098de8dd6139db` |
| `app-icons/android-adaptive-background.svg` | 147 | `2cdac35dfdeda0a9b34816b5bfd0cf4a549f5bdd5dcb00d64ee4ff2c5d7cecb9` |
| `app-icons/icon-16.png` | 387 | `7e82678e660435198819f23f785c5c7cee68c0b76cc2a9ed23dfb3a2283b5e39` |
| `app-icons/icon-24.png` | 560 | `0810ac177860137b8a1d33238ba6281a148a63663adcab2d9ace01fe764d4a69` |
| `app-icons/icon-32.png` | 746 | `a8ddc518db087eb96041eb70a51b57cdf9fdbf238a72108c0aeb342816aa98a4` |
| `app-icons/icon-48.png` | 1833 | `7d93d63a0fc9eca66d4d8ffbabb083986901a42e29cd7ee9d45069f824d89372` |
| `app-icons/icon-64.png` | 2787 | `1740a0f2dbf59c9461bef4ff18a403df678e3cd084778b5ca736cfeba254777f` |
| `app-icons/icon-128.png` | 6603 | `d657169dd5c530ffab0d01de47fa8fdc08b6d49f829fddc2db8203e1c3f1a734` |
| `app-icons/icon-180.png` | 9807 | `e2eab5682f1ad6574cf7b54e8e2f4e2046f30bbefd91f53d217c1230967e9583` |
| `app-icons/icon-192.png` | 10522 | `c4529ff2dea5f8ddac0e3f5957a2c9debe8d7860b409443212e700ce71dc4d24` |
| `app-icons/icon-256.png` | 14767 | `d70c04fbb7573af75bc8497bc5065ff3bf9b4bd5d18c9a0693818b4a262d2c63` |
| `app-icons/icon-512.png` | 31708 | `c2fb3dd2c70dc802044e5db94d22e71a16366a65ce0902069ea9c1ce4126f501` |
| `app-icons/icon-maskable-512.png` | 22422 | `1f4bc5824bf27909028afc5d067bbda7e9a6d617a15bbf5efb8de79730a36cbf` |
| `app-icons/ios-1024.png` | 68014 | `d8b5cb564c21d36b625689fba39d4cc2596d30e826290c18b40c36e60397ec7b` |
| `app-icons/googleplay-512.png` | 31708 | `c2fb3dd2c70dc802044e5db94d22e71a16366a65ce0902069ea9c1ce4126f501` |
| `app-icons/android-adaptive-foreground-432.png` | 20946 | `3254e7d389c5d78f5e68e0df7620fd62218247aac375404badc9fa9e03cb5195` |
| `social/og-1200x630.png` | 51025 | `ce41fb439502906a4f509b11f0e8db67ecac70a1c391ba1c198186e8146ba58c` |
| `fonts/plus-jakarta-sans-vietnamese-latin-wght.woff2` | 35180 | `a435079ca1bd7818134bf75b4c18b9dd9fa0af659d39b47d7cd5d71fb572343b` |
| `fonts/Plus-Jakarta-Sans-OFL.txt` | 4402 | `995c7199cab65954f545996326755daee7b63cc6b42b06c13da1f9502ab08a99` |

## Selected source outputs

| Path | Bytes | SHA256 |
|---|---:|---|
| `source/01_Brand_Guidelines/01_BRAND_SPEC.md` | 2481 | `7f36cbdc8ecd708e599b0fa30c79088843f25d57113b524a6a6c68d4cafae66b` |
| `source/01_Brand_Guidelines/02_LOGO_USAGE.md` | 1744 | `4dddeecfad4a2dfb1eabc11b47e1a6834b70375a0c73df1fe0b2c683281ea1e0` |
| `source/01_Brand_Guidelines/03_MASCOT_BIBLE.md` | 2356 | `c9ce49fd581976114613f903759daed4d7a01ff091bf2282f68276095576f01c` |
| `source/02_Logo/takolio-logo-horizontal.svg` | 6480 | `34815d761ab454439762a9d8c109e3914bfe525d9dce28c327a4792344acdff5` |
| `source/02_Logo/takolio-logo-icon-only.svg` | 3155 | `3fd1db773e537cfa4fc196556cdb3c86c5ce113e174568e3e32df448fabd219e` |
| `source/02_Logo/takolio-logo-monochrome-navy.svg` | 3323 | `cb348d9a3807b644709c09b073b44b1179c7b204d911a6e3830c5ec67032b41f` |
| `source/02_Logo/takolio-logo-monochrome-white.svg` | 3323 | `b8ed9dd17431469118cac19a314fbd2f8799ae373bd724e0eb8537a666517a69` |
| `source/02_Logo/takolio-logo-on-coral.svg` | 3370 | `fdc92c0680b0702ff46c4937f6a468bf2acae42b9dac369f8ec9f1eda120abda` |
| `source/02_Logo/takolio-logo-on-cream.svg` | 3372 | `2e41cb6364de8afd31ad5d7749436d34b2c6ab6594e51239525dbafccadf71b2` |
| `source/02_Logo/takolio-logo-on-navy.svg` | 3370 | `32da6af982a2195f286e31fc210c9db32ae66be7ea314f15dcf9246e2a262875` |
| `source/02_Logo/takolio-logo-primary.svg` | 3468 | `149901617476a1d9e5c3bdef5e8c61990fdd3c6f38aa1a58becbb2a8c9659114` |
| `source/02_Logo/takolio-logo-stacked.svg` | 6372 | `e214eefd13a633b4decb9fc5e58830f529db22c8db877ae05c864bed8616beaa` |
| `source/02_Logo/takolio-logo-wordmark.svg` | 3325 | `a13dc9f81421873303d1e5e4c7591f8c2fcd94bf2bcf0aaac7d1417128dab274` |
| `source/03_Mascot/takolio-mascot-cheering.svg` | 4835 | `73b3de68102150e646f6920e6c2c7ddfcc9452093793cfa33a3b3fb8630884db` |
| `source/03_Mascot/takolio-mascot-completed.svg` | 5559 | `afe3ec6c0382bc3fffdac1d63dad5ab3bb1847a72a28dd7336af12e063dd9fa4` |
| `source/03_Mascot/takolio-mascot-cooking.svg` | 5829 | `1091ccdf496b87235cbaf884e0652c5fd083885d5a8c790845b6197fa2bce844` |
| `source/03_Mascot/takolio-mascot-excited.svg` | 4730 | `dbdaa7045bf3e168ee2ab780cebbfca8272ab4804762347c7d9907a5a2456dbb` |
| `source/03_Mascot/takolio-mascot-mascot-back.svg` | 3746 | `3905e1720821ca75baa159c33215d7b69f71e98dea484c7a39f7394335d5e8fa` |
| `source/03_Mascot/takolio-mascot-mascot-side.svg` | 4457 | `ba0e96daf223f401b28ea64d6a592856a1f7236b6e6f959b8ff592b7ca6cdf2c` |
| `source/03_Mascot/takolio-mascot-mascot-three-quarter.svg` | 4667 | `e3a1ce1de47696c4bd4aae9072cd41d855fad8762897278fd4f117f9c4ea3025` |
| `source/03_Mascot/takolio-mascot-master-front.svg` | 4639 | `cb9d7f8f745b2a521ba8ba7597a96dfbfceece42d14f0d95388fbaf69d7f4ebf` |
| `source/03_Mascot/takolio-mascot-thinking.svg` | 4691 | `c2ea95490b637c3703d82b8aee5ee50ac0b3f3e0ab3d55ce5ab034160673cd2c` |
| `source/03_Mascot/takolio-mascot-welcome.svg` | 4639 | `cb9d7f8f745b2a521ba8ba7597a96dfbfceece42d14f0d95388fbaf69d7f4ebf` |
| `source/04_App_Icons/takolio-android-adaptive-foreground.svg` | 3204 | `c02b9b5b9feda210603f08ed1c7a80a0970ac5402b55cc5418098de8dd6139db` |
| `source/04_App_Icons/takolio-appicon-coral.svg` | 3273 | `8b6f4386e2215cdb37bcc0f0865963fad127cbcdb87e42da78c002e1bb652e12` |
| `source/04_App_Icons/takolio-appicon-cream.svg` | 3211 | `c8f3a9c8d442ee42eb27ffc5d283fb1f76d9c86f237ac37c36fc74ab10bf8154` |
| `source/04_App_Icons/takolio-appicon-navy.svg` | 3211 | `e4f2bfd6a5172ae2e1ca6595a180141eaf3381523a630e10cd87504c14d16895` |
| `source/04_App_Icons/takolio-appicon-primary.svg` | 3273 | `8b6f4386e2215cdb37bcc0f0865963fad127cbcdb87e42da78c002e1bb652e12` |
| `source/04_App_Icons/takolio-appicon-symbol-transparent.svg` | 3155 | `3fd1db773e537cfa4fc196556cdb3c86c5ce113e174568e3e32df448fabd219e` |
| `source/05_UI_Icons/takolio-icon-ai-suggestion.svg` | 401 | `6f4809003a6b288dfa58d002c11c3bb43c918a1a24cf3da060e0166a7810a401` |
| `source/05_UI_Icons/takolio-icon-analytics.svg` | 447 | `547a504eef51e7d5f7bee075a0bdd85d50f0e3dc959c9ec6bc7dae084b6b7939` |
| `source/05_UI_Icons/takolio-icon-calendar.svg` | 493 | `0cc3ad2c4ac5b20cce32327a8d9fd707a62ab8299aff0907fe1ca9fa0ba859db` |
| `source/05_UI_Icons/takolio-icon-camera.svg` | 356 | `c2def4136de5ccbb943803c9790e3debdc1edce993b4c86f0bc3530ee884d2f1` |
| `source/05_UI_Icons/takolio-icon-cook.svg` | 380 | `5b3ce43424ad7e33903557b51b51adb36caafd0ed99bcf2596dc5d0ac1f72b0c` |
| `source/05_UI_Icons/takolio-icon-favorites.svg` | 325 | `f3cfd2a2c9fb364d4cf9fe6f1b3ff78376a534197432a16d46b416fe530341b8` |
| `source/05_UI_Icons/takolio-icon-filter.svg` | 421 | `c159d227fb16db01e7cc466354712ff57fd8b56302e38741c788069222f5df85` |
| `source/05_UI_Icons/takolio-icon-fridge.svg` | 356 | `49bb7a430d19b8c5ab66d8ccc1302a6ebd96aa15107436c020527910727dca17` |
| `source/05_UI_Icons/takolio-icon-history.svg` | 337 | `e1854abf5b81a3c47dd3d7a5b4a46d34ed2111e373e056f9b10c53d3cb46d5a0` |
| `source/05_UI_Icons/takolio-icon-ingredient.svg` | 342 | `e78588d18a1fd32c2a2edd85fd68edfbd7476c9573b206b18bd2451b9c0fd4fc` |
| `source/05_UI_Icons/takolio-icon-meal-plan.svg` | 395 | `4ace4e5f30776c3b9d434043a6125f4fb54459e7d36febf160272fea1ac06d21` |
| `source/05_UI_Icons/takolio-icon-notifications.svg` | 349 | `778b64634f9cbe82cbd80f88fa49d3c499b240fb387bcd4e12933e23756528cd` |
| `source/05_UI_Icons/takolio-icon-nutrition.svg` | 418 | `0e168981ba1a69ffa6a36b1a5597c084eb61c6c4d0d022f6cb0388275b3456af` |
| `source/05_UI_Icons/takolio-icon-profile.svg` | 357 | `22fa64537c1c5c57557e5d3ca7e4e1e29bee618b400adadecbe78239c73d1951` |
| `source/05_UI_Icons/takolio-icon-recipe.svg` | 403 | `904a382dfed1854752828217370c64c11be511ab4e1484f97839bc21c554e3fa` |
| `source/05_UI_Icons/takolio-icon-scan-label.svg` | 351 | `8f08384c78a991db6ab215db454460bc27a98585ed10eeaa10406b54c534c7fa` |
| `source/05_UI_Icons/takolio-icon-search.svg` | 333 | `fe7bbaf9621c59a1b7ba7e58331456968f7f37111b2c990fd4d724d08a43418f` |
| `source/05_UI_Icons/takolio-icon-settings.svg` | 446 | `cfa9e5c46772d9b4db3001e5201c8d764258bf88c90a8ca0fc96639bc131172b` |
| `source/05_UI_Icons/takolio-icon-shopping.svg` | 395 | `c0283b8a5386c1a6b01e56f7468a36abb23aba430b6d929f68ced07b69cbb411` |
| `source/08_Design_Tokens/TYPOGRAPHY.md` | 1617 | `8e7622a5f96ce785930cbc9953c0219c907a069cec0ba053657094e6f8b9cfbe` |
| `source/08_Design_Tokens/design-tokens.json` | 1314 | `323c4756e396dfd2f7a530f65be3552f18488a39fb0f92083388c61183b156cc` |
| `source/Comfortaa-OFL.txt` | 4519 | `bc85bae0b512b799bbfb2b916e4d0a34cfd963d09778cd783e248b479e67760a` |
| `source/fonts/Plus-Jakarta-Sans-OFL.txt` | 4402 | `995c7199cab65954f545996326755daee7b63cc6b42b06c13da1f9502ab08a99` |
| `source/fonts/plus-jakarta-sans-vietnamese-latin-wght.woff2` | 35180 | `a435079ca1bd7818134bf75b4c18b9dd9fa0af659d39b47d7cd5d71fb572343b` |
| `source/micro.svg` | 1128 | `658950332be743f440f639e4e821e6718b86327125f7674005f1829c4cc4c874` |
| `source/provenance.json` | 14517 | `a4b05c7dff0b2cd508f5ddefa85b959a0365ed1f3e3449ebbe9b8d705f989b8d` |
| `source/typography/question.svg` | 678 | `7ab94387c8cfaedc8bdf65d485e06a298e6483ff826dc5287ca66a8609124a5f` |
| `source/typography/tagline-en.svg` | 8139 | `86e8429a4d76d4e96e17e0b32171de3646e6f7809c2a8590cf571ee16e8abceb` |
| `source/typography/tagline-vi.svg` | 11848 | `c79671d8189b6fb2ecc20a49b6375cf46bd9b3a062fe7ecba9f7f686aed05468` |

## 3D illustration exports

The final candidate generator now reports 87 manifest entries and 1,012,952 runtime bytes. Eighteen entries are transparent WebP exports from six pinned 2048px RGBA PNG masters: `mascot/3d/tako-{welcome,cooking,thinking,excited,completed,cheering}-{256,512,1024}.webp`. Their source SHA, authoring SHA, native handoff hashes and `premiumApproved: false` status are in `source/3d/render-manifest.json`. The selected service-worker precache contains nine preferred raster variants (194,324 bytes) plus the vector fallbacks; all 69 pre-existing Takolio runtime entries remain byte-identical.

The native Blender `.blend` and `.glb` files, the full ZIP, boards and PDFs stay outside the public repository. The local delivery ZIP has an adjacent `.sha256` and separate publication receipt; its contents include native/source/QA handoff, not browser runtime.

## Later 3D/UI upgrade

The initial 69-entry table is historical. The current manifest has 87 entries including 18 responsive 3D WebP files; `public/takolio/v1/asset-manifest.json` is the current byte/hash authority. The upgraded six PNG masters, authoring scripts, native handoff hashes and render settings are pinned in `source/3d/render-manifest.json`; `evidence/upgrade/` records the change against the first 3D candidate. No logo, font, UI icon, app icon, SVG fallback or V3 asset is replaced by this follow-up.
