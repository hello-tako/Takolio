/**
 * Takolio V4 — Zero-Dependency WebGL2 PBR + Culinary Subsurface Engine
 * ====================================================================
 * Features:
 * - Cook-Torrance GGX microfacet specular + energy-conserving Lambert diffuse
 * - Warm Culinary Subsurface Scattering (wrap lighting + forward translucency)
 * - Fresnel studio rim light + Hemisphere sky/ground bounce + baked `COLOR_0` AO
 * - Dynamic point light (for stove flame under-glow & smart fridge compartment glow)
 * - ACES Filmic Tone Mapping + linear-to-sRGB output
 * - Ground contact soft shadow disc shader
 * - 100% GPU-animated procedural particle system (steam wisps, simmering bubbles,
 *   wok sizzle embers, golden celebration sparkles)
 * - Critically-damped pointer/touch orbit & hover parallax + ray-sphere node picking
 * - Automatic `ResizeObserver` DPR scaling, `IntersectionObserver` offscreen pause,
 *   reduced-motion support, and clean WebGL context loss/restore lifecycle.
 */

import {
  createRuntimeScene,
  mat3NormalFromMat4,
  mat4Invert,
  mat4LookAt,
  mat4Multiply,
  mat4Perspective,
  raycastSceneNodes,
  updateSceneWorldMatrices,
  type ParsedGLBScene,
  type RuntimeGLBNode,
  type RuntimeGLBScene,
  type Vec3,
} from './glb-loader';

let cachedWebGL2Support: boolean | null = null;

/** Safe capability check that never throws in jsdom / SSR / headless browsers. */
export function isWebGL2Supported(): boolean {
  if (cachedWebGL2Support !== null) return cachedWebGL2Support;
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }
  // jsdom userAgent guard so unit tests cleanly render accessible fallbacks
  if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)) {
    cachedWebGL2Support = false;
    return false;
  }
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2', { failIfMajorPerformanceCaveat: false });
    cachedWebGL2Support = Boolean(gl && typeof gl.createVertexArray === 'function');
    return cachedWebGL2Support;
  } catch {
    cachedWebGL2Support = false;
    return false;
  }
}

export type CulinaryParticleMode = 'none' | 'steam' | 'bubbles' | 'sizzle' | 'sparkles';

export interface ParticleEffectConfig {
  mode: CulinaryParticleMode;
  intensity: number; // 0..1.5
  origin?: Vec3;
  spreadRadius?: number;
  riseHeight?: number;
  color?: Vec3;
}

export interface PointLightConfig {
  position: Vec3;
  color: Vec3;
  intensity: number;
}

export interface CameraGoal {
  yaw?: number;
  pitch?: number;
  distance?: number;
  target?: Vec3;
  fovDeg?: number;
}

export interface EngineFrameContext {
  scene: RuntimeGLBScene;
  time: number;
  dt: number;
  reducedMotion: boolean;
  hoveredNodeName: string | null;
}

export interface TakolioEngineOptions {
  canvas: HTMLCanvasElement;
  parsedScene: ParsedGLBScene;
  initialCamera?: CameraGoal;
  interactive?: boolean;
  autoRotateSpeed?: number;
  reducedMotion?: boolean;
  shadowOpacity?: number;
  shadowY?: number;
  interactiveNodeNames?: string[];
  particleConfig?: ParticleEffectConfig;
  pointLight?: PointLightConfig;
  onUpdateFrame?: (ctx: EngineFrameContext) => void;
  onHoverNode?: (
    node: RuntimeGLBNode | null,
    pointer: { x: number; y: number } | null
  ) => void;
  onSelectNode?: (node: RuntimeGLBNode) => void;
  onContextLost?: () => void;
}

// ---------------------------------------------------------------------------
// GLSL ES 3.00 Shaders
// ---------------------------------------------------------------------------
const PBR_VERT_SRC = `#version 300 es
precision highp float;

layout(location = 0) in vec3 a_position;
layout(location = 1) in vec3 a_normal;
layout(location = 2) in vec4 a_color;

uniform mat4 u_viewProj;
uniform mat4 u_world;
uniform mat3 u_normalMat;

out vec3 v_worldPos;
out vec3 v_normal;
out vec4 v_color;

void main() {
  vec4 wp = u_world * vec4(a_position, 1.0);
  v_worldPos = wp.xyz;
  v_normal = normalize(u_normalMat * a_normal);
  v_color = a_color;
  gl_Position = u_viewProj * wp;
}
`;

