export type Point = { x: number; y: number };
export type Segment = { c1: Point; c2: Point; end: Point };
export type Motif = { start: Point; segments: Segment[] };
export type Tiling = { width: number; pitch: number };
export type Pattern = { motif: Motif; tiling: Tiling };

export type EdgeRail = {
  width: number;
  pitch: number;
  left: number;
  right: number;
  radius: number;
  topCrossY: number;
  midCrossY: number;
  tilt: number;
};

export const EDGE_RAIL: EdgeRail = {
  width: 1100,
  pitch: 2000,
  left: 48,
  right: 1052,
  radius: 110,
  topCrossY: 160,
  midCrossY: 1160,
  tilt: 32,
};

const ROUND = 1000;
const KAPPA = 0.5523;

const round = (n: number) => Math.round(n * ROUND) / ROUND;
const rp = (p: Point): Point => ({ x: round(p.x), y: round(p.y) });

function verticalCubic(from: Point, to: Point): Segment {
  const dy = to.y - from.y;
  return {
    c1: rp({ x: from.x, y: from.y + dy / 3 }),
    c2: rp({ x: from.x, y: from.y + (2 * dy) / 3 }),
    end: rp(to),
  };
}

function horizontalCrossing(from: Point, to: Point): Segment {
  const dx = to.x - from.x;
  return {
    c1: rp({ x: from.x + dx / 3, y: from.y }),
    c2: rp({ x: from.x + (2 * dx) / 3, y: to.y }),
    end: rp(to),
  };
}

/** Quarter corner: start tangent `fromDir` → end tangent `toDir`. */
function quarterCorner(
  from: Point,
  to: Point,
  fromDir: "down" | "right" | "left",
  toDir: "right" | "down" | "left",
  radius: number,
): Segment {
  const k = KAPPA * radius;
  let c1: Point;
  let c2: Point;
  if (fromDir === "down" && toDir === "right") {
    c1 = { x: from.x, y: from.y + k };
    c2 = { x: to.x - k, y: to.y };
  } else if (fromDir === "right" && toDir === "down") {
    c1 = { x: from.x + k, y: from.y };
    c2 = { x: to.x, y: to.y - k };
  } else if (fromDir === "down" && toDir === "left") {
    c1 = { x: from.x, y: from.y + k };
    c2 = { x: to.x + k, y: to.y };
  } else if (fromDir === "left" && toDir === "down") {
    c1 = { x: from.x - k, y: from.y };
    c2 = { x: to.x, y: to.y - k };
  } else {
    throw new Error(`unsupported quarter ${fromDir}→${toDir}`);
  }
  return { c1: rp(c1), c2: rp(c2), end: rp(to) };
}

/**
 * One tileable edge-rail motif: left column → top cross → right column →
 * mid cross → left column, C1-continuous cubics throughout.
 */
export function edgeMotif(r: EdgeRail): Motif {
  const { left: L, right: R, radius: rad, topCrossY: T, midCrossY: M, tilt, pitch } =
    r;
  const start = rp({ x: L, y: 0 });
  const segments: Segment[] = [
    verticalCubic(start, { x: L, y: T - rad }),
    quarterCorner(
      { x: L, y: T - rad },
      { x: L + rad, y: T },
      "down",
      "right",
      rad,
    ),
    horizontalCrossing(
      { x: L + rad, y: T },
      { x: R - rad, y: T + tilt * 0.2 },
    ),
    quarterCorner(
      { x: R - rad, y: T + tilt * 0.2 },
      { x: R, y: T + rad },
      "right",
      "down",
      rad,
    ),
    verticalCubic({ x: R, y: T + rad }, { x: R, y: M - rad }),
    quarterCorner(
      { x: R, y: M - rad },
      { x: R - rad, y: M },
      "down",
      "left",
      rad,
    ),
    horizontalCrossing(
      { x: R - rad, y: M },
      { x: L + rad, y: M + tilt },
    ),
    quarterCorner(
      { x: L + rad, y: M + tilt },
      { x: L, y: M + tilt + rad },
      "left",
      "down",
      rad,
    ),
    verticalCubic({ x: L, y: M + tilt + rad }, { x: L, y: pitch }),
  ];
  return { start, segments };
}

export const EDGE_PATTERN: Pattern = {
  motif: edgeMotif(EDGE_RAIL),
  tiling: { width: EDGE_RAIL.width, pitch: EDGE_RAIL.pitch },
};

export function tileTransform(
  tiling: Tiling,
  i: number,
): (p: Point) => Point {
  return (p) => ({ x: p.x, y: p.y + i * tiling.pitch });
}

function fmt(n: number): string {
  return String(round(n));
}

function appendCubic(d: string, c1: Point, c2: Point, end: Point): string {
  return `${d}C${fmt(c1.x)} ${fmt(c1.y)} ${fmt(c2.x)} ${fmt(c2.y)} ${fmt(end.x)} ${fmt(end.y)}`;
}

function mapMotif(motif: Motif, xf: (p: Point) => Point): Motif {
  return {
    start: xf(motif.start),
    segments: motif.segments.map((s) => ({
      c1: xf(s.c1),
      c2: xf(s.c2),
      end: xf(s.end),
    })),
  };
}

/** Concatenate tiles. EDGE_PATTERN ends meet the next start exactly (gap 0). */
export function buildInfinitePath(pattern: Pattern, tiles: number): string {
  const count = Math.max(0, Math.floor(tiles));
  if (count === 0 || pattern.motif.segments.length === 0) return "";

  const { motif, tiling } = pattern;
  let d = "";
  for (let i = 0; i < count; i++) {
    const tile = mapMotif(motif, tileTransform(tiling, i));
    if (i === 0) {
      d = `M${fmt(tile.start.x)} ${fmt(tile.start.y)}`;
    }
    for (const s of tile.segments) d = appendCubic(d, s.c1, s.c2, s.end);
  }
  return d;
}

export function viewHeight(
  pattern: Pattern,
  tiles: number,
  margin = 48,
): number {
  let maxY = pattern.motif.start.y;
  for (const s of pattern.motif.segments) {
    maxY = Math.max(maxY, s.c1.y, s.c2.y, s.end.y);
  }
  return maxY + Math.max(0, tiles - 1) * pattern.tiling.pitch + margin;
}
