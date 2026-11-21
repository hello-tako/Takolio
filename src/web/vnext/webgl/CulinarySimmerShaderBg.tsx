import React, { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import * as THREE from 'three';
import { useWebGlLifecycle } from './useWebGlLifecycle';

export type CulinarySimmerMode = 'simmer' | 'boil' | 'sear';

export interface CulinarySimmerShaderBgProps {
  mode?: CulinarySimmerMode;
  timerRunning?: boolean;
  className?: string;
}

const SIMMER_BG_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const SIMMER_BG_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform vec2 uResolution;
  uniform vec3 uBaseColor;
  uniform vec3 uWashColor;
  uniform vec3 uCausticColor;
  uniform float uWaveIntensity;
  varying vec2 vUv;

  float causticPattern(vec2 uv, float t) {
    vec2 p = uv * 3.4;
    float w1 = sin(p.x * 1.8 + sin(p.y * 2.1 - t * 0.9) + t * 0.55);
    float w2 = cos(p.y * 2.2 - t * 0.75 + cos(p.x * 1.9 + t * 0.45));
    float w3 = sin((p.x + p.y) * 1.6 - t * 0.65);
    float combined = (w1 + w2 + w3) / 3.0;
    return pow(max(0.0, 1.0 - abs(combined)), 3.2);
  }

  void main() {
    float aspect = uResolution.x / max(1.0, uResolution.y);
    vec2 uv = vec2((vUv.x - 0.5) * aspect + 0.5, vUv.y);

    // Rising delicate steam waves
    float steamWave1 = sin(uv.x * 6.5 + sin(uv.y * 4.0 - uTime * 0.85) * 1.4) * 0.5 + 0.5;
    float steamWave2 = sin(uv.x * 3.8 - uv.y * 2.6 + uTime * 0.55) * 0.5 + 0.5;
    float steamVeil = smoothstep(0.25, 0.92, steamWave1 * 0.55 + steamWave2 * 0.45) * (1.0 - vUv.y * 0.35);

    // Warm sunlit ceramic caustics
    float c1 = causticPattern(uv, uTime);
    float c2 = causticPattern(uv * 1.35 + vec2(0.42, -0.18), uTime * 0.82);
    float caustics = clamp(c1 * 0.65 + c2 * 0.45, 0.0, 1.0);

    vec3 col = mix(uBaseColor, uWashColor, steamVeil * 0.78);
    col = mix(col, uCausticColor, caustics * uWaveIntensity);

    // Soft top-right sunlit window glow (#FFFDFB)
    float windowGlow = exp(-distance(vUv, vec2(0.82, 0.86)) * 2.1) * 0.35;
    col = mix(col, vec3(1.0, 0.992, 0.984), windowGlow);

    gl_FragColor = vec4(col, 1.0);
  }
`;

interface ModePalette {
  base: [number, number, number];
  wash: [number, number, number];
  caustic: [number, number, number];
  cssFallback: string;
}

const MODE_PALETTES: Record<CulinarySimmerMode, ModePalette> = {
  simmer: {
    // Gentle terracotta-linen (#FCF9F5 -> #FFF3EB -> #F4CFC0)
    base: [0.988, 0.976, 0.961],
    wash: [1.0, 0.953, 0.922],
    caustic: [0.945, 0.78, 0.71],
    cssFallback: 'linear-gradient(135deg, #FCF9F5 0%, #FFF6F0 52%, #FDF0EA 100%)',
  },
  boil: {
    // Airy sage-cream mist (#FCF9F5 -> #EEF5F0 -> #CFE2D5)
    base: [0.988, 0.976, 0.961],
    wash: [0.933, 0.961, 0.941],
    caustic: [0.785, 0.878, 0.815],
    cssFallback: 'linear-gradient(135deg, #FCF9F5 0%, #F4F9F5 52%, #EEF5F0 100%)',
  },
  sear: {
    // Warm toasted honey glow (#FFFDF9 -> #FCF5E6 -> #F2D8A7)
    base: [1.0, 0.992, 0.976],
    wash: [0.988, 0.961, 0.902],
    caustic: [0.945, 0.835, 0.635],
    cssFallback: 'linear-gradient(135deg, #FFFDF9 0%, #FCF5E6 55%, #F8EAD0 100%)',
  },
};

export const CulinarySimmerShaderBg: React.FC<CulinarySimmerShaderBgProps> = ({
  mode = 'simmer',
  timerRunning = false,
  className,
}) => {
  const { containerRef, webglSupported, shouldAnimate, prefersReducedMotion, size } =
    useWebGlLifecycle({
      minIntersectionRatio: 0.05,
      fallbackWidth: 640,
      fallbackHeight: 360,
    });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [webglReady, setWebglReady] = useState(false);
  const [webglFailed, setWebglFailed] = useState(false);

  const liveRef = useRef({
    mode,
    timerRunning,
    shouldAnimate,
    size,
    requestRender: null as (() => void) | null,
  });

  liveRef.current.mode = mode;
  liveRef.current.timerRunning = timerRunning;
  liveRef.current.shouldAnimate = shouldAnimate;
  liveRef.current.size = size;

  useEffect(() => {
    liveRef.current.requestRender?.();
  }, [mode, timerRunning, size.width, size.height, size.dpr]);

  useEffect(() => {
    if (!webglSupported || webglFailed) return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    let renderer: THREE.WebGLRenderer | null = null;
    try {
      const ctx =
        canvas.getContext('webgl2', { alpha: false, antialias: false }) ||
        canvas.getContext('webgl', { alpha: false, antialias: false });
      if (!ctx) {
        setWebglFailed(true);
        return undefined;
      }
      renderer = new THREE.WebGLRenderer({
        canvas,
        context: ctx as WebGLRenderingContext,
        alpha: false,
        antialias: false,
        powerPreference: 'low-power',
      });
    } catch {
      setWebglFailed(true);
      return undefined;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const initialPalette = MODE_PALETTES[liveRef.current.mode];
    const quadGeo = new THREE.PlaneGeometry(2, 2);
    const shaderMat = new THREE.ShaderMaterial({
      vertexShader: SIMMER_BG_VERTEX,
      fragmentShader: SIMMER_BG_FRAGMENT,
      uniforms: {
        uTime: { value: 1.2 },
        uResolution: { value: new THREE.Vector2(640, 360) },
        uBaseColor: { value: new THREE.Color(...initialPalette.base) },
        uWashColor: { value: new THREE.Color(...initialPalette.wash) },
        uCausticColor: { value: new THREE.Color(...initialPalette.caustic) },
        uWaveIntensity: { value: liveRef.current.timerRunning ? 0.34 : 0.2 },
      },
      depthTest: false,
      depthWrite: false,
    });

    const quadMesh = new THREE.Mesh(quadGeo, shaderMat);
    scene.add(quadMesh);

    const targetBase = new THREE.Color();
    const targetWash = new THREE.Color();
    const targetCaustic = new THREE.Color();

    let currentSpeed = liveRef.current.timerRunning ? 1.45 : 0.48;
    let simTime = 1.2;
    let lastNow = typeof performance !== 'undefined' ? performance.now() : 0;
    let rafId: number | null = null;
    let painted = false;
    let disposed = false;

    const renderFrame = (dt: number, advance: boolean) => {
      if (disposed || !renderer) return;
      const { width, height, dpr } = liveRef.current.size;
      const safeW = Math.max(1, width);
      const safeH = Math.max(1, height);
      const cappedDpr = Math.min(dpr, 1.5);
      renderer.setPixelRatio(cappedDpr);
      renderer.setSize(safeW, safeH, false);
      shaderMat.uniforms.uResolution.value.set(safeW, safeH);

      const clampedDt = Math.min(0.05, Math.max(0.001, dt));
      const palette = MODE_PALETTES[liveRef.current.mode];
      targetBase.setRGB(...palette.base);
      targetWash.setRGB(...palette.wash);
      targetCaustic.setRGB(...palette.caustic);

      const modeBoost =
        liveRef.current.mode === 'boil'
          ? 1.22
          : liveRef.current.mode === 'sear'
            ? 1.08
            : 0.92;
      const desiredSpeed = (liveRef.current.timerRunning ? 1.48 : 0.46) * modeBoost;
      const desiredIntensity = liveRef.current.timerRunning ? 0.34 : 0.21;

      if (advance) {
        const lerpRate = Math.min(1, clampedDt * 4.2);
        currentSpeed += (desiredSpeed - currentSpeed) * lerpRate;
        simTime += clampedDt * currentSpeed;
        shaderMat.uniforms.uBaseColor.value.lerp(targetBase, lerpRate);
        shaderMat.uniforms.uWashColor.value.lerp(targetWash, lerpRate);
        shaderMat.uniforms.uCausticColor.value.lerp(targetCaustic, lerpRate);
        shaderMat.uniforms.uWaveIntensity.value +=
          (desiredIntensity - shaderMat.uniforms.uWaveIntensity.value) * lerpRate;
      } else {
        shaderMat.uniforms.uBaseColor.value.copy(targetBase);
        shaderMat.uniforms.uWashColor.value.copy(targetWash);
        shaderMat.uniforms.uCausticColor.value.copy(targetCaustic);
        shaderMat.uniforms.uWaveIntensity.value = desiredIntensity;
      }

      shaderMat.uniforms.uTime.value = simTime;
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
      renderFrame(dt, true);
      if (liveRef.current.shouldAnimate) {
        rafId = window.requestAnimationFrame(tick);
      } else {
        rafId = null;
      }
    };

    liveRef.current.requestRender = () => {
      if (disposed) return;
      renderFrame(0.016, false);
      if (liveRef.current.shouldAnimate && rafId === null && typeof window !== 'undefined') {
        lastNow = typeof performance !== 'undefined' ? performance.now() : 0;
        rafId = window.requestAnimationFrame(tick);
      }
    };

    renderFrame(0.016, !prefersReducedMotion);
    if (liveRef.current.shouldAnimate && typeof window !== 'undefined') {
      lastNow = typeof performance !== 'undefined' ? performance.now() : 0;
      rafId = window.requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      liveRef.current.requestRender = null;
      if (rafId !== null && typeof window !== 'undefined') {
        window.cancelAnimationFrame(rafId);
      }
      quadGeo.dispose();
      shaderMat.dispose();
      renderer?.dispose();
    };
  }, [webglSupported, webglFailed, prefersReducedMotion]);

  useEffect(() => {
    if (shouldAnimate) {
      liveRef.current.requestRender?.();
    }
  }, [shouldAnimate]);

  const palette = MODE_PALETTES[mode];

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      data-simmer-mode={mode}
      className={clsx(
        'pointer-events-none select-none overflow-hidden',
        className ?? 'absolute inset-0',
      )}
      style={{
        backgroundImage: palette.cssFallback,
      }}
    >
      {webglSupported && !webglFailed && (
        <canvas
          ref={canvasRef}
          className={clsx(
            'block h-full w-full transition-opacity duration-500',
            webglReady ? 'opacity-100' : 'opacity-0',
          )}
        />
      )}
    </div>
  );
};

export default CulinarySimmerShaderBg;