const PBR_FRAG_SRC = `#version 300 es
precision highp float;

in vec3 v_worldPos;
in vec3 v_normal;
in vec4 v_color;

uniform vec3 u_camPos;
uniform vec4 u_baseColor;
uniform vec3 u_materialParams; // x: metallic, y: roughness, z: subsurface
uniform vec3 u_emissive;
uniform float u_highlightAmount;
uniform vec3 u_highlightColor;

uniform vec3 u_pointLightPos;
uniform vec3 u_pointLightColor;
uniform float u_pointLightIntensity;

out vec4 outColor;

const float PI = 3.14159265359;

float distributionGGX(vec3 N, vec3 H, float roughness) {
  float a = roughness * roughness;
  float a2 = a * a;
  float NdotH = max(dot(N, H), 0.0);
  float NdotH2 = NdotH * NdotH;
  float denom = NdotH2 * (a2 - 1.0) + 1.0;
  return a2 / max(PI * denom * denom, 0.0001);
}

float geometrySchlickGGX(float NdotV, float roughness) {
  float r = roughness + 1.0;
  float k = (r * r) / 8.0;
  return NdotV / max(NdotV * (1.0 - k) + k, 0.0001);
}

float geometrySmith(vec3 N, vec3 V, vec3 L, float roughness) {
  return geometrySchlickGGX(max(dot(N, V), 0.0), roughness) *
         geometrySchlickGGX(max(dot(N, L), 0.0), roughness);
}

vec3 fresnelSchlick(float cosTheta, vec3 F0) {
  return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

vec3 evaluateDirectLight(
  vec3 L,
  vec3 radiance,
  vec3 N,
  vec3 V,
  vec3 albedo,
  float metallic,
  float roughness,
  float subsurface,
  vec3 F0
) {
  vec3 H = normalize(V + L);
  float NDF = distributionGGX(N, H, roughness);
  float G = geometrySmith(N, V, L, roughness);
  vec3 F = fresnelSchlick(max(dot(H, V), 0.0), F0);

  float NdotL = max(dot(N, L), 0.0);
  float NdotV = max(dot(N, V), 0.001);
  vec3 specular = (NDF * G * F) / max(4.0 * NdotV * NdotL, 0.001);

  vec3 kS = F;
  vec3 kD = (vec3(1.0) - kS) * (1.0 - metallic);

  // Warm Culinary Subsurface Scattering (wrap diffuse + forward scatter tint)
  float wrap = 0.48 * subsurface;
  float wrappedNdotL = clamp((dot(N, L) + wrap) / ((1.0 + wrap) * (1.0 + wrap)), 0.0, 1.0);
  float backTranslucency = pow(clamp(dot(V, -L), 0.0, 1.0), 3.0) * subsurface * 0.45;
  vec3 sssWarmTint = albedo * vec3(1.16, 0.78, 0.62);

  vec3 diffuse = (kD * albedo / PI) * mix(NdotL, wrappedNdotL, subsurface)
               + sssWarmTint * (wrappedNdotL * subsurface * 0.36 + backTranslucency);

  return diffuse * radiance + specular * radiance * NdotL;
}

vec3 acesToneMap(vec3 x) {
  const float a = 2.51;
  const float b = 0.03;
  const float c = 2.43;
  const float d = 0.59;
  const float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

void main() {
  vec3 N = normalize(gl_FrontFacing ? v_normal : -v_normal);
  vec3 V = normalize(u_camPos - v_worldPos);

  vec3 aoColor = clamp(v_color.rgb, 0.25, 1.25);
  float aoScalar = clamp((aoColor.r + aoColor.g + aoColor.b) / 3.0, 0.3, 1.05);
  vec3 albedo = u_baseColor.rgb * aoColor;

  float metallic = clamp(u_materialParams.x, 0.0, 1.0);
  float roughness = clamp(u_materialParams.y, 0.06, 1.0);
  float subsurface = clamp(u_materialParams.z, 0.0, 1.0);

  vec3 F0 = mix(vec3(0.04), albedo, metallic);

  // Studio 3-Point Terra-Botanical Lighting
  vec3 keyDir = normalize(vec3(-0.55, 0.88, 0.68));
  vec3 keyRad = vec3(2.55, 2.40, 2.22);

  vec3 fillDir = normalize(vec3(0.76, 0.42, 0.48));
  vec3 fillRad = vec3(0.88, 0.98, 0.92);

  vec3 backDir = normalize(vec3(0.18, 0.72, -0.85));
  vec3 backRad = vec3(1.05, 0.96, 0.88);

  vec3 Lo = vec3(0.0);
  Lo += evaluateDirectLight(keyDir, keyRad, N, V, albedo, metallic, roughness, subsurface, F0);
  Lo += evaluateDirectLight(fillDir, fillRad, N, V, albedo, metallic, roughness, subsurface, F0);
  Lo += evaluateDirectLight(backDir, backRad, N, V, albedo, metallic, roughness, subsurface, F0);

  // Dynamic Burner / Compartment Point Light
  if (u_pointLightIntensity > 0.005) {
    vec3 toLight = u_pointLightPos - v_worldPos;
    float dist = length(toLight);
    vec3 pDir = toLight / max(dist, 0.001);
    float atten = u_pointLightIntensity / (1.0 + 1.35 * dist + 0.85 * dist * dist);
    Lo += evaluateDirectLight(pDir, u_pointLightColor * atten, N, V, albedo, metallic, roughness, subsurface, F0);
  }

  // Hemisphere Sky / Warm Oak Ground Bounce
  vec3 skyBounce = vec3(0.46, 0.45, 0.43);
  vec3 groundBounce = vec3(0.28, 0.21, 0.16);
  vec3 hemi = mix(groundBounce, skyBounce, N.y * 0.5 + 0.5);
  vec3 ambient = hemi * albedo * aoScalar;

  // Crisp Grazing Fresnel Rim Light
  float fresnelRim = pow(1.0 - max(dot(N, V), 0.0), 3.6);
  vec3 rimGlow = vec3(0.38, 0.35, 0.31) * fresnelRim * (0.35 + 0.65 * (1.0 - roughness));

  // Interactive Hover / Active Zone Highlight
  vec3 interactiveGlow = u_highlightColor * u_highlightAmount * (0.28 + 0.72 * fresnelRim);

  vec3 colorLinear = ambient + Lo + rimGlow + u_emissive + interactiveGlow;
  vec3 mapped = acesToneMap(colorLinear);
  vec3 srgb = pow(mapped, vec3(1.0 / 2.2));

  outColor = vec4(srgb, u_baseColor.a);
}
`;

