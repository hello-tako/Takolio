import React, { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import {
  loadGLB,
  type RuntimeGLBNode,
} from './glb-loader';
import {
  isWebGL2Supported,
  TakolioWebGL2Engine,
  type CameraGoal,
  type EngineFrameContext,
  type ParticleEffectConfig,
  type PointLightConfig,
} from './webgl-pbr-engine';
import { ThreeDOrbitBadgeIcon } from '../../design-system/icons';

export interface StageHotspotBadge {
  id: string;
  label: string;
  sublabel?: string;
  positionClassName: string;
  active?: boolean;
  icon?: React.ReactNode;
  onClick?: () => void;
}

export interface TakolioGLBStageProps {
  glbUrl: string;
  ariaLabel: string;
  posterUrl?: string;
  fallbackRender?: React.ReactNode;
  camera?: CameraGoal;
  interactive?: boolean;
  showOrbitHint?: boolean;
  autoRotateSpeed?: number;
  shadowOpacity?: number;
  shadowY?: number;
  interactiveNodeNames?: string[];
  particleConfig?: ParticleEffectConfig;
  pointLight?: PointLightConfig;
  hotspots?: StageHotspotBadge[];
  onUpdateFrame?: (ctx: EngineFrameContext) => void;
  onHoverNode?: (
    node: RuntimeGLBNode | null,
    pointer: { x: number; y: number } | null
  ) => void;
  onSelectNode?: (node: RuntimeGLBNode) => void;
  className?: string;
  canvasClassName?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  return reduced;
}

export const TakolioGLBStage: React.FC<TakolioGLBStageProps> = ({
  glbUrl,
  ariaLabel,
  posterUrl,
  fallbackRender,
  camera,
  interactive = true,
  showOrbitHint = false,
  autoRotateSpeed = 0,
  shadowOpacity = 0.24,
  shadowY = 0.002,
  interactiveNodeNames,
  particleConfig,
  pointLight,
  hotspots,
  onUpdateFrame,
  onHoverNode,
  onSelectNode,
  className,
  canvasClassName,
  style,
  children,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<TakolioWebGL2Engine | null>(null);
  const reducedMotion = usePrefersReducedMotion();

  const [webglAvailable, setWebglAvailable] = useState<boolean>(() =>
    isWebGL2Supported()
  );
  const [status, setStatus] = useState<'loading' | 'ready' | 'fallback'>(() =>
    isWebGL2Supported() ? 'loading' : 'fallback'
  );

  // Keep latest callbacks in refs so prop updates never recreate the WebGL2 context
  const frameCallbackRef = useRef(onUpdateFrame);
  frameCallbackRef.current = onUpdateFrame;

  const hoverCallbackRef = useRef(onHoverNode);
  hoverCallbackRef.current = onHoverNode;

  const selectCallbackRef = useRef(onSelectNode);
  selectCallbackRef.current = onSelectNode;

  const nodeNamesKey = (interactiveNodeNames ?? []).join('|');

  useEffect(() => {
    if (!webglAvailable) {
      setStatus('fallback');
      return;
    }

    let cancelled = false;
    setStatus('loading');

    loadGLB(glbUrl)
      .then((parsedScene) => {
        if (cancelled) return;
        const canvasEl = canvasRef.current;
        if (!canvasEl) {
          setStatus('fallback');
          return;
        }
        try {
          const engine = new TakolioWebGL2Engine({
            canvas: canvasEl,
            parsedScene,
            initialCamera: camera,
            interactive,
            autoRotateSpeed,
            reducedMotion,
            shadowOpacity,
            shadowY,
            interactiveNodeNames,
            particleConfig,
            pointLight,
            onUpdateFrame: (ctx) => frameCallbackRef.current?.(ctx),
            onHoverNode: (node, ptr) => hoverCallbackRef.current?.(node, ptr),
            onSelectNode: (node) => selectCallbackRef.current?.(node),
            onContextLost: () => {
              if (!cancelled) {
                setWebglAvailable(false);
                setStatus('fallback');
              }
            },
          });
          engineRef.current = engine;
          setStatus('ready');
        } catch {
          setWebglAvailable(false);
          setStatus('fallback');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus('fallback');
        }
      });

    return () => {
      cancelled = true;
      engineRef.current?.dispose();
      engineRef.current = null;
    };
    // Only re-initialize WebGL2 engine if model URL or interactive node list changes
  }, [glbUrl, webglAvailable, nodeNamesKey, interactive]);

  // Live-sync camera target without tearing down GPU buffers
  useEffect(() => {
    if (camera && engineRef.current) {
      engineRef.current.setCameraGoal(camera);
    }
  }, [
    camera?.yaw,
    camera?.pitch,
    camera?.distance,
    camera?.fovDeg,
    camera?.target?.[0],
    camera?.target?.[1],
    camera?.target?.[2],
  ]);

  // Live-sync culinary particle system
  useEffect(() => {
    if (particleConfig && engineRef.current) {
      engineRef.current.setParticleConfig(particleConfig);
    }
  }, [
    particleConfig?.mode,
    particleConfig?.intensity,
    particleConfig?.spreadRadius,
    particleConfig?.riseHeight,
    particleConfig?.origin?.[0],
    particleConfig?.origin?.[1],
    particleConfig?.origin?.[2],
    particleConfig?.color?.[0],
    particleConfig?.color?.[1],
    particleConfig?.color?.[2],
  ]);

  // Live-sync dynamic point light (flame / fridge shelf glow)
  useEffect(() => {
    if (pointLight && engineRef.current) {
      engineRef.current.setPointLight(pointLight);
    }
  }, [
    pointLight?.intensity,
    pointLight?.position[0],
    pointLight?.position[1],
    pointLight?.position[2],
    pointLight?.color[0],
    pointLight?.color[1],
    pointLight?.color[2],
  ]);

  useEffect(() => {
    engineRef.current?.setReducedMotion(reducedMotion);
  }, [reducedMotion]);

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      style={style}
      className={clsx(
        'relative overflow-hidden select-none',
        className
      )}
    >
      {/* Loading Shimmer Backdrop */}
      {status === 'loading' && (
        <div
          aria-hidden="true"
          className="absolute inset-0 z-10 flex items-center justify-center bg-tk-sanctuary/85 backdrop-blur-[2px] transition-opacity duration-300"
        >
          <div className="flex flex-col items-center gap-2">
            <div className="h-12 w-12 animate-pulse rounded-full bg-tk-flame/20 ring-4 ring-tk-jade/15" />
            <span className="text-xs font-semibold tracking-wide text-white/80">
              Đang dựng không gian bếp...
            </span>
          </div>
        </div>
      )}

      {/* WebGL2 Canvas OR Graceful SVG/WebP Fallback */}
      {status !== 'fallback' ? (
        <canvas
          ref={canvasRef}
          className={clsx(
            'block h-full w-full touch-none transition-opacity duration-300',
            interactive ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none',
            status === 'ready' ? 'opacity-100' : 'opacity-0',
            canvasClassName
          )}
        />
      ) : (
        <div
          data-testid="takolio-3d-fallback"
          className="flex h-full w-full items-center justify-center"
        >
          {fallbackRender ? (
            fallbackRender
          ) : posterUrl ? (
            <img
              src={posterUrl}
              alt={ariaLabel}
              className="h-full w-full object-contain"
              loading="lazy"
            />
          ) : null}
        </div>
      )}

      {/* Subtle 3D Interactive Orbit Hint Pill */}
      {showOrbitHint && interactive && status === 'ready' && (
        <div
          aria-hidden="true"
          className="tk-glass-dark pointer-events-none absolute right-3 top-3 z-20 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white/85"
        >
          <ThreeDOrbitBadgeIcon size={14} tone="cream" />
          <span>Xoay 360°</span>
        </div>
      )}

      {/* Interactive Hotspot Badges */}
      {hotspots && hotspots.length > 0 && (
        <div className="pointer-events-none absolute inset-0 z-20">
          {hotspots.map((spot) => (
            <button
              key={spot.id}
              type="button"
              onClick={spot.onClick}
              aria-pressed={spot.active}
              className={clsx(
                'pointer-events-auto absolute inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold shadow-card backdrop-blur-md transition-tap duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-tk-flame',
                spot.active
                  ? 'scale-105 border-tk-flame bg-tk-flame text-white shadow-float'
                  : 'tk-glass-dark text-white hover:scale-105 hover:border-white/35',
                spot.positionClassName
              )}
            >
              {spot.icon}
              <span>{spot.label}</span>
              {spot.sublabel && (
                <span
                  className={clsx(
                    'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                    spot.active
                      ? 'bg-white/20 text-white'
                      : 'bg-tk-jade/30 text-tk-jade-mint'
                  )}
                >
                  {spot.sublabel}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Custom Stage Overlays / Telemetry HUD */}
      {children}
    </div>
  );
};
