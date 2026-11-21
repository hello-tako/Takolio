import React, { useEffect, useId, useRef, useState } from 'react';
import { clsx } from 'clsx';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { useWebGlLifecycle } from './useWebGlLifecycle';

export type FridgeFreshnessTone = 'all' | 'fresh' | 'soon' | 'urgent';

export interface FridgeFreshnessOrbital3DProps {
  freshCount?: number;
  soonCount?: number;
  urgentCount?: number;
  activeZone?: string;
  onSelectTone?: (tone: FridgeFreshnessTone) => void;
  className?: string;
}

const ZONE_LABELS_VI: Record<string, string> = {
  all: 'Tất cả ngăn tủ',
  cool: 'Ngăn mát trên · 4°C',
  crisper: 'Ngăn rau củ ẩm · 90% RH',
  chiller: 'Ngăn tươi sống · 0°C',
  freezer: 'Ngăn đông · -18°C',
};

const TRAY_SHADOW_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const TRAY_SHADOW_FRAGMENT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float d = dot(p * vec2(1.05, 1.35), p * vec2(1.05, 1.35));
    float alpha = exp(-d * 2.9) * 0.22;
    gl_FragColor = vec4(0.28, 0.20, 0.16, alpha);
  }
`;

interface FallbackTraySvgProps {
  freshCount: number;
  soonCount: number;
  urgentCount: number;
  selectedTone: FridgeFreshnessTone;
  onPickTone: (tone: FridgeFreshnessTone) => void;
}

const IsometricCeramicTrayFallbackSvg: React.FC<FallbackTraySvgProps> = ({
  freshCount,
  soonCount,
  urgentCount,
  selectedTone,
  onPickTone,
}) => {
  const uid = useId().replace(/:/g, '');
  const total = Math.max(1, freshCount + soonCount + urgentCount);
  const freshH = 38 + Math.round((freshCount / total) * 44);
  const soonH = 38 + Math.round((soonCount / total) * 44);
  const urgentH = 38 + Math.round((urgentCount / total) * 44);

  return (
    <svg
      viewBox="0 0 520 230"
      role="img"
      aria-label="Khay gốm phân loại độ tươi thực phẩm Takolio"
      className="h-full w-full select-none"
    >
      <defs>
        <linearGradient id={`tray-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFFDFB" />
          <stop offset="100%" stopColor="#F4E8DC" />
        </linearGradient>
      </defs>

      {/* Contact shadow & Ceramic Platter */}
      <ellipse cx="260" cy="176" rx="198" ry="38" fill="#5F524A" fillOpacity="0.11" />
      <ellipse cx="260" cy="166" rx="190" ry="36" fill="#E6D7C7" />
      <ellipse
        cx="260"
        cy="160"
        rx="190"
        ry="35"
        fill={`url(#tray-${uid})`}
        stroke="#EAE0D5"
        strokeWidth="2.5"
      />
      <ellipse
        cx="260"
        cy="160"
        rx="162"
        ry="26"
        fill="none"
        stroke="#D5C3B3"
        strokeDasharray="6 6"
        strokeWidth="1.4"
      />

      {/* Fresh Sage Stoneware Jar */}
      <g
        onClick={() => onPickTone(selectedTone === 'fresh' ? 'all' : 'fresh')}
        transform={`translate(152, ${selectedTone === 'fresh' ? 142 : 150})`}
        className="cursor-pointer"
      >
        <ellipse cx="0" cy="8" rx="40" ry="11" fill="#325940" fillOpacity="0.18" />
        <rect
          x="-34"
          y={-freshH}
          width="68"
          height={freshH}
          rx="14"
          fill="#4E7A5B"
          stroke={selectedTone === 'fresh' ? '#FFFDF9' : '#325940'}
          strokeWidth={selectedTone === 'fresh' ? 3 : 1.2}
        />
        <ellipse cx="0" cy={-freshH} rx="33" ry="9" fill="#FFFDF9" stroke="#CFE2D5" strokeWidth="1.5" />
        <circle cx="0" cy={-freshH - 5} r="5" fill="#4E7A5B" />
        <text
          x="0"
          y={-freshH / 2 + 5}
          textAnchor="middle"
          fill="#FFFFFF"
          fontSize="14"
          fontWeight="700"
        >
          {freshCount}
        </text>
      </g>

      {/* Use-Soon Honey Stoneware Jar */}
      <g
        onClick={() => onPickTone(selectedTone === 'soon' ? 'all' : 'soon')}
        transform={`translate(260, ${selectedTone === 'soon' ? 148 : 156})`}
        className="cursor-pointer"
      >
        <ellipse cx="0" cy="8" rx="40" ry="11" fill="#8A5A19" fillOpacity="0.18" />
        <rect
          x="-34"
          y={-soonH}
          width="68"
          height={soonH}
          rx="14"
          fill="#C68634"
          stroke={selectedTone === 'soon' ? '#FFFDF9' : '#8A5A19'}
          strokeWidth={selectedTone === 'soon' ? 3 : 1.2}
        />
        <ellipse cx="0" cy={-soonH} rx="33" ry="9" fill="#FFFDF9" stroke="#EDD9B4" strokeWidth="1.5" />
        <circle cx="0" cy={-soonH - 5} r="5" fill="#C68634" />
        <text
          x="0"
          y={-soonH / 2 + 5}
          textAnchor="middle"
          fill="#FFFFFF"
          fontSize="14"
          fontWeight="700"
        >
          {soonCount}
        </text>
      </g>

      {/* Urgent Terracotta Stoneware Jar */}
      <g
        onClick={() => onPickTone(selectedTone === 'urgent' ? 'all' : 'urgent')}
        transform={`translate(368, ${selectedTone === 'urgent' ? 142 : 150})`}
        className="cursor-pointer"
      >
        <ellipse cx="0" cy="8" rx="42" ry="12" fill="#9E4120" fillOpacity="0.2" />
        <rect
          x="-34"
          y={-urgentH}
          width="68"
          height={urgentH}
          rx="14"
          fill="#D86A43"
          stroke={selectedTone === 'urgent' ? '#FFFDF9' : '#9E4120'}
          strokeWidth={selectedTone === 'urgent' ? 3 : 1.2}
        />
        <ellipse cx="0" cy={-urgentH} rx="33" ry="9" fill="#FFFDF9" stroke="#F2D5C7" strokeWidth="1.5" />
        <circle cx="0" cy={-urgentH - 5} r="5" fill="#D86A43" />
        <text
          x="0"
          y={-urgentH / 2 + 5}
          textAnchor="middle"
          fill="#FFFFFF"
          fontSize="14"
          fontWeight="700"
        >
          {urgentCount}
        </text>
      </g>
    </svg>
  );
};

