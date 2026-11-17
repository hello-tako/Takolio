#!/usr/bin/env node
/**
 * Takolio V4 — Editorial Culinary Dish Illustrations, 3D Posters & Brand/PWA Generator
 * ====================================================================================
 * Pure Node.js + `sharp` pipeline generating:
 * 1. 16 rich 800x600 WebP editorial culinary dish visuals in `public/takolio/v4/dishes/`
 * 2. Updated V4 brand SVGs, PWA icons (16..512 + maskable + apple-touch), and 3D stage
 *    fallback WebP posters in `public/takolio/v4/brand/`
 * 3. `public/takolio/v4/asset-manifest.json`
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, '../..');
const OUT_V4_DIR = resolve(ROOT_DIR, 'public/takolio/v4');
const OUT_DISHES_DIR = resolve(OUT_V4_DIR, 'dishes');
const OUT_BRAND_DIR = resolve(OUT_V4_DIR, 'brand');

// ---------------------------------------------------------------------------
// Editorial Studio Backdrop, Table Linen, Botanical Leaf Shadows & Vessels
// ---------------------------------------------------------------------------
function buildEditorialStageSVG({
  bgTop = '#FBF6EE',
  bgBottom = '#EADBC8',
  sunGlow = '#FFFDF8',
  linenStroke = '#DECBB4',
  placematColor = '#D9C2A6',
  vesselRim = '#F7F2E8',
  vesselInner = '#EFE8DC',
  vesselType = 'bowl', // 'bowl' | 'claypot' | 'plate' | 'tray' | 'lacquer' | 'stonepot'
  chopsticks = true,
  sideDip = 'nuoc-mam', // 'nuoc-mam' | 'herb-lime' | 'none'
  foodContent = '',
  garnishOverlay = '',
}) {
  const vesselMarkup = (() => {
    switch (vesselType) {
      case 'claypot':
        return `
          <ellipse cx="408" cy="332" rx="228" ry="205" fill="#1F140E" fill-opacity="0.22" filter="url(#softShadow)"/>
          <!-- Claypot Ear Handles -->
          <rect x="145" y="282" width="54" height="62" rx="22" fill="#632615" stroke="#47190C" stroke-width="4"/>
          <rect x="601" y="282" width="54" height="62" rx="22" fill="#632615" stroke="#47190C" stroke-width="4"/>
          <circle cx="400" cy="312" r="218" fill="url(#claypotRimGrad)"/>
          <circle cx="400" cy="312" r="192" fill="#3B150B"/>
          <circle cx="400" cy="312" r="184" fill="url(#claypotSauceGrad)"/>
        `;
      case 'plate':
        return `
          <ellipse cx="410" cy="330" rx="248" ry="222" fill="#1E2822" fill-opacity="0.16" filter="url(#softShadow)"/>
          <circle cx="400" cy="312" r="236" fill="url(#vesselOuterGrad)"/>
          <circle cx="400" cy="312" r="232" fill="none" stroke="${vesselRim}" stroke-width="3" stroke-opacity="0.7"/>
          <circle cx="400" cy="312" r="188" fill="url(#vesselWellGrad)" stroke="#D4CBBF" stroke-width="2"/>
        `;
      case 'tray':
        return `
          <ellipse cx="412" cy="326" rx="278" ry="248" fill="#2A1C11" fill-opacity="0.20" filter="url(#softShadow)"/>
          <circle cx="400" cy="306" r="268" fill="url(#rattanGrad)" stroke="#8F5A2C" stroke-width="10"/>
          <circle cx="400" cy="306" r="252" fill="none" stroke="#B67B43" stroke-width="4" stroke-dasharray="10 6"/>
        `;
      case 'lacquer':
        return `
          <ellipse cx="410" cy="332" rx="226" ry="205" fill="#14181C" fill-opacity="0.24" filter="url(#softShadow)"/>
          <circle cx="400" cy="312" r="214" fill="#1F2429"/>
          <circle cx="400" cy="312" r="204" fill="#9E2B22"/>
          <circle cx="400" cy="312" r="192" fill="url(#vesselWellGrad)"/>
        `;
      case 'stonepot':
        return `
          <ellipse cx="410" cy="334" rx="232" ry="210" fill="#14181A" fill-opacity="0.26" filter="url(#softShadow)"/>
          <circle cx="400" cy="312" r="220" fill="#2B3035" stroke="#454C54" stroke-width="5"/>
          <circle cx="400" cy="312" r="192" fill="#1D2124"/>
          <circle cx="400" cy="312" r="186" fill="url(#vesselWellGrad)"/>
        `;
      case 'bowl':
      default:
        return `
          <ellipse cx="410" cy="332" rx="232" ry="208" fill="#1D2621" fill-opacity="0.18" filter="url(#softShadow)"/>
          <circle cx="400" cy="312" r="218" fill="url(#vesselOuterGrad)"/>
          <circle cx="400" cy="312" r="210" fill="none" stroke="#2B7A58" stroke-width="3" stroke-opacity="0.42"/>
          <circle cx="400" cy="312" r="192" fill="url(#vesselWellGrad)"/>
        `;
    }
  })();

  const sidePropsMarkup = `
    ${
      chopsticks
        ? `
      <g opacity="0.95">
        <rect x="572" y="516" width="210" height="14" rx="6" transform="rotate(-14 572 516)" fill="#6C4322" opacity="0.18"/>
        <rect x="540" y="510" width="236" height="9" rx="4.5" transform="rotate(-14 540 510)" fill="url(#bambooGrad)"/>
        <rect x="546" y="528" width="236" height="9" rx="4.5" transform="rotate(-11 546 528)" fill="url(#bambooGrad)"/>
        <rect x="615" y="492" width="22" height="44" rx="8" transform="rotate(-12 615 492)" fill="#2B7A58"/>
      </g>`
        : ''
    }
    ${
      sideDip === 'nuoc-mam'
        ? `
      <g transform="translate(116, 108)">
        <circle cx="4" cy="8" r="54" fill="#2A1D14" fill-opacity="0.14" filter="url(#softShadow)"/>
        <circle cx="0" cy="0" r="52" fill="#FAF5EC" stroke="#DFD5C5" stroke-width="3"/>
        <circle cx="0" cy="0" r="39" fill="#B5441A"/>
        <circle cx="-10" cy="-10" r="14" fill="#FF9F5A" fill-opacity="0.32"/>
        <ellipse cx="8" cy="-4" rx="9" ry="5" transform="rotate(28 8 -4)" fill="#E62E22"/>
        <ellipse cx="-8" cy="10" rx="8" ry="4.5" transform="rotate(-22 -8 10)" fill="#E62E22"/>
        <circle cx="12" cy="11" r="4" fill="#FFE8A3"/>
      </g>`
        : sideDip === 'herb-lime'
          ? `
      <g transform="translate(114, 110)">
        <circle cx="4" cy="8" r="50" fill="#1F2A22" fill-opacity="0.13" filter="url(#softShadow)"/>
        <circle cx="0" cy="0" r="48" fill="#F7F3EA" stroke="#DCD4C6" stroke-width="3"/>
        <path d="M-22 6 A24 24 0 0 1 22 -8 Z" fill="#8CD156" stroke="#3E8838" stroke-width="3"/>
        <ellipse cx="-6" cy="-14" rx="16" ry="9" transform="rotate(-28 -6 -14)" fill="#2B8454"/>
        <ellipse cx="14" cy="14" rx="14" ry="8" transform="rotate(24 14 14)" fill="#379B63"/>
      </g>`
          : ''
    }
  `;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
    <defs>
      <linearGradient id="bgGrad" x1="0" y1="0" x2="0.85" y2="1">
        <stop offset="0%" stop-color="${bgTop}"/>
        <stop offset="100%" stop-color="${bgBottom}"/>
      </linearGradient>
      <radialGradient id="sunWindow" cx="0.2" cy="0.15" r="0.7">
        <stop offset="0%" stop-color="${sunGlow}" stop-opacity="0.85"/>
        <stop offset="100%" stop-color="${sunGlow}" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="vesselOuterGrad" cx="0.35" cy="0.3" r="0.7">
        <stop offset="0%" stop-color="#FFFFFF"/>
        <stop offset="72%" stop-color="${vesselRim}"/>
        <stop offset="100%" stop-color="#D5CCB9"/>
      </radialGradient>
      <radialGradient id="vesselWellGrad" cx="0.38" cy="0.35" r="0.68">
        <stop offset="0%" stop-color="#FFFFFF"/>
        <stop offset="100%" stop-color="${vesselInner}"/>
      </radialGradient>
      <radialGradient id="claypotRimGrad" cx="0.32" cy="0.28" r="0.72">
        <stop offset="0%" stop-color="#B04D2E"/>
        <stop offset="65%" stop-color="#7B3019"/>
        <stop offset="100%" stop-color="#4A1A0C"/>
      </radialGradient>
      <radialGradient id="claypotSauceGrad" cx="0.38" cy="0.35" r="0.65">
        <stop offset="0%" stop-color="#D1541E"/>
        <stop offset="65%" stop-color="#9B3210"/>
        <stop offset="100%" stop-color="#5C1A07"/>
      </radialGradient>
      <radialGradient id="rattanGrad" cx="0.4" cy="0.35" r="0.68">
        <stop offset="0%" stop-color="#DFAC74"/>
        <stop offset="75%" stop-color="#C3884E"/>
        <stop offset="100%" stop-color="#9A6433"/>
      </radialGradient>
      <linearGradient id="bambooGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#E7BE83"/>
        <stop offset="100%" stop-color="#BD894C"/>
      </linearGradient>
      <linearGradient id="steamGrad" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0"/>
        <stop offset="45%" stop-color="#FFFDF9" stop-opacity="0.36"/>
        <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
      </linearGradient>
      <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="16"/>
      </filter>
      <filter id="foodShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="5"/>
      </filter>
    </defs>

    <!-- Warm Studio Surface & Linen Weave -->
    <rect width="800" height="600" fill="url(#bgGrad)"/>
    <rect width="800" height="600" fill="url(#sunWindow)"/>
    <g stroke="${linenStroke}" stroke-width="1.2" opacity="0.36">
      <line x1="0" y1="88" x2="800" y2="88"/>
      <line x1="0" y1="512" x2="800" y2="512"/>
      <line x1="92" y1="0" x2="92" y2="600"/>
      <line x1="708" y1="0" x2="708" y2="600"/>
    </g>

    <!-- Woven Placemat Diagonal Accent -->
    <rect x="150" y="72" width="500" height="460" rx="44" fill="${placematColor}" fill-opacity="0.24"/>

    <!-- Botanical Studio Leaf Shadow Accent (Top Right) -->
    <g fill="#1B6B4A" fill-opacity="0.08">
      <ellipse cx="710" cy="68" rx="95" ry="32" transform="rotate(28 710 68)"/>
      <ellipse cx="742" cy="122" rx="85" ry="26" transform="rotate(14 742 122)"/>
    </g>

    <!-- Hero Ceramic / Claypot / Stoneware Vessel -->
    ${vesselMarkup}

    <!-- Dish-Specific Layered Ingredients -->
    <g>${foodContent}</g>

    <!-- Glossy Specular Highlight & Rising Steam Wisps -->
    <g>${garnishOverlay}</g>
    <path d="M352 210 C334 162 372 122 354 68" fill="none" stroke="url(#steamGrad)" stroke-width="14" stroke-linecap="round"/>
    <path d="M438 198 C422 150 458 112 442 54" fill="none" stroke="url(#steamGrad)" stroke-width="12" stroke-linecap="round"/>

    <!-- Editorial Side Props -->
    ${sidePropsMarkup}
  </svg>`;
}

// ---------------------------------------------------------------------------
// 16 Distinct Editorial Culinary Dish Definitions
// ---------------------------------------------------------------------------
const DISH_SPECIFICATIONS = [
  {
    file: 'vn-braised-claypot.webp',
    config: {
      bgTop: '#FCF4E8',
      bgBottom: '#E6CFAF',
      vesselType: 'claypot',
      sideDip: 'nuoc-mam',
      foodContent: `
        <!-- Caramelized Braised Pork Belly Cubes (Thịt kho tàu) -->
        <g>
          <rect x="282" y="218" width="84" height="72" rx="22" transform="rotate(-14 324 254)" fill="#8B290E" stroke="#BA471E" stroke-width="4"/>
          <rect x="288" y="224" width="72" height="22" rx="10" transform="rotate(-14 324 254)" fill="#F3C59B" fill-opacity="0.82"/>
          <rect x="396" y="204" width="88" height="74" rx="22" transform="rotate(18 440 241)" fill="#962E11" stroke="#C75124" stroke-width="4"/>
          <rect x="402" y="210" width="76" height="22" rx="10" transform="rotate(18 440 241)" fill="#F5CCA6" fill-opacity="0.82"/>
          <rect x="348" y="316" width="92" height="76" rx="24" transform="rotate(-8 394 354)" fill="#86260C" stroke="#B8451C" stroke-width="4"/>
          <rect x="354" y="322" width="80" height="22" rx="10" transform="rotate(-8 394 354)" fill="#F3C59B" fill-opacity="0.80"/>
        </g>
        <!-- Halved Braised Golden Eggs (Trứng kho) -->
        <g>
          <circle cx="310" cy="352" r="44" fill="#E8B98A" stroke="#9C431C" stroke-width="5"/>
          <circle cx="310" cy="352" r="24" fill="#EB8B1B"/>
          <circle cx="303" cy="345" r="7" fill="#FFD27D" fill-opacity="0.65"/>
          <circle cx="482" cy="336" r="44" fill="#E8B98A" stroke="#9C431C" stroke-width="5"/>
          <circle cx="482" cy="336" r="24" fill="#EB8B1B"/>
          <circle cx="475" cy="329" r="7" fill="#FFD27D" fill-opacity="0.65"/>
        </g>
        <!-- Glossy Caramel Broth Highlights, Chili & Scallion Rings -->
        <path d="M265 280 Q320 250 375 285" stroke="#FFB478" stroke-width="6" stroke-linecap="round" fill="none" opacity="0.45"/>
        <ellipse cx="404" cy="288" rx="26" ry="8" transform="rotate(-26 404 288)" fill="#E0241A"/>
        <circle cx="378" cy="272" r="9" fill="#2FA15A" stroke="#186636" stroke-width="3"/>
        <circle cx="422" cy="308" r="8" fill="#2FA15A" stroke="#186636" stroke-width="3"/>
        <circle cx="358" cy="304" r="7" fill="#37B567"/>
      `,
    },
  },
  {
    file: 'vn-sour-soup.webp',
    config: {
      bgTop: '#FCF8EE',
      bgBottom: '#E3EBDD',
      vesselType: 'bowl',
      sideDip: 'nuoc-mam',
      foodContent: `
        <!-- Golden Tamarind Broth (Canh chua Nam Bộ) -->
        <circle cx="400" cy="312" r="178" fill="#F2A93B" fill-opacity="0.88"/>
        <circle cx="375" cy="290" r="145" fill="#FACC6B" fill-opacity="0.38"/>
        <!-- Tomato Wedges -->
        <path d="M270 280 A52 52 0 0 1 344 236 L310 296 Z" fill="#E03422" stroke="#F8725E" stroke-width="3"/>
        <path d="M462 382 A52 52 0 0 1 516 318 L452 332 Z" fill="#E03422" stroke="#F8725E" stroke-width="3"/>
        <!-- Pineapple Fan Slices -->
        <path d="M430 218 L496 244 A48 48 0 0 1 452 292 Z" fill="#FFD23F" stroke="#E09F18" stroke-width="3"/>
        <!-- Poached Fish Fillet Centerpiece -->
        <rect x="336" y="276" width="124" height="72" rx="28" fill="#FFFDF8" stroke="#E6DAC3" stroke-width="4"/>
        <path d="M358 302 Q398 292 438 302 M358 322 Q398 312 438 322" stroke="#E8C9A5" stroke-width="3" fill="none"/>
        <!-- Okra Slices, Bean Sprouts & Ngò Ôm Herbs -->
        <polygon points="316,374 332,364 344,378 336,396 318,392" fill="#2E8B52" stroke="#9BE082" stroke-width="3"/>
        <polygon points="484,274 500,264 512,278 504,296 486,292" fill="#2E8B52" stroke="#9BE082" stroke-width="3"/>
        <path d="M286 332 Q330 356 368 412" stroke="#FFFDF9" stroke-width="6" stroke-linecap="round" fill="none"/>
        <path d="M412 246 Q442 288 418 396" stroke="#FFFDF9" stroke-width="6" stroke-linecap="round" fill="none"/>
        <ellipse cx="388" cy="306" rx="22" ry="10" transform="rotate(-24 388 306)" fill="#237D48"/>
        <ellipse cx="416" cy="318" rx="20" ry="9" transform="rotate(22 416 318)" fill="#2D9659"/>
      `,
    },
  },
  {
    file: 'vn-stirfry-greens.webp',
    config: {
      bgTop: '#F7FAF2',
      bgBottom: '#DCE8D5',
      vesselType: 'plate',
      sideDip: 'nuoc-mam',
      foodContent: `
        <!-- Glossy Oyster-Sauce Glaze Pool -->
        <circle cx="400" cy="316" r="146" fill="#6E3318" fill-opacity="0.22"/>
        <!-- Layered Jade Bok Choy (Cải thìa xào nấm đông cô & tỏi phi) -->
        <g>
          <ellipse cx="348" cy="276" rx="76" ry="42" transform="rotate(-28 348 276)" fill="#1E7B46"/>
          <ellipse cx="312" cy="304" rx="44" ry="22" transform="rotate(-28 312 304)" fill="#DCF2DF"/>
          <ellipse cx="446" cy="284" rx="78" ry="44" transform="rotate(24 446 284)" fill="#258F53"/>
          <ellipse cx="480" cy="314" rx="44" ry="22" transform="rotate(24 480 314)" fill="#E4F6E6"/>
          <ellipse cx="394" cy="348" rx="82" ry="46" transform="rotate(-8 394 348)" fill="#1B6E3E"/>
          <ellipse cx="352" cy="362" rx="46" ry="22" transform="rotate(-8 352 362)" fill="#DCF2DF"/>
        </g>
        <!-- Braised Shiitake Mushroom Caps with Star Cut -->
        <g>
          <circle cx="388" cy="264" r="32" fill="#592C19"/>
          <path d="M372 264 H404 M388 248 V280" stroke="#CDA582" stroke-width="4" stroke-linecap="round"/>
          <circle cx="442" cy="352" r="30" fill="#592C19"/>
          <path d="M428 352 H456 M442 338 V366" stroke="#CDA582" stroke-width="4" stroke-linecap="round"/>
        </g>
        <!-- Crispy Golden Garlic Chips & Chili Threads -->
        <circle cx="362" cy="308" r="9" fill="#F0B443"/>
        <circle cx="418" cy="304" r="8" fill="#F4C158"/>
        <circle cx="398" cy="326" r="9" fill="#E8A635"/>
        <ellipse cx="428" cy="278" rx="16" ry="5" transform="rotate(32 428 278)" fill="#E02D22"/>
      `,
    },
  },
  {
    file: 'vn-pho-noodle.webp',
    config: {
      bgTop: '#FBF7EE',
      bgBottom: '#E8DAC6',
      vesselType: 'bowl',
      sideDip: 'herb-lime',
      foodContent: `
        <!-- Aromatic Amber Star-Anise Bone Broth -->
        <circle cx="400" cy="312" r="180" fill="#D89242" fill-opacity="0.72"/>
        <!-- Silky Flat Bánh Phở Rice Noodle Ribbons -->
        <g stroke="#FFFDF9" stroke-width="11" stroke-linecap="round" fill="none">
          <path d="M268 308 Q340 242 442 292 T528 316"/>
          <path d="M264 334 Q352 276 446 322 T524 344"/>
          <path d="M278 360 Q360 308 452 352 T512 372"/>
          <path d="M298 278 Q378 228 468 272"/>
        </g>
        <!-- Rare Beef Slices & Brisket (Phở bò tái nạm) -->
        <ellipse cx="348" cy="274" rx="54" ry="32" transform="rotate(-18 348 274)" fill="#B54840" stroke="#8C342D" stroke-width="3"/>
        <ellipse cx="354" cy="272" rx="32" ry="16" transform="rotate(-18 354 272)" fill="#E58B82" fill-opacity="0.75"/>
        <ellipse cx="448" cy="284" rx="52" ry="30" transform="rotate(16 448 284)" fill="#8B4A36" stroke="#633223" stroke-width="3"/>
        <!-- Shaved White Onion Rings, Thai Basil & Chili -->
        <circle cx="398" cy="328" r="34" fill="none" stroke="#F8F4FA" stroke-width="5" stroke-opacity="0.88"/>
        <circle cx="424" cy="346" r="28" fill="none" stroke="#F8F4FA" stroke-width="4" stroke-opacity="0.82"/>
        <ellipse cx="342" cy="356" rx="26" ry="12" transform="rotate(-28 342 356)" fill="#227E4A"/>
        <ellipse cx="372" cy="374" rx="24" ry="11" transform="rotate(18 372 374)" fill="#2C965A"/>
        <circle cx="468" cy="352" r="8" fill="#E3261B"/>
        <circle cx="486" cy="336" r="7" fill="#E3261B"/>
      `,
    },
  },
  {
    file: 'vn-steamed-rice-tray.webp',
    config: {
      bgTop: '#FCF7EF',
      bgBottom: '#E8D5BC',
      vesselType: 'tray',
      chopsticks: true,
      sideDip: 'none',
      foodContent: `
        <!-- Overhead Vietnamese Family Mâm Cơm Composition on Rattan Tray -->
        <!-- 1. Top-Left Braised Claypot -->
        <circle cx="312" cy="226" r="76" fill="#6E2814" stroke="#4D1A0B" stroke-width="5"/>
        <circle cx="312" cy="226" r="62" fill="#A83B16"/>
        <circle cx="294" cy="220" r="18" fill="#F09A24"/>
        <rect x="316" y="214" width="32" height="26" rx="8" fill="#7D240B"/>
        <!-- 2. Top-Right Sour Soup Bowl -->
        <circle cx="488" cy="226" r="76" fill="#FAF5EC" stroke="#D8CEBE" stroke-width="4"/>
        <circle cx="488" cy="226" r="64" fill="#EDA43A"/>
        <circle cx="470" cy="212" r="16" fill="#E03422"/>
        <ellipse cx="504" cy="236" rx="20" ry="10" transform="rotate(-24 504 236)" fill="#258550"/>
        <!-- 3. Bottom-Left Stir-Fry Greens Plate -->
        <circle cx="316" cy="386" r="74" fill="#DCEEE4" stroke="#2B7A58" stroke-width="3"/>
        <ellipse cx="312" cy="384" rx="46" ry="28" transform="rotate(-20 312 384)" fill="#21804B"/>
        <ellipse cx="328" cy="396" rx="42" ry="24" transform="rotate(18 328 396)" fill="#2C995C"/>
        <!-- 4. Bottom-Right Fluffy Jasmine Rice Bowl -->
        <circle cx="486" cy="386" r="72" fill="#FAF5EC" stroke="#2B7A58" stroke-width="4"/>
        <circle cx="486" cy="386" r="56" fill="#FFFFFF"/>
        <circle cx="474" cy="376" r="38" fill="#F7F3EA" fill-opacity="0.65"/>
        <!-- 5. Center Nước Mắm Chấm Dish -->
        <circle cx="400" cy="306" r="34" fill="#FAF5EC" stroke="#DBD1C1" stroke-width="3"/>
        <circle cx="400" cy="306" r="24" fill="#B54218"/>
        <circle cx="395" cy="302" r="5" fill="#E6261C"/>
        <circle cx="406" cy="311" r="4" fill="#E6261C"/>
      `,
    },
  },
  {
    file: 'vn-grilled-lemongrass.webp',
    config: {
      bgTop: '#FBF6EE',
      bgBottom: '#E5D3BE',
      vesselType: 'plate',
      sideDip: 'nuoc-mam',
      foodContent: `
        <!-- Fresh Banana Leaf Liner on Stoneware Plate -->
        <ellipse cx="400" cy="316" rx="162" ry="136" transform="rotate(-12 400 316)" fill="#2A7A49"/>
        <!-- Caramelized Grilled Lemongrass Pork/Chicken Cutlets (Thịt nướng sả ớt) -->
        <g>
          <rect x="272" y="246" width="176" height="68" rx="28" transform="rotate(-12 360 280)" fill="#9E3E18" stroke="#6B240A" stroke-width="4"/>
          <line x1="296" y1="252" x2="306" y2="306" stroke="#4D1805" stroke-width="5" stroke-linecap="round"/>
          <line x1="338" y1="244" x2="348" y2="298" stroke="#4D1805" stroke-width="5" stroke-linecap="round"/>
          <line x1="380" y1="236" x2="390" y2="290" stroke="#4D1805" stroke-width="5" stroke-linecap="round"/>
          <rect x="316" y="308" width="182" height="70" rx="28" transform="rotate(8 407 343)" fill="#B0481E" stroke="#73280B" stroke-width="4"/>
          <line x1="348" y1="308" x2="342" y2="366" stroke="#4D1805" stroke-width="5" stroke-linecap="round"/>
          <line x1="392" y1="314" x2="386" y2="372" stroke="#4D1805" stroke-width="5" stroke-linecap="round"/>
          <line x1="436" y1="320" x2="430" y2="378" stroke="#4D1805" stroke-width="5" stroke-linecap="round"/>
        </g>
        <!-- Scallion Oil Sheen (Mỡ hành) & Pickled Carrot-Daikon (Đồ chua) -->
        <circle cx="364" cy="274" r="8" fill="#37B567"/>
        <circle cx="382" cy="268" r="7" fill="#37B567"/>
        <circle cx="408" cy="340" r="8" fill="#37B567"/>
        <circle cx="426" cy="346" r="7" fill="#37B567"/>
        <path d="M462 232 Q498 248 486 286" stroke="#FF7E2E" stroke-width="9" stroke-linecap="round" fill="none"/>
        <path d="M478 224 Q514 242 502 280" stroke="#FFFDF9" stroke-width="8" stroke-linecap="round" fill="none"/>
      `,
    },
  },
  {
    file: 'vn-tofu-vegetarian.webp',
    config: {
      bgTop: '#FAF8F1',
      bgBottom: '#E4EAD9',
      vesselType: 'bowl',
      sideDip: 'herb-lime',
      foodContent: `
        <!-- Velvety Ripe Tomato & Scallion Sauce (Đậu hũ sốt cà chua chay) -->
        <circle cx="400" cy="312" r="172" fill="#D93D26" fill-opacity="0.86"/>
        <circle cx="378" cy="292" r="130" fill="#F06449" fill-opacity="0.35"/>
        <!-- Golden Pan-Seared Tofu Puffs -->
        <g>
          <rect x="294" y="236" width="84" height="76" rx="18" transform="rotate(-12 336 274)" fill="#F0B24A" stroke="#C98220" stroke-width="4"/>
          <rect x="306" y="248" width="60" height="52" rx="12" transform="rotate(-12 336 274)" fill="#FCF4E1" fill-opacity="0.55"/>
          <rect x="412" y="242" width="84" height="76" rx="18" transform="rotate(14 454 280)" fill="#F0B24A" stroke="#C98220" stroke-width="4"/>
          <rect x="424" y="254" width="60" height="52" rx="12" transform="rotate(14 454 280)" fill="#FCF4E1" fill-opacity="0.55"/>
          <rect x="352" y="324" width="88" height="76" rx="18" transform="rotate(4 396 362)" fill="#EDA83E" stroke="#C98220" stroke-width="4"/>
          <rect x="364" y="336" width="64" height="52" rx="12" transform="rotate(4 396 362)" fill="#FCF4E1" fill-opacity="0.55"/>
        </g>
        <!-- Cilantro & Scallion Garnish -->
        <ellipse cx="394" cy="298" rx="22" ry="10" transform="rotate(-25 394 298)" fill="#24854E"/>
        <ellipse cx="416" cy="310" rx="20" ry="9" transform="rotate(25 416 310)" fill="#2E9E5E"/>
        <circle cx="332" cy="354" r="9" fill="#32A862"/>
        <circle cx="474" cy="348" r="8" fill="#32A862"/>
      `,
    },
  },
  {
    file: 'vn-crispy-fried.webp',
    config: {
      bgTop: '#FCF7EE',
      bgBottom: '#EAD7BC',
      vesselType: 'plate',
      sideDip: 'nuoc-mam',
      foodContent: `
        <!-- Crisp Lettuce & Fresh Mint Bed -->
        <circle cx="352" cy="288" r="68" fill="#52B062" fill-opacity="0.85"/>
        <circle cx="436" cy="276" r="64" fill="#3C9950" fill-opacity="0.85"/>
        <circle cx="388" cy="356" r="66" fill="#64BF70" fill-opacity="0.82"/>
        <!-- Golden Crispy Vietnamese Spring Rolls (Chả giò giòn rụm) -->
        <g>
          <rect x="278" y="248" width="196" height="46" rx="23" transform="rotate(-22 376 271)" fill="#E69A28" stroke="#B56A10" stroke-width="4"/>
          <rect x="296" y="294" width="196" height="46" rx="23" transform="rotate(-16 394 317)" fill="#F0AA36" stroke="#BA7014" stroke-width="4"/>
          <rect x="318" y="340" width="192" height="46" rx="23" transform="rotate(-10 414 363)" fill="#E29322" stroke="#AD640E" stroke-width="4"/>
          <!-- Blistered Golden Wrapper Highlights -->
          <circle cx="352" cy="274" r="7" fill="#FFE094" fill-opacity="0.65"/>
          <circle cx="408" cy="258" r="6" fill="#FFE094" fill-opacity="0.65"/>
          <circle cx="384" cy="318" r="7" fill="#FFE094" fill-opacity="0.65"/>
          <circle cx="432" cy="358" r="7" fill="#FFE094" fill-opacity="0.65"/>
        </g>
      `,
    },
  },
  {
    file: 'vn-porridge-congee.webp',
    config: {
      bgTop: '#FCF9F2',
      bgBottom: '#E8DFD1',
      vesselType: 'bowl',
      sideDip: 'herb-lime',
      foodContent: `
        <!-- Velvety Simmered Jasmine Rice Congee (Cháo ấm bụng) -->
        <circle cx="400" cy="312" r="176" fill="#FAF4E8"/>
        <circle cx="392" cy="306" r="144" fill="#FFFDF9"/>
        <!-- Crispy Golden Quẩy Cruller Slices -->
        <ellipse cx="328" cy="268" rx="34" ry="20" transform="rotate(-28 328 268)" fill="#E39A30" stroke="#B36D14" stroke-width="3"/>
        <ellipse cx="364" cy="248" rx="32" ry="19" transform="rotate(-18 364 248)" fill="#EDA63B" stroke="#B36D14" stroke-width="3"/>
        <!-- Shredded Chicken / Mushroom & Soft Egg Center -->
        <circle cx="434" cy="284" r="36" fill="#FFF9EE" stroke="#E5D9C5" stroke-width="2"/>
        <circle cx="434" cy="284" r="20" fill="#F29B1D"/>
        <!-- Julienne Ginger, Scallion Curls & Cracked Black Pepper -->
        <g stroke="#F0B94D" stroke-width="4" stroke-linecap="round">
          <line x1="354" y1="326" x2="398" y2="310"/>
          <line x1="364" y1="342" x2="412" y2="332"/>
          <line x1="348" y1="356" x2="394" y2="352"/>
        </g>
        <circle cx="336" cy="336" r="10" fill="#2A9456"/>
        <circle cx="448" cy="348" r="11" fill="#2A9456"/>
        <circle cx="418" cy="366" r="9" fill="#35AB66"/>
        <circle cx="388" cy="286" r="2.5" fill="#2C2623"/>
        <circle cx="402" cy="296" r="2.5" fill="#2C2623"/>
        <circle cx="376" cy="302" r="2.5" fill="#2C2623"/>
      `,
    },
  },
  {
    file: 'vn-fresh-rolls.webp',
    config: {
      bgTop: '#F8FBF5',
      bgBottom: '#DDE9D8',
      vesselType: 'plate',
      sideDip: 'none',
      foodContent: `
        <!-- Peanut Hoisin Dipping Bowl on Plate -->
        <circle cx="468" cy="252" r="52" fill="#FAF5EC" stroke="#DBD1C0" stroke-width="3"/>
        <circle cx="468" cy="252" r="40" fill="#6E371B"/>
        <circle cx="462" cy="248" r="5" fill="#F2C879"/>
        <circle cx="476" cy="256" r="4.5" fill="#F2C879"/>
        <circle cx="468" cy="262" r="4" fill="#E02B20"/>
        <!-- Three Translucent Vietnamese Gỏi Cuốn Summer Rolls -->
        <g>
          <rect x="242" y="256" width="172" height="52" rx="26" transform="rotate(-18 328 282)" fill="#FBF9F4" fill-opacity="0.92" stroke="#E2DDD2" stroke-width="3"/>
          <circle cx="294" cy="292" r="14" fill="#F26B52"/>
          <circle cx="332" cy="280" r="14" fill="#F26B52"/>
          <ellipse cx="368" cy="268" rx="20" ry="10" transform="rotate(-18 368 268)" fill="#2A8F54"/>

          <rect x="262" y="316" width="182" height="52" rx="26" transform="rotate(-12 353 342)" fill="#FBF9F4" fill-opacity="0.92" stroke="#E2DDD2" stroke-width="3"/>
          <circle cx="314" cy="350" r="14" fill="#F26B52"/>
          <circle cx="354" cy="342" r="14" fill="#F26B52"/>
          <ellipse cx="394" cy="332" rx="22" ry="10" transform="rotate(-12 394 332)" fill="#2A8F54"/>

          <rect x="292" y="376" width="176" height="50" rx="25" transform="rotate(-6 380 401)" fill="#FBF9F4" fill-opacity="0.92" stroke="#E2DDD2" stroke-width="3"/>
          <circle cx="344" cy="404" r="14" fill="#F26B52"/>
          <circle cx="384" cy="400" r="14" fill="#F26B52"/>
          <ellipse cx="424" cy="396" rx="20" ry="10" fill="#2A8F54"/>
        </g>
      `,
    },
  },
  {
    file: 'gl-japanese-donburi.webp',
    config: {
      bgTop: '#FAF6EE',
      bgBottom: '#E4D8C7',
      vesselType: 'lacquer',
      sideDip: 'none',
      foodContent: `
        <!-- Steamed Short-Grain Rice Base -->
        <circle cx="400" cy="312" r="176" fill="#FFFDF8"/>
        <!-- Teriyaki-Glazed Salmon / Chicken Fillet -->
        <rect x="268" y="226" width="168" height="92" rx="34" transform="rotate(-14 352 272)" fill="#DC5B3E" stroke="#9E331B" stroke-width="4"/>
        <path d="M292 262 Q352 246 412 264 M296 286 Q356 270 416 288" stroke="#F8A88C" stroke-width="4" fill="none" opacity="0.7"/>
        <!-- Ajitsuke Soft-Boiled Jammy Egg -->
        <ellipse cx="468" cy="296" rx="46" ry="54" transform="rotate(14 468 296)" fill="#DFB282" stroke="#9E6A38" stroke-width="3"/>
        <circle cx="468" cy="302" r="24" fill="#EA7B15"/>
        <!-- Emerald Edamame Beans, Pickled Ginger & Nori Strips -->
        <circle cx="334" cy="368" r="14" fill="#43B05C"/>
        <circle cx="362" cy="382" r="14" fill="#43B05C"/>
        <circle cx="392" cy="376" r="14" fill="#379B4E"/>
        <rect x="434" y="366" width="58" height="22" rx="4" transform="rotate(-24 463 377)" fill="#1C2421"/>
        <rect x="454" y="382" width="58" height="22" rx="4" transform="rotate(-12 483 393)" fill="#1C2421"/>
      `,
    },
  },
  {
    file: 'gl-korean-bibimbap.webp',
    config: {
      bgTop: '#FBF5EC',
      bgBottom: '#E6D2BA',
      vesselType: 'stonepot',
      sideDip: 'none',
      foodContent: `
        <!-- Radial Seasonal Namul Sections in Sizzling Dolsot Bowl -->
        <circle cx="400" cy="312" r="174" fill="#FAF5EA"/>
        <!-- Spinach Green Sector -->
        <ellipse cx="312" cy="248" rx="54" ry="34" transform="rotate(-35 312 248)" fill="#1E7B45"/>
        <!-- Julienne Carrot Sector -->
        <ellipse cx="486" cy="248" rx="54" ry="34" transform="rotate(35 486 248)" fill="#EE6A26"/>
        <!-- Shiitake / Bulgogi Beef Sector -->
        <ellipse cx="496" cy="358" rx="56" ry="36" transform="rotate(-25 496 358)" fill="#63321E"/>
        <!-- Golden Bean Sprouts Sector -->
        <ellipse cx="304" cy="358" rx="56" ry="36" transform="rotate(25 304 358)" fill="#F2C85B"/>
        <!-- Kimchi Crimson Sector -->
        <ellipse cx="400" cy="408" rx="58" ry="30" fill="#D42C1E"/>
        <!-- Sunny-Side Egg & Gochujang Dollop Center -->
        <circle cx="400" cy="306" r="56" fill="#FFFFFF"/>
        <circle cx="400" cy="306" r="26" fill="#F29416"/>
        <circle cx="400" cy="222" r="24" fill="#BA1F16"/>
      `,
    },
  },
  {
    file: 'gl-italian-pasta.webp',
    config: {
      bgTop: '#FCF8F0',
      bgBottom: '#EADBC8',
      vesselType: 'plate',
      chopsticks: false,
      sideDip: 'herb-lime',
      foodContent: `
        <!-- Rich San Marzano Tomato-Basil Coulis -->
        <circle cx="400" cy="316" r="142" fill="#C9331E" fill-opacity="0.88"/>
        <!-- Twirled Artisanal Tagliatelle Nest -->
        <g stroke="#F5C453" stroke-width="14" stroke-linecap="round" fill="none">
          <path d="M312 312 C312 252 488 252 488 312 C488 372 328 372 328 312 C328 272 456 272 456 312 C456 346 356 346 356 312"/>
          <path d="M296 332 Q398 268 496 328" stroke="#FAD373" stroke-width="11"/>
        </g>
        <!-- Shaved Parmigiano & Sweet Basil Crown -->
        <rect x="356" y="256" width="38" height="20" rx="6" transform="rotate(-18 375 266)" fill="#FFF8E3" fill-opacity="0.9"/>
        <rect x="424" y="338" width="38" height="20" rx="6" transform="rotate(22 443 348)" fill="#FFF8E3" fill-opacity="0.9"/>
        <ellipse cx="392" cy="306" rx="28" ry="15" transform="rotate(-26 392 306)" fill="#1F8249"/>
        <ellipse cx="418" cy="316" rx="24" ry="13" transform="rotate(24 418 316)" fill="#2B9C5B"/>
      `,
    },
  },
  {
    file: 'gl-thai-curry.webp',
    config: {
      bgTop: '#FAF8EF',
      bgBottom: '#E0E8D5',
      vesselType: 'bowl',
      sideDip: 'herb-lime',
      foodContent: `
        <!-- Creamy Coconut Emerald-Turmeric Curry Broth -->
        <circle cx="400" cy="312" r="176" fill="#E89D32"/>
        <!-- Swirl of Coconut Cream -->
        <path d="M326 296 C352 252 448 256 462 312 C472 354 368 372 354 326" fill="none" stroke="#FFFDF8" stroke-width="10" stroke-linecap="round" opacity="0.72"/>
        <!-- Thai Eggplant Halves, Bamboo Shoots, Seared Protein & Red Chili -->
        <circle cx="332" cy="272" r="28" fill="#3D945B" stroke="#1E6337" stroke-width="4"/>
        <circle cx="458" cy="346" r="28" fill="#3D945B" stroke="#1E6337" stroke-width="4"/>
        <rect x="378" y="268" width="76" height="52" rx="20" transform="rotate(16 416 294)" fill="#F5DFBA"/>
        <rect x="336" y="332" width="76" height="50" rx="20" transform="rotate(-14 374 357)" fill="#F5DFBA"/>
        <ellipse cx="446" cy="262" rx="28" ry="9" transform="rotate(-32 446 262)" fill="#E0241A"/>
        <ellipse cx="398" cy="312" rx="24" ry="12" transform="rotate(18 398 312)" fill="#1B7542"/>
      `,
    },
  },
  {
    file: 'gl-chinese-wok.webp',
    config: {
      bgTop: '#FCF6EE',
      bgBottom: '#E6D4BE',
      vesselType: 'lacquer',
      sideDip: 'none',
      foodContent: `
        <!-- Smoky Wok-Hei Savory Glaze -->
        <circle cx="400" cy="312" r="174" fill="#5E2412"/>
        <!-- Glazed Crispy Cubes, Crisp Snap Peas, Bell Peppers & Roasted Cashews -->
        <g>
          <rect x="312" y="236" width="68" height="62" rx="18" transform="rotate(-16 346 267)" fill="#BA431C" stroke="#E06638" stroke-width="3"/>
          <rect x="412" y="246" width="68" height="62" rx="18" transform="rotate(18 446 277)" fill="#C44920" stroke="#E06638" stroke-width="3"/>
          <rect x="356" y="324" width="72" height="64" rx="18" transform="rotate(-6 392 356)" fill="#B53E18" stroke="#E06638" stroke-width="3"/>
          <!-- Crisp Jade Snap Peas -->
          <ellipse cx="316" cy="336" rx="42" ry="15" transform="rotate(28 316 336)" fill="#2FA35D"/>
          <ellipse cx="468" cy="342" rx="42" ry="15" transform="rotate(-28 468 342)" fill="#2FA35D"/>
          <!-- Red Bell Pepper Diamonds & Golden Cashews -->
          <polygon points="396,226 426,248 402,276 374,252" fill="#E32D22"/>
          <circle cx="386" cy="304" r="16" fill="#F2CA7E"/>
          <circle cx="442" cy="382" r="15" fill="#F2CA7E"/>
        </g>
      `,
    },
  },
  {
    file: 'culinary-signature-default.webp',
    config: {
      bgTop: '#FBF7EF',
      bgBottom: '#E5DEC9',
      vesselType: 'bowl',
      sideDip: 'herb-lime',
      foodContent: `
        <!-- Takolio Terra-Botanical Signature Nourish Bowl -->
        <circle cx="400" cy="312" r="176" fill="#FAF4E6"/>
        <!-- Herb-Infused Jasmine Grains -->
        <circle cx="348" cy="336" r="78" fill="#FFFDF8"/>
        <!-- Seared Terracotta Glazed Protein / Plant Cut -->
        <rect x="282" y="224" width="136" height="68" rx="28" transform="rotate(-18 350 258)" fill="#D94E34" stroke="#A6331E" stroke-width="4"/>
        <!-- Emerald Greens Fan -->
        <ellipse cx="468" cy="264" rx="58" ry="30" transform="rotate(26 468 264)" fill="#1F7E49"/>
        <ellipse cx="484" cy="304" rx="54" ry="28" transform="rotate(42 484 304)" fill="#2C995B"/>
        <!-- Soft Golden Jammy Egg & Botanical Sprouts -->
        <circle cx="444" cy="364" r="42" fill="#FFFDF9" stroke="#E5DAC6" stroke-width="3"/>
        <circle cx="444" cy="364" r="22" fill="#F29B1D"/>
        <circle cx="388" cy="306" r="10" fill="#2A8C54"/>
        <circle cx="406" cy="318" r="8" fill="#E5533D"/>
      `,
    },
  },
];

// ---------------------------------------------------------------------------
// Brand Marks, PWA Icons & 3D Stage Poster Fallbacks (`public/takolio/v4/brand/`)
// ---------------------------------------------------------------------------
function buildV4LogoMarkSVG({ bg = 'none', padding = 0 } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <defs>
      <radialGradient id="takoCoral" cx="0.38" cy="0.32" r="0.68">
        <stop offset="0%" stop-color="#FF7863"/>
        <stop offset="62%" stop-color="#E5533D"/>
        <stop offset="100%" stop-color="#B83522"/>
      </radialGradient>
      <linearGradient id="toqueIvory" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#FFFFFF"/>
        <stop offset="100%" stop-color="#EFE7DA"/>
      </linearGradient>
      <linearGradient id="herbApron" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#25845B"/>
        <stop offset="100%" stop-color="#155338"/>
      </linearGradient>
    </defs>
    ${bg !== 'none' ? `<rect width="512" height="512" rx="112" fill="${bg}"/>` : ''}
    <g transform="translate(${padding}, ${padding}) scale(${(512 - padding * 2) / 512})">
      <!-- Ground Soft Contact Shadow -->
      <ellipse cx="256" cy="442" rx="154" ry="26" fill="#1B2A24" fill-opacity="0.14"/>
      <!-- Puffed Chef Toque -->
      <path d="M168 164 C142 124 172 74 216 82 C232 54 280 54 296 82 C340 74 370 124 344 164 Z" fill="url(#toqueIvory)" stroke="#D9CFC0" stroke-width="6"/>
      <rect x="172" y="150" width="168" height="36" rx="14" fill="#FBF8F3" stroke="#D9CFC0" stroke-width="5"/>
      <!-- Botanical Leaf Emblem on Toque -->
      <path d="M256 112 C282 102 302 120 292 146 C268 154 250 136 256 112 Z" fill="#1B6B4A"/>
      <path d="M252 124 C234 118 222 130 228 148 C244 152 254 140 252 124 Z" fill="#2E9468"/>
      <!-- Curled Tentacles -->
      <path d="M148 338 C98 352 72 396 102 422 C126 442 162 424 176 394" fill="none" stroke="url(#takoCoral)" stroke-width="38" stroke-linecap="round"/>
      <path d="M364 338 C414 352 440 396 410 422 C386 442 350 424 336 394" fill="none" stroke="url(#takoCoral)" stroke-width="38" stroke-linecap="round"/>
      <path d="M204 358 C192 398 176 428 206 436" fill="none" stroke="url(#takoCoral)" stroke-width="34" stroke-linecap="round"/>
      <path d="M308 358 C320 398 336 428 306 436" fill="none" stroke="url(#takoCoral)" stroke-width="34" stroke-linecap="round"/>
      <!-- Sculpted Head Dome -->
      <ellipse cx="256" cy="272" rx="126" ry="114" fill="url(#takoCoral)"/>
      <!-- Cheek Blush -->
      <ellipse cx="178" cy="288" rx="22" ry="13" fill="#FFB3A7" fill-opacity="0.55"/>
      <ellipse cx="334" cy="288" rx="22" ry="13" fill="#FFB3A7" fill-opacity="0.55"/>
      <!-- Glossy Eyes + Catchlights -->
      <ellipse cx="208" cy="264" rx="20" ry="25" fill="#101B24"/>
      <circle cx="201" cy="254" r="7" fill="#FFFDF9"/>
      <ellipse cx="304" cy="264" rx="20" ry="25" fill="#101B24"/>
      <circle cx="297" cy="254" r="7" fill="#FFFDF9"/>
      <!-- Joyful Smile -->
      <path d="M232 302 Q256 324 280 302" fill="none" stroke="#651F2A" stroke-width="10" stroke-linecap="round"/>
      <!-- Fitted Botanical Herb Apron -->
      <path d="M182 344 Q256 362 330 344 L318 408 Q256 424 194 408 Z" fill="url(#herbApron)" stroke="#FBF8F3" stroke-width="5"/>
      <!-- Wooden Cooking Ladle -->
      <line x1="392" y1="382" x2="432" y2="236" stroke="#C88A52" stroke-width="16" stroke-linecap="round"/>
      <ellipse cx="436" cy="222" rx="24" ry="30" transform="rotate(14 436 222)" fill="#D99B62" stroke="#A66D38" stroke-width="4"/>
    </g>
  </svg>`;
}

function build3DPosterSVG(variant) {
  const configs = {
    'tako-chef-poster.webp': {
      bgA: '#FFF9F2',
      bgB: '#F2E4D4',
      body: `<g transform="translate(144, 44)">${buildV4LogoMarkSVG()
        .replace(/^<svg[^>]+>/, '')
        .replace(/<\/svg>\s*$/, '')}</g>`,
    },
    'kitchen-island-poster.webp': {
      bgA: '#FBF7EF',
      bgB: '#E4EFE8',
      body: `
        <ellipse cx="400" cy="488" rx="300" ry="52" fill="#1B6B4A" fill-opacity="0.12"/>
        <!-- Smart Fridge Left -->
        <rect x="132" y="138" width="146" height="310" rx="22" fill="#CFD8DF" stroke="#9AA8B4" stroke-width="4"/>
        <rect x="148" y="156" width="114" height="274" rx="14" fill="#FFF9EE"/>
        <rect x="154" y="232" width="102" height="8" rx="4" fill="#8CD4B5"/>
        <rect x="154" y="318" width="102" height="8" rx="4" fill="#8CD4B5"/>
        <!-- Butcher Block Kitchen Island -->
        <rect x="242" y="316" width="336" height="148" rx="20" fill="#1B6B4A"/>
        <rect x="228" y="292" width="364" height="32" rx="12" fill="#C88D56"/>
        <!-- Simmering Claypot on Island -->
        <ellipse cx="352" cy="276" rx="54" ry="32" fill="#8B3820"/>
        <ellipse cx="352" cy="264" rx="44" ry="14" fill="#C94B1E"/>
        <!-- Floating Fresh Ingredients -->
        <circle cx="316" cy="176" r="22" fill="#E03825"/>
        <ellipse cx="418" cy="156" rx="28" ry="18" transform="rotate(-22 418 156)" fill="#268750"/>
        <rect x="488" y="182" width="36" height="28" rx="8" fill="#FCF4E3" stroke="#DFD3BC" stroke-width="2"/>
        <!-- Tako Chef Beside Island -->
        <circle cx="626" cy="346" r="58" fill="#E5533D"/>
        <ellipse cx="626" cy="278" rx="42" ry="26" fill="#FBF8F3"/>
      `,
    },
    'mam-com-poster.webp': {
      bgA: '#FCF7EE',
      bgB: '#EAD8C0',
      body: `
        <circle cx="400" cy="300" r="226" fill="#C68C53" stroke="#9A6332" stroke-width="12"/>
        <circle cx="342" cy="252" r="56" fill="#82341D"/>
        <circle cx="342" cy="252" r="44" fill="#B54118"/>
        <circle cx="462" cy="252" r="56" fill="#FAF5EC"/>
        <circle cx="462" cy="252" r="44" fill="#EA9F38"/>
        <circle cx="400" cy="354" r="54" fill="#2B7A58"/>
        <circle cx="400" cy="354" r="38" fill="#329C5E"/>
        <!-- 5 Radial Rice Bowls -->
        <circle cx="400" cy="118" r="34" fill="#FAF5EC" stroke="#2B7A58" stroke-width="4"/>
        <circle cx="572" cy="244" r="34" fill="#FAF5EC" stroke="#2B7A58" stroke-width="4"/>
        <circle cx="506" cy="446" r="34" fill="#FAF5EC" stroke="#2B7A58" stroke-width="4"/>
        <circle cx="294" cy="446" r="34" fill="#FAF5EC" stroke="#2B7A58" stroke-width="4"/>
        <circle cx="228" cy="244" r="34" fill="#FAF5EC" stroke="#2B7A58" stroke-width="4"/>
      `,
    },
    'smart-fridge-poster.webp': {
      bgA: '#F6FAF8',
      bgB: '#DFECE6',
      body: `
        <rect x="236" y="54" width="328" height="492" rx="34" fill="#CBD4DC" stroke="#9BA8B4" stroke-width="6"/>
        <rect x="258" y="78" width="284" height="178" rx="18" fill="#FCF8F0"/>
        <rect x="258" y="270" width="284" height="122" rx="18" fill="#E6F4FF"/>
        <rect x="258" y="406" width="284" height="116" rx="18" fill="#C78E55"/>
        <circle cx="512" cy="104" r="12" fill="#F59E0B"/>
        <ellipse cx="332" cy="196" rx="44" ry="26" fill="#268750"/>
        <circle cx="428" cy="204" r="20" fill="#DF3A27"/>
        <rect x="304" y="322" width="96" height="44" rx="14" fill="#DE6356"/>
        <ellipse cx="348" cy="462" rx="48" ry="34" fill="#DDA955"/>
      `,
    },
    'cookware-stage-poster.webp': {
      bgA: '#FBF6EE',
      bgB: '#E7DAC8',
      body: `
        <rect x="196" y="396" width="408" height="58" rx="22" fill="#1D252C"/>
        <ellipse cx="400" cy="392" rx="126" ry="22" fill="#FF7B36" fill-opacity="0.65"/>
        <path d="M214 256 H586 C566 356 492 396 400 396 C308 396 234 356 214 256 Z" fill="#262C31"/>
        <rect x="92" y="222" width="142" height="24" rx="12" transform="rotate(12 92 222)" fill="#C4874E"/>
        <ellipse cx="372" cy="256" rx="68" ry="24" fill="#258550"/>
        <ellipse cx="442" cy="258" rx="54" ry="20" fill="#E2452E"/>
      `,
    },
  };

  const c = configs[variant];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
    <defs>
      <linearGradient id="pbg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${c.bgA}"/>
        <stop offset="100%" stop-color="${c.bgB}"/>
      </linearGradient>
    </defs>
    <rect width="800" height="600" fill="url(#pbg)"/>
    ${c.body}
  </svg>`;
}

export async function generateAllV4Assets() {
  await mkdir(OUT_DISHES_DIR, { recursive: true });
  await mkdir(OUT_BRAND_DIR, { recursive: true });

  const generatedDishes = [];
  for (const spec of DISH_SPECIFICATIONS) {
    const svgMarkup = buildEditorialStageSVG(spec.config);
    const outPath = resolve(OUT_DISHES_DIR, spec.file);
    await sharp(Buffer.from(svgMarkup), { density: 144 })
      .resize(800, 600)
      .webp({ quality: 90, effort: 4 })
      .toFile(outPath);
    generatedDishes.push(`/takolio/v4/dishes/${spec.file}`);
  }

  // Brand SVGs & PWA Icons
  const markSvg = buildV4LogoMarkSVG();
  const appRegularSvg = buildV4LogoMarkSVG({ bg: '#FBF8F3', padding: 28 });
  const appMaskableSvg = buildV4LogoMarkSVG({ bg: '#1B6B4A', padding: 86 });
  const buildLockupSvg = (dark = false) => `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="80" viewBox="0 0 320 80">
    <g transform="translate(4, 4) scale(0.140625)">${markSvg
      .replace(/^<svg[^>]+>/, '')
      .replace(/<\/svg>\s*$/, '')}</g>
    <text x="86" y="54" fill="${dark ? '#FBF8F3' : '#1F2937'}" font-family="system-ui, -apple-system, 'Plus Jakarta Sans', sans-serif" font-size="44" font-weight="800" letter-spacing="-1.2">Takolio</text>
    <path d="M254 22 C264 17 273 23 270 33 C261 37 252 31 254 22 Z" fill="#1B6B4A"/>
  </svg>\n`;

  await writeFile(resolve(OUT_BRAND_DIR, 'logo-mark.svg'), markSvg);
  await writeFile(resolve(OUT_BRAND_DIR, 'logo-lockup.svg'), buildLockupSvg(false));
  await writeFile(resolve(OUT_BRAND_DIR, 'logo-lockup-dark.svg'), buildLockupSvg(true));
  await writeFile(resolve(OUT_BRAND_DIR, 'favicon.svg'), appRegularSvg);

  const pwaSizes = [16, 24, 32, 48, 64, 128, 180, 192, 256, 512];
  const generatedBrand = [
    '/takolio/v4/brand/logo-mark.svg',
    '/takolio/v4/brand/logo-lockup.svg',
    '/takolio/v4/brand/logo-lockup-dark.svg',
    '/takolio/v4/brand/favicon.svg',
  ];

  for (const sz of pwaSizes) {
    const pngPath = resolve(OUT_BRAND_DIR, `icon-${sz}.png`);
    await sharp(Buffer.from(appRegularSvg))
      .resize(sz, sz)
      .png({ compressionLevel: 9 })
      .toFile(pngPath);
    generatedBrand.push(`/takolio/v4/brand/icon-${sz}.png`);
  }

  await sharp(Buffer.from(appRegularSvg))
    .resize(180, 180)
    .png({ compressionLevel: 9 })
    .toFile(resolve(OUT_BRAND_DIR, 'apple-touch-icon.png'));
  generatedBrand.push('/takolio/v4/brand/apple-touch-icon.png');

  await sharp(Buffer.from(appMaskableSvg))
    .resize(512, 512)
    .png({ compressionLevel: 9 })
    .toFile(resolve(OUT_BRAND_DIR, 'icon-maskable-512.png'));
  generatedBrand.push('/takolio/v4/brand/icon-maskable-512.png');

  // 3D Stage Poster WebP Fallbacks
  const posterFiles = [
    'tako-chef-poster.webp',
    'kitchen-island-poster.webp',
    'mam-com-poster.webp',
    'smart-fridge-poster.webp',
    'cookware-stage-poster.webp',
  ];
  for (const poster of posterFiles) {
    const svg = build3DPosterSVG(poster);
    await sharp(Buffer.from(svg), { density: 144 })
      .resize(800, 600)
      .webp({ quality: 88 })
      .toFile(resolve(OUT_BRAND_DIR, poster));
    generatedBrand.push(`/takolio/v4/brand/${poster}`);
  }

  const manifest = {
    version: '4.0.0',
    theme: 'Terra-Botanical Atelier',
    models3D: [
      '/takolio/v4/3d/tako-chef-v4.glb',
      '/takolio/v4/3d/kitchen-island-hero.glb',
      '/takolio/v4/3d/onboarding-mam-com.glb',
      '/takolio/v4/3d/smart-fridge-3zone.glb',
      '/takolio/v4/3d/culinary-cookware-stage.glb',
    ],
    dishes: generatedDishes,
    brand: generatedBrand,
  };
  await writeFile(
    resolve(OUT_V4_DIR, 'asset-manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n'
  );

  return manifest;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const manifest = await generateAllV4Assets();
  console.log(
    `[V4 ASSETS OK] ${manifest.dishes.length} dishes (800x600 WebP) + ${manifest.brand.length} brand/PWA/poster assets written to public/takolio/v4/`
  );
}
