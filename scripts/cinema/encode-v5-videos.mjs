import { execFileSync } from 'node:child_process';
import { mkdirSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const BRAIN_DIR = '/Users/tunbee27/.gemini/antigravity/brain/2469a1d2-5662-4ba1-a9a0-ae7b8f2c42f9';
const OUT_VIDEOS = path.resolve('public/takolio/v5/videos');
const OUT_POSTERS = path.resolve('public/takolio/v5/posters');
const TMP_FRAMES = path.resolve('.artifacts/v5-cinema-frames');

mkdirSync(OUT_VIDEOS, { recursive: true });
mkdirSync(OUT_POSTERS, { recursive: true });
mkdirSync(TMP_FRAMES, { recursive: true });

const FORCE = process.argv.includes('--force');

const SOURCES = {
  wok: path.join(BRAIN_DIR, 'cinema_wok_fire_1794940327636.jpg'),
  claypot: path.join(BRAIN_DIR, 'cinema_claypot_simmer_1794940338854.jpg'),
  prep: path.join(BRAIN_DIR, 'cinema_prep_knife_1794940360753.jpg'),
  soup: path.join(BRAIN_DIR, 'cinema_soup_broth_1794940373777.jpg'),
  fridge: path.join(BRAIN_DIR, 'cinema_fridge_vault_1794940437582.jpg'),
  mamcom: path.join(BRAIN_DIR, 'cinema_mam_com_hearth_1794940446488.jpg'),
  heirloom: path.join(BRAIN_DIR, 'cinema_heirloom_atelier_1794947722874.jpg'),
  'batch-prep': path.join(BRAIN_DIR, 'cinema_batch_prep_vault_1794947731617.jpg'),
};

for (const [key, src] of Object.entries(SOURCES)) {
  if (!existsSync(src)) {
    throw new Error(`Missing cinema keyframe ${key}: ${src}`);
  }
}

// 1. Export high-contrast cinema posters + normalized 1600x1200 master PNGs for crisp zoompan
async function prepareMasters() {
  for (const [key, src] of Object.entries(SOURCES)) {
    await sharp(src)
      .resize(1600, 1200, { fit: 'cover' })
      .modulate({ brightness: 1.0, saturation: 1.08 })
      .png()
      .toFile(path.join(TMP_FRAMES, `${key}.png`));

    await sharp(src)
      .resize(1280, 960, { fit: 'cover' })
      .modulate({ saturation: 1.06 })
      .webp({ quality: 86 })
      .toFile(path.join(OUT_POSTERS, `${key}-poster.webp`));
  }
}

/**
 * Encodes a seamless ping-pong / cross-dissolved cinema motion loop with subtle
 * 35mm camera dolly + warm firelight/steam atmospheric breathing.
 */
function encodeSingleSceneLoop({ inputPng, outMp4, width = 960, height = 720, zoomExpr, panXExpr, panYExpr, warmPulse = false }) {
  const eqFilter = warmPulse
    ? `,eq=brightness='0.018*sin(2*PI*t/2.4)':contrast=1.04:saturation=1.06`
    : `,eq=contrast=1.03:saturation=1.04`;

  // Generate 5s forward clip and crossfade last 1s with first 1s for a true 4s seamless loop!
  const filterComplex = [
    `[0:v]zoompan=z='${zoomExpr}':x='${panXExpr}':y='${panYExpr}':d=150:s=${width}x${height}:fps=30,format=yuv420p${eqFilter},split=2[main][head]`,
    `[main]trim=1:5,setpts=PTS-STARTPTS[body]`,
    `[head]trim=0:1,setpts=PTS-STARTPTS[tail]`,
    `[body][tail]xfade=transition=fade:duration=1:offset=3,format=yuv420p[outv]`,
  ].join(';');

  execFileSync(
    '/opt/homebrew/bin/ffmpeg',
    [
      '-y',
      '-loop', '1',
      '-t', '6',
      '-i', inputPng,
      '-filter_complex', filterComplex,
      '-map', '[outv]',
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '22',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      '-an',
      outMp4,
    ],
    { stdio: 'pipe' },
  );
}

/**
 * Encodes the flagship 4-act Hero Culinary Hearth Reel (1280x960, 12s seamless loop):
 * Fridge Vault -> Mise en Place Knife -> High-Flame Wok Fire -> Family Mam Com -> loop!
 */
function encodeHeroReel(outMp4) {
  const inputs = [
    path.join(TMP_FRAMES, 'fridge.png'),
    path.join(TMP_FRAMES, 'prep.png'),
    path.join(TMP_FRAMES, 'wok.png'),
    path.join(TMP_FRAMES, 'mamcom.png'),
  ];

  const W = 1120;
  const H = 840;
  const filterComplex = [
    `[0:v]zoompan=z='1.02+0.0009*on':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=114:s=${W}x${H}:fps=30,eq=contrast=1.04:saturation=1.05,format=yuv420p,split=2[s0a][s0loop]`,
    `[1:v]zoompan=z='1.12-0.0008*on':x='iw/2-(iw/zoom/2)+18*sin(on/45)':y='ih/2-(ih/zoom/2)':d=114:s=${W}x${H}:fps=30,eq=contrast=1.04:saturation=1.06,format=yuv420p[s1]`,
    `[2:v]zoompan=z='1.03+0.0011*on':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)-12*sin(on/35)':d=114:s=${W}x${H}:fps=30,eq=brightness='0.02*sin(2*PI*t/1.8)':contrast=1.06:saturation=1.08,format=yuv420p[s2]`,
    `[3:v]zoompan=z='1.10-0.0007*on':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=114:s=${W}x${H}:fps=30,eq=contrast=1.04:saturation=1.06,format=yuv420p[s3]`,
    `[s0a]trim=0.8:3.8,setpts=PTS-STARTPTS[c0]`,
    `[s0loop]trim=0:0.8,setpts=PTS-STARTPTS[cend]`,
    `[c0][s1]xfade=transition=fade:duration=0.8:offset=2.2[x1]`,
    `[x1][s2]xfade=transition=fade:duration=0.8:offset=5.2[x2]`,
    `[x2][s3]xfade=transition=fade:duration=0.8:offset=8.2[x3]`,
    `[x3][cend]xfade=transition=fade:duration=0.8:offset=11.2,format=yuv420p[outv]`,
  ].join(';');

  execFileSync(
    '/opt/homebrew/bin/ffmpeg',
    [
      '-y',
      '-loop', '1', '-t', '4', '-i', inputs[0],
      '-loop', '1', '-t', '4', '-i', inputs[1],
      '-loop', '1', '-t', '4', '-i', inputs[2],
      '-loop', '1', '-t', '4', '-i', inputs[3],
      '-filter_complex', filterComplex,
      '-map', '[outv]',
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '22',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      '-an',
      outMp4,
    ],
    { stdio: 'pipe' },
  );
}

await prepareMasters();

const heroOut = path.join(OUT_VIDEOS, 'hero-hearth-reel.mp4');
if (FORCE || !existsSync(heroOut)) {
  console.log('Encoding hero-hearth-reel.mp4...');
  encodeHeroReel(heroOut);
}

const scenes = [
  {
    name: 'fridge-vault-loop.mp4',
    src: 'fridge',
    zoomExpr: '1.02+0.05*sin(PI*on/150)',
    panXExpr: 'iw/2-(iw/zoom/2)+14*sin(2*PI*on/150)',
    panYExpr: 'ih/2-(ih/zoom/2)',
    warmPulse: false,
  },
  {
    name: 'mam-com-hearth-loop.mp4',
    src: 'mamcom',
    zoomExpr: '1.03+0.055*sin(PI*on/150)',
    panXExpr: 'iw/2-(iw/zoom/2)-16*cos(2*PI*on/150)',
    panYExpr: 'ih/2-(ih/zoom/2)',
    warmPulse: true,
  },
  {
    name: 'cook-prep.mp4',
    src: 'prep',
    zoomExpr: '1.04+0.05*sin(PI*on/150)',
    panXExpr: 'iw/2-(iw/zoom/2)+18*sin(2*PI*on/150)',
    panYExpr: 'ih/2-(ih/zoom/2)+8*cos(2*PI*on/150)',
    warmPulse: false,
  },
  {
    name: 'cook-wok-fire.mp4',
    src: 'wok',
    zoomExpr: '1.03+0.065*sin(PI*on/150)',
    panXExpr: 'iw/2-(iw/zoom/2)+12*sin(4*PI*on/150)',
    panYExpr: 'ih/2-(ih/zoom/2)-14*sin(2*PI*on/150)',
    warmPulse: true,
  },
  {
    name: 'cook-claypot.mp4',
    src: 'claypot',
    zoomExpr: '1.03+0.055*sin(PI*on/150)',
    panXExpr: 'iw/2-(iw/zoom/2)-10*sin(2*PI*on/150)',
    panYExpr: 'ih/2-(ih/zoom/2)-10*cos(2*PI*on/150)',
    warmPulse: true,
  },
  {
    name: 'cook-soup.mp4',
    src: 'soup',
    zoomExpr: '1.03+0.05*sin(PI*on/150)',
    panXExpr: 'iw/2-(iw/zoom/2)+12*cos(2*PI*on/150)',
    panYExpr: 'ih/2-(ih/zoom/2)',
    warmPulse: true,
  },
  {
    name: 'cook-plate.mp4',
    src: 'mamcom',
    zoomExpr: '1.08-0.045*sin(PI*on/150)',
    panXExpr: 'iw/2-(iw/zoom/2)',
    panYExpr: 'ih/2-(ih/zoom/2)-10*sin(2*PI*on/150)',
    warmPulse: false,
  },
  {
    name: 'heirloom-atelier-loop.mp4',
    src: 'heirloom',
    zoomExpr: '1.03+0.055*sin(PI*on/150)',
    panXExpr: 'iw/2-(iw/zoom/2)+14*sin(2*PI*on/150)',
    panYExpr: 'ih/2-(ih/zoom/2)-8*cos(2*PI*on/150)',
    warmPulse: true,
  },
  {
    name: 'batch-prep-loop.mp4',
    src: 'batch-prep',
    zoomExpr: '1.03+0.05*sin(PI*on/150)',
    panXExpr: 'iw/2-(iw/zoom/2)-14*cos(2*PI*on/150)',
    panYExpr: 'ih/2-(ih/zoom/2)',
    warmPulse: false,
  },
];

for (const s of scenes) {
  const outMp4 = path.join(OUT_VIDEOS, s.name);
  if (!FORCE && existsSync(outMp4)) continue;
  console.log(`Encoding ${s.name}...`);
  encodeSingleSceneLoop({
    inputPng: path.join(TMP_FRAMES, `${s.src}.png`),
    outMp4,
    zoomExpr: s.zoomExpr,
    panXExpr: s.panXExpr,
    panYExpr: s.panYExpr,
    warmPulse: s.warmPulse,
  });
}

console.log('\n=== V5 CINEMA VIDEOS ENCODED ===');
for (const file of ['hero-hearth-reel.mp4', ...scenes.map((s) => s.name)]) {
  const full = path.join(OUT_VIDEOS, file);
  const kb = Math.round(statSync(full).size / 1024);
  console.log(`✓ ${file}: ${kb} KB`);
}
