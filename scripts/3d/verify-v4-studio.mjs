#!/usr/bin/env node
/**
 * Takolio V4 — Automated End-to-End 3D GLB, Dish WebP & Brand Asset Verifier
 */
import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, '../..');
const V4_DIR = resolve(ROOT_DIR, 'public/takolio/v4');

const EXPECTED_GLBS = [
  {
    file: '3d/tako-chef-v4.glb',
    requiredNodes: [
      'Head',
      'Toque',
      'Apron',
      'LadleArm',
      'Eyes',
      'Tentacle_0',
      'Tentacle_1',
      'Tentacle_2',
      'Tentacle_3',
      'Tentacle_4',
      'Tentacle_5',
      'Tentacle_6',
      'Tentacle_7',
    ],
  },
  {
    file: '3d/kitchen-island-hero.glb',
    requiredNodes: [
      'Zone_Fridge',
      'Zone_Cooktop',
      'Zone_Prep',
      'Tako_Hero',
      'Floating_Ingredients',
      'Ing_Tomato',
      'Ing_Egg',
      'Ing_Greens',
      'Ing_Tofu',
      'Ing_PorkFish',
      'Ing_Chili',
    ],
  },
  {
    file: '3d/onboarding-mam-com.glb',
    requiredNodes: [
      'MamCom_Tray',
      'Dish_Claypot',
      'Dish_Soup',
      'Dish_StirFry',
      'Place_1',
      'Place_2',
      'Place_3',
      'Place_4',
      'Place_5',
    ],
  },
  {
    file: '3d/smart-fridge-3zone.glb',
    requiredNodes: ['Zone_Cool', 'Zone_Freeze', 'Zone_Pantry', 'Expiry_Beacon'],
  },
  {
    file: '3d/culinary-cookware-stage.glb',
    requiredNodes: [
      'Burner_Base',
      'Flame_Ring',
      'Rig_Wok',
      'Rig_Claypot',
      'Rig_Stockpot',
      'Rig_Steamer',
      'Rig_PrepBoard',
    ],
  },
];

const EXPECTED_DISHES = [
  'vn-braised-claypot.webp',
  'vn-sour-soup.webp',
  'vn-stirfry-greens.webp',
  'vn-pho-noodle.webp',
  'vn-steamed-rice-tray.webp',
  'vn-grilled-lemongrass.webp',
  'vn-tofu-vegetarian.webp',
  'vn-crispy-fried.webp',
  'vn-porridge-congee.webp',
  'vn-fresh-rolls.webp',
  'gl-japanese-donburi.webp',
  'gl-korean-bibimbap.webp',
  'gl-italian-pasta.webp',
  'gl-thai-curry.webp',
  'gl-chinese-wok.webp',
  'culinary-signature-default.webp',
];

async function main() {
  for (const spec of EXPECTED_GLBS) {
    const full = resolve(V4_DIR, spec.file);
    const buf = await readFile(full);
    const magic = buf.readUInt32LE(0);
    const version = buf.readUInt32LE(4);
    const len = buf.readUInt32LE(8);
    const jsonLen = buf.readUInt32LE(12);
    const jsonType = buf.readUInt32LE(16);
    const jsonStr = buf.subarray(20, 20 + jsonLen).toString('utf8');
    const gltf = JSON.parse(jsonStr);

    if (magic !== 0x46546c67 || version !== 2 || len !== buf.length || jsonType !== 0x4e4f534a) {
      throw new Error(`GLB header check failed for ${spec.file}`);
    }
    const nodeNames = new Set((gltf.nodes ?? []).map((n) => n.name));
    for (const req of spec.requiredNodes) {
      if (!nodeNames.has(req)) {
        throw new Error(`Missing required node "${req}" in ${spec.file}`);
      }
    }
  }

  for (const dish of EXPECTED_DISHES) {
    const full = resolve(V4_DIR, 'dishes', dish);
    const s = await stat(full);
    if (s.size < 2048) throw new Error(`Dish image unexpectedly small: ${dish}`);
    const meta = await sharp(full).metadata();
    if (meta.width !== 800 || meta.height !== 600 || meta.format !== 'webp') {
      throw new Error(
        `Invalid dish metadata for ${dish}: ${meta.width}x${meta.height} (${meta.format})`
      );
    }
  }

  console.log(
    `[VERIFY OK] All ${EXPECTED_GLBS.length} binary .glb models and ${EXPECTED_DISHES.length} 800x600 WebP dishes passed spec checks!`
  );
}

await main();
