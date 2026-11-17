#!/usr/bin/env node
/**
 * Takolio V4 — Deterministic glTF 2.0 Binary `.glb` Compiler
 * ==========================================================
 * Pure Node.js, zero-network procedural 3D geometry & PBR material compiler.
 * Generates 5 spec-compliant glTF 2.0 binary `.glb` assets into `public/takolio/v4/3d/`:
 *   1. `tako-chef-v4.glb`
 *   2. `kitchen-island-hero.glb`
 *   3. `onboarding-mam-com.glb`
 *   4. `smart-fridge-3zone.glb`
 *   5. `culinary-cookware-stage.glb`
 *
 * Features:
 * - Smooth procedural geometry primitives: UV-ellipsoids, Catmull-Rom lathed ceramic
 *   vessels, chamfered/rounded superquadric boxes, Bishop parallel-transport swept
 *   tubes (tentacles, handles, chilies), torus rings, cones, and botanical leaves.
 * - Area-weighted smooth per-vertex normals (`NORMAL`).
 * - Baked ambient-occlusion + artistic vertex tinting (`COLOR_0` RGBA float).
 * - Spec-compliant PBR materials (`baseColorFactor`, `metallicFactor`, `roughnessFactor`,
 *   `emissiveFactor`, `alphaMode`, plus `extras.subsurface` for culinary SSS).
 * - Binary glTF 2.0 container (`0x46546C67`, version 2, 4-byte aligned JSON `0x4E4F534A`
 *   + BIN `0x004E4942` chunks).
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, '../..');
const OUT_3D_DIR = resolve(ROOT_DIR, 'public/takolio/v4/3d');

// ---------------------------------------------------------------------------
// Vector, Quaternion & Color Math Utilities
// ---------------------------------------------------------------------------
const v3 = (x = 0, y = 0, z = 0) => [x, y, z];
const vAdd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const vSub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const vScale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const vDot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const vCross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const vLen = (a) => Math.hypot(a[0], a[1], a[2]);
const vNorm = (a) => {
  const l = vLen(a);
  return l > 1e-8 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 1, 0];
};
const vLerp = (a, b, t) => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

function quatFromEulerXYZ(rx = 0, ry = 0, rz = 0) {
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

function quatRotateVec(q, v) {
  const [qx, qy, qz, qw] = q;
  const uv = vCross([qx, qy, qz], v);
  const uuv = vCross([qx, qy, qz], uv);
  return vAdd(v, vAdd(vScale(uv, 2 * qw), vScale(uuv, 2)));
}

function quatFromUnitVectors(from, to) {
  let r = vDot(from, to) + 1;
  if (r < 1e-6) {
    r = 0;
    const axis =
      Math.abs(from[0]) > Math.abs(from[2])
        ? [-from[1], from[0], 0]
        : [0, -from[2], from[1]];
    const n = vNorm(axis);
    return [n[0], n[1], n[2], 0];
  }
  const c = vCross(from, to);
  const len = Math.hypot(c[0], c[1], c[2], r);
  return [c[0] / len, c[1] / len, c[2] / len, r / len];
}

function hexToLinearRGBA(hex, alpha = 1.0) {
  const clean = hex.replace('#', '');
  const out = [];
  for (let i = 0; i < 6; i += 2) {
    const s = parseInt(clean.slice(i, i + 2), 16) / 255;
    out.push(s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4));
  }
  out.push(alpha);
  return out;
}

function evalCatmullRom3D(pts, u) {
  const n = pts.length;
  const scaled = Math.max(0, Math.min(1, u)) * (n - 1);
  const idx = Math.min(Math.floor(scaled), n - 2);
  const t = scaled - idx;
  const p0 = pts[Math.max(0, idx - 1)];
  const p1 = pts[idx];
  const p2 = pts[idx + 1];
  const p3 = pts[Math.min(n - 1, idx + 2)];
  const t2 = t * t;
  const t3 = t2 * t;
  return [0, 1, 2].map(
    (k) =>
      0.5 *
      (2 * p1[k] +
        (-p0[k] + p2[k]) * t +
        (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 +
        (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)
  );
}

function evalCatmullRom2D(pts, u) {
  const n = pts.length;
  const scaled = Math.max(0, Math.min(1, u)) * (n - 1);
  const idx = Math.min(Math.floor(scaled), n - 2);
  const t = scaled - idx;
  const p0 = pts[Math.max(0, idx - 1)];
  const p1 = pts[idx];
  const p2 = pts[idx + 1];
  const p3 = pts[Math.min(n - 1, idx + 2)];
  const t2 = t * t;
  const t3 = t2 * t;
  return [0, 1].map(
    (k) =>
      0.5 *
      (2 * p1[k] +
        (-p0[k] + p2[k]) * t +
        (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 +
        (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)
  );
}

// ---------------------------------------------------------------------------
// Mesh Representation, Transform, Merging, Smooth Normals & Baked Vertex AO
// ---------------------------------------------------------------------------
function computeSmoothNormals(positions, indices) {
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

    normals[i0] += nx;
    normals[i0 + 1] += ny;
    normals[i0 + 2] += nz;
    normals[i1] += nx;
    normals[i1 + 1] += ny;
    normals[i1 + 2] += nz;
    normals[i2] += nx;
    normals[i2 + 1] += ny;
    normals[i2 + 2] += nz;
  }

  for (let i = 0; i < vCount; i++) {
    const o = i * 3;
    const len = Math.hypot(normals[o], normals[o + 1], normals[o + 2]);
    if (len > 1e-8) {
      normals[o] /= len;
      normals[o + 1] /= len;
      normals[o + 2] /= len;
    } else {
      normals[o] = 0;
      normals[o + 1] = 1;
      normals[o + 2] = 0;
    }
  }
  return normals;
}

/**
 * Bake smooth per-vertex ambient occlusion + optional custom color tint into `COLOR_0`.
 * Ground hemisphere bounce + cavity/underside darkening + optional `tintFn(pos, normal) -> [r,g,b]`.
 */
function bakeVertexColors(positions, normals, opts = {}) {
  const {
    groundY = 0.0,
    aoRange = 0.65,
    minAO = 0.56,
    cavityCenter = null,
    cavityRadius = 0.8,
    tintFn = null,
  } = opts;
  const vCount = positions.length / 3;
  const colors = new Float32Array(vCount * 4);

  for (let i = 0; i < vCount; i++) {
    const px = positions[i * 3];
    const py = positions[i * 3 + 1];
    const pz = positions[i * 3 + 2];
    const nx = normals[i * 3];
    const ny = normals[i * 3 + 1];
    const nz = normals[i * 3 + 2];

    const heightFactor = Math.max(0, Math.min(1, (py - groundY) / Math.max(0.08, aoRange)));
    const upHemisphere = 0.5 + 0.5 * ny;
    let ao = minAO + (1.0 - minAO) * (0.58 * heightFactor + 0.42 * upHemisphere);

    if (cavityCenter) {
      const dist = Math.hypot(px - cavityCenter[0], py - cavityCenter[1], pz - cavityCenter[2]);
      const innerOcc = 0.82 + 0.18 * Math.min(1, dist / Math.max(0.05, cavityRadius));
      ao *= innerOcc;
    }

    ao = Math.max(0.35, Math.min(1.06, ao));
    let r = ao;
    let g = ao * 0.992;
    let b = ao * 0.978;

    if (tintFn) {
      const tint = tintFn([px, py, pz], [nx, ny, nz], ao);
      if (tint) {
        r *= tint[0];
        g *= tint[1];
        b *= tint[2];
      }
    }

    colors[i * 4] = r;
    colors[i * 4 + 1] = g;
    colors[i * 4 + 2] = b;
    colors[i * 4 + 3] = 1.0;
  }
  return colors;
}

function transformGeometry(geo, { translate = [0, 0, 0], rotateEuler = null, rotateQuat = null, scale = [1, 1, 1] } = {}) {
  const vCount = geo.positions.length / 3;
  const positions = new Float32Array(geo.positions.length);
  const normals = new Float32Array(geo.normals.length);
  const colors = geo.colors ? new Float32Array(geo.colors) : null;
  const q = rotateQuat || (rotateEuler ? quatFromEulerXYZ(...rotateEuler) : null);

  for (let i = 0; i < vCount; i++) {
    let p = [
      geo.positions[i * 3] * scale[0],
      geo.positions[i * 3 + 1] * scale[1],
      geo.positions[i * 3 + 2] * scale[2],
    ];
    let n = [
      geo.normals[i * 3] / (scale[0] || 1),
      geo.normals[i * 3 + 1] / (scale[1] || 1),
      geo.normals[i * 3 + 2] / (scale[2] || 1),
    ];
    if (q) {
      p = quatRotateVec(q, p);
      n = quatRotateVec(q, n);
    }
    n = vNorm(n);
    positions[i * 3] = p[0] + translate[0];
    positions[i * 3 + 1] = p[1] + translate[1];
    positions[i * 3 + 2] = p[2] + translate[2];
    normals[i * 3] = n[0];
    normals[i * 3 + 1] = n[1];
    normals[i * 3 + 2] = n[2];
  }

  return {
    positions,
    normals,
    colors,
    indices: new Uint32Array(geo.indices),
  };
}

function mergeGeometries(geos, aoOptions = {}) {
  let totalVerts = 0;
  let totalIdx = 0;
  for (const g of geos) {
    totalVerts += g.positions.length / 3;
    totalIdx += g.indices.length;
  }
  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const colors = new Float32Array(totalVerts * 4);
  const indices = new Uint32Array(totalIdx);

  let vOffset = 0;
  let iOffset = 0;
  let hasAllColors = true;

  for (const g of geos) {
    const vc = g.positions.length / 3;
    positions.set(g.positions, vOffset * 3);
    normals.set(g.normals, vOffset * 3);
    if (g.colors) {
      colors.set(g.colors, vOffset * 4);
    } else {
      hasAllColors = false;
    }
    for (let k = 0; k < g.indices.length; k++) {
      indices[iOffset + k] = g.indices[k] + vOffset;
    }
    vOffset += vc;
    iOffset += g.indices.length;
  }

  const finalColors = hasAllColors
    ? colors
    : bakeVertexColors(positions, normals, aoOptions);

  return { positions, normals, colors: finalColors, indices };
}

// ---------------------------------------------------------------------------
// High-Craft Procedural 3D Primitives (Y-up, Right-Handed)
// ---------------------------------------------------------------------------

/**
 * 1. UV-Ellipsoid with optional custom vertex deformation callback.
 */
function createEllipsoid({
  rx = 0.5,
  ry = 0.5,
  rz = 0.5,
  widthSegments = 36,
  heightSegments = 24,
  phiStart = 0,
  phiLength = Math.PI * 2,
  thetaStart = 0,
  thetaLength = Math.PI,
  deformFn = null,
  aoOptions = {},
} = {}) {
  const vCols = widthSegments + 1;
  const vRows = heightSegments + 1;
  const vCount = vCols * vRows;
  const positions = new Float32Array(vCount * 3);
  const indices = [];

  let ptr = 0;
  for (let y = 0; y <= heightSegments; y++) {
    const v = y / heightSegments;
    const theta = thetaStart + v * thetaLength;
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);

    for (let x = 0; x <= widthSegments; x++) {
      const u = x / widthSegments;
      const phi = phiStart + u * phiLength;
      let px = -rx * Math.cos(phi) * sinTheta;
      let py = ry * cosTheta;
      let pz = rz * Math.sin(phi) * sinTheta;

      if (deformFn) {
        [px, py, pz] = deformFn(px, py, pz, u, v);
      }
      positions[ptr++] = px;
      positions[ptr++] = py;
      positions[ptr++] = pz;
    }
  }

  for (let y = 0; y < heightSegments; y++) {
    for (let x = 0; x < widthSegments; x++) {
      const a = y * vCols + (x + 1);
      const b = y * vCols + x;
      const c = (y + 1) * vCols + x;
      const d = (y + 1) * vCols + (x + 1);

      if (y !== 0 || thetaStart > 0) indices.push(a, b, d);
      if (y !== heightSegments - 1 || thetaStart + thetaLength < Math.PI) {
        indices.push(b, c, d);
      }
    }
  }

  const idxArray = new Uint32Array(indices);
  const normals = computeSmoothNormals(positions, idxArray);
  const colors = bakeVertexColors(positions, normals, aoOptions);
  return { positions, normals, colors, indices: idxArray };
}

/**
 * 2. Lathed Ceramic / Cookware Surface of Revolution around +Y axis.
 * `profile` is an array of `[radius, y]` points from bottom-inside or bottom-outside around rim.
 */
function createLathe(profile, { segments = 48, smoothProfileSteps = 0, aoOptions = {} } = {}) {
  let pts = profile;
  if (smoothProfileSteps > 0 && profile.length >= 4) {
    pts = [];
    for (let i = 0; i <= smoothProfileSteps; i++) {
      const [r, y] = evalCatmullRom2D(profile, i / smoothProfileSteps);
      pts.push([Math.max(0.0005, r), y]);
    }
  }

  const rows = pts.length;
  const cols = segments + 1;
  const positions = new Float32Array(rows * cols * 3);
  const indices = [];

  let ptr = 0;
  for (let rIdx = 0; rIdx < rows; rIdx++) {
    const [rad, py] = pts[rIdx];
    const safeR = Math.max(0.0002, rad);
    for (let s = 0; s <= segments; s++) {
      const phi = (s / segments) * Math.PI * 2;
      positions[ptr++] = safeR * Math.cos(phi);
      positions[ptr++] = py;
      positions[ptr++] = safeR * Math.sin(phi);
    }
  }

  for (let rIdx = 0; rIdx < rows - 1; rIdx++) {
    for (let s = 0; s < segments; s++) {
      const a = rIdx * cols + s;
      const b = (rIdx + 1) * cols + s;
      const c = (rIdx + 1) * cols + (s + 1);
      const d = rIdx * cols + (s + 1);
      // Outward CCW winding when profile moves upward on outer wall (r > 0)
      indices.push(a, d, b);
      indices.push(d, c, b);
    }
  }

  const idxArray = new Uint32Array(indices);
  const normals = computeSmoothNormals(positions, idxArray);
  const colors = bakeVertexColors(positions, normals, aoOptions);
  return { positions, normals, colors, indices: idxArray };
}

/**
 * 3. Smooth Rounded Chamfered Box (Superquadric / Beveled Box).
 * Produces smooth beveled edges & corners with exact outward normals.
 */
