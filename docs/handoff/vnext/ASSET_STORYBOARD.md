# ASSET_STORYBOARD.md — Takolio Frontend vNext Original Asset Bible (`G02`)

- **Status:** `CANDIDATE_GENERATED` · **`OWNER_APPROVAL = PENDING`**
- **Canonical Preservation:** `public/takolio/v1/**` (`60+` files) is 100% untouched and SHA-256 verified against `origin/main` (`87f279a055e028336ea334cc51c7ab4224f30ef4`).
- **Candidate Namespace:** `public/takolio/vnext/{brand,mascot,icons,food,marketing,pwa,social}/` (`77` registered assets in `ASSET_REGISTRY.csv`).

---

## 1. Brand Wordmarks & Lockups (`public/takolio/vnext/brand/`)
- **Master Format:** Pure editable `<svg>` path geometry (zero `<text>` font dependencies, zero `<image>` raster embeds).
- **3 Visual Directions for Owner Selection:**
  1. `lockup-direction-a.svg` — **Kitchen Studio Leaf & Coral** (`#196149` Leaf Green + `#F46B52` Tomato Coral + `#F6C453` Saffron + `#FFF9F1` Ivory) — *Recommended*.
  2. `lockup-direction-b.svg` — **Botanical Market Herb & Linen** (`#14533D` Forest Herb + `#D97706` Amber + `#F4F8F4` Sage).
  3. `lockup-direction-c.svg` — **Warm Terracotta Hearth & Slate** (`#1E3A34` Slate + `#C2412D` Terracotta + `#FDF6EE` Stone).

---

## 2. Mascot Character Bible — “Bé Mầm Bếp” (`public/takolio/vnext/mascot/`)
- **Identity:** Compact warm-ivory ceramic kitchen pot helper with rounded side handles, expressive dark ink eyes, rosy cheeks, knotted tomato-coral neckerchief, white chef toque, and two emerald sprout leaves on top. Legally original silhouette recognizable down to `32px`.
- **Vector vs Raster Transparency (`DESIGN/05_ASSET_GENERATION_POLICY.md` B05):**
  - `mascot-master-vector.svg`: **100% pure editable SVG vector master** authored directly with geometric `<path>`/`<rect>`/`<circle>` primitives.
  - `mascot-concept-sheet-abc.webp` + `pose-01..08.webp` (`512w` & `256w`): **Raster studio illustrations** generated from the unified Concept A character prompt, EXIF-stripped via `sharp`, zero text/watermarks.
- **8 Milestone Poses:**
  1. `pose-01-welcome` (`M01, A01, O01`) — Waving greeting
  2. `pose-02-guide` (`O02, O03, O04`) — Holding wooden spoon & guiding setup
  3. `pose-03-scanning` (`C09, C11, M03`) — Holding rounded green viewfinder over fresh produce
  4. `pose-04-empty-fridge` (`C03, S06`) — Inviting beside clean open fridge shelf
  5. `pose-05-cooking` (`C20, C21, M07`) — Stirring simmering pot
  6. `pose-06-achievement` (`O06, C22`) — Celebrating beside finished Vietnamese soup bowl
  7. `pose-07-offline` (`S04, C27`) — Calmly keeping woven basket safe offline
  8. `pose-08-error` (`S01–S03, S05`) — Tipping chef toque gently for recovery states

---

## 3. 53 Original `24×24` Optical-Grid SVG Icons (`public/takolio/vnext/icons/`)
- **Spec:** `viewBox="0 0 24 24"`, `stroke-width="2"`, `stroke-linecap="round"`, `stroke-linejoin="round"`, `2px` safe inset, `currentColor`, verified at `16px / 20px / 24px / 32px` on `G02ReviewHubPage`.
- **Coverage:** 5 Roots (`home`, `fridge`, `recipes`, `calendar`, `profile`) + `scan` + 20 kitchen/action icons + 17 auth/account/system icons + 10 food category icons.

---

## 4. Verified Vietnamese Culinary & Editorial Photography (`public/takolio/vnext/{food,marketing}/`)
Every dish photograph was generated strictly from verified canonical slugs and ingredient lists in `packages/recipes/src/vietnamese-bank.ts`:
- `FOOD-VN-KHO-01` → `thit-kho-trung` (*Thịt kho tàu nước dừa trứng béo ngậy*: 400g pork belly, 4 braised eggs, scallions, chili)
- `FOOD-VN-CANH-01` → `canh-chua-ca-loc-nam-bo` (*Canh chua cá lóc Nam Bộ*: snakehead fish, tomato, pineapple, bean sprouts, okra, herbs)
- `FOOD-VN-KHO-03` → `ga-ta-kho-gung-sa` (*Gà ta kho gừng sả đậm đà*: chicken thighs, julienned ginger, minced lemongrass)
- `FOOD-VN-XAO-01` → `rau-muong-xao-toi` (*Rau muống xào tỏi xanh giòn*: water spinach, smashed golden garlic)
- `FOOD-VN-KHO-02` → `ca-loc-kho-to-tieu-den` (*Cá lóc kho tộ tiêu đen cay nồng*: claypot snakehead fish, cracked black pepper, crispy pork cracklings)
- `FOOD-VN-BUN-01` → `pho-bo-tai-lan-ha-noi` (*Phở bò tái lăn Hà Nội*: clear beef broth, flat rice noodles, seared beef, onion, herbs)
- `MKT-HERO-M01` → `hero-m01-kitchen-studio-table` (`16:9` family meal table spread for `M01`)
- `MKT-SCAN-M03` → `m03-fresh-produce-scan` (`4:3` fresh Vietnamese produce flatlay for `M02–M04`)
