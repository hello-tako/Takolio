/**
 * Takolio V4 — Spec-Compliant Binary glTF 2.0 (`.glb`) Loader & Scene Graph Math
 * ==============================================================================
 * Zero-dependency binary `.glb` parser with:
 * - Strict `glTF` v2 header (`0x46546C67`) & chunk (`JSON` / `BIN\0`) validation
 * - Accessor/BufferView decoding for `POSITION`, `NORMAL`, `COLOR_0`, `INDICES`
 * - Hierarchical TRS -> 4x4 `Float32Array(16)` local/world matrix evaluation
 * - Hierarchical world-space bounding spheres for fast ray-sphere picking
 * - Immutable geometry cache (`Map<string, ParsedGLBScene>`) + per-stage runtime cloning
 */

export type Vec3 = [number, number, number];
export type Vec4 = [number, number, number, number];
export type Quat = [number, number, number, number];

export interface BoundingSphere {
  center: Vec3;
  radius: number;
}

export interface GLBMaterial {
  name: string;
  baseColorFactor: Vec4;
  metallicFactor: number;
  roughnessFactor: number;
  emissiveFactor: Vec3;
  alphaMode: 'OPAQUE' | 'BLEND' | 'MASK';
  doubleSided: boolean;
  subsurface: number;
}

export interface GLBPrimitive {
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  indices: Uint16Array | Uint32Array;
  indexComponentType: 5123 | 5125; // UNSIGNED_SHORT | UNSIGNED_INT
  vertexCount: number;
  indexCount: number;
  materialIndex: number;
  localBoundingSphere: BoundingSphere;
}

export interface GLBMesh {
  name: string;
  primitives: GLBPrimitive[];
  localBoundingSphere: BoundingSphere;
}

export interface GLBNodeTemplate {
  index: number;
  name: string;
  parentIndex: number | null;
  children: number[];
  meshIndex: number | null;
  translation: Vec3;
  rotation: Quat;
  scale: Vec3;
  localMatrixPreset: Float32Array | null;
  extras: Record<string, unknown>;
}

export interface ParsedGLBScene {
  url: string;
  name: string;
  materials: GLBMaterial[];
  meshes: GLBMesh[];
  nodeTemplates: GLBNodeTemplate[];
  rootNodes: number[];
  sceneBounds: BoundingSphere;
}

export interface RuntimeGLBNode {
  index: number;
  name: string;
  parentIndex: number | null;
  children: number[];
  meshIndex: number | null;
  extras: Record<string, unknown>;
  restTranslation: Vec3;
  restRotation: Quat;
  restScale: Vec3;
  translation: Vec3;
  rotation: Quat;
  scale: Vec3;
  visible: boolean;
  highlightAmount: number;
  highlightColor: Vec3;
  emissiveTint: Vec3 | null;
  baseColorTint: Vec4 | null;
  localMatrix: Float32Array;
  worldMatrix: Float32Array;
  worldBoundingSphere: BoundingSphere;
}

export interface RuntimeGLBScene {
  source: ParsedGLBScene;
  nodes: RuntimeGLBNode[];
  nodesByName: Map<string, RuntimeGLBNode>;
  rootNodes: number[];
  sceneBounds: BoundingSphere;
}

export interface RaycastHit {
  node: RuntimeGLBNode;
  matchedNode: RuntimeGLBNode;
  distance: number;
  point: Vec3;
}

// ---------------------------------------------------------------------------
// In-Memory Decoded GLB Cache
// ---------------------------------------------------------------------------
const glbSceneCache = new Map<string, ParsedGLBScene>();
const glbInflightCache = new Map<string, Promise<ParsedGLBScene>>();

export function getCachedGLBScene(url: string): ParsedGLBScene | undefined {
  return glbSceneCache.get(url);
}

export function clearGLBCache(): void {
  glbSceneCache.clear();
  glbInflightCache.clear();
}

// ---------------------------------------------------------------------------
// 3D Matrix & Quaternion Math (Column-Major OpenGL / WebGL2 Convention)
// ---------------------------------------------------------------------------
export function mat4Identity(out: Float32Array = new Float32Array(16)): Float32Array {
  out.fill(0);
  out[0] = 1;
  out[5] = 1;
  out[10] = 1;
  out[15] = 1;
  return out;
}