function createRoundedBox({
  width = 1,
  height = 1,
  depth = 1,
  radius = 0.08,
  smoothness = 2,
  aoOptions = {},
} = {}) {
  const r = Math.min(radius, width * 0.48, height * 0.48, depth * 0.48);
  const hx = Math.max(0, width * 0.5 - r);
  const hy = Math.max(0, height * 0.5 - r);
  const hz = Math.max(0, depth * 0.5 - r);

  const wSeg = Math.max(12, smoothness * 8);
  const hSeg = Math.max(8, smoothness * 6);
  const vCols = wSeg + 1;
  const vRows = hSeg + 1;
  const positions = new Float32Array(vCols * vRows * 3);
  const indices = [];

  let ptr = 0;
  for (let y = 0; y <= hSeg; y++) {
    const theta = (y / hSeg) * Math.PI;
    const sinT = Math.sin(theta);
    const cosT = Math.cos(theta);
    for (let x = 0; x <= wSeg; x++) {
      const phi = (x / wSeg) * Math.PI * 2;
      const nx = -Math.cos(phi) * sinT;
      const ny = cosT;
      const nz = Math.sin(phi) * sinT;

      const sx = nx >= 0 ? 1 : -1;
      const sy = ny >= 0 ? 1 : -1;
      const sz = nz >= 0 ? 1 : -1;

      positions[ptr++] = sx * hx + nx * r;
      positions[ptr++] = sy * hy + ny * r;
      positions[ptr++] = sz * hz + nz * r;
    }
  }

  for (let y = 0; y < hSeg; y++) {
    for (let x = 0; x < wSeg; x++) {
      const a = y * vCols + (x + 1);
      const b = y * vCols + x;
      const c = (y + 1) * vCols + x;
      const d = (y + 1) * vCols + (x + 1);
      if (y !== 0) indices.push(a, b, d);
      if (y !== hSeg - 1) indices.push(b, c, d);
    }
  }

  const idxArray = new Uint32Array(indices);
  const normals = computeSmoothNormals(positions, idxArray);
  const colors = bakeVertexColors(positions, normals, aoOptions);
  return { positions, normals, colors, indices: idxArray };
}

/**
 * 4. Catmull-Rom Swept Tube with Twist-Free Parallel-Transport Frame + Rounded Caps.
 */
function createSweptTube(
  controlPoints,
  {
    tubularSegments = 48,
    radialSegments = 20,
    radiusFn = (u) => 0.12 * (1 - 0.5 * u),
    capStart = true,
    capEnd = true,
    aoOptions = {},
  } = {}
) {
  const frames = [];
  let prevT = null;
  let prevN = null;

  for (let i = 0; i <= tubularSegments; i++) {
    const u = i / tubularSegments;
    const pos = evalCatmullRom3D(controlPoints, u);
    const pPrev = evalCatmullRom3D(controlPoints, Math.max(0, u - 0.005));
    const pNext = evalCatmullRom3D(controlPoints, Math.min(1, u + 0.005));
    const tangent = vNorm(vSub(pNext, pPrev));

    let normal;
    if (!prevT) {
      const up = Math.abs(vDot(tangent, [0, 1, 0])) > 0.92 ? [0, 0, 1] : [0, 1, 0];
      normal = vNorm(vSub(up, vScale(tangent, vDot(up, tangent))));
    } else {
      const q = quatFromUnitVectors(prevT, tangent);
      const rotN = quatRotateVec(q, prevN);
      normal = vNorm(vSub(rotN, vScale(tangent, vDot(rotN, tangent))));
    }
    const binormal = vNorm(vCross(tangent, normal));
    prevT = tangent;
    prevN = normal;
    frames.push({ u, pos, tangent, normal, binormal, r: Math.max(0.001, radiusFn(u)) });
  }

  const cols = radialSegments + 1;
  const verts = [];
  const indices = [];

  for (let i = 0; i < frames.length; i++) {
    const { pos, normal, binormal, r } = frames[i];
    for (let j = 0; j <= radialSegments; j++) {
      const theta = (j / radialSegments) * Math.PI * 2;
      const offset = vAdd(
        vScale(normal, r * Math.cos(theta)),
        vScale(binormal, r * Math.sin(theta))
      );
      verts.push(...vAdd(pos, offset));
    }
  }

  for (let i = 0; i < frames.length - 1; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * cols + j;
      const b = (i + 1) * cols + j;
      const c = (i + 1) * cols + (j + 1);
      const d = i * cols + (j + 1);
      indices.push(a, d, b);
      indices.push(d, c, b);
    }
  }

  if (capStart) {
    const f0 = frames[0];
    const centerIdx = verts.length / 3;
    verts.push(...vSub(f0.pos, vScale(f0.tangent, f0.r * 0.35)));
    for (let j = 0; j < radialSegments; j++) {
      indices.push(centerIdx, j + 1, j);
    }
  }

  if (capEnd) {
    const fEnd = frames[frames.length - 1];
    const base = (frames.length - 1) * cols;
    const centerIdx = verts.length / 3;
    verts.push(...vAdd(fEnd.pos, vScale(fEnd.tangent, fEnd.r * 0.45)));
    for (let j = 0; j < radialSegments; j++) {
      indices.push(centerIdx, base + j, base + j + 1);
    }
  }

  const positions = new Float32Array(verts);
  const idxArray = new Uint32Array(indices);
  const normals = computeSmoothNormals(positions, idxArray);
  const colors = bakeVertexColors(positions, normals, aoOptions);
  return { positions, normals, colors, indices: idxArray };
}

/**
 * 5. Torus Ring lying in XZ plane (around +Y axis) for steam rings, rims, suction cups.
 */
function createTorus({
  majorRadius = 0.4,
  minorRadius = 0.05,
  radialSegments = 16,
  tubularSegments = 36,
  arc = Math.PI * 2,
  aoOptions = {},
} = {}) {
  const verts = [];
  const indices = [];

  for (let j = 0; j <= radialSegments; j++) {
    const v = (j / radialSegments) * Math.PI * 2;
    const cosV = Math.cos(v);
    const sinV = Math.sin(v);
    for (let i = 0; i <= tubularSegments; i++) {
      const u = (i / tubularSegments) * arc;
      const cosU = Math.cos(u);
      const sinU = Math.sin(u);
      const r = majorRadius + minorRadius * cosV;
      verts.push(r * cosU, minorRadius * sinV, r * sinU);
    }
  }

  const cols = tubularSegments + 1;
  for (let j = 0; j < radialSegments; j++) {
    for (let i = 0; i < tubularSegments; i++) {
      const a = (j + 1) * cols + i;
      const b = j * cols + i;
      const c = j * cols + (i + 1);
      const d = (j + 1) * cols + (i + 1);
      indices.push(a, d, b);
      indices.push(b, d, c);
    }
  }

  const positions = new Float32Array(verts);
  const idxArray = new Uint32Array(indices);
  const normals = computeSmoothNormals(positions, idxArray);
  const colors = bakeVertexColors(positions, normals, aoOptions);
  return { positions, normals, colors, indices: idxArray };
}

/**
 * 6. Botanical Leaf / Flame Cone Helper
 */
function createBotanicalLeaf({ width = 0.08, length = 0.22, thickness = 0.024, bend = 0.04 } = {}) {
  return createEllipsoid({
    rx: width,
    ry: length * 0.5,
    rz: thickness,
    widthSegments: 24,
    heightSegments: 18,
    deformFn: (x, y, z, _u, v) => {
      // Taper tip cleanly and curve forward slightly
      const taper = Math.pow(Math.sin(Math.PI * Math.min(0.999, Math.max(0.001, v))), 0.65);
      const ny = y + length * 0.5;
      const archZ = z + bend * Math.sin(Math.PI * (1 - v));
      return [x * taper, ny, archZ];
    },
  });
}

// ---------------------------------------------------------------------------
// glTF 2.0 Scene Builder & Binary `.glb` Serializer
// ---------------------------------------------------------------------------
class GLBSceneBuilder {
  constructor(sceneName) {
    this.sceneName = sceneName;
    this.materials = [];
    this.materialMap = new Map();
    this.meshes = [];
    this.nodes = [];
    this.rootNodes = [];
  }

  addMaterial(name, {
    hex = '#FFFFFF',
    alpha = 1.0,
    metallic = 0.0,
    roughness = 0.45,
    emissiveHex = null,
    emissiveStrength = 1.0,
    subsurface = 0.0,
    doubleSided = false,
  } = {}) {
    if (this.materialMap.has(name)) {
      return this.materialMap.get(name);
    }
    const baseColorFactor = hexToLinearRGBA(hex, alpha);
    const emissiveFactor = emissiveHex
      ? hexToLinearRGBA(emissiveHex, 1.0)
          .slice(0, 3)
          .map((c) => Math.min(4.0, c * emissiveStrength))
      : [0, 0, 0];

    const matDef = {
      name,
      pbrMetallicRoughness: {
        baseColorFactor,
        metallicFactor: metallic,
        roughnessFactor: roughness,
      },
      emissiveFactor,
      doubleSided,
      ...(alpha < 0.999 ? { alphaMode: 'BLEND' } : { alphaMode: 'OPAQUE' }),
      extras: { subsurface },
    };
    const idx = this.materials.length;
    this.materials.push(matDef);
    this.materialMap.set(name, idx);
    return idx;
  }

  addMesh(name, primitives) {
    // primitives: Array<{ geometry, material }>
    const meshIdx = this.meshes.length;
    this.meshes.push({ name, primitives });
    return meshIdx;
  }

  addNode({
    name,
    mesh = null,
    translation = [0, 0, 0],
    rotation = [0, 0, 0, 1],
    scale = [1, 1, 1],
    parent = null,
    extras = undefined,
  }) {
    const nodeIdx = this.nodes.length;
    const node = {
      name,
      translation,
      rotation,
      scale,
      children: [],
      ...(mesh !== null ? { mesh } : {}),
      ...(extras ? { extras } : {}),
    };
    this.nodes.push(node);
    if (parent === null) {
      this.rootNodes.push(nodeIdx);
    } else {
      this.nodes[parent].children.push(nodeIdx);
    }
    return nodeIdx;
  }

  compileGLBBuffer() {
    const bufferViews = [];
    const accessors = [];
    const binChunks = [];
    let byteOffset = 0;

    const appendAlignedBuffer = (typedArray, target) => {
      const rawBytes = Buffer.from(
        typedArray.buffer,
        typedArray.byteOffset,
        typedArray.byteLength
      );
      const padLen = (4 - (rawBytes.length % 4)) % 4;
      const padded =
        padLen > 0 ? Buffer.concat([rawBytes, Buffer.alloc(padLen, 0)]) : rawBytes;

      const viewIdx = bufferViews.length;
      bufferViews.push({
        buffer: 0,
        byteOffset,
        byteLength: rawBytes.length,
        target,
      });
      binChunks.push(padded);
      byteOffset += padded.length;
      return viewIdx;
    };

    const gltfMeshes = this.meshes.map((mesh) => {
      const gltfPrims = mesh.primitives.map(({ geometry, material }) => {
        const { positions, normals, colors, indices } = geometry;
        const vCount = positions.length / 3;

        // Compute exact min/max for POSITION accessor (required by glTF 2.0 spec)
        const minPos = [Infinity, Infinity, Infinity];
        const maxPos = [-Infinity, -Infinity, -Infinity];
        for (let i = 0; i < vCount; i++) {
          for (let k = 0; k < 3; k++) {
            const val = positions[i * 3 + k];
            if (val < minPos[k]) minPos[k] = val;
            if (val > maxPos[k]) maxPos[k] = val;
          }
        }

        const posView = appendAlignedBuffer(positions, 34962);
        const posAcc = accessors.length;
        accessors.push({
          bufferView: posView,
          componentType: 5126, // FLOAT
          count: vCount,
          type: 'VEC3',
          min: minPos,
          max: maxPos,
        });

        const normView = appendAlignedBuffer(normals, 34962);
        const normAcc = accessors.length;
        accessors.push({
          bufferView: normView,
          componentType: 5126,
          count: vCount,
          type: 'VEC3',
        });

        const colView = appendAlignedBuffer(colors, 34962);
        const colAcc = accessors.length;
        accessors.push({
          bufferView: colView,
          componentType: 5126,
          count: vCount,
          type: 'VEC4',
        });

        // Use Uint16 when vertex count fits (< 65535) for compact GPU buffers, else Uint32
        const useU16 = vCount < 65535;
        const idxTyped = useU16 ? new Uint16Array(indices) : new Uint32Array(indices);
        const idxView = appendAlignedBuffer(idxTyped, 34963);
        const idxAcc = accessors.length;
        accessors.push({
          bufferView: idxView,
          componentType: useU16 ? 5123 : 5125,
          count: idxTyped.length,
          type: 'SCALAR',
        });

        return {
          attributes: {
            POSITION: posAcc,
            NORMAL: normAcc,
            COLOR_0: colAcc,
          },
          indices: idxAcc,
          material,
          mode: 4, // TRIANGLES
        };
      });

      return {
        name: mesh.name,
        primitives: gltfPrims,
      };
    });

    const cleanNodes = this.nodes.map((n) => {
      const copy = { ...n };
      if (copy.children.length === 0) delete copy.children;
      return copy;
    });

    const binBuffer = Buffer.concat(binChunks);

    const gltfJson = {
      asset: {
        version: '2.0',
        generator: 'Takolio V4 Procedural Culinary GLB Compiler',
        copyright: 'Takolio Culinary Studio',
      },
      scene: 0,
      scenes: [
        {
          name: this.sceneName,
          nodes: this.rootNodes,
        },
      ],
      nodes: cleanNodes,
      meshes: gltfMeshes,
      materials: this.materials,
      accessors,
      bufferViews,
      buffers: [
        {
          byteLength: binBuffer.length,
        },
      ],
    };

    const jsonRaw = Buffer.from(JSON.stringify(gltfJson), 'utf8');
    const jsonPad = (4 - (jsonRaw.length % 4)) % 4;
    const jsonPadded =
      jsonPad > 0
        ? Buffer.concat([jsonRaw, Buffer.alloc(jsonPad, 0x20)]) // space padding per glTF spec
        : jsonRaw;

    const totalLength = 12 + 8 + jsonPadded.length + 8 + binBuffer.length;
    const out = Buffer.alloc(totalLength);

    // 12-byte GLB header
    out.writeUInt32LE(0x46546c67, 0); // 'glTF'
    out.writeUInt32LE(2, 4); // version 2
    out.writeUInt32LE(totalLength, 8);

    // Chunk 0: JSON (0x4E4F534A)
    let cursor = 12;
    out.writeUInt32LE(jsonPadded.length, cursor);
    out.writeUInt32LE(0x4e4f534a, cursor + 4);
    jsonPadded.copy(out, cursor + 8);
    cursor += 8 + jsonPadded.length;

    // Chunk 1: BIN (0x004E4942)
    out.writeUInt32LE(binBuffer.length, cursor);
    out.writeUInt32LE(0x004e4942, cursor + 4);
    binBuffer.copy(out, cursor + 8);

    return {
      buffer: out,
      nodeNames: cleanNodes.map((n) => n.name),
      meshCount: gltfMeshes.length,
      byteLength: out.length,
    };
  }
}

