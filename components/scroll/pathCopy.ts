/** Tall tileable rail: Wispr textPath on cubics, Skiper-style stroke grows down the page. */

export type Point = { x: number; y: number };
export type Segment = { c1: Point; c2: Point; end: Point };
export type PathState = { start: Point; segments: Segment[] };

export const SCROLL_COPY = "CHEESE STACK DEVELOPER";
/** Density for the design module (~2000 units). Runtime copies scale with module height. */
export const COPIES_PER_MODULE = 16;

export const VIEW_W = 1100;
/** Authored module span. Runtime layout may scale this so one module is 2800vh. */
export const MODULE_H = 2000;

/** Annotated capsule was the START HEIGHT of generation, not a prison. */
export const BAND_TOP_VH = 78;
export const BAND_BOTTOM_VH = 91;

/**
 * Matches TRACK_VH_PER_MODULE in scrollClock.ts.
 * Kept local so pathCopy does not import the clock (circular).
 */
const TRACK_VH = 2800;

/**
 * Design-space Y where the letter line begins, matching ~78vh at scroll 0
 * when one module occupies TRACK_VH_PER_MODULE (2800vh).
 * 78 / 2800 * 2000 ≈ 55.7
 */
export const PATH_DROP_Y = (BAND_TOP_VH / TRACK_VH) * MODULE_H;

/** Hug the frame: ~4% / ~96% of VIEW_W, not a 21% inset. */
const X_MIN = 0.04 * VIEW_W;
const X_MAX = 0.96 * VIEW_W;
const X_SPAN = X_MAX - X_MIN;

/**
 * Rounded-rect / running-track corners. Radius is 18% of VIEW_W — enough that
 * textPath glyphs (LETTER_SIZE≈34) do not stack on a 90° kink, but not a
 * semicircle that parks the weave at nx=0.5. Kappa = 4/3 tan(π/8) for a cubic
 * quarter-ellipse. ny is short vs the 2800vh module so verticals stay on-edge.
 */
const CORNER_R_VIEW = 0.18;
const CORNER_NX = (CORNER_R_VIEW * VIEW_W) / X_SPAN;
const CORNER_NY = 0.014;
const KAPPA = 0.55228475;
const K_NX = KAPPA * CORNER_NX;
const K_NY = KAPPA * CORNER_NY;
const IK_NY = (1 - KAPPA) * CORNER_NY;
const NX_INNER_R = 1 - CORNER_NX;
const NX_INNER_L = CORNER_NX;

function xAt(t: number): number {
  return X_MIN + t * X_SPAN;
}

function yAt(t: number, dropY: number, moduleH: number): number {
  return dropY + t * moduleH;
}

function pt(nx: number, ny: number, dropY: number, moduleH: number): Point {
  return { x: xAt(nx), y: yAt(ny, dropY, moduleH) };
}

/**
 * Tileable running-track S (nx, ny in ~0–1). Opening = gentle wave from
 * left-ish going right, rounded onto the right column, long edge hug, short
 * bridge after a rounded corner, long left column, join. End x = start x.
 * No ny < 0. Incoming tangent at ny=1 matches outgoing at ny=0 (C1 join).
 *
 * Crossing ny is a thin band (~0.49) — walk-pin at 50vh lands on an edge
 * column, not mid-x. Cheeses at t=0.34 (right) and t=0.84 (left) still sit
 * on those columns (right vertical ~0.02–0.48, left ~0.52–0.99).
 */
const UNIT_START_NX = 0.12;
const WAVE_Y = 0.008;
const RIGHT_TOP = WAVE_Y + CORNER_NY;
const CROSS_Y = 0.48;
const BRIDGE_Y = CROSS_Y + CORNER_NY;
const LEFT_TOP = BRIDGE_Y + CORNER_NY;
const JOIN_Y = 1 - CORNER_NY;

