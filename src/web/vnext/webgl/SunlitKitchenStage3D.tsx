import React, { useEffect, useId, useRef, useState } from 'react';
import { clsx } from 'clsx';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { useWebGlLifecycle } from './useWebGlLifecycle';

export interface SunlitKitchenStage3DProps {
  posterSrc?: string;
  posterSrcSet?: string;
  posterAlt?: string;
  compact?: boolean;
  className?: string;
}

type CameraPreset = 'angled' | 'front';

const CONTACT_SHADOW_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const CONTACT_SHADOW_FRAGMENT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    vec2 trivetOffset = (p - vec2(-0.14, 0.02)) * vec2(1.18, 1.45);
    vec2 takoOffset = (p - vec2(0.42, 0.12)) * vec2(1.85, 2.05);
    vec2 bowlOffset = (p - vec2(-0.56, 0.24)) * vec2(3.1, 3.3);

    float s1 = exp(-dot(trivetOffset, trivetOffset) * 3.1) * 0.24;
    float s2 = exp(-dot(takoOffset, takoOffset) * 3.6) * 0.18;
    float s3 = exp(-dot(bowlOffset, bowlOffset) * 4.2) * 0.11;
    float alpha = clamp(s1 + s2 + s3, 0.0, 0.28);

    // Warm espresso-walnut contact shadow (#4A352B), never harsh black
    vec3 shadowColor = vec3(0.29, 0.208, 0.168);
    gl_FragColor = vec4(shadowColor, alpha);
  }
`;

const STEAM_VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uLidOpen;
  uniform float uSeed;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec3 pos = position;
    float heightFactor = smoothstep(0.0, 1.0, uv.y);
    float swayAmp = mix(0.05, 0.14, uLidOpen) * heightFactor;
    pos.x += sin(uTime * 1.45 + uv.y * 4.2 + uSeed) * swayAmp;
    pos.z += cos(uTime * 1.15 + uv.y * 3.6 + uSeed * 1.7) * swayAmp * 0.75;
    pos.x *= mix(0.72, 1.32 + uLidOpen * 0.35, heightFactor);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const STEAM_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uLidOpen;
  uniform float uSeed;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 4; i++) {
      v += amp * valueNoise(p);
      p = p * 2.03 + vec2(1.7, -1.3);
      amp *= 0.5;
    }
    return v;
  }

  void main() {
    float riseSpeed = mix(0.36, 0.72, uLidOpen);
    vec2 flowUv = vec2(
      vUv.x * 2.6 + sin(vUv.y * 3.2 - uTime * 0.8 + uSeed) * 0.22,
      vUv.y * 3.1 - uTime * riseSpeed + uSeed
    );

    float n = fbm(flowUv);
    float n2 = fbm(flowUv * 1.65 + vec2(2.4, -uTime * riseSpeed * 0.6));
    float plume = smoothstep(0.34, 0.78, n * 0.65 + n2 * 0.35);

    float radialMask = 1.0 - smoothstep(0.08, 0.5, abs(vUv.x - 0.5));
    float verticalIn = smoothstep(0.0, 0.18, vUv.y);
    float verticalOut = 1.0 - smoothstep(0.42, 0.98, vUv.y);

    float intensity = mix(0.24, 0.68, uLidOpen);
    float alpha = plume * radialMask * verticalIn * verticalOut * intensity;

    // Warm sunlit cream (#FFFDF9) fading into woven linen (#F7EFE6)
    vec3 bottomTint = vec3(1.0, 0.992, 0.976);
    vec3 topTint = vec3(0.969, 0.937, 0.902);
    vec3 steamColor = mix(bottomTint, topTint, vUv.y);

    gl_FragColor = vec4(steamColor, alpha);
  }
`;

const BROTH_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const BROTH_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uLidOpen;
  varying vec2 vUv;

  void main() {
    vec2 centered = (vUv - 0.5) * 2.0;
    float dist = length(centered);
    float ripple1 = sin(dist * 18.0 - uTime * 3.6) * 0.5 + 0.5;
    float ripple2 = sin(centered.x * 11.0 + centered.y * 9.0 + uTime * 2.4) * 0.5 + 0.5;

    vec3 deepAmber = vec3(0.847, 0.416, 0.263);   // #D86A43
    vec3 warmBroth = vec3(0.961, 0.620, 0.337);   // #F59E56
    vec3 sunlitHighlight = vec3(1.0, 0.945, 0.84); // #FFF1D6

    vec3 col = mix(deepAmber, warmBroth, 1.0 - smoothstep(0.15, 0.95, dist));
    float shimmer = smoothstep(0.62, 0.96, ripple1 * 0.65 + ripple2 * 0.35);
    col = mix(col, sunlitHighlight, shimmer * (0.22 + uLidOpen * 0.32));

    gl_FragColor = vec4(col, 0.96);
  }