// ---------------------------------------------------------------------------
// ReusableTako Chef Assembly Helper (used standalone + inside Kitchen Island)
// ---------------------------------------------------------------------------
function addTakoChefToScene(builder, {
  rootName = 'TakoRoot',
  position = [0, 0, 0],
  rotationY = 0,
  uniformScale = 1.0,
  includeNamedTentacles = true,
} = {}) {
  const matSkin = builder.addMaterial('Tako_CoralSkin', {
    hex: '#E5533D',
    roughness: 0.38,
    subsurface: 0.44,
  });
  const matBrow = builder.addMaterial('Tako_CoralBrow', {
    hex: '#C43B27',
    roughness: 0.44,
    subsurface: 0.2,
  });
  const matSucker = builder.addMaterial('Tako_SuckerBlush', {
    hex: '#FFD4BF',
    roughness: 0.36,
    subsurface: 0.28,
  });
  const matToque = builder.addMaterial('Tako_ChefToqueIvory', {
    hex: '#FBF8F3',
    roughness: 0.64,
    subsurface: 0.14,
  });
  const matApron = builder.addMaterial('Tako_HerbApronJade', {
    hex: '#1B6B4A',
    roughness: 0.58,
    subsurface: 0.06,
    doubleSided: true,
  });
  const matLeaf = builder.addMaterial('Tako_BotanicalLeaf', {
    hex: '#2E8B63',
    roughness: 0.35,
    subsurface: 0.22,
  });
  const matEyeDark = builder.addMaterial('Tako_GlossyPupil', {
    hex: '#101B24',
    roughness: 0.09,
    metallic: 0.05,
  });
  const matEyeWhite = builder.addMaterial('Tako_EyeIvory', {
    hex: '#FFFDF9',
    roughness: 0.14,
  });
  const matMouth = builder.addMaterial('Tako_SmileBurgundy', {
    hex: '#6B222D',
    roughness: 0.42,
  });
  const matTongue = builder.addMaterial('Tako_TongueRose', {
    hex: '#F68D9B',
    roughness: 0.34,
    subsurface: 0.24,
  });
  const matWood = builder.addMaterial('Tako_LadleBeechwood', {
    hex: '#C88A52',
    roughness: 0.46,
  });
  const matGoldPin = builder.addMaterial('Tako_GoldAccent', {
    hex: '#E5AE47',
    roughness: 0.24,
    metallic: 0.82,
  });

  const rootIdx = builder.addNode({
    name: rootName,
    translation: position,
    rotation: quatFromEulerXYZ(0, rotationY, 0),
    scale: [uniformScale, uniformScale, uniformScale],
  });

  // 1. Head dome (centered at local Y = 1.06) with rosy cheek blush baked into COLOR_0
  const headGeo = createEllipsoid({
    rx: 0.68,
    ry: 0.72,
    rz: 0.62,
    widthSegments: 48,
    heightSegments: 36,
    deformFn: (x, y, z) => {
      // Slightly fuller friendly lower cheek contour
      const lowerBulge = y < 0 ? 1 + 0.06 * Math.min(1, -y / 0.6) : 1;
      return [x * lowerBulge, y, z * lowerBulge];
    },
    aoOptions: {
      groundY: -0.72,
      aoRange: 1.4,
      minAO: 0.68,
      tintFn: ([px, py, pz]) => {
        if (pz > 0.22) {
          const dL = Math.hypot((px + 0.38) / 0.18, (py + 0.06) / 0.11);
          const dR = Math.hypot((px - 0.38) / 0.18, (py + 0.06) / 0.11);
          const blush = Math.max(Math.exp(-dL * dL), Math.exp(-dR * dR)) * 0.35;
          return [1 + blush * 0.28, 1 - blush * 0.12, 1 - blush * 0.06];
        }
        return null;
      },
    },
  });
  const headMesh = builder.addMesh(`${rootName}_HeadMesh`, [{ geometry: headGeo, material: matSkin }]);
  const headNode = builder.addNode({
    name: includeNamedTentacles ? 'Head' : `${rootName}_Head`,
    mesh: headMesh,
    translation: [0, 1.06, 0],
    parent: rootIdx,
  });

  // 2. Expressive Eyes, Catchlights, Brows & Smile (`Eyes` child of `Head`)
  const scleraParts = [];
  const pupilParts = [];
  const browParts = [];

  for (const sign of [-1, 1]) {
    scleraParts.push(
      transformGeometry(createEllipsoid({ rx: 0.135, ry: 0.165, rz: 0.055, widthSegments: 24, heightSegments: 18 }), {
        translate: [sign * 0.24, 0.11, 0.56],
        rotateEuler: [-0.08, sign * 0.32, 0],
      }),
      // Crisp primary & secondary catchlights
      transformGeometry(createEllipsoid({ rx: 0.038, ry: 0.045, rz: 0.02, widthSegments: 16, heightSegments: 12 }), {
        translate: [sign * 0.24 - 0.035, 0.165, 0.618],
        rotateEuler: [-0.08, sign * 0.32, 0],
      }),
      transformGeometry(createEllipsoid({ rx: 0.018, ry: 0.02, rz: 0.015, widthSegments: 12, heightSegments: 10 }), {
        translate: [sign * 0.24 + 0.038, 0.065, 0.614],
        rotateEuler: [-0.08, sign * 0.32, 0],
      })
    );

    pupilParts.push(
      transformGeometry(createEllipsoid({ rx: 0.108, ry: 0.138, rz: 0.052, widthSegments: 24, heightSegments: 18 }), {
        translate: [sign * 0.238, 0.11, 0.585],
        rotateEuler: [-0.08, sign * 0.32, 0],
      })
    );

    browParts.push(
      createSweptTube(
        [
          [sign * 0.15, 0.32, 0.54],
          [sign * 0.24, 0.355, 0.525],
          [sign * 0.34, 0.33, 0.48],
        ],
        { tubularSegments: 14, radialSegments: 10, radiusFn: () => 0.022 }
      )
    );
  }

  const smileGeo = createSweptTube(
    [
      [-0.14, -0.14, 0.59],
      [-0.07, -0.20, 0.605],
      [0.0, -0.215, 0.61],
      [0.07, -0.20, 0.605],
      [0.14, -0.14, 0.59],
    ],
    { tubularSegments: 18, radialSegments: 12, radiusFn: (u) => 0.024 * (0.75 + 0.4 * Math.sin(Math.PI * u)) }
  );
  const tongueGeo = transformGeometry(
    createEllipsoid({ rx: 0.068, ry: 0.032, rz: 0.028, widthSegments: 18, heightSegments: 12 }),
    { translate: [0, -0.195, 0.602] }
  );

  const eyesMesh = builder.addMesh(`${rootName}_EyesMesh`, [
    { geometry: mergeGeometries(scleraParts), material: matEyeWhite },
    { geometry: mergeGeometries(pupilParts), material: matEyeDark },
    { geometry: mergeGeometries(browParts), material: matBrow },
    { geometry: smileGeo, material: matMouth },
    { geometry: tongueGeo, material: matTongue },
  ]);
  builder.addNode({
    name: includeNamedTentacles ? 'Eyes' : `${rootName}_Eyes`,
    mesh: eyesMesh,
    translation: [0, 0, 0],
    parent: headNode,
  });

  // 3. Puffed Chef Toque (`Toque` child of `Head` at local Y = 0.60)
  const toqueBandGeo = createLathe(
    [
      [0.41, 0.0],
      [0.44, 0.02],
      [0.48, 0.24],
      [0.45, 0.26],
      [0.40, 0.04],
      [0.41, 0.0],
    ],
    { segments: 44, aoOptions: { groundY: 0, aoRange: 0.5 } }
  );
  const puffSpecs = [
    [0, 0.42, 0.02, 0.32, 0.27, 0.31],
    [-0.26, 0.35, 0.04, 0.26, 0.23, 0.26],
    [0.26, 0.35, 0.04, 0.26, 0.23, 0.26],
    [-0.15, 0.39, 0.20, 0.25, 0.23, 0.24],
    [0.15, 0.39, 0.20, 0.25, 0.23, 0.24],
    [-0.16, 0.37, -0.18, 0.25, 0.22, 0.24],
    [0.16, 0.37, -0.18, 0.25, 0.22, 0.24],
  ];
  const toqueIvoryParts = [
    toqueBandGeo,
    ...puffSpecs.map(([px, py, pz, rx, ry, rz]) =>
      transformGeometry(createEllipsoid({ rx, ry, rz, widthSegments: 24, heightSegments: 18 }), {
        translate: [px, py, pz],
      })
    ),
  ];
  const toqueLeaves = mergeGeometries([
    transformGeometry(createBotanicalLeaf({ width: 0.055, length: 0.16, thickness: 0.018 }), {
      translate: [0.02, 0.08, 0.465],
      rotateEuler: [0.08, 0, -0.22],
    }),
    transformGeometry(createBotanicalLeaf({ width: 0.038, length: 0.11, thickness: 0.015 }), {
      translate: [-0.03, 0.08, 0.468],
      rotateEuler: [0.08, 0, 0.32],
    }),
  ]);
  const toquePin = transformGeometry(createEllipsoid({ rx: 0.022, ry: 0.022, rz: 0.016, widthSegments: 14, heightSegments: 10 }), {
    translate: [0, 0.075, 0.476],
  });

  const toqueMesh = builder.addMesh(`${rootName}_ToqueMesh`, [
    { geometry: mergeGeometries(toqueIvoryParts, { groundY: 0, aoRange: 0.65 }), material: matToque },
    { geometry: toqueLeaves, material: matLeaf },
    { geometry: toquePin, material: matGoldPin },
  ]);
  builder.addNode({
    name: includeNamedTentacles ? 'Toque' : `${rootName}_Toque`,
    mesh: toqueMesh,
    translation: [0, 0.58, -0.02],
    rotation: quatFromEulerXYZ(-0.08, 0, 0.03),
    parent: headNode,
  });

  // 4. Fitted Herb Chef Apron (`Apron` child of `Head`) — curved wrap shell, zero clipping!
  const apronShell = createEllipsoid({
    rx: 0.708,
    ry: 0.745,
    rz: 0.648,
    widthSegments: 32,
    heightSegments: 20,
    phiStart: Math.PI * 0.24,
    phiLength: Math.PI * 0.52,
    thetaStart: Math.PI * 0.56,
    thetaLength: Math.PI * 0.32,
    aoOptions: { groundY: -0.7, aoRange: 0.8 },
  });
  const apronStrap = transformGeometry(
    createTorus({ majorRadius: 0.655, minorRadius: 0.024, radialSegments: 12, tubularSegments: 40 }),
    { translate: [0, -0.14, 0.01], scale: [1.04, 1.0, 0.94] }
  );
  const apronCrest = transformGeometry(
    createBotanicalLeaf({ width: 0.045, length: 0.12, thickness: 0.016 }),
    { translate: [0, -0.44, 0.595], rotateEuler: [-0.36, 0, -0.14] }
  );
  const apronMesh = builder.addMesh(`${rootName}_ApronMesh`, [
    { geometry: apronShell, material: matApron },
    { geometry: apronStrap, material: matToque },
    { geometry: apronCrest, material: matLeaf },
  ]);
  builder.addNode({
    name: includeNamedTentacles ? 'Apron' : `${rootName}_Apron`,
    mesh: apronMesh,
    translation: [0, 0, 0],
    parent: headNode,
  });

  // 5. Eight Articulated Curved Tentacles + Suction Cups (`Tentacle_0`..`Tentacle_7`)
  // Local coordinates relative to each tentacle's shoulder socket!
  const tentacleDefinitions = [
    {
      // 0: Front-Left Waving Tentacle
      socket: [-0.46, 0.54, 0.26],
      curve: [
        [0, 0, 0],
        [-0.28, -0.16, 0.14],
        [-0.56, -0.02, 0.28],
        [-0.74, 0.30, 0.34],
        [-0.64, 0.54, 0.28],
      ],
    },
    {
      // 1: Front-Right Ladle Chef Tentacle
      socket: [0.46, 0.54, 0.26],
      curve: [
        [0, 0, 0],
        [0.28, -0.14, 0.16],
        [0.54, 0.02, 0.30],
        [0.68, 0.28, 0.34],
        [0.58, 0.44, 0.30],
      ],
    },
    {
      // 2: Mid-Left Stance Curl
      socket: [-0.48, 0.44, -0.04],
      curve: [
        [0, 0, 0],
        [-0.28, -0.22, 0.04],
        [-0.54, -0.35, 0.12],
        [-0.72, -0.32, 0.24],
      ],
    },
    {
      // 3: Mid-Right Stance Curl
      socket: [0.48, 0.44, -0.04],
      curve: [
        [0, 0, 0],
        [0.28, -0.22, 0.04],
        [0.54, -0.35, 0.12],
        [0.72, -0.32, 0.24],
      ],
    },
    {
      // 4: Front-Center-Left Curl
      socket: [-0.22, 0.42, 0.34],
      curve: [
        [0, 0, 0],
        [-0.12, -0.22, 0.22],
        [-0.24, -0.33, 0.42],
        [-0.36, -0.26, 0.52],
      ],
    },
    {
      // 5: Front-Center-Right Curl
      socket: [0.22, 0.42, 0.34],
      curve: [
        [0, 0, 0],
        [0.12, -0.22, 0.22],
        [0.24, -0.33, 0.42],
        [0.36, -0.26, 0.52],
      ],
    },
    {
      // 6: Back-Left Stabilizer Curl
      socket: [-0.36, 0.42, -0.34],
      curve: [
        [0, 0, 0],
        [-0.24, -0.22, -0.22],
        [-0.46, -0.33, -0.40],
        [-0.36, -0.28, -0.54],
      ],
    },
    {
      // 7: Back-Right Stabilizer Curl
      socket: [0.36, 0.42, -0.34],
      curve: [
        [0, 0, 0],
        [0.24, -0.22, -0.22],
        [0.46, -0.33, -0.40],
        [0.36, -0.28, -0.54],
      ],
    },
  ];

  tentacleDefinitions.forEach((def, idx) => {
    const tubeGeo = createSweptTube(def.curve, {
      tubularSegments: 36,
      radialSegments: 18,
      radiusFn: (u) => {
        const base = 0.165 * (1 - 0.58 * u);
        if (u > 0.85) {
          const tip = (u - 0.85) / 0.15;
          return base * Math.sqrt(Math.max(0.02, 1 - tip * tip));
        }
        return base;
      },
      aoOptions: { groundY: -0.42, aoRange: 0.9 },
    });

    // Suction cups along underside
    const cupParts = [];
    for (const u of [0.35, 0.52, 0.68, 0.82]) {
      const pt = evalCatmullRom3D(def.curve, u);
      const rTube = 0.165 * (1 - 0.58 * u);
      const rCup = 0.042 * (1 - 0.35 * u);
      cupParts.push(
        transformGeometry(
          createTorus({ majorRadius: rCup, minorRadius: rCup * 0.38, radialSegments: 10, tubularSegments: 16 }),
          {
            translate: [pt[0], pt[1] - rTube * 0.72, pt[2] + rTube * 0.42],
            rotateEuler: [0.5, 0, 0],
          }
        )
      );
    }

    const tMesh = builder.addMesh(`${rootName}_TentacleMesh_${idx}`, [
      { geometry: tubeGeo, material: matSkin },
      { geometry: mergeGeometries(cupParts), material: matSucker },
    ]);

    const tNode = builder.addNode({
      name: includeNamedTentacles ? `Tentacle_${idx}` : `${rootName}_Tentacle_${idx}`,
      mesh: tMesh,
      translation: def.socket,
      parent: rootIdx,
    });

    // Attach wooden cooking spoon/ladle (`LadleArm`) to Tentacle_1
    if (idx === 1) {
      const shaftGeo = createSweptTube(
        [
          [0, -0.18, 0],
          [0, 0.12, -0.02],
          [0, 0.44, -0.05],
        ],
        { tubularSegments: 18, radialSegments: 12, radiusFn: (u) => 0.026 * (1 - 0.15 * u) }
      );
      const spoonBowlGeo = transformGeometry(
        createLathe(
          [
            [0.005, 0.0],
            [0.095, 0.03],
            [0.115, 0.09],
            [0.095, 0.09],
            [0.075, 0.035],
            [0.005, 0.02],
          ],
          { segments: 24 }
        ),
        {
          translate: [0, 0.50, -0.04],
          rotateEuler: [Math.PI * 0.44, 0, 0],
        }
      );
      const ladleMesh = builder.addMesh(`${rootName}_LadleMesh`, [
        { geometry: mergeGeometries([shaftGeo, spoonBowlGeo]), material: matWood },
      ]);
      builder.addNode({
        name: includeNamedTentacles ? 'LadleArm' : `${rootName}_LadleArm`,
        mesh: ladleMesh,
        translation: [0.58, 0.42, 0.30],
        rotation: quatFromEulerXYZ(0.15, 0.12, 0.24),
        parent: tNode,
      });
    }
  });

  return rootIdx;
}