const UNIT: Array<{ c1: [number, number]; c2: [number, number]; end: [number, number] }> = [
  // Opening wave (image-5 gentle, from ~78vh). First handle locked to tile C1.
  { c1: [0.2, 0.002], c2: [0.373, 0], end: [0.5, 0.003] },
  {
    c1: [0.627, 0.006],
    c2: [NX_INNER_R - K_NX, WAVE_Y],
    end: [NX_INNER_R, WAVE_Y],
  },
  // Top-right quarter (rightward → down).
  {
    c1: [NX_INNER_R + K_NX, WAVE_Y],
    c2: [1, WAVE_Y + IK_NY],
    end: [1, RIGHT_TOP],
  },
  // Right edge column (rest 1 lives here).
  { c1: [1, RIGHT_TOP + K_NY], c2: [1, CROSS_Y - K_NY], end: [1, CROSS_Y] },
  // Bottom-right quarter (down → left), then a short bridge — do not linger at nx=0.5.
  {
    c1: [1, CROSS_Y + K_NY],
    c2: [NX_INNER_R + K_NX, BRIDGE_Y],
    end: [NX_INNER_R, BRIDGE_Y],
  },
  {
    c1: [NX_INNER_R - K_NX, BRIDGE_Y],
    c2: [NX_INNER_L + K_NX, BRIDGE_Y],
    end: [NX_INNER_L, BRIDGE_Y],
  },
  // Bottom-left quarter (left → down).
  {
    c1: [NX_INNER_L - K_NX, BRIDGE_Y],
    c2: [0, BRIDGE_Y + IK_NY],
    end: [0, LEFT_TOP],
  },
  // Left edge column (rest 2 lives here).
  { c1: [0, LEFT_TOP + K_NY], c2: [0, JOIN_Y - K_NY], end: [0, JOIN_Y] },
  // Exit onto the next tile's wave. Last c2 locked to tile C1 (0.08, 0.002).
  { c1: [0, JOIN_Y + K_NY], c2: [0.04, 0.998], end: [0.12, 1] },
];

export function buildModulePath(dropY = PATH_DROP_Y, moduleH = MODULE_H): PathState {
  return {
    start: pt(UNIT_START_NX, 0, dropY, moduleH),
    segments: UNIT.map((segment) => ({
      c1: pt(segment.c1[0], segment.c1[1], dropY, moduleH),
      c2: pt(segment.c2[0], segment.c2[1], dropY, moduleH),
      end: pt(segment.end[0], segment.end[1], dropY, moduleH),
    })),
  };
}

export const MODULE_PATH: PathState = buildModulePath();

export type PathLayout = {
  dropY: number;
  moduleH: number;
  viewH: (modules: number) => number;
};

/** Uniform SVG scale: one vertical module is `vhPerModule` tall at the current width. */
export function layoutMetrics(
  width: number,
  viewportH: number,
  vhPerModule: number,
): PathLayout {
  const w = Math.max(1, width);
  const vh = Math.max(1, viewportH);
  const moduleH = (vhPerModule / 100) * vh * (VIEW_W / w);
  const dropY = (BAND_TOP_VH / 100) * vh * (VIEW_W / w);
  return {
    dropY,
    moduleH,
    viewH: (modules: number) => dropY + Math.max(1, modules) * moduleH,
  };
}

const round = (n: number) => Math.round(n * 1000) / 1000;

export function tiledCopy(repeats: number): string {
  const count = Math.max(2, repeats);
  return Array.from({ length: count }, () => SCROLL_COPY).join(" ");
}

export function toPathD({ start, segments }: PathState): string {
  let d = `M${round(start.x)} ${round(start.y)}`;
  for (const segment of segments) {
    d += `C${round(segment.c1.x)} ${round(segment.c1.y)} ${round(segment.c2.x)} ${round(segment.c2.y)} ${round(segment.end.x)} ${round(segment.end.y)}`;
  }
  return d;
}

function shiftPoint(point: Point, dy: number): Point {
  return { x: point.x, y: point.y + dy };
}

