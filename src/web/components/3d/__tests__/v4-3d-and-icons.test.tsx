// @vitest-environment jsdom
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

import {
  ActiveCookwareStage3D,
  createRuntimeScene,
  HeroKitchenDiorama3D,
  isWebGL2Supported,
  OnboardingMamCom3D,
  parseGLB,
  raycastSceneNodes,
  SmartFridge3D,
  TakoChef3D,
  updateSceneWorldMatrices,
} from '../index';
import {
  TAKOLIO_ICON_REGISTRY,
  type TakolioIconTone,
} from '../../../design-system/icons';

// Enable React 18 act() environment flag for clean zero-warning jsdom tests
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const PUBLIC_3D = resolve(process.cwd(), 'public/takolio/v4/3d');

describe('Takolio V4 — Binary GLB Loader, Raycast & 5 Compiled Models', () => {
  it('parses all 5 spec-compliant .glb files, computes world bounds, and raycasts interactive nodes', async () => {
    const modelChecks: Array<[string, string[]]> = [
      [
        'tako-chef-v4.glb',
        ['Head', 'Toque', 'Apron', 'LadleArm', 'Eyes', 'Tentacle_0', 'Tentacle_7'],
      ],
      [
        'kitchen-island-hero.glb',
        ['Zone_Fridge', 'Zone_Cooktop', 'Zone_Prep', 'Tako_Hero', 'Floating_Ingredients'],
      ],
      [
        'onboarding-mam-com.glb',
        ['Place_1', 'Place_2', 'Place_3', 'Place_4', 'Place_5'],
      ],
      [
        'smart-fridge-3zone.glb',
        ['Zone_Cool', 'Zone_Freeze', 'Zone_Pantry'],
      ],
      [
        'culinary-cookware-stage.glb',
        ['Flame_Ring', 'Rig_Wok', 'Rig_Claypot', 'Rig_Stockpot', 'Rig_Steamer', 'Rig_PrepBoard'],
      ],
    ];

    for (const [filename, requiredNodes] of modelChecks) {
      const nodeBuf = await readFile(resolve(PUBLIC_3D, filename));
      const arrayBuf = nodeBuf.buffer.slice(
        nodeBuf.byteOffset,
        nodeBuf.byteOffset + nodeBuf.byteLength
      );
      const parsed = parseGLB(arrayBuf, `/takolio/v4/3d/${filename}`);
      expect(parsed.meshes.length).toBeGreaterThan(0);
      expect(parsed.materials.length).toBeGreaterThan(0);
      expect(parsed.sceneBounds.radius).toBeGreaterThan(0.5);

      const runtime = createRuntimeScene(parsed);
      updateSceneWorldMatrices(runtime);

      for (const nodeName of requiredNodes) {
        const found = runtime.nodesByName.get(nodeName);
        expect(found, `Expected node ${nodeName} in ${filename}`).toBeDefined();
      }

      // Raycast toward scene center from +Z camera position
      const c = runtime.sceneBounds.center;
      const hit = raycastSceneNodes(runtime, [c[0], c[1], c[2] + 8], [0, 0, -1]);
      expect(hit).not.toBeNull();
    }
  });
});

describe('Takolio V4 — React 3D Components & Graceful jsdom Fallbacks', () => {
  it('renders TakoChef3D, HeroKitchenDiorama3D, OnboardingMamCom3D, SmartFridge3D, and ActiveCookwareStage3D cleanly', async () => {
    expect(isWebGL2Supported()).toBe(false);

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    const onSelectZone = vi.fn();
    await act(async () => {
      root.render(
        <div>
          <TakoChef3D pose="cook" size={180} />
          <HeroKitchenDiorama3D />
          <OnboardingMamCom3D householdSize={4} spicyLevel={2} mealStyle="Mâm cơm Việt" step={2} />
          <SmartFridge3D
            activeZone="cool"
            onSelectZone={onSelectZone}
            zoneCounts={{ cool: 8, freeze: 3, pantry: 5, expiring: 2 }}
          />
          <ActiveCookwareStage3D
            technique="stir_fry"
            heatLevel="high"
            timerRunning
            timerProgress={0.65}
            stepTitle="Đảo nhanh tay trên lửa lớn"
          />
        </div>
      );
    });

    expect(container.textContent).toContain('Tủ lạnh FEFO');
    expect(container.textContent).toContain('Bếp Mâm Cơm');
    expect(container.textContent).toContain('Quét AI');
    expect(container.textContent).toContain('4 chén đũa');
    expect(container.textContent).toContain('2 sắp hết hạn');
    expect(container.textContent).toContain('Chảo gang & Xẻng đảo');
    expect(container.textContent).toContain('Lửa lớn • Đỏ rực');
    expect(container.textContent).toContain('65%');

    // Click Fridge Freeze tab and verify callback
    const freezeTab = Array.from(container.querySelectorAll('[role="tab"]')).find((el) =>
      el.textContent?.includes('Ngăn đá')
    ) as HTMLButtonElement | undefined;
    expect(freezeTab).toBeDefined();
    await act(async () => {
      freezeTab?.click();
    });
    expect(onSelectZone).toHaveBeenCalledWith('freeze');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});

describe('Takolio V4 — 56 Bespoke Terra-Botanical SVG Icons', () => {
  it('exports 50+ bespoke icon components and renders every tone cleanly', async () => {
    const entries = Object.entries(TAKOLIO_ICON_REGISTRY);
    expect(entries.length).toBeGreaterThanOrEqual(56);

    const tones: TakolioIconTone[] = ['flame', 'jade', 'turmeric', 'ink', 'cream'];
    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <div>
          {entries.map(([name, IconComp], idx) => (
            <IconComp
              key={name}
              size={22}
              tone={tones[idx % tones.length]}
              active={idx % 2 === 0}
              title={name}
            />
          ))}
        </div>
      );
    });

    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBe(entries.length);

    await act(async () => {
      root.unmount();
    });
  });
});

