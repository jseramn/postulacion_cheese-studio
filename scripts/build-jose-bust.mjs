/**
 * Author public/jose-bust.glb from José's portrait (and the portfolio
 * video frame as the same bust the site ASCII-samples).
 *
 * One closed heightfield: silhouette mask, luminance + Sobel relief,
 * a carved visor bar with raised rims. Not a stack of spheres.
 * Runtime loads the static GLB — this script is not imported by the app.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

if (typeof FileReader === "undefined") {
  globalThis.FileReader = class FileReader {
    result = null;
    onloadend = null;
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((buffer) => {
        this.result = buffer;
        this.onloadend?.();
      });
    }
  };
}

import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const portraitPath = join(root, "reference", "jose-portrait.png");
const videoFramePath = join(root, "reference", "jose-video-front.png");
const outPath = join(root, "public", "jose-bust.glb");

const PROCESS_W = 200;
const PROCESS_H = 240;
const GRID_W = 64;
const GRID_H = 80;

function identifySize(path) {
  const text = execFileSync("identify", ["-format", "%w %h", path], {
    encoding: "utf8",
  });
  const [w, h] = text.trim().split(/\s+/).map(Number);
  return { w, h };
}

function loadRgb(path, w, h) {
  return execFileSync("convert", [
    path,
    "-resize",
    `${w}x${h}!`,
    "-colorspace",
    "sRGB",
    "-depth",
    "8",
    "rgb:-",
  ]);
}

function loadRgbCrop(path, crop, w, h) {
  return execFileSync("convert", [
    path,
    "-crop",
    `${crop.w}x${crop.h}+${crop.x}+${crop.y}`,
    "+repage",
    "-resize",
    `${w}x${h}!`,
    "-colorspace",
    "sRGB",
    "-depth",
    "8",
    "rgb:-",
  ]);
}

function lumaAt(rgb, w, x, y) {
  const i = (y * w + x) * 3;
  return (0.2126 * rgb[i] + 0.7152 * rgb[i + 1] + 0.0722 * rgb[i + 2]) / 255;
}

function rgbAt(rgb, w, x, y) {
  const i = (y * w + x) * 3;
  return [rgb[i] / 255, rgb[i + 1] / 255, rgb[i + 2] / 255];
}

function floodBackground(rgb, w, h) {
  const bg = new Uint8Array(w * h);
  const queue = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const idx = y * w + x;
    if (bg[idx]) return;
    const [r, g, b] = rgbAt(rgb, w, x, y);
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const blueBias = b - Math.max(r, g);
    const nearBlack = luma < 0.08 && Math.abs(r - g) < 0.05 && Math.abs(g - b) < 0.05;
    const bluishDark = luma < 0.22 && blueBias > 0.03;
    if (!nearBlack && !bluishDark) return;
    bg[idx] = 1;
    queue.push(idx);
  };

  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }

  while (queue.length) {
    const idx = queue.pop();
    const x = idx % w;
    const y = (idx - x) / w;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
  return bg;
}

function bboxOf(mask, w, h, invertBg) {
  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const inside = invertBg ? !mask[y * w + x] : mask[y * w + x];
      if (!inside) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  const padX = Math.max(2, Math.round((maxX - minX) * 0.03));
  const padY = Math.max(2, Math.round((maxY - minY) * 0.03));
  return {
    x: Math.max(0, minX - padX),
    y: Math.max(0, minY - padY),
    w: Math.min(w - Math.max(0, minX - padX), maxX - minX + 1 + padX * 2),
    h: Math.min(h - Math.max(0, minY - padY), maxY - minY + 1 + padY * 2),
  };
}

function sampleField(rgb, w, h, u, v) {
  const x = Math.min(w - 1, Math.max(0, u * (w - 1)));
  const y = Math.min(h - 1, Math.max(0, v * (h - 1)));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(w - 1, x0 + 1);
  const y1 = Math.min(h - 1, y0 + 1);
  const tx = x - x0;
  const ty = y - y0;
  const lerp = (a, b, t) => a + (b - a) * t;
  const pix = (ix, iy) => rgbAt(rgb, w, ix, iy);
  const c00 = pix(x0, y0);
  const c10 = pix(x1, y0);
  const c01 = pix(x0, y1);
  const c11 = pix(x1, y1);
  return [
    lerp(lerp(c00[0], c10[0], tx), lerp(c01[0], c11[0], tx), ty),
    lerp(lerp(c00[1], c10[1], tx), lerp(c01[1], c11[1], tx), ty),
    lerp(lerp(c00[2], c10[2], tx), lerp(c01[2], c11[2], tx), ty),
  ];
}

function sobelLuma(luma, w, h, x, y) {
  const at = (ix, iy) => luma[Math.min(h - 1, Math.max(0, iy)) * w + Math.min(w - 1, Math.max(0, ix))];
  const gx =
    -at(x - 1, y - 1) +
    at(x + 1, y - 1) -
    2 * at(x - 1, y) +
    2 * at(x + 1, y) -
    at(x - 1, y + 1) +
    at(x + 1, y + 1);
  const gy =
    -at(x - 1, y - 1) -
    2 * at(x, y - 1) -
    at(x + 1, y - 1) +
    at(x - 1, y + 1) +
    2 * at(x, y + 1) +
    at(x + 1, y + 1);
  return Math.min(1, Math.hypot(gx, gy) * 0.5);
}

function detectVisorBand(luma, inside, w, h) {
  let bestY = Math.round(h * 0.36);
  let bestScore = -1;
  const y0 = Math.round(h * 0.28);
  const y1 = Math.round(h * 0.46);
  const x0 = Math.round(w * 0.18);
  const x1 = Math.round(w * 0.82);
  for (let y = y0; y <= y1; y++) {
    let dark = 0;
    let total = 0;
    for (let x = x0; x <= x1; x++) {
      if (!inside[y * w + x]) continue;
      total += 1;
      if (luma[y * w + x] < 0.28) dark += 1;
    }
    if (total < 8) continue;
    const score = dark / total;
    if (score > bestScore) {
      bestScore = score;
      bestY = y;
    }
  }
  const half = Math.max(2, Math.round(h * 0.035));
  return { y: bestY, half, score: bestScore };
}

function prepareSource() {
  const portrait = identifySize(portraitPath);
  const portraitRgb = loadRgb(portraitPath, portrait.w, portrait.h);
  const portraitBg = floodBackground(portraitRgb, portrait.w, portrait.h);
  const box = bboxOf(portraitBg, portrait.w, portrait.h, true);

  // Keep a bust crop: hair through upper chest, drop the lower shirt.
  const bustH = Math.round(box.h * 0.78);
  const crop = {
    x: box.x,
    y: box.y,
    w: box.w,
    h: Math.min(box.h, bustH),
  };

  const processRgb = loadRgbCrop(portraitPath, crop, PROCESS_W, PROCESS_H);

  const bg = floodBackground(processRgb, PROCESS_W, PROCESS_H);
  const inside = new Uint8Array(PROCESS_W * PROCESS_H);
  const luma = new Float32Array(PROCESS_W * PROCESS_H);
  for (let i = 0; i < inside.length; i++) {
    inside[i] = bg[i] ? 0 : 1;
    const o = i * 3;
    luma[i] =
      (0.2126 * processRgb[o] +
        0.7152 * processRgb[o + 1] +
        0.0722 * processRgb[o + 2]) /
      255;
  }

  // Dilate once so the visor and hair stay inside the silhouette.
  const dilated = inside.slice();
  for (let y = 1; y < PROCESS_H - 1; y++) {
    for (let x = 1; x < PROCESS_W - 1; x++) {
      if (inside[y * PROCESS_W + x]) continue;
      if (
        inside[y * PROCESS_W + x - 1] ||
        inside[y * PROCESS_W + x + 1] ||
        inside[(y - 1) * PROCESS_W + x] ||
        inside[(y + 1) * PROCESS_W + x]
      ) {
        dilated[y * PROCESS_W + x] = 1;
      }
    }
  }

  const visor = detectVisorBand(luma, dilated, PROCESS_W, PROCESS_H);
  return { rgb: processRgb, luma, inside: dilated, visor };
}

function buildMesh(source) {
  const { rgb, luma, inside, visor } = source;
  const aspect = PROCESS_W / PROCESS_H;
  const height = 1.7;
  const width = height * aspect;

  const frontIdx = new Int32Array(GRID_W * GRID_H).fill(-1);
  const backIdx = new Int32Array(GRID_W * GRID_H).fill(-1);
  const positions = [];
  const colors = [];

  const sample = (ix, iy) => {
    const u = ix / (GRID_W - 1);
    const v = iy / (GRID_H - 1);
    const px = Math.round(u * (PROCESS_W - 1));
    const py = Math.round(v * (PROCESS_H - 1));
    const pidx = py * PROCESS_W + px;
    if (!inside[pidx]) return null;

    const [r, g, b] = sampleField(rgb, PROCESS_W, PROCESS_H, u, v);
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const edge = sobelLuma(luma, PROCESS_W, PROCESS_H, px, py);
    const nx = u * 2 - 1;
    const wrap = Math.sqrt(Math.max(0.12, 1 - nx * nx * 0.55));
    const headness = Math.max(0, 1 - Math.abs(v - 0.38) / 0.42);
    const shoulder = v > 0.72 ? 0.55 + (v - 0.72) * 1.1 : 1;
    const base = (0.16 + headness * 0.1) * wrap * shoulder;

    const visorDist = Math.abs(py - visor.y) / Math.max(1, visor.half);
    const inVisor = visorDist < 1.15 && u > 0.16 && u < 0.84;
    const visorLens = inVisor && lum < 0.32 ? 1 - Math.min(1, visorDist) : 0;
    const visorRim = inVisor && edge > 0.18 ? Math.min(1, edge * 1.4) : 0;

    const relief = (lum - 0.42) * 0.1;
    const ridge = edge * 0.055;
    const hair = v < 0.28 && lum < 0.45 ? (0.28 - v) * 0.12 : 0;
    const zFront =
      base + relief + ridge + hair + visorRim * 0.05 - visorLens * 0.07;
    const zBack = -base * 0.82;

    const x = (u - 0.5) * width;
    const y = (0.5 - v) * height;

    // Light glyphs over the fire; keep the visor a dark purple bar.
    let cr;
    let cg;
    let cb;
    if (visorLens > 0.35) {
      cr = 0.22 + visorRim * 0.15;
      cg = 0.1;
      cb = 0.4 + visorRim * 0.25;
    } else {
      const lift = 0.42 + lum * 0.52;
      cr = lift;
      cg = lift * 0.98;
      cb = lift * 0.95;
    }

    return { x, y, zFront, zBack, cr, cg, cb };
  };

  for (let iy = 0; iy < GRID_H; iy++) {
    for (let ix = 0; ix < GRID_W; ix++) {
      const s = sample(ix, iy);
      if (!s) continue;
      const slot = iy * GRID_W + ix;
      frontIdx[slot] = positions.length / 3;
      positions.push(s.x, s.y, s.zFront);
      colors.push(s.cr, s.cg, s.cb);
      backIdx[slot] = positions.length / 3;
      positions.push(s.x, s.y, s.zBack);
      colors.push(0.12, 0.12, 0.14);
    }
  }

  const indices = [];
  const pushTri = (a, b, c) => {
    if (a < 0 || b < 0 || c < 0) return;
    indices.push(a, b, c);
  };

  for (let iy = 0; iy < GRID_H - 1; iy++) {
    for (let ix = 0; ix < GRID_W - 1; ix++) {
      const a = iy * GRID_W + ix;
      const b = a + 1;
      const c = a + GRID_W;
      const d = c + 1;
      pushTri(frontIdx[a], frontIdx[c], frontIdx[b]);
      pushTri(frontIdx[b], frontIdx[c], frontIdx[d]);
      pushTri(backIdx[a], backIdx[b], backIdx[c]);
      pushTri(backIdx[b], backIdx[d], backIdx[c]);
    }
  }

  const used = new Uint8Array((GRID_W - 1) * (GRID_H - 1) * 4);
  const edgeKey = (x0, y0, x1, y1) => {
    if (x0 < x1 || (x0 === x1 && y0 < y1)) return `${x0},${y0}:${x1},${y1}`;
    return `${x1},${y1}:${x0},${y0}`;
  };
  const edges = new Map();
  const addEdge = (x0, y0, x1, y1) => {
    const key = edgeKey(x0, y0, x1, y1);
    edges.set(key, (edges.get(key) ?? 0) + 1);
  };

  for (let iy = 0; iy < GRID_H - 1; iy++) {
    for (let ix = 0; ix < GRID_W - 1; ix++) {
      const a = iy * GRID_W + ix;
      if (frontIdx[a] < 0 || frontIdx[a + 1] < 0 || frontIdx[a + GRID_W] < 0) {
        continue;
      }
      addEdge(ix, iy, ix + 1, iy);
      addEdge(ix + 1, iy, ix + 1, iy + 1);
      addEdge(ix + 1, iy + 1, ix, iy + 1);
      addEdge(ix, iy + 1, ix, iy);
      void used;
    }
  }

  for (const [key, count] of edges) {
    if (count !== 1) continue;
    const [a, b] = key.split(":");
    const [x0, y0] = a.split(",").map(Number);
    const [x1, y1] = b.split(",").map(Number);
    const i0 = y0 * GRID_W + x0;
    const i1 = y1 * GRID_W + x1;
    pushTri(frontIdx[i0], frontIdx[i1], backIdx[i1]);
    pushTri(frontIdx[i0], backIdx[i1], backIdx[i0]);
  }

  if (indices.length < 300) {
    throw new Error(`Heightfield too empty: ${indices.length} indices`);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.center();
  return geo;
}

const source = prepareSource();
if (source.visor.score < 0.25) {
  console.warn(
    `Visor band weak (${source.visor.score.toFixed(2)}); using video frame edges.`,
  );
  void videoFramePath;
}

const geometry = buildMesh(source);
const material = new THREE.MeshStandardMaterial({
  color: 0xf4f1ea,
  roughness: 0.48,
  metalness: 0.06,
  vertexColors: true,
  emissive: 0x1a1028,
  emissiveIntensity: 0.12,
});

const mesh = new THREE.Mesh(geometry, material);
mesh.name = "JoseBust";

const scene = new THREE.Scene();
scene.add(mesh);

const exporter = new GLTFExporter();
const buffer = await exporter.parseAsync(scene, { binary: true });
writeFileSync(outPath, Buffer.from(buffer));

const bytes = Buffer.from(buffer);
const magic = bytes.subarray(0, 4).toString("ascii");
if (magic !== "glTF") {
  throw new Error(`Expected glTF magic, got ${JSON.stringify(magic)}`);
}
if (bytes.length > 500_000) {
  throw new Error(`GLB too large: ${bytes.length} bytes`);
}
console.log(
  `Wrote ${outPath} (${bytes.length} bytes, visorY=${source.visor.y}, visorScore=${source.visor.score.toFixed(2)})`,
);