const SHADOW_VERT_SRC = `#version 300 es
precision highp float;
layout(location = 0) in vec2 a_quad;
uniform mat4 u_viewProj;
uniform vec3 u_shadowCenter;
uniform float u_shadowRadius;
out vec2 v_uv;
void main() {
  v_uv = a_quad;
  vec3 wp = vec3(
    u_shadowCenter.x + a_quad.x * u_shadowRadius,
    u_shadowCenter.y,
    u_shadowCenter.z + a_quad.y * u_shadowRadius
  );
  gl_Position = u_viewProj * vec4(wp, 1.0);
}
`;

const SHADOW_FRAG_SRC = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform float u_shadowOpacity;
out vec4 outColor;
void main() {
  float dist = length(v_uv);
  float core = smoothstep(1.0, 0.12, dist);
  float alpha = core * core * u_shadowOpacity;
  outColor = vec4(0.08, 0.11, 0.10, alpha);
}
`;

const PARTICLE_VERT_SRC = `#version 300 es
precision highp float;
layout(location = 0) in vec4 a_seed; // x: phase, y: rNorm, z: angle, w: speed

uniform mat4 u_viewProj;
uniform float u_time;
uniform vec3 u_origin;
uniform vec2 u_bounds; // x: spreadRadius, y: riseHeight
uniform float u_intensity;
uniform int u_mode; // 1: steam, 2: bubbles, 3: sizzle, 4: sparkles
uniform float u_dpr;

out float v_alpha;
out float v_mode;

void main() {
  float speed = (0.32 + 0.45 * a_seed.w) * (0.65 + 0.55 * u_intensity);
  float life = fract(a_seed.x + u_time * speed);
  float theta = a_seed.z + u_time * (0.45 * (a_seed.w - 0.5));
  float rad = a_seed.y * u_bounds.x;

  vec3 pos = u_origin;
  float ptSize = 12.0;

  if (u_mode == 1) {
    // Rising curling translucent steam wisps
    float expand = 1.0 + life * 0.85;
    pos.x += cos(theta + life * 2.2) * rad * expand;
    pos.z += sin(theta + life * 2.2) * rad * expand;
    pos.y += life * u_bounds.y;
    v_alpha = sin(life * 3.14159) * 0.34 * clamp(u_intensity, 0.0, 1.4);
    ptSize = (18.0 + life * 34.0) * u_dpr;
  } else if (u_mode == 2) {
    // Simmering broth / braise surface bubbles
    pos.x += cos(theta) * rad * 0.92;
    pos.z += sin(theta) * rad * 0.92;
    pos.y += sin(life * 3.14159) * 0.06;
    float pop = smoothstep(0.0, 0.25, life) * smoothstep(1.0, 0.72, life);
    v_alpha = pop * 0.65 * clamp(u_intensity, 0.0, 1.4);
    ptSize = (6.0 + sin(life * 3.14159) * 9.0) * u_dpr;
  } else if (u_mode == 3) {
    // High-heat wok sizzle & flame sparks
    float arc = life * (1.0 - 0.35 * life);
    pos.x += cos(theta) * rad * (0.7 + life * 0.9);
    pos.z += sin(theta) * rad * (0.7 + life * 0.9);
    pos.y += arc * u_bounds.y * 0.85;
    v_alpha = (1.0 - life) * 0.75 * clamp(u_intensity, 0.0, 1.5);
    ptSize = (7.0 + (1.0 - life) * 10.0) * u_dpr;
  } else {
    // Golden celebration / freshness sparkles
    pos.x += cos(theta) * (rad * 1.15);
    pos.z += sin(theta) * (rad * 1.15);
    pos.y += (life - 0.2) * u_bounds.y;
    float twinkle = 0.5 + 0.5 * sin(u_time * 7.0 + a_seed.x * 25.0);
    v_alpha = sin(life * 3.14159) * twinkle * 0.88 * clamp(u_intensity, 0.0, 1.5);
    ptSize = (9.0 + twinkle * 11.0) * u_dpr;
  }

  v_mode = float(u_mode);
  gl_Position = u_viewProj * vec4(pos, 1.0);
  gl_PointSize = clamp(ptSize, 2.0, 64.0);
}
`;

const PARTICLE_FRAG_SRC = `#version 300 es
precision highp float;
in float v_alpha;
in float v_mode;
uniform vec3 u_particleColor;
out vec4 outColor;