describe('Takolio V5 — Obsidian Hearth 35mm Cinema Video Stages & Assets', () => {
  it('verifies all 8 H.264 .mp4 loops and 6 .webp posters exist on disk and switches video chapters dynamically', async () => {
    const publicRoot = resolve(process.cwd(), 'public');
    const requiredVideos = [
      'takolio/v5/videos/hero-hearth-reel.mp4',
      'takolio/v5/videos/fridge-vault-loop.mp4',
      'takolio/v5/videos/mam-com-hearth-loop.mp4',
      'takolio/v5/videos/cook-prep.mp4',
      'takolio/v5/videos/cook-wok-fire.mp4',
      'takolio/v5/videos/cook-claypot.mp4',
      'takolio/v5/videos/cook-soup.mp4',
      'takolio/v5/videos/cook-plate.mp4',
    ];
    const requiredPosters = [
      'takolio/v5/posters/wok-poster.webp',
      'takolio/v5/posters/claypot-poster.webp',
      'takolio/v5/posters/prep-poster.webp',
      'takolio/v5/posters/soup-poster.webp',
      'takolio/v5/posters/fridge-poster.webp',
      'takolio/v5/posters/mamcom-poster.webp',
    ];

    for (const relPath of [...requiredVideos, ...requiredPosters]) {
      expect(existsSync(resolve(publicRoot, relPath)), `Missing ${relPath}`).toBe(true);
    }

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    // 1. HeroKitchenDiorama3D chapter switching
    await act(async () => {
      root.render(<HeroKitchenDiorama3D activeHotspot="overview" />);
    });
    expect(container.querySelector('video')?.getAttribute('src')).toBe(
      '/takolio/v5/videos/hero-hearth-reel.mp4',
    );
    expect(container.textContent).toContain('0% nhựa giả lập');

    await act(async () => {
      root.render(<HeroKitchenDiorama3D activeHotspot="fridge" />);
    });
    expect(container.querySelector('video')?.getAttribute('src')).toBe(
      '/takolio/v5/videos/fridge-vault-loop.mp4',
    );

    await act(async () => {
      root.render(<HeroKitchenDiorama3D activeHotspot="cooktop" />);
    });
    expect(container.querySelector('video')?.getAttribute('src')).toBe(
      '/takolio/v5/videos/cook-claypot.mp4',
    );

    await act(async () => {
      root.render(<HeroKitchenDiorama3D activeHotspot="scan" />);
    });
    expect(container.querySelector('video')?.getAttribute('src')).toBe(
      '/takolio/v5/videos/cook-prep.mp4',
    );

    // 2. ActiveCookwareStage3D technique-to-video mapping
    const techniqueChecks = [
      ['prep', '/takolio/v5/videos/cook-prep.mp4'],
      ['stir_fry', '/takolio/v5/videos/cook-wok-fire.mp4'],
      ['braise', '/takolio/v5/videos/cook-claypot.mp4'],
      ['simmer', '/takolio/v5/videos/cook-soup.mp4'],
      ['plate', '/takolio/v5/videos/cook-plate.mp4'],
    ] as const;

    for (const [tech, expectedSrc] of techniqueChecks) {
      await act(async () => {
        root.render(<ActiveCookwareStage3D technique={tech} heatLevel="medium" />);
      });
      expect(container.querySelector('video')?.getAttribute('src')).toBe(expectedSrc);
    }

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