// ---------------------------------------------------------------------------
// Asset 1: `tako-chef-v4.glb`
// ---------------------------------------------------------------------------
function buildTakoChefV4GLB() {
  const builder = new GLBSceneBuilder('TakoChefV4');
  addTakoChefToScene(builder, {
    rootName: 'TakoRoot',
    position: [0, 0, 0],
    uniformScale: 1.0,
    includeNamedTentacles: true,
  });
  return builder.compileGLBBuffer();
}

// ---------------------------------------------------------------------------
// Asset 2: `kitchen-island-hero.glb`
// ---------------------------------------------------------------------------
function buildKitchenIslandHeroGLB() {
  const builder = new GLBSceneBuilder('KitchenIslandHero');

  const matCabinet = builder.addMaterial('Cabinet_Jade', { hex: '#1B6B4A', roughness: 0.52 });
  const matWoodTop = builder.addMaterial('Counter_ButcherOak', { hex: '#C88D56', roughness: 0.44 });
  const matWoodDark = builder.addMaterial('Wood_WalnutTrim', { hex: '#8F5B32', roughness: 0.48 });
  const matBrass = builder.addMaterial('Hardware_Brass', { hex: '#DFA946', roughness: 0.24, metallic: 0.86 });
  const matSteel = builder.addMaterial('Appliance_BrushedSteel', { hex: '#CED7DF', roughness: 0.25, metallic: 0.80 });
  const matObsidian = builder.addMaterial('Induction_Obsidian', { hex: '#1A2228', roughness: 0.16, metallic: 0.35 });
  const matBurnerGlow = builder.addMaterial('Induction_AmberRing', {
    hex: '#FF8438',
    roughness: 0.2,
    emissiveHex: '#FF6B2B',
    emissiveStrength: 1.4,
  });
  const matFridgeLiner = builder.addMaterial('Fridge_WarmGlow', {
    hex: '#FFF9EE',
    roughness: 0.28,
    emissiveHex: '#FFE9BE',
    emissiveStrength: 0.45,
  });
  const matGlass = builder.addMaterial('Fridge_ShelfGlass', {
    hex: '#D6F5EB',
    alpha: 0.48,
    roughness: 0.12,
    doubleSided: true,
  });
  const matClaypot = builder.addMaterial('BatTrang_Claypot', { hex: '#8B3820', roughness: 0.28 });
  const matBraise = builder.addMaterial('Caramel_Braise', { hex: '#A83B16', roughness: 0.15 });
  const matSteam = builder.addMaterial('Culinary_SteamWisp', {
    hex: '#FFFBF5',
    alpha: 0.42,
    roughness: 0.6,
    emissiveHex: '#FFF6EA',
    emissiveStrength: 0.25,
  });
  const matTomato = builder.addMaterial('Ing_Tomato', { hex: '#E13825', roughness: 0.22, subsurface: 0.36 });
  const matEgg = builder.addMaterial('Ing_FarmEgg', { hex: '#F0C396', roughness: 0.34, subsurface: 0.24 });
  const matGreens = builder.addMaterial('Ing_BokChoy', { hex: '#268650', roughness: 0.34, subsurface: 0.28 });
  const matGreensStem = builder.addMaterial('Ing_BokChoyStem', { hex: '#E4F4E6', roughness: 0.32, subsurface: 0.30 });
  const matTofu = builder.addMaterial('Ing_SilkenTofu', { hex: '#FCF4E3', roughness: 0.42, subsurface: 0.38 });
  const matPork = builder.addMaterial('Ing_MarbledCut', { hex: '#DE6556', roughness: 0.36, subsurface: 0.28 });
  const matCeramic = builder.addMaterial('Prep_CeramicIvory', { hex: '#FAF5EC', roughness: 0.20 });

  // Architectural Island Base
  const cabinetGeo = mergeGeometries([
    transformGeometry(createRoundedBox({ width: 2.30, height: 0.82, depth: 1.26, radius: 0.04 }), {
      translate: [0.12, 0.43, 0.12],
    }),
  ], { groundY: 0, aoRange: 0.9 });
  const toeKickGeo = transformGeometry(
    createRoundedBox({ width: 2.16, height: 0.08, depth: 1.12, radius: 0.015 }),
    { translate: [0.12, 0.04, 0.12] }
  );
  const countertopGeo = transformGeometry(
    createRoundedBox({ width: 2.48, height: 0.10, depth: 1.44, radius: 0.03 }),
    { translate: [0.12, 0.88, 0.12] }
  );
  const handlesGeo = mergeGeometries([
    transformGeometry(createRoundedBox({ width: 0.32, height: 0.025, depth: 0.03, radius: 0.01 }), {
      translate: [-0.36, 0.66, 0.77],
    }),
    transformGeometry(createRoundedBox({ width: 0.32, height: 0.025, depth: 0.03, radius: 0.01 }), {
      translate: [0.60, 0.66, 0.77],
    }),
    transformGeometry(createRoundedBox({ width: 0.32, height: 0.025, depth: 0.03, radius: 0.01 }), {
      translate: [-0.36, 0.34, 0.77],
    }),
    transformGeometry(createRoundedBox({ width: 0.32, height: 0.025, depth: 0.03, radius: 0.01 }), {
      translate: [0.60, 0.34, 0.77],
    }),
  ]);

  const islandMesh = builder.addMesh('Island_Architecture', [
    { geometry: cabinetGeo, material: matCabinet },
    { geometry: toeKickGeo, material: matWoodDark },
    { geometry: countertopGeo, material: matWoodTop },
    { geometry: handlesGeo, material: matBrass },
  ]);
  builder.addNode({ name: 'Island_Base', mesh: islandMesh, translation: [0, 0, 0] });

  // 1. Zone_Fridge: Tall Open Smart Fridge at back-left
  const fridgeShell = mergeGeometries([
    transformGeometry(createRoundedBox({ width: 0.96, height: 1.98, depth: 0.10, radius: 0.03 }), {
      translate: [0, 0.99, -0.36],
    }),
    transformGeometry(createRoundedBox({ width: 0.08, height: 1.98, depth: 0.78, radius: 0.025 }), {
      translate: [-0.44, 0.99, 0],
    }),
    transformGeometry(createRoundedBox({ width: 0.08, height: 1.98, depth: 0.78, radius: 0.025 }), {
      translate: [0.44, 0.99, 0],
    }),
    transformGeometry(createRoundedBox({ width: 0.96, height: 0.08, depth: 0.78, radius: 0.025 }), {
      translate: [0, 1.94, 0],
    }),
    transformGeometry(createRoundedBox({ width: 0.96, height: 0.12, depth: 0.78, radius: 0.025 }), {
      translate: [0, 0.06, 0],
    }),
  ], { groundY: 0, aoRange: 1.9 });

  const fridgeGlow = transformGeometry(
    createRoundedBox({ width: 0.80, height: 1.76, depth: 0.03, radius: 0.01 }),
    { translate: [0, 1.00, -0.29] }
  );
  const fridgeShelves = mergeGeometries([
    ...[0.58, 1.04, 1.48].map((sy) =>
      transformGeometry(createRoundedBox({ width: 0.78, height: 0.025, depth: 0.62, radius: 0.008 }), {
        translate: [0, sy, 0.02],
      })
    ),
    // Open glass door swung gently outward on left hinge
    transformGeometry(createRoundedBox({ width: 0.52, height: 1.78, depth: 0.035, radius: 0.012 }), {
      translate: [-0.62, 1.00, 0.56],
      rotateEuler: [0, -0.78, 0],
    }),
  ]);
  const fridgeStockGreens = mergeGeometries([
    transformGeometry(createEllipsoid({ rx: 0.14, ry: 0.10, rz: 0.12 }), { translate: [-0.16, 1.15, 0.05] }),
    transformGeometry(createEllipsoid({ rx: 0.11, ry: 0.09, rz: 0.10 }), { translate: [0.16, 0.69, 0.08] }),
  ]);
  const fridgeCarafe = transformGeometry(
    createLathe(
      [
        [0.005, 0],
        [0.08, 0],
        [0.085, 0.18],
        [0.045, 0.28],
        [0.055, 0.31],
        [0.035, 0.31],
        [0.005, 0.26],
      ],
      { segments: 24 }
    ),
    { translate: [0.18, 1.50, 0.04] }
  );

  const fridgeMesh = builder.addMesh('Zone_Fridge_Mesh', [
    { geometry: fridgeShell, material: matSteel },
    { geometry: fridgeGlow, material: matFridgeLiner },
    { geometry: fridgeShelves, material: matGlass },
    { geometry: fridgeStockGreens, material: matGreens },
    { geometry: fridgeCarafe, material: matCeramic },
  ]);
  builder.addNode({
    name: 'Zone_Fridge',
    mesh: fridgeMesh,
    translation: [-1.32, 0, -0.22],
    rotation: quatFromEulerXYZ(0, 0.24, 0),
    extras: { hotspotId: 'fridge', labelVi: 'Tủ lạnh FEFO' },
  });

  // 2. Zone_Cooktop: Induction Burner + Simmering Bát Tràng Claypot
  const hobGeo = transformGeometry(
    createRoundedBox({ width: 0.84, height: 0.03, depth: 0.72, radius: 0.012 }),
    { translate: [0, 0.015, 0] }
  );
  const burnerRingGeo = transformGeometry(
    createTorus({ majorRadius: 0.24, minorRadius: 0.016, radialSegments: 12, tubularSegments: 36 }),
    { translate: [0, 0.034, 0] }
  );
  const claypotGeo = mergeGeometries([
    createLathe(
      [
        [0.01, 0.03],
        [0.20, 0.03],
        [0.29, 0.12],
        [0.27, 0.24],
        [0.30, 0.27],
        [0.25, 0.27],
        [0.23, 0.12],
        [0.01, 0.08],
      ],
      { segments: 36 }
    ),
    transformGeometry(createTorus({ majorRadius: 0.06, minorRadius: 0.016, arc: Math.PI }), {
      translate: [-0.28, 0.22, 0],
      rotateEuler: [0, Math.PI * 0.5, 0],
    }),
    transformGeometry(createTorus({ majorRadius: 0.06, minorRadius: 0.016, arc: Math.PI }), {
      translate: [0.28, 0.22, 0],
      rotateEuler: [0, -Math.PI * 0.5, 0],
    }),
  ]);
  const braiseFillGeo = transformGeometry(
    createEllipsoid({ rx: 0.235, ry: 0.025, rz: 0.235, widthSegments: 28, heightSegments: 12 }),
    { translate: [0, 0.21, 0] }
  );
  const steamRingsGeo = mergeGeometries([
    transformGeometry(createTorus({ majorRadius: 0.11, minorRadius: 0.012, radialSegments: 10, tubularSegments: 24 }), {
      translate: [0, 0.36, 0],
      rotateEuler: [0.12, 0, -0.08],
    }),
    transformGeometry(createTorus({ majorRadius: 0.16, minorRadius: 0.010, radialSegments: 10, tubularSegments: 24 }), {
      translate: [0.03, 0.48, -0.02],
      rotateEuler: [-0.10, 0, 0.12],
    }),
  ]);

  const cooktopMesh = builder.addMesh('Zone_Cooktop_Mesh', [
    { geometry: hobGeo, material: matObsidian },
    { geometry: burnerRingGeo, material: matBurnerGlow },
    { geometry: claypotGeo, material: matClaypot },
    { geometry: braiseFillGeo, material: matBraise },
    { geometry: steamRingsGeo, material: matSteam },
  ]);
  builder.addNode({
    name: 'Zone_Cooktop',
    mesh: cooktopMesh,
    translation: [-0.36, 0.93, 0.14],
    extras: { hotspotId: 'cooktop', labelVi: 'Bếp Mâm Cơm' },
  });

  // 3. Zone_Prep: Beveled Cutting Board + Chef Knife + Prep Bowl
  const boardGeo = transformGeometry(
    createRoundedBox({ width: 0.74, height: 0.042, depth: 0.54, radius: 0.016 }),
    { translate: [0, 0.021, 0] }
  );
  const knifeBladeGeo = transformGeometry(
    createRoundedBox({ width: 0.28, height: 0.008, depth: 0.065, radius: 0.002 }),
    { translate: [0.06, 0.052, 0.08], rotateEuler: [0, -0.35, 0] }
  );
  const knifeHandleGeo = transformGeometry(
    createRoundedBox({ width: 0.14, height: 0.024, depth: 0.032, radius: 0.008 }),
    { translate: [0.24, 0.056, 0.145], rotateEuler: [0, -0.35, 0] }
  );
  const prepBowlGeo = transformGeometry(
    createLathe(
      [
        [0.01, 0.04],
        [0.09, 0.04],
        [0.14, 0.12],
        [0.12, 0.12],
        [0.07, 0.06],
        [0.01, 0.05],
      ],
      { segments: 28 }
    ),
    { translate: [-0.18, 0.0, -0.10] }
  );
  const prepHerbsGeo = transformGeometry(
    createEllipsoid({ rx: 0.09, ry: 0.035, rz: 0.08 }),
    { translate: [-0.06, 0.055, 0.06] }
  );

  const prepMesh = builder.addMesh('Zone_Prep_Mesh', [
    { geometry: boardGeo, material: matWoodDark },
    { geometry: knifeBladeGeo, material: matSteel },
    { geometry: knifeHandleGeo, material: matObsidian },
    { geometry: prepBowlGeo, material: matCeramic },
    { geometry: prepHerbsGeo, material: matGreens },
  ]);
  builder.addNode({
    name: 'Zone_Prep',
    mesh: prepMesh,
    translation: [0.64, 0.93, 0.16],
    extras: { hotspotId: 'prep', labelVi: 'Quét AI' },
  });

  // 4. Tako_Hero standing cheerfully beside the island!
  addTakoChefToScene(builder, {
    rootName: 'Tako_Hero',
    position: [1.62, 0.0, 0.34],
    rotationY: -0.45,
    uniformScale: 0.68,
    includeNamedTentacles: false,
  });

  // 5. Floating_Ingredients with individually pickable Vietnamese ingredients
  const floatRoot = builder.addNode({
    name: 'Floating_Ingredients',
    translation: [0.12, 1.62, 0.12],
  });

  // Ing_Tomato
  const tomatoMesh = builder.addMesh('Ing_Tomato_Mesh', [
    {
      geometry: createEllipsoid({ rx: 0.105, ry: 0.09, rz: 0.105, widthSegments: 24, heightSegments: 18 }),
      material: matTomato,
    },
    {
      geometry: transformGeometry(createEllipsoid({ rx: 0.045, ry: 0.018, rz: 0.045 }), { translate: [0, 0.088, 0] }),
      material: matGreens,
    },
  ]);
  builder.addNode({
    name: 'Ing_Tomato',
    mesh: tomatoMesh,
    translation: [-0.62, 0.08, 0.18],
    parent: floatRoot,
    extras: { labelVi: 'Cà chua chín mọng', freshness: 'Tươi 98%' },
  });

  // Ing_Egg
  const eggMesh = builder.addMesh('Ing_Egg_Mesh', [
    {
      geometry: createEllipsoid({
        rx: 0.072,
        ry: 0.098,
        rz: 0.072,
        deformFn: (x, y, z) => [x * (1 - 0.18 * (y / 0.1)), y, z * (1 - 0.18 * (y / 0.1))],
      }),
      material: matEgg,
    },
  ]);
  builder.addNode({
    name: 'Ing_Egg',
    mesh: eggMesh,
    translation: [-0.24, 0.24, -0.18],
    rotation: quatFromEulerXYZ(0.22, 0, -0.18),
    parent: floatRoot,
    extras: { labelVi: 'Trứng gà ta', freshness: 'Còn 6 ngày' },
  });

  // Ing_Greens (Bok choy)
  const bokChoyMesh = builder.addMesh('Ing_Greens_Mesh', [
    {
      geometry: createEllipsoid({ rx: 0.065, ry: 0.09, rz: 0.055 }),
      material: matGreensStem,
    },
    {
      geometry: mergeGeometries([
        transformGeometry(createBotanicalLeaf({ width: 0.075, length: 0.16, bend: 0.03 }), {
          translate: [-0.02, 0.04, 0],
          rotateEuler: [0.1, 0, 0.2],
        }),
        transformGeometry(createBotanicalLeaf({ width: 0.075, length: 0.16, bend: -0.03 }), {
          translate: [0.02, 0.04, 0.01],
          rotateEuler: [-0.1, 0, -0.2],
        }),
      ]),
      material: matGreens,
    },
  ]);
  builder.addNode({
    name: 'Ing_Greens',
    mesh: bokChoyMesh,
    translation: [0.22, 0.20, 0.20],
    rotation: quatFromEulerXYZ(0.18, 0.4, -0.25),
    parent: floatRoot,
    extras: { labelVi: 'Cải thìa hữu cơ', freshness: 'Ưu tiên FEFO' },
  });

  // Ing_Tofu
  const tofuMesh = builder.addMesh('Ing_Tofu_Mesh', [
    {
      geometry: createRoundedBox({ width: 0.15, height: 0.10, depth: 0.15, radius: 0.02 }),
      material: matTofu,
    },
    {
      geometry: transformGeometry(createBotanicalLeaf({ width: 0.03, length: 0.08 }), {
        translate: [0, 0.052, 0],
        rotateEuler: [Math.PI * 0.5, 0.3, 0],
      }),
      material: matGreens,
    },
  ]);
  builder.addNode({
    name: 'Ing_Tofu',
    mesh: tofuMesh,
    translation: [0.58, 0.06, -0.10],
    rotation: quatFromEulerXYZ(0.14, 0.5, 0.1),
    parent: floatRoot,
    extras: { labelVi: 'Đậu hũ non làng Mơ', freshness: 'Dùng trong 2 ngày' },
  });

  // Ing_PorkFish
  const porkMesh = builder.addMesh('Ing_PorkFish_Mesh', [
    {
      geometry: createRoundedBox({ width: 0.19, height: 0.075, depth: 0.11, radius: 0.022 }),
      material: matPork,
    },
    {
      geometry: transformGeometry(createRoundedBox({ width: 0.185, height: 0.022, depth: 0.105, radius: 0.008 }), {
        translate: [0, 0.032, 0],
      }),
      material: matTofu,
    },
  ]);
  builder.addNode({
    name: 'Ing_PorkFish',
    mesh: porkMesh,
    translation: [-0.04, 0.34, 0.24],
    rotation: quatFromEulerXYZ(-0.16, -0.35, 0.14),
    parent: floatRoot,
    extras: { labelVi: 'Thịt ba chỉ kho tộ', freshness: 'Ngăn mát • Tươi' },
  });

  // Ing_Chili
  const chiliMesh = builder.addMesh('Ing_Chili_Mesh', [
    {
      geometry: createSweptTube(
        [
          [-0.08, 0, 0],
          [-0.02, -0.02, 0.01],
          [0.05, 0.01, 0],
          [0.10, 0.05, -0.01],
        ],
        { tubularSegments: 16, radialSegments: 10, radiusFn: (u) => 0.026 * (1 - 0.78 * u) }
      ),
      material: matTomato,
    },
    {
      geometry: createSweptTube(
        [
          [-0.11, 0.02, 0],
          [-0.08, 0, 0],
        ],
        { tubularSegments: 6, radialSegments: 8, radiusFn: () => 0.009 }
      ),
      material: matGreens,
    },
  ]);
  builder.addNode({
    name: 'Ing_Chili',
    mesh: chiliMesh,
    translation: [0.44, 0.30, 0.26],
    rotation: quatFromEulerXYZ(0.2, -0.4, 0.3),
    parent: floatRoot,
    extras: { labelVi: 'Ớt hiểm đỏ & Gia vị', freshness: 'Tủ bếp sẵn sàng' },
  });

  return builder.compileGLBBuffer();
}