void main() {
  vec2 uv = gl_PointCoord * 2.0 - 1.0;
  float r = length(uv);
  if (r > 1.0) discard;

  float shape = 0.0;
  if (v_mode > 3.5) {
    // Crisp 4-point star sparkle
    float star = max(0.0, 1.0 - (abs(uv.x) * 2.6 + abs(uv.y) * 0.65));
    star = max(star, max(0.0, 1.0 - (abs(uv.y) * 2.6 + abs(uv.x) * 0.65)));
    float halo = smoothstep(1.0, 0.0, r) * 0.45;
    shape = clamp(star + halo, 0.0, 1.0);
  } else if (v_mode > 1.5 && v_mode < 2.5) {
    // Glossy bubble ring
    float ring = smoothstep(1.0, 0.68, r) * (0.35 + 0.65 * smoothstep(0.25, 0.78, r));
    shape = ring;
  } else {
    // Soft Gaussian cloud puff
    shape = pow(1.0 - r, 2.1);
  }

  outColor = vec4(u_particleColor, shape * v_alpha);
}
`;

// ---------------------------------------------------------------------------
// Internal GPU Resource Handles
// ---------------------------------------------------------------------------
interface GPUPrimitive {
  vao: WebGLVertexArrayObject;
  buffers: WebGLBuffer[];
  indexCount: number;
  indexType: number;
  materialIndex: number;
}

function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Unable to allocate WebGL2 shader');
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) ?? 'Unknown GLSL error';
    gl.deleteShader(shader);
    throw new Error(`GLSL compilation failed: ${info}`);
  }
  return shader;
}

function linkProgram(gl: WebGL2RenderingContext, vsSrc: string, fsSrc: string): WebGLProgram {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSrc);
  const prog = gl.createProgram();
  if (!prog) throw new Error('Unable to allocate WebGL2 program');
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(prog) ?? 'Unknown link error';
    gl.deleteProgram(prog);
    throw new Error(`Program link failed: ${info}`);
  }
  return prog;
}

// ---------------------------------------------------------------------------
// Main Engine Class
// ---------------------------------------------------------------------------
export class TakolioWebGL2Engine {
  private canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;
  private scene: RuntimeGLBScene;
  private options: TakolioEngineOptions;

  private pbrProgram: WebGLProgram | null = null;
  private shadowProgram: WebGLProgram | null = null;
  private particleProgram: WebGLProgram | null = null;

  private pbrUniforms: Record<string, WebGLUniformLocation | null> = {};
  private shadowUniforms: Record<string, WebGLUniformLocation | null> = {};
  private particleUniforms: Record<string, WebGLUniformLocation | null> = {};

  private gpuMeshes: GPUPrimitive[][] = [];
  private shadowVao: WebGLVertexArrayObject | null = null;
  private shadowBuf: WebGLBuffer | null = null;
  private particleVao: WebGLVertexArrayObject | null = null;
  private particleBuf: WebGLBuffer | null = null;
  private readonly particleCount = 64;

  // Camera state (spherical orbit + damped interpolation)
  private yaw = 0.35;
  private pitch = 0.32;
  private distance = 3.8;
  private target: Vec3 = [0, 0.85, 0];
  private fovDeg = 36;

  private goalYaw = 0.35;
  private goalPitch = 0.32;
  private goalDistance = 3.8;
  private goalTarget: Vec3 = [0, 0.85, 0];
  private goalFovDeg = 36;

  private parallaxX = 0;
  private parallaxY = 0;

  // Pointer & Picking state
  private isDragging = false;
  private dragMoved = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private hoveredNodeName: string | null = null;
  private interactiveSet: Set<string>;

  // Reusable scratch matrices (zero per-frame GC allocations)
  private viewMat = new Float32Array(16);
  private projMat = new Float32Array(16);
  private viewProjMat = new Float32Array(16);
  private invViewProjMat = new Float32Array(16);
  private normalMat = new Float32Array(9);
  private eyePos: Vec3 = [0, 1.5, 4];

  // Runtime flags & observers
  private rafId: number | null = null;
  private isVisible = true;
  private isDisposed = false;
  private isContextLost = false;
  private dpr = 1;
  private startTime = 0;
  private lastFrameTime = 0;

  private particleConfig: ParticleEffectConfig;
  private pointLight: PointLightConfig;

  private resizeObserver: ResizeObserver | null = null;
  private intersectionObserver: IntersectionObserver | null = null;
  private cleanupListeners: Array<() => void> = [];

  constructor(options: TakolioEngineOptions) {
    this.options = options;
    this.canvas = options.canvas;
    this.scene = createRuntimeScene(options.parsedScene);
    this.interactiveSet = new Set(options.interactiveNodeNames ?? []);

    const gl = this.canvas.getContext('webgl2', {
      alpha: true,
      antialias: true,
      depth: true,
      stencil: false,
      powerPreference: 'default',
      premultipliedAlpha: false,
    });
    if (!gl) {
      throw new Error('WebGL2 context unavailable');
    }
    this.gl = gl;

    // Initialize camera from scene bounds or explicit goal
    const bounds = this.scene.sceneBounds;
    const defaultDist = Math.max(1.8, bounds.radius * 2.65);
    this.target = options.initialCamera?.target
      ? ([...options.initialCamera.target] as Vec3)
      : ([...bounds.center] as Vec3);
    this.goalTarget = [...this.target] as Vec3;
    this.yaw = this.goalYaw = options.initialCamera?.yaw ?? 0.32;
    this.pitch = this.goalPitch = options.initialCamera?.pitch ?? 0.28;
    this.distance = this.goalDistance = options.initialCamera?.distance ?? defaultDist;
    this.fovDeg = this.goalFovDeg = options.initialCamera?.fovDeg ?? 35;

    this.particleConfig = options.particleConfig ?? {
      mode: 'none',
      intensity: 0,
    };
    this.pointLight = options.pointLight ?? {
      position: [0, 0.5, 0],
      color: [1, 0.55, 0.25],
      intensity: 0,
    };

    this.initGPUResources();
    this.setupObserversAndEvents();
    this.resizeCanvas();
    this.startLoop();
  }

  public getRuntimeScene(): RuntimeGLBScene {
    return this.scene;
  }

  public setCameraGoal(goal: CameraGoal): void {
    if (goal.yaw !== undefined) this.goalYaw = goal.yaw;
    if (goal.pitch !== undefined) {
      this.goalPitch = Math.max(-0.25, Math.min(1.28, goal.pitch));
    }
    if (goal.distance !== undefined) {
      this.goalDistance = Math.max(1.1, Math.min(14.0, goal.distance));
    }
    if (goal.target !== undefined) {
      this.goalTarget = [...goal.target] as Vec3;
    }
    if (goal.fovDeg !== undefined) {
      this.goalFovDeg = goal.fovDeg;
    }
  }

  public setParticleConfig(config: ParticleEffectConfig): void {
    this.particleConfig = { ...this.particleConfig, ...config };
  }

  public setPointLight(light: PointLightConfig): void {
    this.pointLight = { ...light };
  }

  public setReducedMotion(reduced: boolean): void {
    this.options.reducedMotion = reduced;
  }

  public setOnUpdateFrame(fn: ((ctx: EngineFrameContext) => void) | undefined): void {
    this.options.onUpdateFrame = fn;
  }

  // -------------------------------------------------------------------------
  // GPU Setup & Cleanup
  // -------------------------------------------------------------------------
  private initGPUResources(): void {
    const gl = this.gl;

    // 1. PBR Program
    this.pbrProgram = linkProgram(gl, PBR_VERT_SRC, PBR_FRAG_SRC);
    for (const name of [
      'u_viewProj',
      'u_world',
      'u_normalMat',
      'u_camPos',
      'u_baseColor',
      'u_materialParams',
      'u_emissive',
      'u_highlightAmount',
      'u_highlightColor',
      'u_pointLightPos',
      'u_pointLightColor',
      'u_pointLightIntensity',
    ]) {
      this.pbrUniforms[name] = gl.getUniformLocation(this.pbrProgram, name);
    }

    // 2. Upload GLB Meshes -> VAOs
    this.gpuMeshes = this.scene.source.meshes.map((mesh) =>
      mesh.primitives.map((prim) => {
        const vao = gl.createVertexArray()!;
        gl.bindVertexArray(vao);

        const posBuf = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
        gl.bufferData(gl.ARRAY_BUFFER, prim.positions, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

        const normBuf = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, normBuf);
        gl.bufferData(gl.ARRAY_BUFFER, prim.normals, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);

        const colBuf = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, colBuf);
        gl.bufferData(gl.ARRAY_BUFFER, prim.colors, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(2);
        gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 0, 0);

        const idxBuf = gl.createBuffer()!;
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, prim.indices, gl.STATIC_DRAW);

        gl.bindVertexArray(null);
        return {
          vao,
          buffers: [posBuf, normBuf, colBuf, idxBuf],
          indexCount: prim.indexCount,
          indexType:
            prim.indexComponentType === 5125 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT,
          materialIndex: prim.materialIndex,
        };
      })
    );

    // 3. Soft Ground Contact Shadow Disc
    this.shadowProgram = linkProgram(gl, SHADOW_VERT_SRC, SHADOW_FRAG_SRC);
    for (const name of [
      'u_viewProj',
      'u_shadowCenter',
      'u_shadowRadius',
      'u_shadowOpacity',
    ]) {
      this.shadowUniforms[name] = gl.getUniformLocation(this.shadowProgram, name);
    }
    this.shadowVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.shadowVao);
    this.shadowBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.shadowBuf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    // 4. GPU Procedural Particle System (deterministic pseudo-random seeds)
    this.particleProgram = linkProgram(gl, PARTICLE_VERT_SRC, PARTICLE_FRAG_SRC);
    for (const name of [
      'u_viewProj',
      'u_time',
      'u_origin',
      'u_bounds',
      'u_intensity',
      'u_mode',
      'u_dpr',
      'u_particleColor',
    ]) {
      this.particleUniforms[name] = gl.getUniformLocation(this.particleProgram, name);
    }

    const seeds = new Float32Array(this.particleCount * 4);
    for (let i = 0; i < this.particleCount; i++) {
      // Golden-ratio Halton-like deterministic distribution
      seeds[i * 4] = (i / this.particleCount) % 1;
      seeds[i * 4 + 1] = Math.sqrt(((i * 0.6180339887) % 1) * 0.92 + 0.06);
      seeds[i * 4 + 2] = ((i * 2.39996323) % (Math.PI * 2));
      seeds[i * 4 + 3] = ((i * 0.381966) % 1);
    }
    this.particleVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.particleVao);
    this.particleBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.particleBuf);
    gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
  }

  private destroyGPUResources(): void {
    const gl = this.gl;
    for (const meshPrims of this.gpuMeshes) {
      for (const p of meshPrims) {
        gl.deleteVertexArray(p.vao);
        for (const b of p.buffers) gl.deleteBuffer(b);
      }
    }
    this.gpuMeshes = [];

    if (this.shadowVao) gl.deleteVertexArray(this.shadowVao);
    if (this.shadowBuf) gl.deleteBuffer(this.shadowBuf);
    if (this.particleVao) gl.deleteVertexArray(this.particleVao);
    if (this.particleBuf) gl.deleteBuffer(this.particleBuf);

    if (this.pbrProgram) gl.deleteProgram(this.pbrProgram);
    if (this.shadowProgram) gl.deleteProgram(this.shadowProgram);
    if (this.particleProgram) gl.deleteProgram(this.particleProgram);

    this.shadowVao = null;
    this.shadowBuf = null;
    this.particleVao = null;
    this.particleBuf = null;
    this.pbrProgram = null;
    this.shadowProgram = null;
    this.particleProgram = null;
  }

  // -------------------------------------------------------------------------
  // Resize, Offscreen Pause, Pointer Orbit & Ray-Sphere Picking
  // -------------------------------------------------------------------------
  private resizeCanvas = (): void => {
    if (this.isDisposed || this.isContextLost) return;
    const rect = this.canvas.getBoundingClientRect();
    const cssW = Math.max(1, Math.floor(rect.width || this.canvas.clientWidth || 320));
    const cssH = Math.max(1, Math.floor(rect.height || this.canvas.clientHeight || 260));
    this.dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2);
    const targetW = Math.max(1, Math.floor(cssW * this.dpr));
    const targetH = Math.max(1, Math.floor(cssH * this.dpr));

    if (this.canvas.width !== targetW || this.canvas.height !== targetH) {
      this.canvas.width = targetW;
      this.canvas.height = targetH;
      this.gl.viewport(0, 0, targetW, targetH);
    }
  };

  private setupObserversAndEvents(): void {
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.resizeCanvas());
      this.resizeObserver.observe(this.canvas);
    }

    if (typeof IntersectionObserver !== 'undefined') {
      this.intersectionObserver = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (!entry) return;
          const nowVisible = entry.isIntersecting;
          if (nowVisible && !this.isVisible) {
            this.isVisible = true;
            this.lastFrameTime = performance.now();
            this.startLoop();
          } else if (!nowVisible) {
            this.isVisible = false;
          }
        },
        { threshold: 0.02 }
      );
      this.intersectionObserver.observe(this.canvas);
    }

    const onContextLost = (e: Event) => {
      e.preventDefault();
      this.isContextLost = true;
      this.options.onContextLost?.();
    };
    const onContextRestored = () => {
      this.isContextLost = false;
      this.initGPUResources();
      this.resizeCanvas();
      this.startLoop();
    };
    this.canvas.addEventListener('webglcontextlost', onContextLost);
    this.canvas.addEventListener('webglcontextrestored', onContextRestored);
    this.cleanupListeners.push(() => {
      this.canvas.removeEventListener('webglcontextlost', onContextLost);
      this.canvas.removeEventListener('webglcontextrestored', onContextRestored);
    });

    if (this.options.interactive !== false) {
      const onPointerDown = (e: PointerEvent) => {
        this.isDragging = true;
        this.dragMoved = false;
        this.dragStartX = this.lastPointerX = e.clientX;
        this.dragStartY = this.lastPointerY = e.clientY;
        try {
          this.canvas.setPointerCapture(e.pointerId);
        } catch {
          // Ignore synthetic events in tests
        }
      };

      const onPointerMove = (e: PointerEvent) => {
        const rect = this.canvas.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          this.parallaxX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
          this.parallaxY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
        }

        if (this.isDragging) {
          const dx = e.clientX - this.lastPointerX;
          const dy = e.clientY - this.lastPointerY;
          this.lastPointerX = e.clientX;
          this.lastPointerY = e.clientY;
          if (Math.hypot(e.clientX - this.dragStartX, e.clientY - this.dragStartY) > 5) {
            this.dragMoved = true;
          }
          this.goalYaw -= dx * 0.0075;
          this.goalPitch = Math.max(-0.18, Math.min(1.22, this.goalPitch + dy * 0.006));
        } else if (this.interactiveSet.size > 0 || this.options.onHoverNode) {
          const hit = this.pickNodeAt(e.clientX, e.clientY);
          const nextName = hit ? hit.name : null;
          if (nextName !== this.hoveredNodeName) {
            this.hoveredNodeName = nextName;
            this.canvas.style.cursor = hit ? 'pointer' : 'grab';
          }
          this.options.onHoverNode?.(
            hit,
            hit
              ? {
                  x: e.clientX - rect.left,
                  y: e.clientY - rect.top,
                }
              : null
          );
        }
      };

      const onPointerUp = (e: PointerEvent) => {
        const wasClick = this.isDragging && !this.dragMoved;
        this.isDragging = false;
        try {
          this.canvas.releasePointerCapture(e.pointerId);
        } catch {
          // Ignore synthetic events
        }
        if (wasClick && this.options.onSelectNode) {
          const hit = this.pickNodeAt(e.clientX, e.clientY);
          if (hit) {
            this.options.onSelectNode(hit);
          }
        }
      };

      const onPointerLeave = () => {
        this.isDragging = false;
        this.parallaxX = 0;
        this.parallaxY = 0;
        if (this.hoveredNodeName !== null) {
          this.hoveredNodeName = null;
          this.canvas.style.cursor = 'grab';
          this.options.onHoverNode?.(null, null);
        }
      };

      this.canvas.addEventListener('pointerdown', onPointerDown);
      this.canvas.addEventListener('pointermove', onPointerMove);
      this.canvas.addEventListener('pointerup', onPointerUp);
      this.canvas.addEventListener('pointerleave', onPointerLeave);
      this.cleanupListeners.push(() => {
        this.canvas.removeEventListener('pointerdown', onPointerDown);
        this.canvas.removeEventListener('pointermove', onPointerMove);
        this.canvas.removeEventListener('pointerup', onPointerUp);
        this.canvas.removeEventListener('pointerleave', onPointerLeave);
      });
    }
  }

  public pickNodeAt(clientX: number, clientY: number): RuntimeGLBNode | null {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = 1 - ((clientY - rect.top) / rect.height) * 2;

    const invVP = mat4Invert(this.viewProjMat, this.invViewProjMat);
    if (!invVP) return null;

    const unproject = (z: number): Vec3 => {
      const w =
        invVP[3] * ndcX + invVP[7] * ndcY + invVP[11] * z + invVP[15] || 1;
      return [
        (invVP[0] * ndcX + invVP[4] * ndcY + invVP[8] * z + invVP[12]) / w,
        (invVP[1] * ndcX + invVP[5] * ndcY + invVP[9] * z + invVP[13]) / w,
        (invVP[2] * ndcX + invVP[6] * ndcY + invVP[10] * z + invVP[14]) / w,
      ];
    };

    const nearPt = unproject(-1);
    const farPt = unproject(1);
    const dx = farPt[0] - nearPt[0];
    const dy = farPt[1] - nearPt[1];
    const dz = farPt[2] - nearPt[2];
    const len = Math.hypot(dx, dy, dz) || 1;
    const dir: Vec3 = [dx / len, dy / len, dz / len];

    const hit = raycastSceneNodes(
      this.scene,
      nearPt,
      dir,
      this.interactiveSet.size > 0 ? this.interactiveSet : undefined
    );
    return hit ? hit.matchedNode : null;
  }

  // -------------------------------------------------------------------------
  // Main Render Loop
  // -------------------------------------------------------------------------
  private startLoop(): void {
    if (this.rafId !== null || this.isDisposed) return;
    const now = performance.now();
    if (this.startTime === 0) this.startTime = now;
    this.lastFrameTime = now;

    const tick = (frameNow: number) => {
      this.rafId = null;
      if (this.isDisposed || !this.isVisible || this.isContextLost) return;

      const dt = Math.min(0.05, Math.max(0.001, (frameNow - this.lastFrameTime) / 1000));
      this.lastFrameTime = frameNow;
      const elapsed = (frameNow - this.startTime) / 1000;

      this.stepAndRender(elapsed, dt);
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private stepAndRender(time: number, dt: number): void {
    const gl = this.gl;
    const reduced = Boolean(this.options.reducedMotion);

    // Gentle auto-orbit when idle and not reduced-motion
    const autoSpeed = this.options.autoRotateSpeed ?? 0;
    if (!reduced && !this.isDragging && Math.abs(autoSpeed) > 1e-4) {
      this.goalYaw += autoSpeed * dt;
    }

    // Critically damped camera smoothing
    const damp = 1 - Math.exp(-8.5 * dt);
    const effectiveYaw =
      this.goalYaw + (reduced ? 0 : this.parallaxX * 0.08);
    const effectivePitch = Math.max(
      -0.2,
      Math.min(1.25, this.goalPitch + (reduced ? 0 : -this.parallaxY * 0.05))
    );

    this.yaw += (effectiveYaw - this.yaw) * damp;
    this.pitch += (effectivePitch - this.pitch) * damp;
    this.distance += (this.goalDistance - this.distance) * damp;
    this.fovDeg += (this.goalFovDeg - this.fovDeg) * damp;
    for (let k = 0; k < 3; k++) {
      this.target[k] += (this.goalTarget[k] - this.target[k]) * damp;
    }

    // Custom component procedural node animations
    this.options.onUpdateFrame?.({
      scene: this.scene,
      time: reduced ? 0 : time,
      dt,
      reducedMotion: reduced,
      hoveredNodeName: this.hoveredNodeName,
    });
    updateSceneWorldMatrices(this.scene);

    // Compute camera matrices
    const cosPitch = Math.cos(this.pitch);
    this.eyePos[0] = this.target[0] + Math.sin(this.yaw) * cosPitch * this.distance;
    this.eyePos[1] = this.target[1] + Math.sin(this.pitch) * this.distance;
    this.eyePos[2] = this.target[2] + Math.cos(this.yaw) * cosPitch * this.distance;

    const aspect = this.canvas.width / Math.max(1, this.canvas.height);
    mat4LookAt(this.eyePos, this.target, [0, 1, 0], this.viewMat);
    mat4Perspective(
      (this.fovDeg * Math.PI) / 180,
      aspect,
      0.1,
      40.0,
      this.projMat
    );
    mat4Multiply(this.projMat, this.viewMat, this.viewProjMat);

    // Clear framebuffer (transparent so CSS stage gradients shine cleanly!)
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // 1. Ground Contact Soft Shadow Disc
    const shadowOpacity = this.options.shadowOpacity ?? 0.24;
    if (shadowOpacity > 0.01 && this.shadowProgram && this.shadowVao) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.useProgram(this.shadowProgram);
      gl.uniformMatrix4fv(this.shadowUniforms.u_viewProj, false, this.viewProjMat);
      gl.uniform3f(
        this.shadowUniforms.u_shadowCenter,
        this.scene.sceneBounds.center[0],
        this.options.shadowY ?? 0.002,
        this.scene.sceneBounds.center[2]
      );
      gl.uniform1f(
        this.shadowUniforms.u_shadowRadius,
        Math.max(0.65, this.scene.sceneBounds.radius * 1.05)
      );
      gl.uniform1f(this.shadowUniforms.u_shadowOpacity, shadowOpacity);
      gl.bindVertexArray(this.shadowVao);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }

    // 2. PBR + Culinary Subsurface Meshes (Opaque Pass -> Blend Pass)
    if (this.pbrProgram) {
      gl.useProgram(this.pbrProgram);
      gl.uniformMatrix4fv(this.pbrUniforms.u_viewProj, false, this.viewProjMat);
      gl.uniform3fv(this.pbrUniforms.u_camPos, this.eyePos);
      gl.uniform3fv(this.pbrUniforms.u_pointLightPos, this.pointLight.position);
      gl.uniform3fv(this.pbrUniforms.u_pointLightColor, this.pointLight.color);
      gl.uniform1f(this.pbrUniforms.u_pointLightIntensity, this.pointLight.intensity);

      const materials = this.scene.source.materials;

      // Resolve effective highlight from self or ancestor (e.g. hovering `Zone_Fridge`)
      const getEffectiveHighlight = (
        node: RuntimeGLBNode
      ): { amount: number; color: Vec3 } => {
        let maxAmt = node.highlightAmount;
        let col = node.highlightColor;
        let curr: RuntimeGLBNode | undefined = node;
        while (curr) {
          if (curr.name === this.hoveredNodeName) {
            maxAmt = Math.max(maxAmt, 0.35);
          }
          if (curr.highlightAmount > maxAmt) {
            maxAmt = curr.highlightAmount;
            col = curr.highlightColor;
          }
          curr =
            curr.parentIndex !== null ? this.scene.nodes[curr.parentIndex] : undefined;
        }
        return { amount: maxAmt, color: col };
      };

      const isSubtreeVisible = (node: RuntimeGLBNode): boolean => {
        let curr: RuntimeGLBNode | undefined = node;
        while (curr) {
          if (!curr.visible) return false;
          curr =
            curr.parentIndex !== null ? this.scene.nodes[curr.parentIndex] : undefined;
        }
        return true;
      };

      const drawPass = (transparentPass: boolean) => {
        if (transparentPass) {
          gl.enable(gl.BLEND);
          gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
          gl.depthMask(false);
        } else {
          gl.disable(gl.BLEND);
          gl.depthMask(true);
        }

        for (const node of this.scene.nodes) {
          if (node.meshIndex === null || !isSubtreeVisible(node)) continue;
          const gpuPrims = this.gpuMeshes[node.meshIndex];
          if (!gpuPrims) continue;

          let worldUploaded = false;
          const hl = getEffectiveHighlight(node);

          for (const prim of gpuPrims) {
            const mat = materials[prim.materialIndex] ?? materials[0];
            const isBlend = mat.alphaMode === 'BLEND';
            if (isBlend !== transparentPass) continue;

            if (!worldUploaded) {
              mat3NormalFromMat4(node.worldMatrix, this.normalMat);
              gl.uniformMatrix4fv(this.pbrUniforms.u_world, false, node.worldMatrix);
              gl.uniformMatrix3fv(this.pbrUniforms.u_normalMat, false, this.normalMat);
              gl.uniform1f(this.pbrUniforms.u_highlightAmount, hl.amount);
              gl.uniform3fv(this.pbrUniforms.u_highlightColor, hl.color);
              worldUploaded = true;
            }

            if (mat.doubleSided || isBlend) {
              gl.disable(gl.CULL_FACE);
            } else {
              gl.enable(gl.CULL_FACE);
              gl.cullFace(gl.BACK);
            }

            const bc = node.baseColorTint ?? mat.baseColorFactor;
            const em = node.emissiveTint ?? mat.emissiveFactor;

            gl.uniform4fv(this.pbrUniforms.u_baseColor, bc);
            gl.uniform3f(
              this.pbrUniforms.u_materialParams,
              mat.metallicFactor,
              mat.roughnessFactor,
              mat.subsurface
            );
            gl.uniform3fv(this.pbrUniforms.u_emissive, em);

            gl.bindVertexArray(prim.vao);
            gl.drawElements(gl.TRIANGLES, prim.indexCount, prim.indexType, 0);
          }
        }
      };

      drawPass(false);
      drawPass(true);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }

    // 3. GPU Procedural Culinary Particles
    const pMode = this.particleConfig.mode;
    const pIntensity = this.particleConfig.intensity;
    if (
      !reduced &&
      pMode !== 'none' &&
      pIntensity > 0.02 &&
      this.particleProgram &&
      this.particleVao
    ) {
      const modeInt =
        pMode === 'steam'
          ? 1
          : pMode === 'bubbles'
            ? 2
            : pMode === 'sizzle'
              ? 3
              : 4;
      const defaultColor: Vec3 =
        pMode === 'steam'
          ? [0.98, 0.96, 0.93]
          : pMode === 'bubbles'
            ? [1.0, 0.88, 0.62]
            : pMode === 'sizzle'
              ? [1.0, 0.56, 0.24]
              : [1.0, 0.82, 0.35];

      gl.enable(gl.BLEND);
      if (pMode === 'sizzle' || pMode === 'sparkles') {
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      } else {
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      }
      gl.depthMask(false);

      gl.useProgram(this.particleProgram);
      gl.uniformMatrix4fv(this.particleUniforms.u_viewProj, false, this.viewProjMat);
      gl.uniform1f(this.particleUniforms.u_time, time);
      gl.uniform3fv(
        this.particleUniforms.u_origin,
        this.particleConfig.origin ?? [0, 0.65, 0]
      );
      gl.uniform2f(
        this.particleUniforms.u_bounds,
        this.particleConfig.spreadRadius ?? 0.35,
        this.particleConfig.riseHeight ?? 0.85
      );
      gl.uniform1f(this.particleUniforms.u_intensity, pIntensity);
      gl.uniform1i(this.particleUniforms.u_mode, modeInt);
      gl.uniform1f(this.particleUniforms.u_dpr, this.dpr);
      gl.uniform3fv(
        this.particleUniforms.u_particleColor,
        this.particleConfig.color ?? defaultColor
      );

      gl.bindVertexArray(this.particleVao);
      gl.drawArrays(gl.POINTS, 0, this.particleCount);

      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }

    gl.bindVertexArray(null);
  }

  public dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.resizeObserver?.disconnect();
    this.intersectionObserver?.disconnect();
    for (const fn of this.cleanupListeners) fn();
    this.cleanupListeners = [];
    if (!this.isContextLost) {
      this.destroyGPUResources();
    }
  }
}