/** Repeat the module downward. Infinite generation appends below. */
export function tilePath(unit: PathState, modules: number, moduleH = MODULE_H): PathState {
  const count = Math.max(1, modules);
  const segments: Segment[] = [];
  for (let i = 0; i < count; i++) {
    const dy = i * moduleH;
    for (const segment of unit.segments) {
      segments.push({
        c1: shiftPoint(segment.c1, dy),
        c2: shiftPoint(segment.c2, dy),
        end: shiftPoint(segment.end, dy),
      });
    }
  }
  return { start: unit.start, segments };
}

export function viewHeight(modules = 1, dropY = PATH_DROP_Y, moduleH = MODULE_H): number {
  return dropY + Math.max(1, modules) * moduleH;
}

export function viewBoxFor(modules = 1, dropY = PATH_DROP_Y, moduleH = MODULE_H): string {
  return `0 0 ${VIEW_W} ${viewHeight(modules, dropY, moduleH)}`;
}

export type RailNearYSide = "left" | "right" | "any";
export type RailSampleY = (point: { x: number; y: number }) => number;

/**
 * Sample a rail span and pick the point nearest targetY.
 * Pass `yOf` to compare in viewport/CSS space (walk pin). `side: "any"`
 * skips the left/right bias so we stay on the lettered stroke.
 */
export function pointOnRailNearY(
  rail: SVGPathElement,
  targetY: number,
  side: RailNearYSide,
  alongStart: number,
  alongEnd: number,
  midX = VIEW_W / 2,
  yOf?: RailSampleY,
  preferAlong?: number,
): { x: number; y: number; along: number } {
  const total = rail.getTotalLength();
  const start = Math.max(0, Math.min(total, alongStart));
  const end = Math.max(start, Math.min(total, alongEnd));
  const span = Math.max(1, end - start);
  const steps = yOf
    ? Math.min(720, Math.max(280, Math.round(span / 8)))
    : 320;
  let bestAlong = start;
  let best = rail.getPointAtLength(start);
  let bestScore = Number.POSITIVE_INFINITY;
  const sampleY = yOf ?? ((point) => point.y);
  for (let i = 0; i <= steps; i++) {
    const along = start + (span * i) / steps;
    const point = rail.getPointAtLength(along);
    const onSide =
      side === "any"
        ? true
        : side === "left"
          ? point.x <= midX
          : point.x >= midX;
    const continuity =
      preferAlong != null ? Math.abs(along - preferAlong) * 1e-4 : 0;
    const score =
      Math.abs(sampleY(point) - targetY) + (onSide ? 0 : 500) + continuity;
    if (score < bestScore) {
      bestScore = score;
      best = point;
      bestAlong = along;
    }
  }
  return { x: best.x, y: best.y, along: bestAlong };
}

export type RailLutSample = { along: number; x: number; y: number };

export type RailLut = {
  samples: RailLutSample[];
  totalLength: number;
  pathD: string;
};

/** SVG-user-unit spacing for walk-pin samples. Built on geometry, not per tick. */
export const RAIL_LUT_STEP = 16;
/** |along| this tick ≤ |scrollDelta| / scale * this. Keeps a 130px wheel on the bridge. */
const ALONG_SCROLL_FACTOR = 2;
/** Screen-Y span below this (px) is a flat bridge — walk along, do not nearest-Y. */
const FLAT_Y_PX = 16;
/** Horizontal only: max along (SVG units) per pin. X_SPAN≈1012; ~8 wheels to cross. */
const FLAT_ALONG_STEP_MAX = X_SPAN / 8;

export function buildRailLut(
  rail: SVGPathElement,
  pathD: string,
  step = RAIL_LUT_STEP,
): RailLut {
  const totalLength = rail.getTotalLength();
  const samples: RailLutSample[] = [];
  if (totalLength <= 0) {
    return { samples, totalLength: 0, pathD };
  }
  const stride = Math.max(1, step);
  for (let along = 0; along < totalLength; along += stride) {
    const point = rail.getPointAtLength(along);
    samples.push({ along, x: point.x, y: point.y });
  }
  const last = samples[samples.length - 1];
  if (!last || last.along < totalLength) {
    const point = rail.getPointAtLength(totalLength);
    samples.push({ along: totalLength, x: point.x, y: point.y });
  }
  return { samples, totalLength, pathD };
}