// ---------------------------------------------------------------------------
// Asset 3: `onboarding-mam-com.glb`
// ---------------------------------------------------------------------------
function buildOnboardingMamComGLB() {
  const builder = new GLBSceneBuilder('OnboardingMamCom');

  const matRattan = builder.addMaterial('MamCom_WovenRattan', { hex: '#C68C53', roughness: 0.52 });
  const matRattanRim = builder.addMaterial('MamCom_TeakRim', { hex: '#9A6332', roughness: 0.46 });
  const matCeramicIvory = builder.addMaterial('BatTrang_IvoryGlaze', { hex: '#FAF5EC', roughness: 0.18 });
  const matCeladon = builder.addMaterial('BatTrang_CeladonJade', { hex: '#2B7A58', roughness: 0.24 });
  const matClaypot = builder.addMaterial('Claypot_TerraGlaze', { hex: '#82341D', roughness: 0.28 });
  const matBraise = builder.addMaterial('KhoTo_CaramelGlaze', { hex: '#A63A16', roughness: 0.14 });
  const matSoup = builder.addMaterial('CanhChua_GoldenBroth', { hex: '#EA9F38', roughness: 0.16 });
  const matGreens = builder.addMaterial('StirFry_JadeGreens', { hex: '#247E4C', roughness: 0.32, subsurface: 0.24 });
  const matRice = builder.addMaterial('Steamed_JasmineRice', { hex: '#FFFDF8', roughness: 0.56, subsurface: 0.35 });
  const matBamboo = builder.addMaterial('Chopstick_SeasonedBamboo', { hex: '#D6A668', roughness: 0.40 });
  const matChili = builder.addMaterial('Spice_BirdseyeChili', { hex: '#DC2B1E', roughness: 0.24, subsurface: 0.25 });
  const matEggYolk = builder.addMaterial('Braised_EggGold', { hex: '#F2AE30', roughness: 0.30 });

  // Circular woven rattan & teak tray (`MamCom_Tray`)
  const trayBaseGeo = createLathe(
    [
      [0.01, 0.0],
      [1.42, 0.0],
      [1.48, 0.08],
      [1.45, 0.13],
      [1.38, 0.05],
      [0.01, 0.05],
    ],
    { segments: 64, aoOptions: { groundY: 0, aoRange: 0.35 } }
  );
  const trayRimGeo = transformGeometry(
    createTorus({ majorRadius: 1.45, minorRadius: 0.036, radialSegments: 14, tubularSegments: 64 }),
    { translate: [0, 0.115, 0] }
  );
  const trayMesh = builder.addMesh('MamCom_Tray_Mesh', [
    { geometry: trayBaseGeo, material: matRattan },
    { geometry: trayRimGeo, material: matRattanRim },
  ]);
  const trayNode = builder.addNode({ name: 'MamCom_Tray', mesh: trayMesh, translation: [0, 0, 0] });

  // Central Shared Dishes
  // 1. Dish_Claypot (Thịt kho trứng)
  const claypotVessel = createLathe(
    [
      [0.01, 0.0],
      [0.24, 0.0],
      [0.33, 0.11],
      [0.31, 0.22],
      [0.34, 0.25],
      [0.28, 0.25],
      [0.26, 0.12],
      [0.01, 0.08],
    ],
    { segments: 40 }
  );
  const claypotSauce = transformGeometry(
    createEllipsoid({ rx: 0.27, ry: 0.025, rz: 0.27 }),
    { translate: [0, 0.19, 0] }
  );
  const claypotEggs = mergeGeometries([
    transformGeometry(createEllipsoid({ rx: 0.065, ry: 0.045, rz: 0.065 }), { translate: [-0.08, 0.21, 0.04] }),
    transformGeometry(createEllipsoid({ rx: 0.065, ry: 0.045, rz: 0.065 }), { translate: [0.09, 0.21, -0.05] }),
  ]);
  const dishClaypotMesh = builder.addMesh('Dish_Claypot_Mesh', [
    { geometry: claypotVessel, material: matClaypot },
    { geometry: claypotSauce, material: matBraise },
    { geometry: claypotEggs, material: matEggYolk },
  ]);
  builder.addNode({
    name: 'Dish_Claypot',
    mesh: dishClaypotMesh,
    translation: [-0.36, 0.05, -0.22],
    parent: trayNode,
  });

  // 2. Dish_Soup (Tô canh chua)
  const soupBowl = createLathe(
    [
      [0.01, 0.0],
      [0.18, 0.0],
      [0.34, 0.15],
      [0.37, 0.24],
      [0.33, 0.24],
      [0.20, 0.08],
      [0.01, 0.05],
    ],
    { segments: 40 }
  );
  const soupFill = transformGeometry(createEllipsoid({ rx: 0.31, ry: 0.02, rz: 0.31 }), {
    translate: [0, 0.19, 0],
  });
  const soupGarnish = mergeGeometries([
    transformGeometry(createEllipsoid({ rx: 0.06, ry: 0.035, rz: 0.04 }), { translate: [-0.09, 0.205, 0.06] }),
    transformGeometry(createEllipsoid({ rx: 0.06, ry: 0.035, rz: 0.04 }), { translate: [0.10, 0.205, -0.05] }),
  ]);
  const soupHerbs = transformGeometry(createEllipsoid({ rx: 0.08, ry: 0.025, rz: 0.06 }), {
    translate: [0.0, 0.21, 0.02],
  });
  const dishSoupMesh = builder.addMesh('Dish_Soup_Mesh', [
    { geometry: soupBowl, material: matCeramicIvory },
    { geometry: soupFill, material: matSoup },
    { geometry: soupGarnish, material: matChili },
    { geometry: soupHerbs, material: matGreens },
  ]);
  builder.addNode({
    name: 'Dish_Soup',
    mesh: dishSoupMesh,
    translation: [0.36, 0.05, -0.20],
    parent: trayNode,
  });

  // 3. Dish_StirFry (Đĩa rau xào tỏi)
  const plateGeo = createLathe(
    [
      [0.01, 0.0],
      [0.26, 0.0],
      [0.38, 0.07],
      [0.35, 0.085],
      [0.22, 0.03],
      [0.01, 0.025],
    ],
    { segments: 40 }
  );
  const stirFryMound = mergeGeometries([
    transformGeometry(createEllipsoid({ rx: 0.23, ry: 0.075, rz: 0.19 }), { translate: [0, 0.07, 0] }),
    transformGeometry(createBotanicalLeaf({ width: 0.08, length: 0.18 }), {
      translate: [-0.06, 0.09, 0.02],
      rotateEuler: [1.3, 0.3, 0.4],
    }),
    transformGeometry(createBotanicalLeaf({ width: 0.08, length: 0.18 }), {
      translate: [0.07, 0.09, -0.03],
      rotateEuler: [1.3, -0.4, -0.3],
    }),
  ]);
  const dishStirFryMesh = builder.addMesh('Dish_StirFry_Mesh', [
    { geometry: plateGeo, material: matCeladon },
    { geometry: stirFryMound, material: matGreens },
  ]);
  builder.addNode({
    name: 'Dish_StirFry',
    mesh: dishStirFryMesh,
    translation: [0.0, 0.05, 0.34],
    parent: trayNode,
  });

  // 4. Dish_Dip & Garnish_Spice (Chén nước mắm ớt)
  const dipBowl = createLathe(
    [
      [0.01, 0.0],
      [0.09, 0.0],
      [0.13, 0.05],
      [0.11, 0.055],
      [0.01, 0.02],
    ],
    { segments: 28 }
  );
  const dipLiquid = transformGeometry(createEllipsoid({ rx: 0.10, ry: 0.012, rz: 0.10 }), {
    translate: [0, 0.038, 0],
  });
  const dipMesh = builder.addMesh('Dish_Dip_Mesh', [
    { geometry: dipBowl, material: matCeramicIvory },
    { geometry: dipLiquid, material: matBraise },
  ]);
  builder.addNode({
    name: 'Dish_Dip',
    mesh: dipMesh,
    translation: [0.0, 0.05, -0.01],
    parent: trayNode,
  });

  const spiceParts = mergeGeometries([
    transformGeometry(createEllipsoid({ rx: 0.024, ry: 0.012, rz: 0.024 }), { translate: [-0.03, 0.05, 0.01] }),
    transformGeometry(createEllipsoid({ rx: 0.024, ry: 0.012, rz: 0.024 }), { translate: [0.03, 0.05, -0.02] }),
    transformGeometry(
      createSweptTube(
        [
          [-0.42, 0.21, -0.18],
          [-0.36, 0.23, -0.22],
          [-0.29, 0.22, -0.24],
        ],
        { tubularSegments: 12, radialSegments: 8, radiusFn: (u) => 0.018 * (1 - 0.65 * u) }
      ),
      {}
    ),
  ]);
  const spiceMesh = builder.addMesh('Garnish_Spice_Mesh', [{ geometry: spiceParts, material: matChili }]);
  builder.addNode({
    name: 'Garnish_Spice',
    mesh: spiceMesh,
    translation: [0.0, 0.05, -0.01],
    parent: trayNode,
  });

  // 5. Shared Reusable Place Setting Mesh (`Place_1`..`Place_5`)
  const riceBowlGeo = createLathe(
    [
      [0.01, 0.0],
      [0.10, 0.0],
      [0.11, 0.025],
      [0.20, 0.11],
      [0.215, 0.165],
      [0.195, 0.165],
      [0.10, 0.045],
      [0.01, 0.035],
    ],
    { segments: 36 }
  );
  const rimBandGeo = transformGeometry(
    createTorus({ majorRadius: 0.206, minorRadius: 0.008, radialSegments: 8, tubularSegments: 36 }),
    { translate: [0, 0.155, 0] }
  );
  const fluffyRiceGeo = transformGeometry(
    createEllipsoid({ rx: 0.18, ry: 0.075, rz: 0.18, widthSegments: 24, heightSegments: 16 }),
    { translate: [0, 0.145, 0] }
  );
  const chopsticksGeo = mergeGeometries([
    createSweptTube(
      [
        [0.25, 0.032, -0.22],
        [0.25, 0.022, 0.22],
      ],
      { tubularSegments: 8, radialSegments: 10, radiusFn: (u) => 0.013 * (1 - 0.38 * u) }
    ),
    createSweptTube(
      [
        [0.295, 0.032, -0.22],
        [0.295, 0.022, 0.22],
      ],
      { tubularSegments: 8, radialSegments: 10, radiusFn: (u) => 0.013 * (1 - 0.38 * u) }
    ),
  ]);
  const chopstickRestGeo = transformGeometry(
    createRoundedBox({ width: 0.09, height: 0.022, depth: 0.028, radius: 0.008 }),
    { translate: [0.272, 0.012, -0.10] }
  );

  const placeMesh = builder.addMesh('Place_Setting_Mesh', [
    { geometry: riceBowlGeo, material: matCeramicIvory },
    { geometry: mergeGeometries([rimBandGeo, chopstickRestGeo]), material: matCeladon },
    { geometry: fluffyRiceGeo, material: matRice },
    { geometry: chopsticksGeo, material: matBamboo },
  ]);

  const placeRadius = 1.02;
  for (let i = 0; i < 5; i++) {
    // Place_1 sits front-center (+Z), then balanced clockwise around the tray
    const angle = (i / 5) * Math.PI * 2;
    const px = Math.sin(angle) * placeRadius;
    const pz = Math.cos(angle) * placeRadius;
    builder.addNode({
      name: `Place_${i + 1}`,
      mesh: placeMesh,
      translation: [px, 0.05, pz],
      rotation: quatFromEulerXYZ(0, angle, 0),
      extras: { seatIndex: i + 1 },
    });
  }

  return builder.compileGLBBuffer();
}