export const FridgeFreshnessOrbital3D: React.FC<FridgeFreshnessOrbital3DProps> = ({
  freshCount = 8,
  soonCount = 3,
  urgentCount = 2,
  activeZone,
  onSelectTone,
  className,
}) => {
  const { containerRef, webglSupported, shouldAnimate, prefersReducedMotion, size } =
    useWebGlLifecycle({
      minIntersectionRatio: 0.05,
      fallbackWidth: 520,
      fallbackHeight: 220,
    });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [selectedTone, setSelectedTone] = useState<FridgeFreshnessTone>('all');
  const [webglReady, setWebglReady] = useState(false);
  const [webglFailed, setWebglFailed] = useState(false);

  const safeFresh = Math.max(0, freshCount);
  const safeSoon = Math.max(0, soonCount);
  const safeUrgent = Math.max(0, urgentCount);
  const totalItems = safeFresh + safeSoon + safeUrgent;

  const handleSelectTone = (tone: FridgeFreshnessTone) => {
    setSelectedTone(tone);
    onSelectTone?.(tone);
  };

  const liveRef = useRef({
    freshCount: safeFresh,
    soonCount: safeSoon,
    urgentCount: safeUrgent,
    selectedTone,
    pointerX: 0,
    pointerY: 0,
    shouldAnimate,
    size,
    requestRender: null as (() => void) | null,
    pickAtNdc: null as ((ndcX: number, ndcY: number) => FridgeFreshnessTone | null) | null,
  });

  liveRef.current.freshCount = safeFresh;
  liveRef.current.soonCount = safeSoon;
  liveRef.current.urgentCount = safeUrgent;
  liveRef.current.selectedTone = selectedTone;
  liveRef.current.shouldAnimate = shouldAnimate;
  liveRef.current.size = size;

  useEffect(() => {
    liveRef.current.requestRender?.();
  }, [safeFresh, safeSoon, safeUrgent, selectedTone, size.width, size.height, size.dpr]);

  useEffect(() => {
    if (!webglSupported || webglFailed) return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    let renderer: THREE.WebGLRenderer | null = null;
    try {
      const ctx =
        canvas.getContext('webgl2', { alpha: true, antialias: true }) ||
        canvas.getContext('webgl', { alpha: true, antialias: true });
      if (!ctx) {
        setWebglFailed(true);
        return undefined;
      }
      renderer = new THREE.WebGLRenderer({
        canvas,
        context: ctx as WebGLRenderingContext,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglFailed(true);
      return undefined;
    }

    const disposables: Array<{ dispose: () => void }> = [];
    const track = <T extends { dispose: () => void }>(item: T): T => {
      disposables.push(item);
      return item;
    };

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(31, 520 / 220, 0.1, 30);
    camera.position.set(0, 2.55, 4.55);
    camera.lookAt(0, 0.05, 0);

    let pmrem: THREE.PMREMGenerator | null = null;
    let envTarget: THREE.WebGLRenderTarget | null = null;
    try {
      pmrem = new THREE.PMREMGenerator(renderer);
      const room = new RoomEnvironment();
      envTarget = pmrem.fromScene(room, 0.04);
      scene.environment = envTarget.texture;
      scene.environmentIntensity = 0.78;
      room.dispose();
    } catch {
      // Analytical lights suffice on fallback hardware
    }

    scene.add(new THREE.HemisphereLight('#FFFDF9', '#EAD5C3', 0.95));
    const dirLight = new THREE.DirectionalLight('#FFF5E8', 2.0);
    dirLight.position.set(3.4, 5.8, 3.6);
    scene.add(dirLight);

    const bounceLight = new THREE.PointLight('#F4B183', 1.15, 12);
    bounceLight.position.set(-2.8, 1.6, 2.2);
    scene.add(bounceLight);

    const rootTrayGroup = new THREE.Group();
    rootTrayGroup.position.y = -0.22;
    scene.add(rootTrayGroup);

    // Soft contact shadow
    const shadowMesh = new THREE.Mesh(
      track(new THREE.PlaneGeometry(4.8, 3.2)),
      track(
        new THREE.ShaderMaterial({
          vertexShader: TRAY_SHADOW_VERTEX,
          fragmentShader: TRAY_SHADOW_FRAGMENT,
          transparent: true,
          depthWrite: false,
        }),
      ),
    );
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = -0.3;
    rootTrayGroup.add(shadowMesh);

    // Sunlit Isometric Ceramic Platter (#FFFDF9) + Sand Rim (#EAE0D5)
    const porcelainMat = track(
      new THREE.MeshPhysicalMaterial({
        color: '#FFFDF9',
        roughness: 0.24,
        metalness: 0.02,
        clearcoat: 0.72,
        clearcoatRoughness: 0.16,
      }),
    );
    const sandRimMat = track(
      new THREE.MeshStandardMaterial({
        color: '#E5D6C5',
        roughness: 0.46,
        metalness: 0.04,
      }),
    );

    const platterProfile = [
      new THREE.Vector2(0.0, -0.12),
      new THREE.Vector2(1.65, -0.12),
      new THREE.Vector2(1.88, -0.02),
      new THREE.Vector2(1.94, 0.09),
      new THREE.Vector2(1.84, 0.11),
      new THREE.Vector2(1.68, 0.0),
      new THREE.Vector2(0.0, 0.0),
    ];
    const platterGeo = track(new THREE.LatheGeometry(platterProfile, 56));
    const platterMesh = new THREE.Mesh(platterGeo, porcelainMat);
    platterMesh.scale.set(1.12, 1, 0.82);
    rootTrayGroup.add(platterMesh);

    const orbitalTrackGeo = track(new THREE.TorusGeometry(1.42, 0.018, 12, 64));
    const orbitalTrack = new THREE.Mesh(orbitalTrackGeo, sandRimMat);
    orbitalTrack.rotation.x = Math.PI / 2;
    orbitalTrack.scale.set(1.12, 0.82, 1);
    orbitalTrack.position.y = 0.02;
    rootTrayGroup.add(orbitalTrack);

    // 3 Tactile Glazed Stoneware Containers (Fresh Sage, Use-Soon Honey, Priority Terracotta)
    const canisterDefs: Array<{
      tone: Exclude<FridgeFreshnessTone, 'all'>;
      color: string;
      x: number;
      z: number;
    }> = [
      { tone: 'fresh', color: '#4E7A5B', x: -1.06, z: -0.08 },
      { tone: 'soon', color: '#C68634', x: 0.0, z: 0.22 },
      { tone: 'urgent', color: '#D86A43', x: 1.06, z: -0.08 },
    ];

    const bodyGeo = track(new THREE.CylinderGeometry(0.42, 0.45, 1.0, 36));
    const shoulderGeo = track(new THREE.TorusGeometry(0.41, 0.032, 14, 36));
    const lidDiskGeo = track(new THREE.CylinderGeometry(0.41, 0.42, 0.08, 36));
    const finialGeo = track(new THREE.SphereGeometry(0.075, 18, 18));
    const haloRingGeo = track(new THREE.TorusGeometry(0.56, 0.022, 12, 42));
    const pearlGeo = track(new THREE.SphereGeometry(0.055, 14, 14));

    const interactiveHitMeshes: Array<{
      mesh: THREE.Object3D;
      tone: Exclude<FridgeFreshnessTone, 'all'>;
    }> = [];

    const vessels = canisterDefs.map((def, idx) => {
      const group = new THREE.Group();
      group.position.set(def.x, 0.02, def.z);
      rootTrayGroup.add(group);

      const glazeMat = track(
        new THREE.MeshPhysicalMaterial({
          color: def.color,
          roughness: 0.22,
          metalness: 0.04,
          clearcoat: 0.86,
          clearcoatRoughness: 0.14,
        }),
      );

      const haloMat = track(
        new THREE.MeshBasicMaterial({
          color: def.color,
          transparent: true,
          opacity: 0.25,
        }),
      );

      const bodyMesh = new THREE.Mesh(bodyGeo, glazeMat);
      bodyMesh.position.y = 0.5;
      group.add(bodyMesh);
      interactiveHitMeshes.push({ mesh: bodyMesh, tone: def.tone });

      const capGroup = new THREE.Group();
      group.add(capGroup);

      const shoulder = new THREE.Mesh(shoulderGeo, glazeMat);
      shoulder.rotation.x = Math.PI / 2;
      capGroup.add(shoulder);

      const lid = new THREE.Mesh(lidDiskGeo, porcelainMat);
      lid.position.y = 0.05;
      capGroup.add(lid);
      interactiveHitMeshes.push({ mesh: lid, tone: def.tone });

      const finial = new THREE.Mesh(finialGeo, glazeMat);
      finial.position.y = 0.12;
      capGroup.add(finial);

      const halo = new THREE.Mesh(haloRingGeo, haloMat);
      halo.rotation.x = Math.PI / 2;
      halo.position.y = 0.02;
      group.add(halo);

      // Orbiting freshness pearl satellite
      const pearlOrbit = new THREE.Group();
      const pearl = new THREE.Mesh(pearlGeo, glazeMat);
      pearl.position.set(0.62, 0.35, 0);
      pearlOrbit.add(pearl);
      group.add(pearlOrbit);

      return {
        tone: def.tone,
        group,
        bodyMesh,
        capGroup,
        halo,
        haloMat,
        pearlOrbit,
        glazeMat,
        currentScaleY: 0.65,
        currentLiftY: 0,
        phase: idx * 2.1,
      };
    });

    const raycaster = new THREE.Raycaster();
    const ndcVec = new THREE.Vector2();

    liveRef.current.pickAtNdc = (ndcX: number, ndcY: number) => {
      ndcVec.set(ndcX, ndcY);
      raycaster.setFromCamera(ndcVec, camera);
      const targets = interactiveHitMeshes.map((h) => h.mesh);
      const hits = raycaster.intersectObjects(targets, false);
      if (hits.length === 0) return null;
      const match = interactiveHitMeshes.find((h) => h.mesh === hits[0].object);
      return match?.tone ?? null;
    };

    let smoothTiltX = 0;
    let smoothTiltY = 0;
    let elapsed = 0.8;
    let lastNow = typeof performance !== 'undefined' ? performance.now() : 0;
    let rafId: number | null = null;
    let painted = false;
    let disposed = false;

    const renderScene = (dt: number, advance: boolean) => {
      if (disposed || !renderer) return;
      const { width, height, dpr } = liveRef.current.size;
      const safeW = Math.max(1, width);
      const safeH = Math.max(1, height);
      renderer.setPixelRatio(dpr);
      renderer.setSize(safeW, safeH, false);
      camera.aspect = safeW / safeH;
      camera.fov = safeW < 440 ? 35 : 30;
      camera.updateProjectionMatrix();

      const clampedDt = Math.min(0.05, Math.max(0.001, dt));
      if (advance) elapsed += clampedDt;

      const total = Math.max(
        1,
        liveRef.current.freshCount + liveRef.current.soonCount + liveRef.current.urgentCount,
      );
      const countsMap: Record<Exclude<FridgeFreshnessTone, 'all'>, number> = {
        fresh: liveRef.current.freshCount,
        soon: liveRef.current.soonCount,
        urgent: liveRef.current.urgentCount,
      };

      const lerpAlpha = advance ? Math.min(1, clampedDt * 8.5) : 1;
      smoothTiltX += (liveRef.current.pointerX * 0.22 - smoothTiltX) * lerpAlpha;
      smoothTiltY += (liveRef.current.pointerY * 0.12 - smoothTiltY) * lerpAlpha;

      rootTrayGroup.rotation.y = smoothTiltX;
      rootTrayGroup.rotation.x = -smoothTiltY + 0.04;

      vessels.forEach((v) => {
        const count = countsMap[v.tone];
        const ratio = count / total;
        const targetHeight = 0.44 + ratio * 0.72;
        const isSelected = liveRef.current.selectedTone === v.tone;
        const isDimmed =
          liveRef.current.selectedTone !== 'all' && liveRef.current.selectedTone !== v.tone;
        const targetLift = isSelected ? 0.18 : 0.0;

        v.currentScaleY += (targetHeight - v.currentScaleY) * lerpAlpha;
        v.currentLiftY += (targetLift - v.currentLiftY) * lerpAlpha;

        v.bodyMesh.scale.y = v.currentScaleY;
        v.bodyMesh.position.y = v.currentScaleY * 0.5;
        v.capGroup.position.y = v.currentScaleY;
        v.group.position.y = 0.02 + v.currentLiftY;

        v.haloMat.opacity = isSelected
          ? 0.62
          : v.tone === 'urgent' && count > 0
            ? 0.28 + 0.16 * (0.5 + 0.5 * Math.sin(elapsed * 3.4))
            : isDimmed
              ? 0.08
              : 0.22;

        const haloScale = isSelected ? 1.14 : 1.0;
        v.halo.scale.setScalar(haloScale);

        v.pearlOrbit.visible = count > 0;
        if (advance) {
          v.pearlOrbit.rotation.y = elapsed * (1.1 + ratio * 0.8) + v.phase;
        }
      });

      renderer.render(scene, camera);
      if (!painted) {
        painted = true;
        setWebglReady(true);
      }
    };

    const tick = (now: number) => {
      if (disposed) return;
      const dt = (now - lastNow) / 1000;
      lastNow = now;
      renderScene(dt, true);
      if (liveRef.current.shouldAnimate) {
        rafId = window.requestAnimationFrame(tick);
      } else {
        rafId = null;
      }
    };

    liveRef.current.requestRender = () => {
      if (disposed) return;
      renderScene(0.016, false);
      if (liveRef.current.shouldAnimate && rafId === null && typeof window !== 'undefined') {
        lastNow = typeof performance !== 'undefined' ? performance.now() : 0;
        rafId = window.requestAnimationFrame(tick);
      }
    };

    renderScene(0.016, !prefersReducedMotion);
    if (liveRef.current.shouldAnimate && typeof window !== 'undefined') {
      lastNow = typeof performance !== 'undefined' ? performance.now() : 0;
      rafId = window.requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      liveRef.current.requestRender = null;
      liveRef.current.pickAtNdc = null;
      if (rafId !== null && typeof window !== 'undefined') {
        window.cancelAnimationFrame(rafId);
      }
      disposables.forEach((d) => d.dispose());
      envTarget?.dispose();
      pmrem?.dispose();
      renderer?.dispose();
    };
  }, [webglSupported, webglFailed, prefersReducedMotion]);

  useEffect(() => {
    if (shouldAnimate) {
      liveRef.current.requestRender?.();
    }
  }, [shouldAnimate]);

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    liveRef.current.pointerX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    liveRef.current.pointerY = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const ndcX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    const picked = liveRef.current.pickAtNdc?.(ndcX, ndcY);
    if (picked) {
      handleSelectTone(selectedTone === picked ? 'all' : picked);
    }
  };

  const activeZoneLabel = activeZone
    ? ZONE_LABELS_VI[activeZone] ?? activeZone
    : ZONE_LABELS_VI.all;

  const filterPills: Array<{
    tone: FridgeFreshnessTone;
    label: string;
    count: number;
    dotVar: string;
    activeClass: string;
  }> = [
    {
      tone: 'all',
      label: 'Tất cả',
      count: totalItems,
      dotVar: 'var(--tkv-ink-secondary)',
      activeClass: 'bg-[var(--tkv-ink)] text-white border-transparent',
    },
    {
      tone: 'fresh',
      label: 'Tươi mới',
      count: safeFresh,
      dotVar: 'var(--tkv-success)',
      activeClass:
        'bg-[var(--tkv-surface-mint)] text-[var(--tkv-success-ink)] border-[var(--tkv-border-mint)]',
    },
    {
      tone: 'soon',
      label: 'Dùng sớm',
      count: safeSoon,
      dotVar: 'var(--tkv-warning)',
      activeClass:
        'bg-[var(--tkv-surface-saffron)] text-[var(--tkv-warning-ink)] border-[var(--tkv-border-saffron)]',
    },
    {
      tone: 'urgent',
      label: 'Ưu tiên nấu',
      count: safeUrgent,
      dotVar: 'var(--tkv-primary)',
      activeClass:
        'bg-[var(--tkv-surface-coral)] text-[var(--tkv-coral-ink)] border-[var(--tkv-border-coral)]',
    },
  ];

  const showSvgFallback = !webglSupported || webglFailed || !webglReady;

  return (
    <div
      className={clsx(
        'flex flex-col gap-3 rounded-[var(--tkv-radius-card)] border border-[var(--tkv-border)] bg-[var(--tkv-surface)] p-4 shadow-[var(--tkv-shadow-card)]',
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--tkv-ink-muted)]">
            Khay gốm độ tươi 3D
          </span>
          <h3 className="tkv-heading text-base font-bold text-[var(--tkv-ink)]">
            Cân đối tồn kho theo nhịp nấu
          </h3>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--tkv-border)] bg-[var(--tkv-surface-subtle)] px-3 py-1 text-xs font-medium text-[var(--tkv-ink-secondary)]">
          <span>{activeZoneLabel}</span>
        </span>
      </div>

      {/* 3D Isometric Tray Stage + Graceful SVG Fallback */}
      <div
        ref={containerRef}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => {
          liveRef.current.pointerX = 0;
          liveRef.current.pointerY = 0;
        }}
        className="relative h-[205px] w-full overflow-hidden rounded-xl border border-[var(--tkv-border)] bg-[var(--tkv-bg)]"
      >
        <div
          aria-hidden={webglReady}
          className={clsx(
            'absolute inset-0 transition-opacity duration-300',
            showSvgFallback ? 'opacity-100' : 'opacity-0 pointer-events-none',
          )}
        >
          <IsometricCeramicTrayFallbackSvg
            freshCount={safeFresh}
            soonCount={safeSoon}
            urgentCount={safeUrgent}
            selectedTone={selectedTone}
            onPickTone={handleSelectTone}
          />
        </div>

        {webglSupported && !webglFailed && (
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            role="img"
            aria-label={`Khay gốm 3D: ${safeFresh} món tươi mới, ${safeSoon} món dùng sớm, ${safeUrgent} món ưu tiên nấu`}
            className={clsx(
              'relative z-10 block h-full w-full cursor-pointer transition-opacity duration-300',
              webglReady ? 'opacity-100' : 'opacity-0',
            )}
          />
        )}
      </div>

      {/* Accessible Interactive Filter Pills */}
      <div
        role="group"
        aria-label="Lọc thực phẩm theo mức độ ưu tiên sử dụng"
        className="flex flex-wrap items-center gap-2"
      >
        {filterPills.map((pill) => {
          const isActive = selectedTone === pill.tone;
          return (
            <button
              key={pill.tone}
              type="button"
              aria-pressed={isActive}
              onClick={() => handleSelectTone(pill.tone)}
              className={clsx(
                'tkv-focusable tkv-tactile inline-flex min-h-[44px] min-w-[44px] items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold tabular-nums',
                isActive
                  ? pill.activeClass
                  : 'border-[var(--tkv-border)] bg-[var(--tkv-surface)] text-[var(--tkv-ink-secondary)] hover:bg-[var(--tkv-surface-subtle)] hover:text-[var(--tkv-ink)]',
              )}
            >
              {pill.tone !== 'all' && (
                <span
                  aria-hidden="true"
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: pill.dotVar }}
                />
              )}
              <span>{pill.label}</span>
              <span className="opacity-85">({pill.count})</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default FridgeFreshnessOrbital3D;