function lutIndexAtAlong(samples: RailLutSample[], along: number): number {
  let lo = 0;
  let hi = samples.length - 1;
  if (hi <= 0) return 0;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].along < along) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0) {
    const prev = samples[lo - 1];
    const cur = samples[lo];
    if (Math.abs(prev.along - along) <= Math.abs(cur.along - along)) {
      return lo - 1;
    }
  }
  return lo;
}

function lastIndexAtMostAlong(samples: RailLutSample[], maxAlong: number): number {
  let lo = 0;
  let hi = samples.length - 1;
  let found = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].along <= maxAlong) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

function sampleScreenY(
  sample: RailLutSample,
  svgTop: number,
  scale: number,
): number {
  return svgTop + sample.y * scale;
}

function bestIndexInRange(
  samples: RailLutSample[],
  start: number,
  end: number,
  targetScreenY: number,
  svgTop: number,
  scale: number,
  preferAlong: number,
  stride = 1,
): { index: number; err: number } {
  let best = start;
  let bestErr = Number.POSITIVE_INFINITY;
  let bestScore = Number.POSITIVE_INFINITY;
  const step = Math.max(1, stride);
  for (let i = start; i <= end; i += step) {
    const sample = samples[i];
    const err = Math.abs(sampleScreenY(sample, svgTop, scale) - targetScreenY);
    const score = err + Math.abs(sample.along - preferAlong) * 1e-4;
    if (score < bestScore) {
      bestScore = score;
      bestErr = err;
      best = i;
    }
  }
  if (step > 1 && (end - start) % step !== 0) {
    const sample = samples[end];
    const err = Math.abs(sampleScreenY(sample, svgTop, scale) - targetScreenY);
    const score = err + Math.abs(sample.along - preferAlong) * 1e-4;
    if (score < bestScore) {
      bestErr = err;
      best = end;
    }
  }
  return { index: best, err: bestErr };
}

function sampleAtAlong(
  samples: RailLutSample[],
  along: number,
  hiCap: number,
): RailLutSample {
  const i = Math.min(hiCap, lutIndexAtAlong(samples, along));
  const cur = samples[i];
  const blend = (a: RailLutSample, b: RailLutSample): RailLutSample | null => {
    const span = b.along - a.along;
    if (span === 0) return null;
    const t = (along - a.along) / span;
    if (t < 0 || t > 1) return null;
    return {
      along,
      x: a.x + t * (b.x - a.x),
      y: a.y + t * (b.y - a.y),
    };
  };
  if (i > 0) {
    const left = blend(samples[i - 1], cur);
    if (left) return left;
  }
  if (i < hiCap) {
    const right = blend(cur, samples[i + 1]);
    if (right) return right;
  }
  return { ...cur, along };
}

function windowYSpanPx(
  samples: RailLutSample[],
  start: number,
  end: number,
  svgTop: number,
  scale: number,
): number {
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (let i = start; i <= end; i++) {
    const screenY = sampleScreenY(samples[i], svgTop, scale);
    if (screenY < minY) minY = screenY;
    if (screenY > maxY) maxY = screenY;
  }
  return maxY - minY;
}

function interpolatePin(
  samples: RailLutSample[],
  index: number,
  hiCap: number,
  targetScreenY: number,
  svgTop: number,
  scale: number,
): RailLutSample {
  const cur = samples[index];
  const curY = sampleScreenY(cur, svgTop, scale);
  const blend = (neighbor: RailLutSample): RailLutSample | null => {
    const neighborY = sampleScreenY(neighbor, svgTop, scale);
    const denom = neighborY - curY;
    if (denom === 0) return null;
    const t = (targetScreenY - curY) / denom;
    if (t < 0 || t > 1) return null;
    return {
      along: cur.along + t * (neighbor.along - cur.along),
      x: cur.x + t * (neighbor.x - cur.x),
      y: cur.y + t * (neighbor.y - cur.y),
    };
  };
  if (index > 0) {
    const left = blend(samples[index - 1]);
    if (left) return left;
  }
  if (index < hiCap) {
    const right = blend(samples[index + 1]);
    if (right) return right;
  }
  return cur;
}