// ---------------------------------------------------------------------------
// Asset 4: `smart-fridge-3zone.glb`
// ---------------------------------------------------------------------------
function buildSmartFridge3ZoneGLB() {
  const builder = new GLBSceneBuilder('SmartFridge3Zone');

  const matChassis = builder.addMaterial('Fridge_BrushedTitanium', {
    hex: '#CBD4DC',
    roughness: 0.26,
    metallic: 0.78,
  });
  const matTrimDark = builder.addMaterial('Fridge_GasketSlate', {
    hex: '#222E36',
    roughness: 0.42,
    metallic: 0.25,
  });
  const matLiner = builder.addMaterial('Fridge_WarmIvoryLiner', {
    hex: '#FCF8F0',
    roughness: 0.30,
    emissiveHex: '#FFF2D6',
    emissiveStrength: 0.22,
  });
  const matGlassCool = builder.addMaterial('Shelf_CoolGlass', {
    hex: '#D4F5EA',
    alpha: 0.46,
    roughness: 0.12,
    doubleSided: true,
  });
  const matGlassFreeze = builder.addMaterial('Shelf_CryoFrost', {
    hex: '#CEE9FF',
    alpha: 0.54,
    roughness: 0.18,
    doubleSided: true,
  });
  const matOakPantry = builder.addMaterial('Pantry_WarmOak', { hex: '#C78E55', roughness: 0.46 });
  const matGreens = builder.addMaterial('Cool_Greens', { hex: '#268750', roughness: 0.34, subsurface: 0.26 });
  const matTomato = builder.addMaterial('Cool_Tomato', { hex: '#DF3A27', roughness: 0.24, subsurface: 0.32 });
  const matDairy = builder.addMaterial('Cool_MilkCeramic', { hex: '#FAF6EE', roughness: 0.18 });
  const matProtein = builder.addMaterial('Freeze_SalmonMeat', { hex: '#DE6356', roughness: 0.34, subsurface: 0.24 });
  const matIce = builder.addMaterial('Freeze_IceBlock', { hex: '#E4F4FF', roughness: 0.14, subsurface: 0.35 });
  const matGrain = builder.addMaterial('Pantry_BurlapGrain', { hex: '#DDA955', roughness: 0.56 });
  const matSauceAmber = builder.addMaterial('Pantry_NuocMamAmber', { hex: '#9E3C1A', roughness: 0.16 });
  const matFreshOrb = builder.addMaterial('Freshness_AmberBeacon', {
    hex: '#F59E0B',
    roughness: 0.16,
    emissiveHex: '#FBBF24',
    emissiveStrength: 1.5,
  });

  // Exterior Sculpted Chassis (`Fridge_Chassis`)
  const chassisParts = mergeGeometries([
    transformGeometry(createRoundedBox({ width: 1.44, height: 2.34, depth: 0.10, radius: 0.04 }), {
      translate: [0, 1.17, -0.38],
    }),
    transformGeometry(createRoundedBox({ width: 0.09, height: 2.34, depth: 0.82, radius: 0.03 }), {
      translate: [-0.675, 1.17, 0],
    }),
    transformGeometry(createRoundedBox({ width: 0.09, height: 2.34, depth: 0.82, radius: 0.03 }), {
      translate: [0.675, 1.17, 0],
    }),
    transformGeometry(createRoundedBox({ width: 1.44, height: 0.09, depth: 0.82, radius: 0.03 }), {
      translate: [0, 2.295, 0],
    }),
    transformGeometry(createRoundedBox({ width: 1.44, height: 0.10, depth: 0.82, radius: 0.03 }), {
      translate: [0, 0.05, 0],
    }),
  ], { groundY: 0, aoRange: 2.2 });

  const dividersGeo = mergeGeometries([
    transformGeometry(createRoundedBox({ width: 1.28, height: 0.055, depth: 0.76, radius: 0.015 }), {
      translate: [0, 1.28, 0.01],
    }),
    transformGeometry(createRoundedBox({ width: 1.28, height: 0.055, depth: 0.76, radius: 0.015 }), {
      translate: [0, 0.66, 0.01],
    }),
  ]);
  const backLinerGeo = transformGeometry(
    createRoundedBox({ width: 1.24, height: 2.12, depth: 0.03, radius: 0.01 }),
    { translate: [0, 1.17, -0.31] }
  );

  const chassisMesh = builder.addMesh('Fridge_Chassis_Mesh', [
    { geometry: chassisParts, material: matChassis },
    { geometry: dividersGeo, material: matTrimDark },
    { geometry: backLinerGeo, material: matLiner },
  ]);
  builder.addNode({ name: 'Fridge_Chassis', mesh: chassisMesh, translation: [0, 0, 0] });

  // 1. Zone_Cool (`Ngăn mát`, Y: 1.32 .. 2.24, local center Y = 1.78)
  const coolShelves = mergeGeometries([
    transformGeometry(createRoundedBox({ width: 1.22, height: 0.025, depth: 0.68, radius: 0.008 }), {
      translate: [0, 0.04, 0.02],
    }),
    transformGeometry(createRoundedBox({ width: 1.22, height: 0.025, depth: 0.68, radius: 0.008 }), {
      translate: [0, -0.38, 0.02],
    }),
  ]);
  const coolVeg = mergeGeometries([
    transformGeometry(createEllipsoid({ rx: 0.18, ry: 0.11, rz: 0.14 }), { translate: [-0.34, 0.16, 0.04] }),
    transformGeometry(createEllipsoid({ rx: 0.13, ry: 0.10, rz: 0.12 }), { translate: [-0.14, -0.26, 0.08] }),
  ]);
  const coolTomatoes = mergeGeometries([
    transformGeometry(createEllipsoid({ rx: 0.075, ry: 0.068, rz: 0.075 }), { translate: [0.02, 0.12, 0.10] }),
    transformGeometry(createEllipsoid({ rx: 0.070, ry: 0.065, rz: 0.070 }), { translate: [0.16, 0.12, 0.05] }),
  ]);
  const coolDairy = mergeGeometries([
    transformGeometry(
      createLathe(
        [
          [0.01, 0],
          [0.09, 0],
          [0.095, 0.20],
          [0.05, 0.30],
          [0.06, 0.33],
          [0.01, 0.31],
        ],
        { segments: 24 }
      ),
      { translate: [0.38, 0.055, 0.02] }
    ),
    transformGeometry(createRoundedBox({ width: 0.28, height: 0.09, depth: 0.20, radius: 0.02 }), {
      translate: [0.28, -0.32, 0.06],
    }),
  ]);
  const coolOrb = transformGeometry(createEllipsoid({ rx: 0.048, ry: 0.048, rz: 0.048 }), {
    translate: [0.52, 0.34, 0.34],
  });

  const zoneCoolMesh = builder.addMesh('Zone_Cool_Mesh', [
    { geometry: coolShelves, material: matGlassCool },
    { geometry: coolVeg, material: matGreens },
    { geometry: coolTomatoes, material: matTomato },
    { geometry: coolDairy, material: matDairy },
    { geometry: coolOrb, material: matFreshOrb },
  ]);
  builder.addNode({
    name: 'Zone_Cool',
    mesh: zoneCoolMesh,
    translation: [0, 1.78, 0],
    extras: { zoneKey: 'cool', labelVi: 'Ngăn mát' },
  });

  // 2. Zone_Freeze (`Ngăn đá`, Y: 0.70 .. 1.25, local center Y = 0.98)
  const freezeTray = mergeGeometries([
    transformGeometry(createRoundedBox({ width: 1.22, height: 0.03, depth: 0.68, radius: 0.008 }), {
      translate: [0, -0.20, 0.02],
    }),
    transformGeometry(createRoundedBox({ width: 0.54, height: 0.16, depth: 0.56, radius: 0.02 }), {
      translate: [0.28, -0.10, 0.04],
    }),
  ]);
  const freezeCuts = mergeGeometries([
    transformGeometry(createRoundedBox({ width: 0.32, height: 0.09, depth: 0.22, radius: 0.022 }), {
      translate: [-0.30, -0.13, 0.06],
      rotateEuler: [0, 0.14, 0],
    }),
    transformGeometry(createRoundedBox({ width: 0.28, height: 0.08, depth: 0.18, radius: 0.02 }), {
      translate: [-0.26, -0.03, -0.02],
      rotateEuler: [0, -0.12, 0],
    }),
  ]);
  const freezeIce = mergeGeometries([
    transformGeometry(createRoundedBox({ width: 0.12, height: 0.10, depth: 0.12, radius: 0.02 }), {
      translate: [0.18, 0.04, 0.08],
    }),
    transformGeometry(createRoundedBox({ width: 0.12, height: 0.10, depth: 0.12, radius: 0.02 }), {
      translate: [0.35, 0.04, 0.04],
    }),
  ]);
  const freezeOrb = transformGeometry(createEllipsoid({ rx: 0.048, ry: 0.048, rz: 0.048 }), {
    translate: [0.52, 0.16, 0.34],
  });

  const zoneFreezeMesh = builder.addMesh('Zone_Freeze_Mesh', [
    { geometry: freezeTray, material: matGlassFreeze },
    { geometry: freezeCuts, material: matProtein },
    { geometry: freezeIce, material: matIce },
    { geometry: freezeOrb, material: matFreshOrb },
  ]);
  builder.addNode({
    name: 'Zone_Freeze',
    mesh: zoneFreezeMesh,
    translation: [0, 0.98, 0],
    extras: { zoneKey: 'freeze', labelVi: 'Ngăn đá' },
  });

  // 3. Zone_Pantry (`Tủ đồ khô`, Y: 0.10 .. 0.64, local center Y = 0.37)
  const pantryCrate = mergeGeometries([
    transformGeometry(createRoundedBox({ width: 1.20, height: 0.14, depth: 0.68, radius: 0.02 }), {
      translate: [0, -0.18, 0.03],
    }),
  ]);
  const pantryRiceSack = mergeGeometries([
    transformGeometry(createEllipsoid({ rx: 0.22, ry: 0.18, rz: 0.18 }), {
      translate: [-0.30, 0.02, 0.04],
    }),
    transformGeometry(createRoundedBox({ width: 0.16, height: 0.18, depth: 0.16, radius: 0.03 }), {
      translate: [0.06, 0.0, 0.04],
    }),
  ]);
  const pantryBottles = mergeGeometries([
    transformGeometry(
      createLathe(
        [
          [0.01, 0],
          [0.065, 0],
          [0.07, 0.18],
          [0.028, 0.27],
          [0.034, 0.31],
          [0.01, 0.31],
        ],
        { segments: 20 }
      ),
      { translate: [0.34, -0.10, 0.08] }
    ),
    transformGeometry(
      createLathe(
        [
          [0.01, 0],
          [0.055, 0],
          [0.055, 0.16],
          [0.06, 0.18],
          [0.01, 0.18],
        ],
        { segments: 20 }
      ),
      { translate: [0.20, -0.10, -0.06] }
    ),
  ]);
  const pantryOrb = transformGeometry(createEllipsoid({ rx: 0.048, ry: 0.048, rz: 0.048 }), {
    translate: [0.52, 0.16, 0.34],
  });

  const zonePantryMesh = builder.addMesh('Zone_Pantry_Mesh', [
    { geometry: pantryCrate, material: matOakPantry },
    { geometry: pantryRiceSack, material: matGrain },
    { geometry: pantryBottles, material: matSauceAmber },
    { geometry: pantryOrb, material: matFreshOrb },
  ]);
  builder.addNode({
    name: 'Zone_Pantry',
    mesh: zonePantryMesh,
    translation: [0, 0.37, 0],
    extras: { zoneKey: 'pantry', labelVi: 'Tủ đồ khô' },
  });

  // Dedicated Expiry Beacon node for dynamic pulsing
  const beaconMesh = builder.addMesh('Expiry_Beacon_Mesh', [
    { geometry: createEllipsoid({ rx: 0.055, ry: 0.055, rz: 0.055 }), material: matFreshOrb },
  ]);
  builder.addNode({
    name: 'Expiry_Beacon',
    mesh: beaconMesh,
    translation: [-0.54, 2.16, 0.38],
  });

  return builder.compileGLBBuffer();
}