`;

const DUST_VERTEX_SHADER = /* glsl */ `
  attribute float aScale;
  attribute float aPhase;
  uniform float uTime;
  uniform float uPixelRatio;
  varying float vAlpha;

  void main() {
    vec3 pos = position;
    pos.y += mod(uTime * 0.08 + aPhase, 2.4) - 1.2;
    pos.x += sin(uTime * 0.42 + aPhase * 6.28) * 0.14;
    pos.z += cos(uTime * 0.35 + aPhase * 4.12) * 0.12;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = aScale * uPixelRatio * (18.0 / max(1.0, -mvPosition.z));
    vAlpha = 0.25 + 0.35 * (0.5 + 0.5 * sin(uTime * 1.3 + aPhase * 9.0));
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const DUST_FRAGMENT_SHADER = /* glsl */ `
  varying float vAlpha;
  void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);
    float d = length(coord);
    if (d > 0.5) discard;
    float soft = smoothstep(0.5, 0.05, d);
    // Warm golden-hour sunbeam dust (#FFF5E4)
    gl_FragColor = vec4(1.0, 0.96, 0.894, soft * vAlpha);
  }
`;

function createProceduralOakTexture(): THREE.DataTexture {
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const nx = (x / size - 0.5) * 2;
      const ny = (y / size - 0.5) * 2;
      const radius = Math.sqrt(nx * nx + ny * ny);
      const ringWave = Math.sin(radius * 26.0 + Math.sin(nx * 7.0 + ny * 5.0) * 0.55);
      const fineFiber = Math.sin(nx * 42.0 + ny * 6.0) * 0.5 + 0.5;
      const blend = (ringWave * 0.5 + 0.5) * 0.68 + fineFiber * 0.32;

      // Warm honey oak #D8B384 -> #C79E6B
      const r = Math.round(199 + blend * 26);
      const g = Math.round(158 + blend * 28);
      const b = Math.round(107 + blend * 29);
      const idx = (y * size + x) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

function createBotanicalLeafGeometry(): THREE.ExtrudeGeometry {
  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, -0.22);
  leafShape.bezierCurveTo(0.14, -0.14, 0.16, 0.08, 0, 0.24);
  leafShape.bezierCurveTo(-0.16, 0.08, -0.14, -0.14, 0, -0.22);

  const extrude = new THREE.ExtrudeGeometry(leafShape, {
    depth: 0.018,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.012,
    bevelThickness: 0.01,
  });
  extrude.center();
  return extrude;
}

interface StaticKitchenFallbackProps {
  lidOpen: boolean;
  posterAlt: string;
}

const StaticKitchenPosterSvg: React.FC<StaticKitchenFallbackProps> = ({
  lidOpen,
  posterAlt,
}) => {
  const uid = useId().replace(/:/g, '');
  return (
    <svg
      viewBox="0 0 680 420"
      role="img"
      aria-label={posterAlt}
      className="h-full w-full select-none"
    >
      <defs>
        <linearGradient id={`bg-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFFDFB" />
          <stop offset="55%" stopColor="#FFF6F0" />
          <stop offset="100%" stopColor="#F7E7DA" />
        </linearGradient>
        <radialGradient id={`sun-${uid}`} cx="0.72" cy="0.2" r="0.65">
          <stop offset="0%" stopColor="#FFF5E8" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#FFF5E8" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`pot-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#E67F5C" />
          <stop offset="55%" stopColor="#D86A43" />
          <stop offset="100%" stopColor="#B44E2B" />
        </linearGradient>
      </defs>

      <rect width="680" height="420" fill={`url(#bg-${uid})`} />
      <circle cx="490" cy="86" r="220" fill={`url(#sun-${uid})`} />

      {/* Contact shadows */}
      <ellipse cx="285" cy="316" rx="138" ry="26" fill="#5F524A" fillOpacity="0.12" />
      <ellipse cx="486" cy="318" rx="76" ry="18" fill="#5F524A" fillOpacity="0.11" />

      {/* Warm Oak Trivet */}
      <ellipse cx="285" cy="304" rx="116" ry="22" fill="#C79E6B" />
      <ellipse cx="285" cy="297" rx="116" ry="21" fill="#D8B384" stroke="#EAD5BC" strokeWidth="2" />

      {/* Rising Steam Plumes */}
      <g opacity={lidOpen ? 0.92 : 0.52}>
        <path
          d="M250 185 C238 152, 264 126, 250 92"
          fill="none"
          stroke="#FFFDF9"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path
          d="M286 178 C298 142, 272 114, 288 76"
          fill="none"
          stroke="#FFFDF9"
          strokeWidth="15"
          strokeLinecap="round"
        />
        <path
          d="M322 186 C334 156, 312 128, 326 98"
          fill="none"
          stroke="#F7EFE6"
          strokeWidth="11"
          strokeLinecap="round"
        />
      </g>

      {/* Terracotta Cocotte Body */}
      <path
        d="M170 218 C148 218, 148 242, 172 244"
        fill="none"
        stroke="#C25731"
        strokeWidth="11"
        strokeLinecap="round"
      />
      <path
        d="M400 218 C422 218, 422 242, 398 244"
        fill="none"
        stroke="#C25731"
        strokeWidth="11"
        strokeLinecap="round"
      />
      <path
        d="M178 206 L392 206 C394 268, 358 298, 285 298 C212 298, 176 268, 178 206 Z"
        fill={`url(#pot-${uid})`}
      />
      <ellipse cx="285" cy="206" rx="107" ry="20" fill="#FFF8F0" stroke="#D86A43" strokeWidth="4" />
      <ellipse cx="285" cy="208" rx="95" ry="15" fill="#F59E56" />

      {/* Domed Ceramic Lid (lifts & tilts when lidOpen is true) */}
      <g
        transform={
          lidOpen
            ? 'translate(14, -36) rotate(-11 285 198)'
            : 'translate(0, 0) rotate(0 285 198)'
        }
      >
        <path
          d="M176 202 C188 156, 382 156, 394 202 Z"
          fill={`url(#pot-${uid})`}
          stroke="#FFF8F0"
          strokeWidth="2.5"
        />
        <ellipse cx="285" cy="164" rx="22" ry="7" fill="#C68634" />
        <ellipse cx="285" cy="159" rx="15" ry="5" fill="#E4A853" />
      </g>

      {/* Tako Octopus Chef */}
      <g transform="translate(486, 258)">
        {/* Curled Tentacles */}
        <path
          d="M-46 36 C-68 42, -72 22, -56 18 C-44 16, -34 32, -22 38"
          fill="none"
          stroke="#E67F5C"
          strokeWidth="14"
          strokeLinecap="round"
        />
        <path
          d="M46 36 C68 42, 72 22, 56 18 C44 16, 34 32, 22 38"
          fill="none"
          stroke="#E67F5C"
          strokeWidth="14"
          strokeLinecap="round"
        />
        <path
          d="M-24 42 C-32 56, -12 58, -6 44"
          fill="none"
          stroke="#D86A43"
          strokeWidth="13"
          strokeLinecap="round"
        />
        <path
          d="M24 42 C32 56, 12 58, 6 44"
          fill="none"
          stroke="#D86A43"
          strokeWidth="13"
          strokeLinecap="round"
        />

        {/* Mantle Head */}
        <ellipse cx="0" cy="6" rx="46" ry="42" fill="#E67F5C" />
        {/* Rosy Cheeks & Eyes */}
        <ellipse cx="-22" cy="14" rx="8" ry="5" fill="#F39A82" />
        <ellipse cx="22" cy="14" rx="8" ry="5" fill="#F39A82" />
        <circle cx="-15" cy="4" r="5.5" fill="#2C221E" />
        <circle cx="-13" cy="2" r="2" fill="#FFFFFF" />
        <circle cx="15" cy="4" r="5.5" fill="#2C221E" />
        <circle cx="17" cy="2" r="2" fill="#FFFFFF" />
        <path
          d="M-8 15 Q0 22 8 15"
          fill="none"
          stroke="#2C221E"
          strokeWidth="2.6"
          strokeLinecap="round"
        />

        {/* Creamy Chef Toque */}
        <g transform="translate(2, -38) rotate(5)">
          <circle cx="-16" cy="-10" r="15" fill="#FFFDF9" stroke="#EAE0D5" strokeWidth="1.5" />
          <circle cx="16" cy="-10" r="15" fill="#FFFDF9" stroke="#EAE0D5" strokeWidth="1.5" />
          <circle cx="0" cy="-16" r="18" fill="#FFFDF9" stroke="#EAE0D5" strokeWidth="1.5" />
          <rect x="-24" y="-2" width="48" height="13" rx="5" fill="#FFFDF9" stroke="#EAE0D5" strokeWidth="1.5" />
          <path d="M-24 5 L24 5" stroke="#4E7A5B" strokeWidth="3" />
        </g>
      </g>

      {/* Ceramic Pinch Bowl & Botanical Sage Leaves */}
      <g transform="translate(116, 304)">
        <ellipse cx="0" cy="10" rx="30" ry="9" fill="#EAE0D5" />
        <path d="M-28 0 C-26 18, 26 18, 28 0 Z" fill="#FFFDF9" stroke="#EAE0D5" strokeWidth="1.5" />
        <ellipse cx="0" cy="0" rx="28" ry="8" fill="#FCF5E6" stroke="#EAE0D5" strokeWidth="1.5" />
        <ellipse cx="0" cy="1" rx="18" ry="4.5" fill="#C68634" />
      </g>

      <g fill="#4E7A5B">
        <path d="M132 146 C146 132, 166 138, 156 156 C144 166, 128 158, 132 146 Z" />
        <path d="M424 118 C438 106, 456 114, 446 130 C434 138, 420 130, 424 118 Z" />
        <path d="M558 176 C572 166, 586 176, 574 190 C562 196, 552 186, 558 176 Z" />
      </g>
    </svg>
  );
};

export const SunlitKitchenStage3D: React.FC<SunlitKitchenStage3DProps> = ({
  posterSrc,
  posterSrcSet,
  posterAlt = 'Gian bếp gốm sứ ấm nắng Takolio cùng nồi đất nung và đầu bếp bạch tuộc Tako',
  compact = false,
  className,
}) => {
  const { containerRef, webglSupported, shouldAnimate, prefersReducedMotion, size } =
    useWebGlLifecycle({
      minIntersectionRatio: 0.05,
      fallbackWidth: compact ? 480 : 680,
      fallbackHeight: compact ? 280 : 400,
    });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [webglReady, setWebglReady] = useState(false);
  const [webglFailed, setWebglFailed] = useState(false);

  const [isLidPinnedOpen, setIsLidPinnedOpen] = useState(false);
  const [isStageHovered, setIsStageHovered] = useState(false);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('angled');
  const [isMotionPaused, setIsMotionPaused] = useState(false);

  const isLidEffectiveOpen = isLidPinnedOpen || isStageHovered;

  // Mutable live controls shared cleanly with the Three.js loop without recreating the WebGL context
  const liveControlsRef = useRef({
    lidOpen: false,
    cameraPreset: 'angled' as CameraPreset,
    pointerX: 0,
    pointerY: 0,
    shouldRunLoop: true,
    size,
    requestSingleRender: null as (() => void) | null,
  });

  liveControlsRef.current.lidOpen = isLidEffectiveOpen;
  liveControlsRef.current.cameraPreset = cameraPreset;
  liveControlsRef.current.shouldRunLoop = shouldAnimate && !isMotionPaused;
  liveControlsRef.current.size = size;

  // Trigger an immediate crisp frame whenever interactive state updates while continuous motion is paused
  useEffect(() => {
    liveControlsRef.current.requestSingleRender?.();
  }, [isLidEffectiveOpen, cameraPreset, isMotionPaused, size.width, size.height, size.dpr]);

  useEffect(() => {
    if (!webglSupported || webglFailed) return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    let renderer: THREE.WebGLRenderer | null = null;
    try {
      const testCtx =
        canvas.getContext('webgl2', { alpha: true, antialias: true }) ||
        canvas.getContext('webgl', { alpha: true, antialias: true });
      if (!testCtx) {
        setWebglFailed(true);
        return undefined;
      }
      renderer = new THREE.WebGLRenderer({
        canvas,
        context: testCtx as WebGLRenderingContext,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglFailed(true);
      return undefined;
    }

    const disposables: Array<{ dispose: () => void }> = [];
    const track = <T extends { dispose: () => void }>(resource: T): T => {
      disposables.push(resource);
      return resource;
    };

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      compact ? 36 : 34,
      Math.max(1, liveControlsRef.current.size.width) /
        Math.max(1, liveControlsRef.current.size.height),
      0.1,
      40,
    );
    camera.position.set(0.24, 2.25, 5.15);
    camera.lookAt(0.18, 0.16, 0);

    // Studio warm PBR environment via RoomEnvironment + PMREMGenerator (zero network I/O)
    let pmremGenerator: THREE.PMREMGenerator | null = null;
    let envTarget: THREE.WebGLRenderTarget | null = null;
    try {
      pmremGenerator = new THREE.PMREMGenerator(renderer);
      const roomEnv = new RoomEnvironment();
      envTarget = pmremGenerator.fromScene(roomEnv, 0.04);
      scene.environment = envTarget.texture;
      scene.environmentIntensity = 0.82;
      roomEnv.dispose();
    } catch {
      // Fallback cleanly to analytical lights if PMREM fails on restricted hardware
    }

    // Golden-hour window lighting rig
    const hemiLight = new THREE.HemisphereLight('#FFFBF4', '#EAD5C3', 0.92);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight('#FFF5E8', 2.2);
    keyLight.position.set(4.2, 6.5, 4.4);
    scene.add(keyLight);

    const terracottaBounce = new THREE.PointLight('#F4B183', 1.4, 14);
    terracottaBounce.position.set(-3.4, 1.8, 2.8);
    scene.add(terracottaBounce);

    const porcelainRimLight = new THREE.DirectionalLight('#FFF9F2', 0.78);
    porcelainRimLight.position.set(-2.6, 4.0, -3.5);
    scene.add(porcelainRimLight);

    // Master stage root for gentle pointer parallax
    const stageGroup = new THREE.Group();
    stageGroup.position.set(-0.08, -0.14, 0);
    scene.add(stageGroup);

    // Soft contact shadow plane
    const shadowGeo = track(new THREE.PlaneGeometry(5.6, 3.8));
    const shadowMat = track(
      new THREE.ShaderMaterial({
        vertexShader: CONTACT_SHADOW_VERTEX,
        fragmentShader: CONTACT_SHADOW_FRAGMENT,
        transparent: true,
        depthWrite: false,
      }),
    );
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.set(0.18, -0.76, 0.08);
    stageGroup.add(shadowMesh);

    // 1. Turned Warm Oak Trivet (#D8B384)
    const cocotteAnchor = new THREE.Group();
    cocotteAnchor.position.set(-0.46, -0.66, 0.02);
    stageGroup.add(cocotteAnchor);

    const oakTexture = track(createProceduralOakTexture());
    const oakMaterial = track(
      new THREE.MeshStandardMaterial({
        color: '#E6C79C',
        map: oakTexture,
        roughness: 0.54,
        metalness: 0.04,
      }),
    );

    const trivetBaseGeo = track(new THREE.CylinderGeometry(1.16, 1.22, 0.14, 48));
    const trivetMesh = new THREE.Mesh(trivetBaseGeo, oakMaterial);
    trivetMesh.position.y = 0.02;
    cocotteAnchor.add(trivetMesh);

    const trivetRimGeo = track(new THREE.TorusGeometry(1.06, 0.048, 16, 48));
    const trivetRim = new THREE.Mesh(trivetRimGeo, oakMaterial);
    trivetRim.rotation.x = Math.PI / 2;
    trivetRim.position.y = 0.09;
    cocotteAnchor.add(trivetRim);

    const trivetFootGeo = track(new THREE.CylinderGeometry(0.1, 0.08, 0.08, 16));
    for (let i = 0; i < 3; i += 1) {
      const footAngle = (i / 3) * Math.PI * 2 + 0.4;
      const foot = new THREE.Mesh(trivetFootGeo, oakMaterial);
      foot.position.set(Math.cos(footAngle) * 0.92, -0.06, Math.sin(footAngle) * 0.92);
      cocotteAnchor.add(foot);
    }

    // 2. Glazed Terracotta Clay Cocotte / Dutch Oven (#D86A43)
    const terracottaGlazeMat = track(
      new THREE.MeshPhysicalMaterial({
        color: '#D86A43',
        roughness: 0.2,
        metalness: 0.04,
        clearcoat: 0.88,
        clearcoatRoughness: 0.14,
      }),
    );

    const creamEnamelMat = track(
      new THREE.MeshPhysicalMaterial({
        color: '#FFF8F0',
        roughness: 0.26,
        metalness: 0.02,
        clearcoat: 0.65,
        clearcoatRoughness: 0.18,
      }),
    );

    const deepTerracottaRimMat = track(
      new THREE.MeshStandardMaterial({
        color: '#9E4120',
        roughness: 0.42,
        metalness: 0.08,
      }),
    );

    const brassKnobMat = track(
      new THREE.MeshPhysicalMaterial({
        color: '#C68634',
        roughness: 0.25,
        metalness: 0.62,
        clearcoat: 0.45,
        clearcoatRoughness: 0.2,
      }),
    );

    const potProfile = [
      new THREE.Vector2(0.0, 0.09),
      new THREE.Vector2(0.76, 0.09),
      new THREE.Vector2(0.95, 0.18),
      new THREE.Vector2(1.04, 0.48),
      new THREE.Vector2(1.01, 0.86),
      new THREE.Vector2(1.06, 0.93),
      new THREE.Vector2(0.95, 0.95),
      new THREE.Vector2(0.92, 0.86),
      new THREE.Vector2(0.86, 0.24),
      new THREE.Vector2(0.0, 0.22),
    ];
    const potGeo = track(new THREE.LatheGeometry(potProfile, 48));
    const potMesh = new THREE.Mesh(potGeo, terracottaGlazeMat);
    cocotteAnchor.add(potMesh);

    // Cream glazed inner bowl wall
    const innerLiningProfile = [
      new THREE.Vector2(0.0, 0.23),
      new THREE.Vector2(0.85, 0.25),
      new THREE.Vector2(0.92, 0.88),
      new THREE.Vector2(0.96, 0.94),
    ];
    const innerLiningGeo = track(new THREE.LatheGeometry(innerLiningProfile, 40));
    const innerLining = new THREE.Mesh(innerLiningGeo, creamEnamelMat);
    cocotteAnchor.add(innerLining);

    // Artisanal unglazed seating lip ring
    const potLipGeo = track(new THREE.TorusGeometry(0.99, 0.025, 14, 48));
    const potLip = new THREE.Mesh(potLipGeo, deepTerracottaRimMat);
    potLip.rotation.x = Math.PI / 2;
    potLip.position.y = 0.945;
    cocotteAnchor.add(potLip);

    // Side curved loop handles
    const handleGeo = track(new THREE.TorusGeometry(0.22, 0.052, 16, 32, Math.PI * 1.08));
    const leftHandle = new THREE.Mesh(handleGeo, terracottaGlazeMat);
    leftHandle.position.set(-0.99, 0.74, 0);
    leftHandle.rotation.set(0.28, 0, Math.PI / 2);
    cocotteAnchor.add(leftHandle);

    const rightHandle = new THREE.Mesh(handleGeo, terracottaGlazeMat);
    rightHandle.position.set(0.99, 0.74, 0);
    rightHandle.rotation.set(0.28, 0, -Math.PI / 2);
    cocotteAnchor.add(rightHandle);

    // Simmering warm broth inside cocotte + floating tofu & herb garnish
    const brothGeo = track(new THREE.CircleGeometry(0.89, 40));
    const brothMat = track(
      new THREE.ShaderMaterial({
        vertexShader: BROTH_VERTEX_SHADER,
        fragmentShader: BROTH_FRAGMENT_SHADER,
        uniforms: {
          uTime: { value: 0 },
          uLidOpen: { value: 0 },
        },
        transparent: true,
      }),
    );
    const brothMesh = new THREE.Mesh(brothGeo, brothMat);
    brothMesh.rotation.x = -Math.PI / 2;
    brothMesh.position.y = 0.76;
    cocotteAnchor.add(brothMesh);

    const brothGlowLight = new THREE.PointLight('#F59E56', 0.55, 4.2);
    brothGlowLight.position.set(0, 1.02, 0);
    cocotteAnchor.add(brothGlowLight);

    const garnishGroup = new THREE.Group();
    garnishGroup.position.y = 0.77;
    cocotteAnchor.add(garnishGroup);

    const tofuGeo = track(new THREE.BoxGeometry(0.18, 0.09, 0.18));
    const scallionRingGeo = track(new THREE.TorusGeometry(0.055, 0.018, 10, 20));
    const sageMat = track(
      new THREE.MeshPhysicalMaterial({
        color: '#4E7A5B',
        roughness: 0.44,
        metalness: 0.02,
        clearcoat: 0.22,
        clearcoatRoughness: 0.32,
      }),
    );

    const tofuPositions: Array<[number, number, number]> = [
      [-0.28, 0.01, 0.16],
      [0.24, 0.01, -0.18],
      [0.06, 0.01, 0.3],
    ];
    tofuPositions.forEach(([tx, ty, tz], idx) => {
      const cube = new THREE.Mesh(tofuGeo, creamEnamelMat);
      cube.position.set(tx, ty, tz);
      cube.rotation.y = idx * 0.65;
      garnishGroup.add(cube);

      const ring = new THREE.Mesh(scallionRingGeo, sageMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(-tx * 0.85, 0.02, -tz * 0.85);
      garnishGroup.add(ring);
    });

    // Separate Domed Ceramic Lid Group (animated via damped spring)
    const lidGroup = new THREE.Group();
    lidGroup.position.set(0, 0.94, 0);
    cocotteAnchor.add(lidGroup);

    const lidProfile = [
      new THREE.Vector2(0.0, 0.34),
      new THREE.Vector2(0.32, 0.33),
      new THREE.Vector2(0.68, 0.25),
      new THREE.Vector2(0.96, 0.11),
      new THREE.Vector2(1.03, 0.03),
      new THREE.Vector2(0.95, -0.02),
      new THREE.Vector2(0.88, 0.02),
      new THREE.Vector2(0.0, 0.24),
    ];
    const lidGeo = track(new THREE.LatheGeometry(lidProfile, 48));
    const lidMesh = new THREE.Mesh(lidGeo, terracottaGlazeMat);
    lidGroup.add(lidMesh);

    const lidInnerRimGeo = track(new THREE.TorusGeometry(0.96, 0.022, 14, 48));
    const lidInnerRim = new THREE.Mesh(lidInnerRimGeo, creamEnamelMat);
    lidInnerRim.rotation.x = Math.PI / 2;
    lidInnerRim.position.y = 0.01;
    lidGroup.add(lidInnerRim);

    const lidBasteRingGeo = track(new THREE.TorusGeometry(0.56, 0.016, 12, 40));
    const lidBasteRing = new THREE.Mesh(lidBasteRingGeo, creamEnamelMat);
    lidBasteRing.rotation.x = Math.PI / 2;
    lidBasteRing.position.y = 0.285;
    lidGroup.add(lidBasteRing);

    const knobStemGeo = track(new THREE.CylinderGeometry(0.07, 0.11, 0.09, 24));
    const knobStem = new THREE.Mesh(knobStemGeo, brassKnobMat);
    knobStem.position.y = 0.37;
    lidGroup.add(knobStem);

    const knobCapGeo = track(new THREE.CylinderGeometry(0.16, 0.14, 0.055, 28));
    const knobCap = new THREE.Mesh(knobCapGeo, brassKnobMat);
    knobCap.position.y = 0.43;
    lidGroup.add(knobCap);

    // 3. 3D Sculpted Ceramic Tako Octopus Chef
    const takoGroup = new THREE.Group();
    takoGroup.position.set(1.32, -0.34, 0.34);
    takoGroup.rotation.y = -0.36;
    stageGroup.add(takoGroup);

    const takoBodyMat = track(
      new THREE.MeshPhysicalMaterial({
        color: '#E67F5C',
        roughness: 0.38,
        metalness: 0.02,
        clearcoat: 0.35,
        clearcoatRoughness: 0.26,
      }),
    );

    const toqueMat = track(
      new THREE.MeshPhysicalMaterial({
        color: '#FFFDF9',
        roughness: 0.52,
        metalness: 0.01,
        clearcoat: 0.16,
        clearcoatRoughness: 0.4,
      }),
    );

    const cheekMat = track(
      new THREE.MeshStandardMaterial({
        color: '#F39A82',
        roughness: 0.48,
        metalness: 0.0,
      }),
    );

    const espressoEyeMat = track(
      new THREE.MeshPhysicalMaterial({
        color: '#2C221E',
        roughness: 0.12,
        metalness: 0.05,
        clearcoat: 0.95,
        clearcoatRoughness: 0.08,
      }),
    );

    const catchlightMat = track(
      new THREE.MeshBasicMaterial({
        color: '#FFFFFF',
      }),
    );

    // Tako rounded ceramic head
    const headGeo = track(new THREE.SphereGeometry(0.5, 36, 32));
    const headMesh = new THREE.Mesh(headGeo, takoBodyMat);
    headMesh.scale.set(1.06, 0.96, 1.02);
    headMesh.position.y = 0.24;
    takoGroup.add(headMesh);

    // 8 graceful curled CatmullRomCurve3 tentacles
    const tentaclePivots: THREE.Group[] = [];
    for (let i = 0; i < 8; i += 1) {
      const pivot = new THREE.Group();
      const angle = (i / 8) * Math.PI * 2 + 0.22;
      pivot.rotation.y = angle;
      pivot.position.y = -0.08;

      const curlHeight = i % 2 === 0 ? 0.18 : 0.11;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.24, 0.06, 0),
        new THREE.Vector3(0.46, -0.18, 0.04),
        new THREE.Vector3(0.68, -0.25, 0.08),
        new THREE.Vector3(0.82, -0.16 + curlHeight * 0.5, 0.04),
        new THREE.Vector3(0.75, -0.02 + curlHeight, -0.03),
      ]);
      const tubeGeo = track(new THREE.TubeGeometry(curve, 22, 0.085, 12, false));
      const tentacleMesh = new THREE.Mesh(tubeGeo, takoBodyMat);
      pivot.add(tentacleMesh);

      // Tip sphere cap so each tentacle ends smoothly
      const tipPos = curve.getPoint(1);
      const tipCapGeo = track(new THREE.SphereGeometry(0.082, 12, 12));
      const tipCap = new THREE.Mesh(tipCapGeo, takoBodyMat);
      tipCap.position.copy(tipPos);
      pivot.add(tipCap);

      takoGroup.add(pivot);
      tentaclePivots.push(pivot);
    }

    // Pleated Creamy-White Chef Toque Crown (#FFFDF9)
    const toqueGroup = new THREE.Group();
    toqueGroup.position.set(0.03, 0.68, -0.02);
    toqueGroup.rotation.set(-0.06, 0, -0.09);
    takoGroup.add(toqueGroup);

    const toqueBandGeo = track(new THREE.CylinderGeometry(0.31, 0.33, 0.16, 32));
    const toqueBand = new THREE.Mesh(toqueBandGeo, toqueMat);
    toqueGroup.add(toqueBand);

    const toqueSageRibbonGeo = track(new THREE.TorusGeometry(0.322, 0.018, 12, 32));
    const toqueSageRibbon = new THREE.Mesh(toqueSageRibbonGeo, sageMat);
    toqueSageRibbon.rotation.x = Math.PI / 2;
    toqueSageRibbon.position.y = -0.03;
    toqueGroup.add(toqueSageRibbon);

    const centralPuffGeo = track(new THREE.SphereGeometry(0.27, 24, 20));
    const centralPuff = new THREE.Mesh(centralPuffGeo, toqueMat);
    centralPuff.position.y = 0.22;
    centralPuff.scale.set(1.08, 0.92, 1.08);
    toqueGroup.add(centralPuff);

    const pleatPuffGeo = track(new THREE.SphereGeometry(0.155, 16, 16));
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      const puff = new THREE.Mesh(pleatPuffGeo, toqueMat);
      puff.position.set(Math.cos(a) * 0.22, 0.19, Math.sin(a) * 0.22);
      puff.scale.set(1, 1.15, 1);
      toqueGroup.add(puff);
    }

    // Rosy Cheeks, Smile & Pointer-Tracking Eyes
    const cheekGeo = track(new THREE.SphereGeometry(0.085, 16, 16));
    const leftCheek = new THREE.Mesh(cheekGeo, cheekMat);
    leftCheek.scale.set(1.2, 0.72, 0.45);
    leftCheek.position.set(-0.27, 0.16, 0.45);
    takoGroup.add(leftCheek);

    const rightCheek = new THREE.Mesh(cheekGeo, cheekMat);
    rightCheek.scale.set(1.2, 0.72, 0.45);
    rightCheek.position.set(0.27, 0.16, 0.45);
    takoGroup.add(rightCheek);

    const smileGeo = track(new THREE.TorusGeometry(0.075, 0.016, 10, 20, Math.PI * 0.85));
    const smileMesh = new THREE.Mesh(smileGeo, deepTerracottaRimMat);
    smileMesh.position.set(0, 0.19, 0.49);
    smileMesh.rotation.z = Math.PI + 0.23;
    takoGroup.add(smileMesh);

    const eyeGeo = track(new THREE.SphereGeometry(0.068, 20, 20));
    const catchlightGeo = track(new THREE.SphereGeometry(0.022, 12, 12));

    const buildEyeCluster = (baseX: number) => {
      const pivot = new THREE.Group();
      pivot.position.set(baseX, 0.28, 0.47);
      const iris = new THREE.Mesh(eyeGeo, espressoEyeMat);
      iris.scale.set(1, 1.08, 0.7);
      pivot.add(iris);

      const catchlight = new THREE.Mesh(catchlightGeo, catchlightMat);
      catchlight.position.set(0.022, 0.024, 0.048);
      pivot.add(catchlight);

      takoGroup.add(pivot);
      return pivot;
    };

    const leftEyePivot = buildEyeCluster(-0.17);
    const rightEyePivot = buildEyeCluster(0.17);

    // 4. Floating Ceramic Pinch Bowls & Botanical Sage Leaves (#4E7A5B)
    const pinchBowlProfile = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.2, 0.0),
      new THREE.Vector2(0.31, 0.08),
      new THREE.Vector2(0.34, 0.17),
      new THREE.Vector2(0.3, 0.18),
      new THREE.Vector2(0.24, 0.05),
      new THREE.Vector2(0.0, 0.04),
    ];
    const pinchBowlGeo = track(new THREE.LatheGeometry(pinchBowlProfile, 32));
    const pinchSpiceGeo = track(new THREE.CircleGeometry(0.24, 24));
    const honeySpiceMat = track(
      new THREE.MeshStandardMaterial({
        color: '#C68634',
        roughness: 0.68,
      }),
    );

    const frontPinchBowl = new THREE.Group();
    frontPinchBowl.position.set(-1.68, -0.56, 0.66);
    frontPinchBowl.add(new THREE.Mesh(pinchBowlGeo, creamEnamelMat));
    const spiceFill1 = new THREE.Mesh(pinchSpiceGeo, honeySpiceMat);
    spiceFill1.rotation.x = -Math.PI / 2;
    spiceFill1.position.y = 0.11;
    frontPinchBowl.add(spiceFill1);
    stageGroup.add(frontPinchBowl);

    const floatingPinchBowl = new THREE.Group();
    floatingPinchBowl.position.set(0.56, 0.56, -0.82);
    floatingPinchBowl.rotation.set(0.22, 0.4, -0.14);
    floatingPinchBowl.scale.setScalar(0.84);
    floatingPinchBowl.add(new THREE.Mesh(pinchBowlGeo, creamEnamelMat));
    const spiceFill2 = new THREE.Mesh(pinchSpiceGeo, sageMat);
    spiceFill2.rotation.x = -Math.PI / 2;
    spiceFill2.position.y = 0.11;
    floatingPinchBowl.add(spiceFill2);
    stageGroup.add(floatingPinchBowl);

    // 5 Sculpted Botanical Sage Leaves gently bobbing in harmonic motion
    const leafGeo = track(createBotanicalLeafGeometry());
    const leafConfigs: Array<{
      pos: [number, number, number];
      rot: [number, number, number];
      scale: number;
      phase: number;
    }> = [
      { pos: [-1.62, 0.54, 0.18], rot: [0.4, 0.3, -0.5], scale: 0.95, phase: 0.0 },
      { pos: [-1.18, 0.96, -0.45], rot: [-0.3, 0.8, 0.4], scale: 0.78, phase: 1.3 },
      { pos: [0.42, 1.08, 0.28], rot: [0.5, -0.4, 0.6], scale: 0.86, phase: 2.4 },
      { pos: [1.92, 0.62, -0.22], rot: [-0.4, 0.5, -0.35], scale: 0.82, phase: 3.7 },
      { pos: [1.74, -0.18, 0.92], rot: [0.6, -0.6, 0.25], scale: 0.72, phase: 4.9 },
    ];
    const sageLeaves = leafConfigs.map((cfg) => {
      const leaf = new THREE.Mesh(leafGeo, sageMat);
      leaf.position.set(...cfg.pos);
      leaf.rotation.set(...cfg.rot);
      leaf.scale.setScalar(cfg.scale);
      stageGroup.add(leaf);
      return { mesh: leaf, basePos: cfg.pos, baseRot: cfg.rot, phase: cfg.phase };
    });

    // 5. Custom GLSL Volumetric Warm Steam Plumes
    const steamPlaneGeo = track(new THREE.PlaneGeometry(1.42, 1.85, 16, 24));
    const steamMaterials: THREE.ShaderMaterial[] = [];
    const steamAngles = [0, Math.PI * 0.28, -Math.PI * 0.28, Math.PI * 0.52];

    steamAngles.forEach((angle, idx) => {
      const mat = track(
        new THREE.ShaderMaterial({
          vertexShader: STEAM_VERTEX_SHADER,
          fragmentShader: STEAM_FRAGMENT_SHADER,
          uniforms: {
            uTime: { value: 0 },
            uLidOpen: { value: 0 },
            uSeed: { value: idx * 3.17 + 1.1 },
          },
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      steamMaterials.push(mat);
      const plane = new THREE.Mesh(steamPlaneGeo, mat);
      plane.position.set(
        (idx - 1.5) * 0.08,
        1.78,
        (idx % 2 === 0 ? 1 : -1) * 0.05,
      );
      plane.rotation.y = angle;
      cocotteAnchor.add(plane);
    });

    // Sunbeam Dust Motes (Points)
    const moteCount = 36;
    const motePositions = new Float32Array(moteCount * 3);
    const moteScales = new Float32Array(moteCount);
    const motePhases = new Float32Array(moteCount);

    for (let i = 0; i < moteCount; i += 1) {
      // Deterministic pseudo-random spread so SSR/hydration stays clean
      const s1 = Math.sin(i * 12.9898 + 1.23) * 43758.5453;
      const s2 = Math.sin(i * 78.233 + 4.56) * 24634.6345;
      const s3 = Math.sin(i * 39.425 + 7.89) * 19543.2145;
      const r1 = s1 - Math.floor(s1);
      const r2 = s2 - Math.floor(s2);
      const r3 = s3 - Math.floor(s3);

      motePositions[i * 3] = (r1 - 0.45) * 4.4;
      motePositions[i * 3 + 1] = (r2 - 0.2) * 2.5;
      motePositions[i * 3 + 2] = (r3 - 0.5) * 2.6;
      moteScales[i] = 0.65 + r1 * 0.95;
      motePhases[i] = r2 * 2.4;
    }

    const dustGeo = track(new THREE.BufferGeometry());
    dustGeo.setAttribute('position', new THREE.BufferAttribute(motePositions, 3));
    dustGeo.setAttribute('aScale', new THREE.BufferAttribute(moteScales, 1));
    dustGeo.setAttribute('aPhase', new THREE.BufferAttribute(motePhases, 1));

    const dustMat = track(
      new THREE.ShaderMaterial({
        vertexShader: DUST_VERTEX_SHADER,
        fragmentShader: DUST_FRAGMENT_SHADER,
        uniforms: {
          uTime: { value: 0 },
          uPixelRatio: { value: 1 },
        },
        transparent: true,
        depthWrite: false,
      }),
    );
    const dustPoints = new THREE.Points(dustGeo, dustMat);
    stageGroup.add(dustPoints);

    // Smooth damped animation state
    let lidSpring = liveControlsRef.current.lidOpen ? 1 : 0;
    let lidVelocity = 0;
    let camPos = new THREE.Vector3(0.24, 2.25, 5.15);
    let smoothPtrX = 0;
    let smoothPtrY = 0;
    let elapsed = 1.4; // Start with steam already gracefully mid-rise on first frame!
    let lastNow = typeof performance !== 'undefined' ? performance.now() : 0;
    let rafId: number | null = null;
    let paintedOnce = false;
    let disposed = false;

    const syncViewport = () => {
      if (!renderer) return;
      const { width, height, dpr } = liveControlsRef.current.size;
      const safeW = Math.max(1, width);
      const safeH = Math.max(1, height);
      renderer.setPixelRatio(dpr);
      renderer.setSize(safeW, safeH, false);
      camera.aspect = safeW / safeH;
      camera.fov = compact ? 36 : safeW < 560 ? 38 : 34;
      camera.updateProjectionMatrix();
      dustMat.uniforms.uPixelRatio.value = dpr;
    };

    const renderFrame = (dt: number, advanceTime: boolean) => {
      if (disposed || !renderer) return;
      syncViewport();

      const clampedDt = Math.min(0.05, Math.max(0.001, dt));
      if (advanceTime) {
        elapsed += clampedDt;
      }

      const targetLid = liveControlsRef.current.lidOpen ? 1 : 0;
      if (advanceTime) {
        const stiffness = 115;
        const damping = 16;
        const accel = (targetLid - lidSpring) * stiffness - lidVelocity * damping;
        lidVelocity += accel * clampedDt;
        lidSpring = Math.max(0, Math.min(1.12, lidSpring + lidVelocity * clampedDt));
      } else {
        lidSpring = targetLid;
        lidVelocity = 0;
      }

      // Apply interactive lid peek & simmer boost (+0.38 units up, 0.22 rad tilt)
      lidGroup.position.y = 0.94 + lidSpring * 0.38;
      lidGroup.position.x = lidSpring * 0.08;
      lidGroup.rotation.z = -lidSpring * 0.22;
      lidGroup.rotation.x = -lidSpring * 0.07;

      const lidClamped = Math.max(0, Math.min(1, lidSpring));
      brothGlowLight.intensity = 0.55 + lidClamped * 1.95;
      brothMat.uniforms.uTime.value = elapsed;
      brothMat.uniforms.uLidOpen.value = lidClamped;

      steamMaterials.forEach((mat) => {
        mat.uniforms.uTime.value = elapsed;
        mat.uniforms.uLidOpen.value = lidClamped;
      });
      dustMat.uniforms.uTime.value = elapsed;

      // Pointer tracking for stage parallax & Tako Chef's walnut eyes
      const ptrLerp = advanceTime ? Math.min(1, clampedDt * 8) : 1;
      smoothPtrX += (liveControlsRef.current.pointerX - smoothPtrX) * ptrLerp;
      smoothPtrY += (liveControlsRef.current.pointerY - smoothPtrY) * ptrLerp;

      leftEyePivot.position.x = -0.17 + smoothPtrX * 0.042;
      leftEyePivot.position.y = 0.28 + smoothPtrY * 0.036;
      rightEyePivot.position.x = 0.17 + smoothPtrX * 0.042;
      rightEyePivot.position.y = 0.28 + smoothPtrY * 0.036;

      // Harmonic breath on Tako Chef, tentacles, floating bowl & sage leaves
      const breath = advanceTime ? Math.sin(elapsed * 2.1) : 0;
      takoGroup.position.y = -0.34 + breath * 0.024 + lidClamped * 0.025;
      toqueGroup.rotation.z = -0.09 + Math.sin(elapsed * 1.7) * 0.035;

      tentaclePivots.forEach((pivot, idx) => {
        const wave = advanceTime
          ? Math.sin(elapsed * (2.4 + lidClamped * 1.1) + idx * 0.9) * (0.045 + lidClamped * 0.03)
          : 0;
        pivot.rotation.z = wave;
      });

      floatingPinchBowl.position.y = 0.56 + Math.sin(elapsed * 1.5 + 0.8) * 0.045;
      floatingPinchBowl.rotation.y = 0.4 + Math.sin(elapsed * 0.9) * 0.12;

      sageLeaves.forEach((item) => {
        item.mesh.position.y =
          item.basePos[1] + Math.sin(elapsed * 1.65 + item.phase) * 0.055;
        item.mesh.rotation.z =
          item.baseRot[2] + Math.cos(elapsed * 1.25 + item.phase) * 0.09;
      });

      // Camera preset interpolation ("Góc nghiêng" vs "Góc trực diện")
      const preset = liveControlsRef.current.cameraPreset;
      const targetCamX = (preset === 'angled' ? 0.34 : 0.02) + smoothPtrX * 0.28;
      const targetCamY = (preset === 'angled' ? 2.28 : 1.28) + smoothPtrY * 0.18;
      const targetCamZ = preset === 'angled' ? 5.05 : 5.25;

      if (advanceTime) {
        const camLerp = Math.min(1, clampedDt * 5.5);
        camPos.x += (targetCamX - camPos.x) * camLerp;
        camPos.y += (targetCamY - camPos.y) * camLerp;
        camPos.z += (targetCamZ - camPos.z) * camLerp;
      } else {
        camPos.set(targetCamX, targetCamY, targetCamZ);
      }

      camera.position.copy(camPos);
      camera.lookAt(0.18, 0.14 + lidClamped * 0.06, 0);

      renderer.render(scene, camera);
      if (!paintedOnce) {
        paintedOnce = true;
        setWebglReady(true);
      }
    };

    const tick = (now: number) => {
      if (disposed) return;
      const dt = (now - lastNow) / 1000;
      lastNow = now;
      renderFrame(dt, true);
      if (liveControlsRef.current.shouldRunLoop) {
        rafId = window.requestAnimationFrame(tick);
      } else {
        rafId = null;
      }
    };

    liveControlsRef.current.requestSingleRender = () => {
      if (disposed) return;
      renderFrame(0.016, false);
      if (liveControlsRef.current.shouldRunLoop && rafId === null && typeof window !== 'undefined') {
        lastNow = typeof performance !== 'undefined' ? performance.now() : 0;
        rafId = window.requestAnimationFrame(tick);
      }
    };

    // Paint initial frame synchronously so CLS = 0.000
    renderFrame(0.016, !prefersReducedMotion);
    if (liveControlsRef.current.shouldRunLoop && typeof window !== 'undefined') {
      lastNow = typeof performance !== 'undefined' ? performance.now() : 0;
      rafId = window.requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      liveControlsRef.current.requestSingleRender = null;
      if (rafId !== null && typeof window !== 'undefined') {
        window.cancelAnimationFrame(rafId);
      }
      disposables.forEach((d) => d.dispose());
      envTarget?.dispose();
      pmremGenerator?.dispose();
      renderer?.dispose();
    };
  }, [webglSupported, webglFailed, compact, prefersReducedMotion]);

  // Resume RAF loop cleanly when shouldAnimate / isMotionPaused flips back to true
  useEffect(() => {
    if (shouldAnimate && !isMotionPaused) {
      liveControlsRef.current.requestSingleRender?.();
    }
  }, [shouldAnimate, isMotionPaused]);

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    liveControlsRef.current.pointerX = Math.max(-1, Math.min(1, nx));
    liveControlsRef.current.pointerY = Math.max(-1, Math.min(1, ny));
  };

  const handlePointerLeave = () => {
    setIsStageHovered(false);
    liveControlsRef.current.pointerX = 0;
    liveControlsRef.current.pointerY = 0;
  };

  const showFallbackUnderlay = !webglReady || !webglSupported || webglFailed;

  return (
    <div
      ref={containerRef}
      onPointerEnter={() => setIsStageHovered(true)}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={clsx(
        'tkv-hero-ceramic relative w-full overflow-hidden rounded-[var(--tkv-radius-card)] select-none',
        compact ? 'min-h-[270px] sm:min-h-[310px]' : 'min-h-[340px] sm:min-h-[410px]',
        className,
      )}
    >
      {/* Zero-CLS Poster / Inline Sunlit Ceramic SVG Underlay */}
      <div
        aria-hidden={webglReady}
        className={clsx(
          'absolute inset-0 transition-opacity duration-300',
          showFallbackUnderlay ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
      >
        {posterSrc ? (
          <img
            src={posterSrc}
            srcSet={posterSrcSet}
            alt={posterAlt}
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <StaticKitchenPosterSvg lidOpen={isLidEffectiveOpen} posterAlt={posterAlt} />
        )}
      </div>

      {/* Interactive 60fps Three.js PBR Canvas */}
      {webglSupported && !webglFailed && (
        <canvas
          ref={canvasRef}
          aria-label={posterAlt}
          role="img"
          className={clsx(
            'relative z-10 block h-full w-full transition-opacity duration-300',
            webglReady ? 'opacity-100' : 'opacity-0',
          )}
          style={{
            minHeight: compact ? 270 : 340,
          }}
        />
      )}

      {/* Top Interactive Lid Peek & Simmer Mode Pill */}
      <div className="pointer-events-none absolute inset-x-3 top-3 z-20 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setIsLidPinnedOpen((prev) => !prev)}
          aria-pressed={isLidPinnedOpen}
          className="tkv-focusable tkv-tactile pointer-events-auto inline-flex min-h-[44px] min-w-[44px] items-center gap-2 rounded-full border border-[var(--tkv-border-coral)] bg-[var(--tkv-header-glass)] px-3.5 py-1.5 text-xs font-semibold text-[var(--tkv-ink)] shadow-xs backdrop-blur-xs hover:bg-[var(--tkv-surface)]"
        >
          <span
            aria-hidden="true"
            className="h-2 w-2 rounded-full"
            style={{
              backgroundColor: isLidEffectiveOpen
                ? 'var(--tkv-primary)'
                : 'var(--tkv-success)',
            }}
          />
          <span>{isLidEffectiveOpen ? 'Đậy nắp ủ ấm' : 'Mở nắp xem hơi bếp'}</span>
        </button>

        <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-[var(--tkv-border)] bg-[var(--tkv-header-glass)] px-3 py-1 text-[11px] font-medium text-[var(--tkv-ink-secondary)] backdrop-blur-xs">
          <span>Bếp gốm Takolio 3D</span>
        </span>
      </div>

      {/* Bottom Interactive Controls Bar */}
      <div
        data-testid="webgl-hero-controls"
        role="toolbar"
        aria-label="Điều khiển góc nhìn gian bếp gốm 3D Takolio"
        className="pointer-events-none absolute inset-x-3 bottom-3 z-20 flex flex-wrap items-center justify-between gap-2"
      >
        <div className="pointer-events-auto inline-flex flex-wrap items-center gap-1.5 rounded-full border border-[var(--tkv-border)] bg-[var(--tkv-header-glass)] p-1 shadow-xs backdrop-blur-xs">
          <button
            type="button"
            onClick={() => setIsLidPinnedOpen((prev) => !prev)}
            aria-pressed={isLidPinnedOpen}
            className={clsx(
              'tkv-focusable tkv-tactile inline-flex min-h-[44px] min-w-[44px] items-center rounded-full px-3 py-1 text-xs font-semibold',
              isLidEffectiveOpen
                ? 'bg-[var(--tkv-primary)] text-white'
                : 'bg-[var(--tkv-surface)] text-[var(--tkv-ink)] hover:bg-[var(--tkv-surface-subtle)]',
            )}
          >
            {isLidEffectiveOpen ? 'Đậy nắp' : 'Mở nắp nồi'}
          </button>

          <button
            type="button"
            onClick={() =>
              setCameraPreset((prev) => (prev === 'angled' ? 'front' : 'angled'))
            }
            aria-pressed={cameraPreset === 'front'}
            className="tkv-focusable tkv-tactile inline-flex min-h-[44px] min-w-[44px] items-center rounded-full border border-[var(--tkv-border)] bg-[var(--tkv-surface)] px-3 py-1 text-xs font-semibold text-[var(--tkv-ink)] hover:bg-[var(--tkv-surface-subtle)]"
          >
            {cameraPreset === 'angled' ? 'Góc nghiêng' : 'Góc trực diện'}
          </button>
        </div>

        <button
          type="button"
          onClick={() => setIsMotionPaused((prev) => !prev)}
          aria-pressed={isMotionPaused}
          className={clsx(
            'tkv-focusable tkv-tactile pointer-events-auto inline-flex min-h-[44px] min-w-[44px] items-center rounded-full border px-3 py-1 text-xs font-medium backdrop-blur-xs',
            isMotionPaused
              ? 'border-[var(--tkv-border-strong)] bg-[var(--tkv-surface-subtle)] text-[var(--tkv-ink)]'
              : 'border-[var(--tkv-border)] bg-[var(--tkv-header-glass)] text-[var(--tkv-ink-secondary)] hover:text-[var(--tkv-ink)]',
          )}
        >
          {isMotionPaused ? 'Tiếp tục chuyển động' : 'Tạm dừng chuyển động'}
        </button>
      </div>
    </div>
  );
};

export default SunlitKitchenStage3D;