/**
 * Walk pin on a prebuilt LUT. Screen Y is `svgTop + y * scale` — one
 * getBoundingClientRect for the SVG, no getScreenCTM per sample.
 * Search only lastAlong ± alongCap (from scrollDelta). Never 0..hiCap nearest-Y.
 */
export function pinOnRailFromLut(
  lut: RailLut,
  targetScreenY: number,
  svgTop: number,
  scale: number,
  lastAlong: number,
  maxAlong: number,
  scrollDelta = 0,
): { x: number; y: number; along: number } {
  const { samples, totalLength } = lut;
  if (samples.length === 0) {
    return { x: 0, y: 0, along: 0 };
  }
  const cap = Math.max(0, Math.min(totalLength, maxAlong));
  const hiCap = lastIndexAtMostAlong(samples, cap);
  const prefer = Math.max(0, Math.min(cap, lastAlong));
  const safeScale = Math.max(scale, 1e-6);
  const alongCapRaw = (Math.abs(scrollDelta) / safeScale) * ALONG_SCROLL_FACTOR;
  const alongStepRaw = (scrollDelta / safeScale) * ALONG_SCROLL_FACTOR;
  const pad = RAIL_LUT_STEP * 2;
  const neighLoAlong = Math.max(0, prefer - pad);
  const neighHiAlong = Math.min(cap, prefer + pad);
  const neighLo = Math.min(hiCap, lutIndexAtAlong(samples, neighLoAlong));
  const neighHi = lastIndexAtMostAlong(samples, neighHiAlong);
  const ySpanPx = windowYSpanPx(samples, neighLo, neighHi, svgTop, scale);
  const isFlat = ySpanPx <= FLAT_Y_PX;

  let alongCap = alongCapRaw;
  let alongStep = alongStepRaw;
  if (isFlat) {
    alongStep = Math.max(-FLAT_ALONG_STEP_MAX, Math.min(FLAT_ALONG_STEP_MAX, alongStepRaw));
    alongCap = Math.min(alongCapRaw, FLAT_ALONG_STEP_MAX);
  }
  const destAlong = Math.max(0, Math.min(cap, prefer + alongStep));
  const winLoAlong = Math.max(0, Math.min(prefer, destAlong) - pad);
  const winHiAlong = Math.min(cap, Math.max(prefer, destAlong) + pad);
  const winLo = Math.min(hiCap, lutIndexAtAlong(samples, winLoAlong));
  const winHi = lastIndexAtMostAlong(samples, winHiAlong);

  let chosen: { x: number; y: number; along: number };
  if (isFlat) {
    chosen = sampleAtAlong(samples, destAlong, hiCap);
  } else {
    const local = bestIndexInRange(
      samples,
      winLo,
      winHi,
      targetScreenY,
      svgTop,
      scale,
      destAlong,
    );
    chosen = interpolatePin(samples, local.index, hiCap, targetScreenY, svgTop, scale);
  }

  const maxDelta = Math.max(alongCap, RAIL_LUT_STEP);
  if (Math.abs(chosen.along - prefer) > maxDelta + 1e-6) {
    const clampedAlong = prefer + Math.sign(chosen.along - prefer) * maxDelta;
    chosen = sampleAtAlong(
      samples,
      Math.max(0, Math.min(cap, clampedAlong)),
      hiCap,
    );
  }

  return chosen;
}

export function modulePathD(
  modules: number,
  dropY = PATH_DROP_Y,
  moduleH = MODULE_H,
): string {
  return toPathD(tilePath(buildModulePath(dropY, moduleH), modules, moduleH));
}

export function svgCssHeight(
  modules: number,
  width: number,
  dropY = PATH_DROP_Y,
  moduleH = MODULE_H,
): number {
  return (Math.max(1, width) * viewHeight(modules, dropY, moduleH)) / VIEW_W;
}