// ---------------------------------------------------------------------------
// Asset 5: `culinary-cookware-stage.glb`
// ---------------------------------------------------------------------------
function buildCulinaryCookwareStageGLB() {
  const builder = new GLBSceneBuilder('CulinaryCookwareStage');

  const matHobObsidian = builder.addMaterial('Hob_CeramicObsidian', {
    hex: '#1D252C',
    roughness: 0.18,
    metallic: 0.38,
  });
  const matBrass = builder.addMaterial('Stage_BrushedBrass', {
    hex: '#DFAA48',
    roughness: 0.24,
    metallic: 0.86,
  });
  const matCastIron = builder.addMaterial('Wok_SeasonedCastIron', {
    hex: '#262C31',
    roughness: 0.34,
    metallic: 0.72,
  });
  const matSteel = builder.addMaterial('Cookware_BrushedSteel', {
    hex: '#D4DCE3',
    roughness: 0.20,
    metallic: 0.88,
  });
  const matClayTerra = builder.addMaterial('Claypot_BatTrangTerra', {
    hex: '#8C3921',
    roughness: 0.28,
  });
  const matBraiseSauce = builder.addMaterial('Claypot_CaramelKho', {
    hex: '#A73A15',
    roughness: 0.14,
  });
  const matBrothGold = builder.addMaterial('Stockpot_SimmerBroth', {
    hex: '#E6A138',
    roughness: 0.14,
    subsurface: 0.25,
  });
  const matBamboo = builder.addMaterial('Steamer_WovenBamboo', {
    hex: '#D8A96B',
    roughness: 0.54,
  });
  const matBambooDark = builder.addMaterial('Steamer_RimRattan', {
    hex: '#A7723B',
    roughness: 0.50,
  });
  const matBunIvory = builder.addMaterial('Steamer_FluffyBuns', {
    hex: '#FFFDF8',
    roughness: 0.52,
    subsurface: 0.40,
  });
  const matButcherOak = builder.addMaterial('PrepBoard_EndGrainOak', {
    hex: '#C4874E',
    roughness: 0.44,
  });
  const matGreens = builder.addMaterial('Culinary_JadeGreens', {
    hex: '#258550',
    roughness: 0.32,
    subsurface: 0.26,
  });
  const matCoralFood = builder.addMaterial('Culinary_CoralIngredient', {
    hex: '#E2452E',
    roughness: 0.26,
    subsurface: 0.30,
  });
  const matGoldFood = builder.addMaterial('Culinary_GoldenIngredient', {
    hex: '#F2B238',
    roughness: 0.32,
    subsurface: 0.22,
  });
  const matFlameCore = builder.addMaterial('Burner_FlameCore', {
    hex: '#FF7D36',
    roughness: 0.16,
    emissiveHex: '#FF6B28',
    emissiveStrength: 2.2,
  });

  // Base Stove / Induction Hob (`Burner_Base`)
  const hobBody = mergeGeometries([
    transformGeometry(createRoundedBox({ width: 1.72, height: 0.11, depth: 1.52, radius: 0.035 }), {
      translate: [0, 0.055, 0],
    }),
    // 4 cast-iron pan support prongs
    ...[0, 1, 2, 3].map((k) => {
      const a = (k * Math.PI) / 2 + Math.PI * 0.25;
      return transformGeometry(createRoundedBox({ width: 0.24, height: 0.035, depth: 0.05, radius: 0.008 }), {
        translate: [Math.cos(a) * 0.46, 0.125, Math.sin(a) * 0.46],
        rotateEuler: [0, -a, 0],
      });
    }),
  ], { groundY: 0, aoRange: 0.25 });

  const hobBrassTrim = mergeGeometries([
    transformGeometry(createTorus({ majorRadius: 0.48, minorRadius: 0.012, radialSegments: 10, tubularSegments: 48 }), {
      translate: [0, 0.114, 0],
    }),
    // Front rotary dial knob
    transformGeometry(
      createLathe(
        [
          [0.01, 0],
          [0.065, 0],
          [0.06, 0.045],
          [0.01, 0.045],
        ],
        { segments: 24 }
      ),
      { translate: [0.62, 0.11, 0.56] }
    ),
  ]);

  const burnerBaseMesh = builder.addMesh('Burner_Base_Mesh', [
    { geometry: hobBody, material: matHobObsidian },
    { geometry: hobBrassTrim, material: matBrass },
  ]);
  builder.addNode({ name: 'Burner_Base', mesh: burnerBaseMesh, translation: [0, 0, 0] });

  // Dynamic 3D Burner Flame Ring (`Flame_Ring`)
  const flameJets = [];
  for (let i = 0; i < 16; i++) {
    const theta = (i / 16) * Math.PI * 2;
    flameJets.push(
      transformGeometry(
        createEllipsoid({
          rx: 0.036,
          ry: 0.085,
          rz: 0.036,
          deformFn: (x, y, z) => {
            const taper = 1 - 0.55 * (y / 0.085);
            return [x * taper + 0.015 * (y / 0.085), y + 0.06, z * taper];
          },
        }),
        {
          translate: [Math.cos(theta) * 0.38, 0, Math.sin(theta) * 0.38],
          rotateEuler: [0, -theta, -0.28],
        }
      )
    );
  }
  flameJets.push(
    createTorus({ majorRadius: 0.37, minorRadius: 0.018, radialSegments: 10, tubularSegments: 40 })
  );
  const flameMesh = builder.addMesh('Flame_Ring_Mesh', [
    { geometry: mergeGeometries(flameJets), material: matFlameCore },
  ]);
  builder.addNode({ name: 'Flame_Ring', mesh: flameMesh, translation: [0, 0.125, 0] });

  // -------------------------------------------------------------------------
  // 1. `Rig_Wok` (Cast-Iron Wok + Wooden Handle + Stir-Fry Toss + `Wok_Spatula`)
  // -------------------------------------------------------------------------
  const rigWok = builder.addNode({ name: 'Rig_Wok', translation: [0, 0.15, 0] });

  const wokVessel = mergeGeometries([
    createLathe(
      [
        [0.01, 0.0],
        [0.24, 0.02],
        [0.52, 0.16],
        [0.72, 0.38],
        [0.75, 0.42],
        [0.71, 0.42],
        [0.50, 0.19],
        [0.22, 0.045],
        [0.01, 0.03],
      ],
      { segments: 48, aoOptions: { groundY: 0, aoRange: 0.5 } }
    ),
    // Helper ear loop on right
    transformGeometry(createTorus({ majorRadius: 0.09, minorRadius: 0.02, arc: Math.PI }), {
      translate: [0.73, 0.39, 0],
      rotateEuler: [0.3, -Math.PI * 0.5, 0],
    }),
  ]);
  const wokHandle = createSweptTube(
    [
      [-0.71, 0.38, 0],
      [-0.98, 0.48, 0],
      [-1.26, 0.58, 0],
    ],
    { tubularSegments: 14, radialSegments: 14, radiusFn: (u) => 0.044 + 0.012 * u }
  );
  const wokFerrule = createSweptTube(
    [
      [-0.68, 0.37, 0],
      [-0.78, 0.41, 0],
    ],
    { tubularSegments: 6, radialSegments: 14, radiusFn: () => 0.048 }
  );

  const wokMesh = builder.addMesh('Rig_Wok_BodyMesh', [
    { geometry: wokVessel, material: matCastIron },
    { geometry: wokHandle, material: matButcherOak },
    { geometry: wokFerrule, material: matBrass },
  ]);
  builder.addNode({ name: 'Wok_Vessel', mesh: wokMesh, parent: rigWok });

  // Colorful stir-fry ingredients inside wok (`Wok_TossFood`)
  const tossGreens = mergeGeometries([
    transformGeometry(createBotanicalLeaf({ width: 0.08, length: 0.22 }), {
      translate: [-0.12, 0.12, 0.08],
      rotateEuler: [1.2, 0.4, 0.3],
    }),
    transformGeometry(createBotanicalLeaf({ width: 0.08, length: 0.22 }), {
      translate: [0.14, 0.13, -0.06],
      rotateEuler: [1.3, -0.5, -0.2],
    }),
    transformGeometry(createEllipsoid({ rx: 0.12, ry: 0.045, rz: 0.10 }), { translate: [0, 0.08, 0] }),
  ]);
  const tossCoral = mergeGeometries([
    transformGeometry(createRoundedBox({ width: 0.11, height: 0.06, depth: 0.08, radius: 0.018 }), {
      translate: [-0.08, 0.11, -0.10],
      rotateEuler: [0.2, 0.5, 0.1],
    }),
    transformGeometry(createRoundedBox({ width: 0.10, height: 0.055, depth: 0.08, radius: 0.018 }), {
      translate: [0.12, 0.11, 0.11],
      rotateEuler: [-0.2, -0.3, 0.2],
    }),
  ]);
  const tossGold = mergeGeometries([
    transformGeometry(createEllipsoid({ rx: 0.045, ry: 0.03, rz: 0.045 }), { translate: [0.02, 0.12, 0.14] }),
    transformGeometry(createEllipsoid({ rx: 0.045, ry: 0.03, rz: 0.045 }), { translate: [-0.16, 0.12, 0.02] }),
  ]);
  const tossMesh = builder.addMesh('Wok_TossFood_Mesh', [
    { geometry: tossGreens, material: matGreens },
    { geometry: tossCoral, material: matCoralFood },
    { geometry: tossGold, material: matGoldFood },
  ]);
  builder.addNode({ name: 'Wok_TossFood', mesh: tossMesh, parent: rigWok });

  // Wok Spatula (`Wok_Spatula` child node for tossing animation!)
  const spatulaSteel = mergeGeometries([
    transformGeometry(createRoundedBox({ width: 0.20, height: 0.012, depth: 0.18, radius: 0.005 }), {
      translate: [0, 0, 0],
      rotateEuler: [0, 0, -0.22],
    }),
    createSweptTube(
      [
        [0.08, 0.02, 0],
        [0.38, 0.24, 0],
      ],
      { tubularSegments: 10, radialSegments: 10, radiusFn: () => 0.018 }
    ),
  ]);
  const spatulaGrip = createSweptTube(
    [
      [0.36, 0.225, 0],
      [0.64, 0.43, 0],
    ],
    { tubularSegments: 10, radialSegments: 12, radiusFn: (u) => 0.032 + 0.008 * u }
  );
  const spatulaMesh = builder.addMesh('Wok_Spatula_Mesh', [
    { geometry: spatulaSteel, material: matSteel },
    { geometry: spatulaGrip, material: matButcherOak },
  ]);
  builder.addNode({
    name: 'Wok_Spatula',
    mesh: spatulaMesh,
    translation: [0.08, 0.18, 0.04],
    rotation: quatFromEulerXYZ(0.15, -0.35, 0),
    parent: rigWok,
  });

  // -------------------------------------------------------------------------
  // 2. `Rig_Claypot` (Bát Tràng Nồi Đất + Braise Fill + `Claypot_Lid`)
  // -------------------------------------------------------------------------
  const rigClaypot = builder.addNode({ name: 'Rig_Claypot', translation: [0, 0.14, 0] });

  const claypotBody = mergeGeometries([
    createLathe(
      [
        [0.01, 0.0],
        [0.38, 0.0],
        [0.54, 0.16],
        [0.50, 0.36],
        [0.56, 0.41],
        [0.47, 0.41],
        [0.44, 0.16],
        [0.01, 0.09],
      ],
      { segments: 48, aoOptions: { groundY: 0, aoRange: 0.5 } }
    ),
    transformGeometry(createTorus({ majorRadius: 0.09, minorRadius: 0.024, arc: Math.PI }), {
      translate: [-0.52, 0.32, 0],
      rotateEuler: [0.25, Math.PI * 0.5, 0],
    }),
    transformGeometry(createTorus({ majorRadius: 0.09, minorRadius: 0.024, arc: Math.PI }), {
      translate: [0.52, 0.32, 0],
      rotateEuler: [0.25, -Math.PI * 0.5, 0],
    }),
  ]);
  const claypotBraise = transformGeometry(
    createEllipsoid({ rx: 0.43, ry: 0.03, rz: 0.43, widthSegments: 32, heightSegments: 14 }),
    { translate: [0, 0.31, 0] }
  );
  const claypotChunks = mergeGeometries([
    transformGeometry(createEllipsoid({ rx: 0.09, ry: 0.065, rz: 0.09 }), { translate: [-0.14, 0.34, 0.08] }),
    transformGeometry(createEllipsoid({ rx: 0.09, ry: 0.065, rz: 0.09 }), { translate: [0.15, 0.34, -0.07] }),
    transformGeometry(createRoundedBox({ width: 0.14, height: 0.09, depth: 0.12, radius: 0.025 }), {
      translate: [0.02, 0.33, 0.15],
    }),
  ]);
  const claypotMesh = builder.addMesh('Rig_Claypot_BodyMesh', [
    { geometry: claypotBody, material: matClayTerra },
    { geometry: claypotBraise, material: matBraiseSauce },
    { geometry: claypotChunks, material: matGoldFood },
  ]);
  builder.addNode({ name: 'Claypot_Body', mesh: claypotMesh, parent: rigClaypot });

  const claypotLidGeo = createLathe(
    [
      [0.01, 0.18],
      [0.095, 0.19],
      [0.055, 0.12],
      [0.48, 0.02],
      [0.49, 0.0],
      [0.44, 0.0],
      [0.01, 0.09],
    ],
    { segments: 48 }
  );
  const claypotLidMesh = builder.addMesh('Claypot_Lid_Mesh', [
    { geometry: claypotLidGeo, material: matClayTerra },
  ]);
  builder.addNode({
    name: 'Claypot_Lid',
    mesh: claypotLidMesh,
    translation: [0.06, 0.40, -0.04],
    rotation: quatFromEulerXYZ(-0.10, 0, -0.14),
    parent: rigClaypot,
  });

  // -------------------------------------------------------------------------
  // 3. `Rig_Stockpot` (Brushed Steel Soup Stockpot + `Stockpot_Broth`)
  // -------------------------------------------------------------------------
  const rigStockpot = builder.addNode({ name: 'Rig_Stockpot', translation: [0, 0.14, 0] });

  const stockpotVessel = mergeGeometries([
    createLathe(
      [
        [0.01, 0.0],
        [0.52, 0.0],
        [0.54, 0.50],
        [0.58, 0.54],
        [0.51, 0.54],
        [0.49, 0.06],
        [0.01, 0.05],
      ],
      { segments: 48, aoOptions: { groundY: 0, aoRange: 0.6 } }
    ),
  ]);
  const stockpotHandles = mergeGeometries([
    transformGeometry(createTorus({ majorRadius: 0.11, minorRadius: 0.022, arc: Math.PI }), {
      translate: [-0.54, 0.42, 0],
      rotateEuler: [0.2, Math.PI * 0.5, 0],
    }),
    transformGeometry(createTorus({ majorRadius: 0.11, minorRadius: 0.022, arc: Math.PI }), {
      translate: [0.54, 0.42, 0],
      rotateEuler: [0.2, -Math.PI * 0.5, 0],
    }),
  ]);
  const stockpotMesh = builder.addMesh('Rig_Stockpot_BodyMesh', [
    { geometry: stockpotVessel, material: matSteel },
    { geometry: stockpotHandles, material: matBrass },
  ]);
  builder.addNode({ name: 'Stockpot_Vessel', mesh: stockpotMesh, parent: rigStockpot });

  const brothSurface = createEllipsoid({ rx: 0.485, ry: 0.025, rz: 0.485, widthSegments: 36, heightSegments: 14 });
  const brothTomatoes = mergeGeometries([
    transformGeometry(createEllipsoid({ rx: 0.085, ry: 0.045, rz: 0.06 }), { translate: [-0.18, 0.02, 0.12] }),
    transformGeometry(createEllipsoid({ rx: 0.085, ry: 0.045, rz: 0.06 }), { translate: [0.16, 0.02, -0.14] }),
  ]);
  const brothHerbs = mergeGeometries([
    transformGeometry(createBotanicalLeaf({ width: 0.05, length: 0.14 }), {
      translate: [0.04, 0.025, 0.06],
      rotateEuler: [1.45, 0.3, 0.2],
    }),
    transformGeometry(createBotanicalLeaf({ width: 0.05, length: 0.14 }), {
      translate: [-0.06, 0.025, -0.08],
      rotateEuler: [1.45, -0.4, -0.2],
    }),
  ]);
  const brothMesh = builder.addMesh('Stockpot_Broth_Mesh', [
    { geometry: brothSurface, material: matBrothGold },
    { geometry: brothTomatoes, material: matCoralFood },
    { geometry: brothHerbs, material: matGreens },
  ]);
  builder.addNode({
    name: 'Stockpot_Broth',
    mesh: brothMesh,
    translation: [0, 0.43, 0],
    parent: rigStockpot,
  });

  // -------------------------------------------------------------------------
  // 4. `Rig_Steamer` (Two-Tier Woven Bamboo Steamer + Steamed Buns + `Steamer_Lid`)
  // -------------------------------------------------------------------------
  const rigSteamer = builder.addNode({ name: 'Rig_Steamer', translation: [0, 0.14, 0] });

  const buildTierWall = (yBase) =>
    createLathe(
      [
        [0.01, yBase + 0.02],
        [0.48, yBase + 0.02],
        [0.48, yBase],
        [0.53, yBase],
        [0.53, yBase + 0.22],
        [0.48, yBase + 0.22],
        [0.48, yBase + 0.04],
        [0.01, yBase + 0.04],
      ],
      { segments: 48 }
    );

  const steamerBambooGeo = mergeGeometries([buildTierWall(0), buildTierWall(0.22)], {
    groundY: 0,
    aoRange: 0.55,
  });
  const steamerBandsGeo = mergeGeometries([
    ...[0.03, 0.19, 0.25, 0.41].map((by) =>
      transformGeometry(createTorus({ majorRadius: 0.532, minorRadius: 0.012, radialSegments: 8, tubularSegments: 48 }), {
        translate: [0, by, 0],
      })
    ),
  ]);
  const steamedBunsGeo = mergeGeometries(
    [0, 1, 2, 3, 4].map((idx) => {
      const a = (idx / 5) * Math.PI * 2;
      const r = idx === 4 ? 0 : 0.22;
      return transformGeometry(createEllipsoid({ rx: 0.115, ry: 0.085, rz: 0.115 }), {
        translate: [Math.cos(a) * r, 0.30, Math.sin(a) * r],
      });
    })
  );
  const steamerBodyMesh = builder.addMesh('Rig_Steamer_TiersMesh', [
    { geometry: steamerBambooGeo, material: matBamboo },
    { geometry: steamerBandsGeo, material: matBambooDark },
    { geometry: steamedBunsGeo, material: matBunIvory },
  ]);
  builder.addNode({ name: 'Steamer_Tiers', mesh: steamerBodyMesh, parent: rigSteamer });

  const steamerLidDome = createLathe(
    [
      [0.01, 0.14],
      [0.32, 0.11],
      [0.54, 0.03],
      [0.54, 0.0],
      [0.49, 0.0],
      [0.01, 0.10],
    ],
    { segments: 48 }
  );
  const steamerLidLoop = transformGeometry(
    createTorus({ majorRadius: 0.075, minorRadius: 0.018, arc: Math.PI }),
    { translate: [0, 0.13, 0] }
  );
  const steamerLidMesh = builder.addMesh('Steamer_Lid_Mesh', [
    { geometry: steamerLidDome, material: matBamboo },
    { geometry: steamerLidLoop, material: matBambooDark },
  ]);
  builder.addNode({
    name: 'Steamer_Lid',
    mesh: steamerLidMesh,
    translation: [0.10, 0.44, -0.06],
    rotation: quatFromEulerXYZ(-0.14, 0, -0.18),
    parent: rigSteamer,
  });

  // -------------------------------------------------------------------------
  // 5. `Rig_PrepBoard` (End-Grain Butcher Block + `Prep_Knife` + Chopped Herbs)
  // -------------------------------------------------------------------------
  const rigPrep = builder.addNode({ name: 'Rig_PrepBoard', translation: [0, 0.13, 0] });

  const blockGeo = transformGeometry(
    createRoundedBox({ width: 1.42, height: 0.10, depth: 1.04, radius: 0.028 }),
    { translate: [0, 0.05, 0] }
  );
  const marinateBowlGeo = transformGeometry(
    createLathe(
      [
        [0.01, 0],
        [0.14, 0],
        [0.24, 0.14],
        [0.21, 0.14],
        [0.12, 0.03],
        [0.01, 0.025],
      ],
      { segments: 32 }
    ),
    { translate: [-0.36, 0.10, -0.20] }
  );
  const choppedGreensGeo = mergeGeometries([
    transformGeometry(createEllipsoid({ rx: 0.18, ry: 0.04, rz: 0.14 }), { translate: [-0.08, 0.12, 0.14] }),
    transformGeometry(createBotanicalLeaf({ width: 0.06, length: 0.16 }), {
      translate: [-0.14, 0.13, 0.12],
      rotateEuler: [1.4, 0.4, 0.2],
    }),
    transformGeometry(createEllipsoid({ rx: 0.16, ry: 0.03, rz: 0.16 }), { translate: [-0.36, 0.19, -0.20] }),
  ]);
  const choppedChiliGeo = mergeGeometries([
    transformGeometry(createEllipsoid({ rx: 0.035, ry: 0.018, rz: 0.035 }), { translate: [0.06, 0.115, 0.22] }),
    transformGeometry(createEllipsoid({ rx: 0.035, ry: 0.018, rz: 0.035 }), { translate: [0.12, 0.115, 0.16] }),
    transformGeometry(createRoundedBox({ width: 0.18, height: 0.05, depth: 0.12, radius: 0.016 }), {
      translate: [-0.36, 0.20, -0.20],
    }),
  ]);

  const prepBaseMesh = builder.addMesh('Rig_PrepBoard_BaseMesh', [
    { geometry: blockGeo, material: matButcherOak },
    { geometry: marinateBowlGeo, material: matBunIvory },
    { geometry: choppedGreensGeo, material: matGreens },
    { geometry: choppedChiliGeo, material: matCoralFood },
  ]);
  builder.addNode({ name: 'Prep_Block', mesh: prepBaseMesh, parent: rigPrep });

  // Animated Chef Santoku Knife (`Prep_Knife`)
  const santokuBlade = transformGeometry(
    createRoundedBox({ width: 0.48, height: 0.012, depth: 0.11, radius: 0.003 }),
    { translate: [-0.12, 0, 0] }
  );
  const santokuHandle = transformGeometry(
    createRoundedBox({ width: 0.24, height: 0.038, depth: 0.046, radius: 0.012 }),
    { translate: [0.22, 0.015, 0] }
  );
  const santokuBolster = transformGeometry(
    createRoundedBox({ width: 0.03, height: 0.042, depth: 0.05, radius: 0.006 }),
    { translate: [0.10, 0.012, 0] }
  );
  const knifeMesh = builder.addMesh('Prep_Knife_Mesh', [
    { geometry: santokuBlade, material: matSteel },
    { geometry: santokuHandle, material: matHobObsidian },
    { geometry: santokuBolster, material: matBrass },
  ]);
  builder.addNode({
    name: 'Prep_Knife',
    mesh: knifeMesh,
    translation: [0.24, 0.15, 0.06],
    rotation: quatFromEulerXYZ(0, -0.32, 0),
    parent: rigPrep,
  });

  return builder.compileGLBBuffer();
}