export function mat4FromTRS(
  t: Vec3,
  q: Quat,
  s: Vec3,
  out: Float32Array = new Float32Array(16)
): Float32Array {
  const [x, y, z, w] = q;
  const x2 = x + x;
  const y2 = y + y;
  const z2 = z + z;
  const xx = x * x2;
  const xy = x * y2;
  const xz = x * z2;
  const yy = y * y2;
  const yz = y * z2;
  const zz = z * z2;
  const wx = w * x2;
  const wy = w * y2;
  const wz = w * z2;
  const [sx, sy, sz] = s;

  out[0] = (1 - (yy + zz)) * sx;
  out[1] = (xy + wz) * sx;
  out[2] = (xz - wy) * sx;
  out[3] = 0;

  out[4] = (xy - wz) * sy;
  out[5] = (1 - (xx + zz)) * sy;
  out[6] = (yz + wx) * sy;
  out[7] = 0;

  out[8] = (xz + wy) * sz;
  out[9] = (yz - wx) * sz;
  out[10] = (1 - (xx + yy)) * sz;
  out[11] = 0;

  out[12] = t[0];
  out[13] = t[1];
  out[14] = t[2];
  out[15] = 1;
  return out;
}

export function mat4Multiply(
  a: Float32Array,
  b: Float32Array,
  out: Float32Array = new Float32Array(16)
): Float32Array {
  const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
  const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
  const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
  const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

  for (let col = 0; col < 4; col++) {
    const b0 = b[col * 4];
    const b1 = b[col * 4 + 1];
    const b2 = b[col * 4 + 2];
    const b3 = b[col * 4 + 3];
    out[col * 4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[col * 4 + 1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[col * 4 + 2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[col * 4 + 3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  }
  return out;
}

export function mat4LookAt(
  eye: Vec3,
  target: Vec3,
  up: Vec3 = [0, 1, 0],
  out: Float32Array = new Float32Array(16)
): Float32Array {
  let zx = eye[0] - target[0];
  let zy = eye[1] - target[1];
  let zz = eye[2] - target[2];
  let len = Math.hypot(zx, zy, zz);
  if (len < 1e-6) {
    zz = 1;
  } else {
    zx /= len;
    zy /= len;
    zz /= len;
  }

  let xx = up[1] * zz - up[2] * zy;
  let xy = up[2] * zx - up[0] * zz;
  let xz = up[0] * zy - up[1] * zx;
  len = Math.hypot(xx, xy, xz);
  if (len < 1e-6) {
    xx = 1;
    xy = 0;
    xz = 0;
  } else {
    xx /= len;
    xy /= len;
    xz /= len;
  }

  const yx = zy * xz - zz * xy;
  const yy = zz * xx - zx * xz;
  const yz = zx * xy - zy * xx;

  out[0] = xx;
  out[1] = yx;
  out[2] = zx;
  out[3] = 0;

  out[4] = xy;
  out[5] = yy;
  out[6] = zy;
  out[7] = 0;

  out[8] = xz;
  out[9] = yz;
  out[10] = zz;
  out[11] = 0;

  out[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
  out[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
  out[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
  out[15] = 1;
  return out;
}

export function mat4Perspective(
  fovyRad: number,
  aspect: number,
  near: number,
  far: number,
  out: Float32Array = new Float32Array(16)
): Float32Array {
  const f = 1.0 / Math.tan(fovyRad * 0.5);
  const nf = 1.0 / (near - far);
  out.fill(0);
  out[0] = f / Math.max(0.05, aspect);
  out[5] = f;
  out[10] = (far + near) * nf;
  out[11] = -1;
  out[14] = 2 * far * near * nf;
  return out;
}

export function mat4Invert(m: Float32Array, out: Float32Array = new Float32Array(16)): Float32Array | null {
  const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3];
  const a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
  const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11];
  const a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];

  const b00 = a00 * a11 - a01 * a10;
  const b01 = a00 * a12 - a02 * a10;
  const b02 = a00 * a13 - a03 * a10;
  const b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11;
  const b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30;
  const b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30;
  const b09 = a21 * a32 - a22 * a31;
  const b10 = a21 * a33 - a23 * a31;
  const b11 = a22 * a33 - a23 * a32;

  let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (Math.abs(det) < 1e-10) return null;
  det = 1.0 / det;

  out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
  out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
  out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
  out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
  out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
  out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
  out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
  out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
  out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
  out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
  out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
  out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
  out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
  out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
  out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
  out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
  return out;
}

export function mat3NormalFromMat4(m: Float32Array, out: Float32Array = new Float32Array(9)): Float32Array {
  const a00 = m[0], a01 = m[1], a02 = m[2];
  const a10 = m[4], a11 = m[5], a12 = m[6];
  const a20 = m[8], a21 = m[9], a22 = m[10];

  const b01 = a22 * a11 - a12 * a21;
  const b11 = -a22 * a10 + a12 * a20;
  const b21 = a21 * a10 - a11 * a20;

  let det = a00 * b01 + a01 * b11 + a02 * b21;
  if (Math.abs(det) < 1e-10) {
    out.set([1, 0, 0, 0, 1, 0, 0, 0, 1]);
    return out;
  }
  det = 1.0 / det;

  out[0] = b01 * det;
  out[1] = (-a22 * a01 + a02 * a21) * det;
  out[2] = (a12 * a01 - a02 * a11) * det;
  out[3] = b11 * det;
  out[4] = (a22 * a00 - a02 * a20) * det;
  out[5] = (-a12 * a00 + a02 * a10) * det;
  out[6] = b21 * det;
  out[7] = (-a21 * a00 + a01 * a20) * det;
  out[8] = (a11 * a00 - a01 * a10) * det;
  return out;
}

export function quatFromEuler(rx: number, ry: number, rz: number): Quat {
  const cx = Math.cos(rx * 0.5);
  const sx = Math.sin(rx * 0.5);
  const cy = Math.cos(ry * 0.5);
  const sy = Math.sin(ry * 0.5);
  const cz = Math.cos(rz * 0.5);
  const sz = Math.sin(rz * 0.5);
  return [
    sx * cy * cz + cx * sy * sz,
    cx * sy * cz - sx * cy * sz,
    cx * cy * sz + sx * sy * cz,
    cx * cy * cz - sx * sy * sz,
  ];
}

export function quatMultiply(a: Quat, b: Quat): Quat {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    ax * bw + aw * bx + ay * bz - az * by,
    ay * bw + aw * by + az * bx - ax * bz,
    az * bw + aw * bz + ax * by - ay * bx,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

export function transformPointMat4(p: Vec3, m: Float32Array): Vec3 {
  const x = p[0], y = p[1], z = p[2];
  const w = m[3] * x + m[7] * y + m[11] * z + m[15] || 1;
  return [
    (m[0] * x + m[4] * y + m[8] * z + m[12]) / w,
    (m[1] * x + m[5] * y + m[9] * z + m[13]) / w,
    (m[2] * x + m[6] * y + m[10] * z + m[14]) / w,
  ];
}

// ---------------------------------------------------------------------------
// Internal Accessor Decoding & Bounding Sphere Calculation
// ---------------------------------------------------------------------------
interface RawGLTFJson {
  asset?: { version?: string };
  scene?: number;
  scenes?: Array<{ name?: string; nodes?: number[] }>;
  nodes?: Array<{
    name?: string;
    mesh?: number;
    children?: number[];
    translation?: number[];
    rotation?: number[];
    scale?: number[];
    matrix?: number[];
    extras?: Record<string, unknown>;
  }>;
  meshes?: Array<{
    name?: string;
    primitives: Array<{
      attributes: Record<string, number>;
      indices?: number;
      material?: number;
      mode?: number;
    }>;
  }>;
  materials?: Array<{
    name?: string;
    pbrMetallicRoughness?: {
      baseColorFactor?: number[];
      metallicFactor?: number;
      roughnessFactor?: number;
    };
    emissiveFactor?: number[];
    alphaMode?: 'OPAQUE' | 'BLEND' | 'MASK';
    doubleSided?: boolean;
    extras?: { subsurface?: number };
  }>;
  accessors?: Array<{
    bufferView?: number;
    byteOffset?: number;
    componentType: number;
    normalized?: boolean;
    count: number;
    type: 'SCALAR' | 'VEC2' | 'VEC3' | 'VEC4' | 'MAT4';
  }>;
  bufferViews?: Array<{
    buffer: number;
    byteOffset?: number;
    byteLength: number;
    byteStride?: number;
  }>;
}

const TYPE_COMPONENTS: Record<string, number> = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
  MAT4: 16,
};

const COMPONENT_BYTE_SIZE: Record<number, number> = {
  5120: 1, // BYTE
  5121: 1, // UNSIGNED_BYTE
  5122: 2, // SHORT
  5123: 2, // UNSIGNED_SHORT
  5125: 4, // UNSIGNED_INT
  5126: 4, // FLOAT
};

function decodeFloatAccessor(
  gltf: RawGLTFJson,
  binChunk: Uint8Array,
  accessorIndex: number,
  expectedComponents: number
): Float32Array {
  const acc = gltf.accessors?.[accessorIndex];
  if (!acc || acc.bufferView === undefined) {
    throw new Error(`Missing glTF accessor ${accessorIndex}`);
  }
  const view = gltf.bufferViews?.[acc.bufferView];
  if (!view) {
    throw new Error(`Missing glTF bufferView ${acc.bufferView}`);
  }
  const numComp = TYPE_COMPONENTS[acc.type] ?? expectedComponents;
  const compBytes = COMPONENT_BYTE_SIZE[acc.componentType] ?? 4;
  const baseOffset = binChunk.byteOffset + (view.byteOffset ?? 0) + (acc.byteOffset ?? 0);
  const stride = view.byteStride ?? numComp * compBytes;
  const dataView = new DataView(binChunk.buffer, baseOffset, view.byteLength - (acc.byteOffset ?? 0));

  // Fast zero-copy slice when tightly packed float32
  if (acc.componentType === 5126 && stride === numComp * 4 && baseOffset % 4 === 0) {
    return new Float32Array(
      binChunk.buffer.slice(baseOffset, baseOffset + acc.count * numComp * 4)
    );
  }

  const out = new Float32Array(acc.count * expectedComponents);
  for (let i = 0; i < acc.count; i++) {
    const rowByte = i * stride;
    for (let c = 0; c < expectedComponents; c++) {
      if (c >= numComp) {
        out[i * expectedComponents + c] = c === 3 ? 1.0 : 0.0;
        continue;
      }
      const off = rowByte + c * compBytes;
      let val = 0;
      if (acc.componentType === 5126) val = dataView.getFloat32(off, true);
      else if (acc.componentType === 5121) val = dataView.getUint8(off) / 255.0;
      else if (acc.componentType === 5123) val = dataView.getUint16(off, true) / 65535.0;
      else if (acc.componentType === 5120) val = Math.max(-1, dataView.getInt8(off) / 127.0);
      else if (acc.componentType === 5122) val = Math.max(-1, dataView.getInt16(off, true) / 32767.0);
      out[i * expectedComponents + c] = val;
    }
  }
  return out;
}

function decodeIndexAccessor(
  gltf: RawGLTFJson,
  binChunk: Uint8Array,
  accessorIndex: number
): { indices: Uint16Array | Uint32Array; componentType: 5123 | 5125 } {
  const acc = gltf.accessors?.[accessorIndex];
  if (!acc || acc.bufferView === undefined) {
    throw new Error(`Missing index accessor ${accessorIndex}`);
  }
  const view = gltf.bufferViews?.[acc.bufferView];
  if (!view) {
    throw new Error(`Missing index bufferView ${acc.bufferView}`);
  }
  const baseOffset = binChunk.byteOffset + (view.byteOffset ?? 0) + (acc.byteOffset ?? 0);

  if (acc.componentType === 5123) {
    const copy = binChunk.buffer.slice(baseOffset, baseOffset + acc.count * 2);
    return { indices: new Uint16Array(copy), componentType: 5123 };
  }
  if (acc.componentType === 5125) {
    const copy = binChunk.buffer.slice(baseOffset, baseOffset + acc.count * 4);
    return { indices: new Uint32Array(copy), componentType: 5125 };
  }
  if (acc.componentType === 5121) {
    const out = new Uint16Array(acc.count);
    for (let i = 0; i < acc.count; i++) {
      out[i] = binChunk[(view.byteOffset ?? 0) + (acc.byteOffset ?? 0) + i];
    }
    return { indices: out, componentType: 5123 };
  }
  throw new Error(`Unsupported index componentType ${acc.componentType}`);
}

function computeFallbackNormals(
  positions: Float32Array,
  indices: Uint16Array | Uint32Array
): Float32Array {
  const vCount = positions.length / 3;
  const normals = new Float32Array(vCount * 3);
  for (let i = 0; i < indices.length; i += 3) {
    const i0 = indices[i] * 3;
    const i1 = indices[i + 1] * 3;
    const i2 = indices[i + 2] * 3;
    const ax = positions[i1] - positions[i0];
    const ay = positions[i1 + 1] - positions[i0 + 1];
    const az = positions[i1 + 2] - positions[i0 + 2];
    const bx = positions[i2] - positions[i0];
    const by = positions[i2 + 1] - positions[i0 + 1];
    const bz = positions[i2 + 2] - positions[i0 + 2];
    const nx = ay * bz - az * by;
    const ny = az * bx - ax * bz;
    const nz = ax * by - ay * bx;
    for (const idx of [i0, i1, i2]) {
      normals[idx] += nx;
      normals[idx + 1] += ny;
      normals[idx + 2] += nz;
    }
  }
  for (let i = 0; i < vCount; i++) {
    const o = i * 3;
    const l = Math.hypot(normals[o], normals[o + 1], normals[o + 2]);
    if (l > 1e-8) {
      normals[o] /= l;
      normals[o + 1] /= l;
      normals[o + 2] /= l;
    } else {
      normals[o + 1] = 1;
    }
  }
  return normals;
}

function computeBoundingSphereFromPositions(positions: Float32Array): BoundingSphere {
  const vCount = positions.length / 3;
  if (vCount === 0) return { center: [0, 0, 0], radius: 0 };

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < vCount; i++) {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  }

  const cx = (minX + maxX) * 0.5;
  const cy = (minY + maxY) * 0.5;
  const cz = (minZ + maxZ) * 0.5;
  let maxR2 = 0;
  for (let i = 0; i < vCount; i++) {
    const dx = positions[i * 3] - cx;
    const dy = positions[i * 3 + 1] - cy;
    const dz = positions[i * 3 + 2] - cz;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 > maxR2) maxR2 = d2;
  }
  return { center: [cx, cy, cz], radius: Math.sqrt(maxR2) };
}

function mergeBoundingSpheres(spheres: BoundingSphere[]): BoundingSphere {
  const valid = spheres.filter((s) => s.radius > 1e-6);
  if (valid.length === 0) return { center: [0, 0, 0], radius: 0 };
  if (valid.length === 1) {
    return { center: [...valid[0].center] as Vec3, radius: valid[0].radius };
  }

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (const s of valid) {
    minX = Math.min(minX, s.center[0] - s.radius);
    minY = Math.min(minY, s.center[1] - s.radius);
    minZ = Math.min(minZ, s.center[2] - s.radius);
    maxX = Math.max(maxX, s.center[0] + s.radius);
    maxY = Math.max(maxY, s.center[1] + s.radius);
    maxZ = Math.max(maxZ, s.center[2] + s.radius);
  }
  const cx = (minX + maxX) * 0.5;
  const cy = (minY + maxY) * 0.5;
  const cz = (minZ + maxZ) * 0.5;
  let radius = 0;
  for (const s of valid) {
    const dist = Math.hypot(s.center[0] - cx, s.center[1] - cy, s.center[2] - cz) + s.radius;
    if (dist > radius) radius = dist;
  }
  return { center: [cx, cy, cz], radius };
}

// ---------------------------------------------------------------------------
// Public GLB Binary Parser & Async Cached Loader
// ---------------------------------------------------------------------------
export function parseGLB(buffer: ArrayBuffer, url = 'memory://scene.glb'): ParsedGLBScene {
  if (buffer.byteLength < 20) {
    throw new Error('GLB buffer too small (< 20 bytes)');
  }
  const header = new DataView(buffer, 0, 12);
  const magic = header.getUint32(0, true);
  const version = header.getUint32(4, true);
  const declaredLength = header.getUint32(8, true);

  if (magic !== 0x46546c67) {
    throw new Error(`Invalid GLB magic header: 0x${magic.toString(16)}`);
  }
  if (version !== 2) {
    throw new Error(`Unsupported glTF binary version: ${version}`);
  }
  if (declaredLength > buffer.byteLength) {
    throw new Error('Truncated GLB payload');
  }

  let offset = 12;
  let jsonText: string | null = null;
  let binChunk: Uint8Array | null = null;

  while (offset + 8 <= declaredLength) {
    const chunkHeader = new DataView(buffer, offset, 8);
    const chunkLen = chunkHeader.getUint32(0, true);
    const chunkType = chunkHeader.getUint32(4, true);
    offset += 8;

    if (chunkType === 0x4e4f534a) {
      // JSON chunk
      const jsonBytes = new Uint8Array(buffer, offset, chunkLen);
      jsonText = new TextDecoder('utf-8').decode(jsonBytes);
    } else if (chunkType === 0x004e4942) {
      // BIN\0 chunk
      binChunk = new Uint8Array(buffer, offset, chunkLen);
    }
    offset += chunkLen;
  }

  if (!jsonText) {
    throw new Error('GLB file missing JSON chunk');
  }
  const gltf = JSON.parse(jsonText) as RawGLTFJson;
  const bin = binChunk ?? new Uint8Array(0);

  // 1. Materials
  const materials: GLBMaterial[] = (gltf.materials ?? []).map((m, idx) => {
    const pbr = m.pbrMetallicRoughness ?? {};
    const bc = pbr.baseColorFactor ?? [0.92, 0.9, 0.86, 1.0];
    const em = m.emissiveFactor ?? [0, 0, 0];
    return {
      name: m.name ?? `Material_${idx}`,
      baseColorFactor: [bc[0] ?? 1, bc[1] ?? 1, bc[2] ?? 1, bc[3] ?? 1],
      metallicFactor: pbr.metallicFactor ?? 0.0,
      roughnessFactor: pbr.roughnessFactor ?? 0.45,
      emissiveFactor: [em[0] ?? 0, em[1] ?? 0, em[2] ?? 0],
      alphaMode: m.alphaMode ?? 'OPAQUE',
      doubleSided: Boolean(m.doubleSided),
      subsurface: typeof m.extras?.subsurface === 'number' ? m.extras.subsurface : 0.08,
    };
  });
  if (materials.length === 0) {
    materials.push({
      name: 'DefaultAtelierClay',
      baseColorFactor: [0.95, 0.92, 0.88, 1],
      metallicFactor: 0,
      roughnessFactor: 0.48,
      emissiveFactor: [0, 0, 0],
      alphaMode: 'OPAQUE',
      doubleSided: false,
      subsurface: 0.12,
    });
  }

  // 2. Meshes & Primitives
  const meshes: GLBMesh[] = (gltf.meshes ?? []).map((mesh, meshIdx) => {
    const primitives: GLBPrimitive[] = mesh.primitives.map((prim) => {
      const posAccIdx = prim.attributes.POSITION;
      if (posAccIdx === undefined) {
        throw new Error(`Mesh ${mesh.name ?? meshIdx} missing POSITION attribute`);
      }
      const positions = decodeFloatAccessor(gltf, bin, posAccIdx, 3);
      const vertexCount = positions.length / 3;

      let indices: Uint16Array | Uint32Array;
      let indexComponentType: 5123 | 5125;
      if (prim.indices !== undefined) {
        const decoded = decodeIndexAccessor(gltf, bin, prim.indices);
        indices = decoded.indices;
        indexComponentType = decoded.componentType;
      } else {
        indices = vertexCount < 65535 ? new Uint16Array(vertexCount) : new Uint32Array(vertexCount);
        for (let k = 0; k < vertexCount; k++) indices[k] = k;
        indexComponentType = vertexCount < 65535 ? 5123 : 5125;
      }

      const normals =
        prim.attributes.NORMAL !== undefined
          ? decodeFloatAccessor(gltf, bin, prim.attributes.NORMAL, 3)
          : computeFallbackNormals(positions, indices);

      let colors: Float32Array;
      if (prim.attributes.COLOR_0 !== undefined) {
        colors = decodeFloatAccessor(gltf, bin, prim.attributes.COLOR_0, 4);
      } else {
        colors = new Float32Array(vertexCount * 4);
        colors.fill(1.0);
      }

      const localBoundingSphere = computeBoundingSphereFromPositions(positions);
      return {
        positions,
        normals,
        colors,
        indices,
        indexComponentType,
        vertexCount,
        indexCount: indices.length,
        materialIndex: prim.material ?? 0,
        localBoundingSphere,
      };
    });

    return {
      name: mesh.name ?? `Mesh_${meshIdx}`,
      primitives,
      localBoundingSphere: mergeBoundingSpheres(primitives.map((p) => p.localBoundingSphere)),
    };
  });

  // 3. Scene Graph Nodes
  const rawNodes = gltf.nodes ?? [];
  const parentLookup = new Array<number | null>(rawNodes.length).fill(null);
  rawNodes.forEach((n, idx) => {
    for (const childIdx of n.children ?? []) {
      parentLookup[childIdx] = idx;
    }
  });

  const nodeTemplates: GLBNodeTemplate[] = rawNodes.map((n, idx) => ({
    index: idx,
    name: n.name ?? `Node_${idx}`,
    parentIndex: parentLookup[idx],
    children: [...(n.children ?? [])],
    meshIndex: typeof n.mesh === 'number' ? n.mesh : null,
    translation: [
      n.translation?.[0] ?? 0,
      n.translation?.[1] ?? 0,
      n.translation?.[2] ?? 0,
    ],
    rotation: [
      n.rotation?.[0] ?? 0,
      n.rotation?.[1] ?? 0,
      n.rotation?.[2] ?? 0,
      n.rotation?.[3] ?? 1,
    ],
    scale: [n.scale?.[0] ?? 1, n.scale?.[1] ?? 1, n.scale?.[2] ?? 1],
    localMatrixPreset: n.matrix ? new Float32Array(n.matrix) : null,
    extras: n.extras ? { ...n.extras } : {},
  }));

  const activeSceneIdx = gltf.scene ?? 0;
  const activeScene = gltf.scenes?.[activeSceneIdx];
  const rootNodes = activeScene?.nodes
    ? [...activeScene.nodes]
    : nodeTemplates.filter((n) => n.parentIndex === null).map((n) => n.index);

  const parsed: ParsedGLBScene = {
    url,
    name: activeScene?.name ?? 'TakolioScene',
    materials,
    meshes,
    nodeTemplates,
    rootNodes,
    sceneBounds: { center: [0, 0.6, 0], radius: 1.5 },
  };

  // Compute initial scene bounds via a temporary runtime instance
  const tempRuntime = createRuntimeScene(parsed);
  parsed.sceneBounds = {
    center: [...tempRuntime.sceneBounds.center] as Vec3,
    radius: Math.max(0.25, tempRuntime.sceneBounds.radius),
  };

  return parsed;
}

export async function loadGLB(url: string): Promise<ParsedGLBScene> {
  const cached = glbSceneCache.get(url);
  if (cached) return cached;

  const inflight = glbInflightCache.get(url);
  if (inflight) return inflight;

  const promise = fetch(url)
    .then((res) => {
      if (!res.ok) {
        throw new Error(`Failed to fetch GLB ${url} (HTTP ${res.status})`);
      }
      return res.arrayBuffer();
    })
    .then((buf) => {
      const parsed = parseGLB(buf, url);
      glbSceneCache.set(url, parsed);
      glbInflightCache.delete(url);
      return parsed;
    })
    .catch((err) => {
      glbInflightCache.delete(url);
      throw err;
    });

  glbInflightCache.set(url, promise);
  return promise;
}

// ---------------------------------------------------------------------------
// Per-Stage Runtime Scene Graph Instantiation, World Matrix Update & Raycast
// ---------------------------------------------------------------------------
export function createRuntimeScene(parsed: ParsedGLBScene): RuntimeGLBScene {
  const nodesByName = new Map<string, RuntimeGLBNode>();
  const nodes: RuntimeGLBNode[] = parsed.nodeTemplates.map((tpl) => {
    const node: RuntimeGLBNode = {
      index: tpl.index,
      name: tpl.name,
      parentIndex: tpl.parentIndex,
      children: [...tpl.children],
      meshIndex: tpl.meshIndex,
      extras: { ...tpl.extras },
      restTranslation: [...tpl.translation] as Vec3,
      restRotation: [...tpl.rotation] as Quat,
      restScale: [...tpl.scale] as Vec3,
      translation: [...tpl.translation] as Vec3,
      rotation: [...tpl.rotation] as Quat,
      scale: [...tpl.scale] as Vec3,
      visible: true,
      highlightAmount: 0,
      highlightColor: [1.0, 0.72, 0.36],
      emissiveTint: null,
      baseColorTint: null,
      localMatrix: tpl.localMatrixPreset
        ? new Float32Array(tpl.localMatrixPreset)
        : mat4FromTRS(tpl.translation, tpl.rotation, tpl.scale),
      worldMatrix: mat4Identity(),
      worldBoundingSphere: { center: [0, 0, 0], radius: 0 },
    };
    nodesByName.set(node.name, node);
    return node;
  });

  const runtime: RuntimeGLBScene = {
    source: parsed,
    nodes,
    nodesByName,
    rootNodes: [...parsed.rootNodes],
    sceneBounds: { center: [0, 0.6, 0], radius: 1.5 },
  };

  updateSceneWorldMatrices(runtime);
  return runtime;
}

export function updateSceneWorldMatrices(scene: RuntimeGLBScene): void {
  const { nodes, source } = scene;

  const visit = (nodeIdx: number, parentWorld: Float32Array | null): BoundingSphere => {
    const node = nodes[nodeIdx];
    const tpl = source.nodeTemplates[nodeIdx];
    if (!tpl.localMatrixPreset) {
      mat4FromTRS(node.translation, node.rotation, node.scale, node.localMatrix);
    }
    if (parentWorld) {
      mat4Multiply(parentWorld, node.localMatrix, node.worldMatrix);
    } else {
      node.worldMatrix.set(node.localMatrix);
    }

    if (!node.visible) {
      node.worldBoundingSphere = { center: [0, 0, 0], radius: 0 };
      return node.worldBoundingSphere;
    }

    const childSpheres: BoundingSphere[] = [];
    if (node.meshIndex !== null) {
      const mesh = source.meshes[node.meshIndex];
      if (mesh && mesh.localBoundingSphere.radius > 0) {
        const wCenter = transformPointMat4(mesh.localBoundingSphere.center, node.worldMatrix);
        const sx = Math.hypot(node.worldMatrix[0], node.worldMatrix[1], node.worldMatrix[2]);
        const sy = Math.hypot(node.worldMatrix[4], node.worldMatrix[5], node.worldMatrix[6]);
        const sz = Math.hypot(node.worldMatrix[8], node.worldMatrix[9], node.worldMatrix[10]);
        const maxScale = Math.max(sx, sy, sz);
        childSpheres.push({
          center: wCenter,
          radius: mesh.localBoundingSphere.radius * maxScale,
        });
      }
    }

    for (const childIdx of node.children) {
      const cSphere = visit(childIdx, node.worldMatrix);
      if (cSphere.radius > 0) childSpheres.push(cSphere);
    }

    node.worldBoundingSphere = mergeBoundingSpheres(childSpheres);
    return node.worldBoundingSphere;
  };

  const rootSpheres: BoundingSphere[] = [];
  for (const rIdx of scene.rootNodes) {
    const s = visit(rIdx, null);
    if (s.radius > 0) rootSpheres.push(s);
  }
  scene.sceneBounds = mergeBoundingSpheres(rootSpheres);
}

/**
 * Ray-sphere intersection against interactive scene nodes (supports matching either
 * a leaf mesh node OR an interactive ancestor group like `Zone_Fridge` / `Place_1`).
 */
export function raycastSceneNodes(
  scene: RuntimeGLBScene,
  rayOrigin: Vec3,
  rayDir: Vec3,
  interactiveNames?: ReadonlySet<string>
): RaycastHit | null {
  let closestHit: RaycastHit | null = null;

  const findInteractiveSelfOrAncestor = (node: RuntimeGLBNode): RuntimeGLBNode | null => {
    if (!interactiveNames || interactiveNames.size === 0) return node;
    let curr: RuntimeGLBNode | undefined = node;
    while (curr) {
      if (interactiveNames.has(curr.name)) return curr;
      curr = curr.parentIndex !== null ? scene.nodes[curr.parentIndex] : undefined;
    }
    return null;
  };

  for (const node of scene.nodes) {
    if (!node.visible) continue;
    // Prefer testing nodes that own meshes (more accurate tight spheres) or leaf interactive nodes
    if (node.meshIndex === null && node.children.length > 0) continue;

    const matched = findInteractiveSelfOrAncestor(node);
    if (!matched || !matched.visible) continue;

    const { center, radius } = node.worldBoundingSphere;
    if (radius <= 1e-5) continue;

    const ocX = rayOrigin[0] - center[0];
    const ocY = rayOrigin[1] - center[1];
    const ocZ = rayOrigin[2] - center[2];

    const b = ocX * rayDir[0] + ocY * rayDir[1] + ocZ * rayDir[2];
    const c = ocX * ocX + ocY * ocY + ocZ * ocZ - radius * radius;
    const disc = b * b - c;
    if (disc < 0) continue;

    const sqrtDisc = Math.sqrt(disc);
    let t = -b - sqrtDisc;
    if (t < 0) t = -b + sqrtDisc;
    if (t < 0) continue;

    if (!closestHit || t < closestHit.distance) {
      closestHit = {
        node,
        matchedNode: matched,
        distance: t,
        point: [
          rayOrigin[0] + rayDir[0] * t,
          rayOrigin[1] + rayDir[1] * t,
          rayOrigin[2] + rayDir[2] * t,
        ],
      };
    }
  }

  return closestHit;
}