// ---------------------------------------------------------------------------
// Main Execution & Self-Validation
// ---------------------------------------------------------------------------
export async function compileAllGLBAssets(outDir = OUT_3D_DIR) {
  await mkdir(outDir, { recursive: true });

  const targets = [
    ['tako-chef-v4.glb', buildTakoChefV4GLB],
    ['kitchen-island-hero.glb', buildKitchenIslandHeroGLB],
    ['onboarding-mam-com.glb', buildOnboardingMamComGLB],
    ['smart-fridge-3zone.glb', buildSmartFridge3ZoneGLB],
    ['culinary-cookware-stage.glb', buildCulinaryCookwareStageGLB],
  ];

  const results = [];
  for (const [filename, buildFn] of targets) {
    const compiled = buildFn();
    const buf = compiled.buffer;

    // Validate binary glTF 2.0 header & 4-byte alignment
    const magic = buf.readUInt32LE(0);
    const version = buf.readUInt32LE(4);
    const totalLen = buf.readUInt32LE(8);
    const jsonChunkLen = buf.readUInt32LE(12);
    const jsonChunkType = buf.readUInt32LE(16);
    const binOffset = 20 + jsonChunkLen;
    const binChunkLen = buf.readUInt32LE(binOffset);
    const binChunkType = buf.readUInt32LE(binOffset + 4);

    if (
      magic !== 0x46546c67 ||
      version !== 2 ||
      totalLen !== buf.length ||
      totalLen % 4 !== 0 ||
      jsonChunkType !== 0x4e4f534a ||
      binChunkType !== 0x004e4942 ||
      20 + jsonChunkLen + 8 + binChunkLen !== totalLen
    ) {
      throw new Error(`Invalid GLB container structure in ${filename}`);
    }

    const fullPath = resolve(outDir, filename);
    await writeFile(fullPath, buf);
    results.push({
      file: filename,
      kb: Math.round((buf.length / 1024) * 10) / 10,
      meshes: compiled.meshCount,
      nodes: compiled.nodeNames,
    });
  }

  return results;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const summary = await compileAllGLBAssets();
  for (const item of summary) {
    console.log(
      `[GLB OK] ${item.file} (${item.kb} KB, ${item.meshes} meshes) -> nodes: ${item.nodes.join(', ')}`
    );
  }
}
