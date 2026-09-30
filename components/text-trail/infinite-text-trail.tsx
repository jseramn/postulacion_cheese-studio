"use client";

import {
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  EDGE_PATTERN,
  buildInfinitePath,
  buildInfiniteTextPath,
  viewHeight,
  type Pattern,
} from "./pattern";
import {
  DRAW_ANCHOR,
  alongAt,
  gateScrollY,
  listRestAlongs,
  restMotifTargets,
} from "./rail-clock";
import { TrailMouse, type GatePaintState } from "./trail-mouse";

const LEFT_TEXT =
  "Umm, hope your week has started well…I was talking to Cheyene earlier but reception was really bad and I think their going to handle the first part of the project, but I\u2019m not totally sure. Also, I told the team the the new timeline should be ready by Friday, although it\u2019s probably going to slip. There\u2019s been a lot of back and forth and honestly the the whole thing\u2019s been kind of chaotic, like nobody really knows what\u2019s going on so can you check in with them and see if the notes from yesterday\u2019s meeting were sent out, or if they\u2019re still waiting. I think Cheyene mentioned it but didn\u2019t confirm, and now I\u2019m a little lost.";

const SEPARATOR = "  ";
const MAX_TEXT_COPIES = 12;
/** Divide native wheel deltas by this so the page (and trail) advance slower. */
const SCROLL_HEAVINESS = 20;
/** Exponential velocity decay rate (1/s) while in bounds. Higher = snappier stop. */
const FRICTION = 6.2;
/** Spring constant pulling overscroll back to the edge (1/s²). Soft kiss, not a snap. */
const BOUNCE_STIFFNESS = 55;
/** Spring damping while overscrolled (1/s). Mild underdamp for a tiny settle kiss. */
const BOUNCE_DAMPING = 8;
/** Max virtual overshoot past 0 / maxScroll (px). Tiny edge kiss only. */
const MAX_OVERSCROLL = 28;
/** Convert a px impulse into initial velocity (px/s). Lower = less travel per flick. */
const IMPULSE_SCALE = 34;
/** Stop the rAF loop below this |velocity| (px/s) when not overscrolled. */
const STOP_VELOCITY = 5;
/** Approximate line height when WheelEvent.deltaMode is DOM_DELTA_LINE. */
const WHEEL_LINE_PX = 16;

/** Soft wall past an armed rest gate (px). Smaller than edge bounce. */
const GATE_OVERSCROLL = 12;
const GATE_STIFFNESS = 90;
const GATE_DAMPING = 14;
/**
 * Accumulated |dy|/SCROLL_HEAVINESS to release (~4–5 deliberate wheel gestures
 * of ~100px at heaviness 20 → ~5 each).
 */
const REST_RELEASE = 22;
/** Rest-meter exponential decay rate (1/s) with no wheel input. */
const REST_DECAY = 0.6;
/** Re-arm a passed gate when scroll rises this far above it (fraction of vh). */
const REARM_VH = 0.5;
/** Trail letter fade when entering / leaving rest (MDN: CSS transition + opacity). */
const TRAIL_FADE_MS = 320;

function wheelDeltaYPx(event: WheelEvent): number {
  switch (event.deltaMode) {
    case WheelEvent.DOM_DELTA_LINE:
      return event.deltaY * WHEEL_LINE_PX;
    case WheelEvent.DOM_DELTA_PAGE:
      return event.deltaY * (window.innerHeight || 1);
    default:
      return event.deltaY;
  }
}

function maxScrollY(): number {
  return Math.max(
    0,
    document.documentElement.scrollHeight - (window.innerHeight || 0),
  );
}

function writeScrollY(y: number): void {
  const max = maxScrollY();
  window.scrollTo({
    top: Math.max(0, Math.min(max, y)),
    left: 0,
    behavior: "instant",
  });
}

/** Closest path along to a motif-space target (single-tile path). */
function alongNearest(path: SVGPathElement, target: { x: number; y: number }): number {
  const total = path.getTotalLength();
  if (total <= 0) return 0;
  const samples = 500;
  let bestU = 0;
  let bestD = Number.POSITIVE_INFINITY;
  for (let i = 0; i <= samples; i++) {
    const u = (i / samples) * total;
    const p = path.getPointAtLength(u);
    const d = (p.x - target.x) ** 2 + (p.y - target.y) ** 2;
    if (d < bestD) {
      bestD = d;
      bestU = u;
    }
  }
  return bestU;
}

export type InfiniteTextTrailProps = {
  pattern?: Pattern;
  text?: string;
  fontSize?: number;
  textOpacity?: number;
  textColor?: string;
  /** Pixel mouse on the rail with mid-column rest gates. Default off. */
  mouse?: boolean;
  /** Optional CSS filter on TrailMouse wrap. Omitted = lab sprite colors. */
  mouseTint?: string;
};

function estimatePeriod(text: string, fontSize: number): number {
  return Math.max(1, (text.length + SEPARATOR.length) * fontSize * 0.48);
}

export function InfiniteTextTrail({
  pattern = EDGE_PATTERN,
  text = LEFT_TEXT,
  fontSize = 15,
  textOpacity = 0.4,
  textColor = "#1A1A1A",
  mouse = false,
  mouseTint,
}: InfiniteTextTrailProps) {
  const tiling = pattern.tiling;
  const rawId = useId().replace(/:/g, "");
  const trailId = `trail-${rawId}`;
  const maskId = `mask-${rawId}`;

  const svgRef = useRef<SVGSVGElement>(null);
  const maskPathRef = useRef<SVGPathElement>(null);
  const measureRef = useRef<SVGTextElement>(null);
  const samplePathRef = useRef<SVGPathElement>(null);
  const tilesRef = useRef(2);
  const periodRef = useRef(estimatePeriod(text, fontSize));
  const windowRef = useRef({ startOffset: 0, copies: 4 });
  const tilingRef = useRef(tiling);
  const growingRef = useRef(false);
  const lastScrollYRef = useRef(0);
  const lastGrowthHeightRef = useRef(Number.NaN);
  const mouseEnabledRef = useRef(mouse);

  const gateRef = useRef<GatePaintState>({ sitting: false, meter: 0 });
  /** Armed gate scrollY, or null when none / released until re-arm. */
  const armedGateRef = useRef<number | null>(null);
  /** Passed gate scrollYs still eligible to re-arm when scrolling up. */
  const passedGatesRef = useRef<number[]>([]);
  const baseAlongsRef = useRef<number[]>([]);
  const tileLenRef = useRef(0);
  const restMeterRef = useRef(0);
  const textOpacityRef = useRef(textOpacity);
  /** Writes gateRef and mirrors sitting → trail letter opacity (0..textOpacity). */
  const writeGateRef = useRef<(next: GatePaintState) => void>(() => {});

  const [tiles, setTiles] = useState(2);
  const [textWindow, setTextWindow] = useState({ startOffset: 0, copies: 4 });
  const [period, setPeriod] = useState(() => estimatePeriod(text, fontSize));
  const [trailOpacity, setTrailOpacity] = useState(textOpacity);
  const [trailFadeMs, setTrailFadeMs] = useState(TRAIL_FADE_MS);

  const d = useMemo(() => buildInfinitePath(pattern, tiles), [pattern, tiles]);
  /** Text-only: mid R→L cubics reversed so glyph-up is screen-up (mouse keeps `d`). */
  const textD = useMemo(
    () => buildInfiniteTextPath(pattern, tiles),
    [pattern, tiles],
  );
  const sampleD = useMemo(() => buildInfinitePath(pattern, 1), [pattern]);
  const height = viewHeight(pattern, tiles);
  const width = tiling.width;

  const unit = `${text}${SEPARATOR}`;
  const repeated = unit.repeat(Math.max(1, textWindow.copies));

  useLayoutEffect(() => {
    if (tilesRef.current !== tiles) growingRef.current = false;
    tilesRef.current = tiles;
    periodRef.current = period;
    windowRef.current = textWindow;
    tilingRef.current = tiling;
    mouseEnabledRef.current = mouse;
    textOpacityRef.current = textOpacity;
    writeGateRef.current = (next) => {
      const prevSitting = gateRef.current.sitting;
      gateRef.current = next;
      if (next.sitting !== prevSitting) {
        setTrailOpacity(next.sitting ? 0 : textOpacityRef.current);
      }
    };
  });

  useLayoutEffect(() => {
    if (!gateRef.current.sitting) setTrailOpacity(textOpacity);
  }, [textOpacity]);

  useLayoutEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setTrailFadeMs(mq.matches ? 0 : TRAIL_FADE_MS);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const syncBaseAlongs = useCallback(() => {
    const sample = samplePathRef.current;
    if (!sample) return;
    const tileLen = sample.getTotalLength();
    if (tileLen <= 0) return;
    tileLenRef.current = tileLen;
    const targets = restMotifTargets();
    const alongs = targets.map((t) => alongNearest(sample, t));
    alongs.sort((a, b) => a - b);
    baseAlongsRef.current = alongs;
  }, []);

  const railMetrics = useCallback(() => {
    const svg = svgRef.current;
    const t = tilingRef.current;
    const cw = svg?.clientWidth || t.width;
    const pitchPx = t.pitch * (cw / t.width);
    const vh = window.innerHeight || 1;
    const tileLen = tileLenRef.current;
    return { pitchPx, vh, tileLen, cw };
  }, []);

  const refreshArmedGate = useCallback(() => {
    if (!mouseEnabledRef.current) {
      armedGateRef.current = null;
      writeGateRef.current({ sitting: false, meter: 0 });
      return;
    }
    const { pitchPx, vh, tileLen } = railMetrics();
    if (pitchPx <= 0 || tileLen <= 0) return;

    const scrollY = window.scrollY;
    // Sticky only while still approaching / at the soft wall. If scroll climbs
    // above the gate, drop the arm so the next refresh can pick the right rest.
    if (armedGateRef.current != null) {
      if (scrollY < armedGateRef.current - 2) {
        armedGateRef.current = null;
      } else if (scrollY <= armedGateRef.current + GATE_OVERSCROLL + 1) {
        return;
      } else {
        // Past soft wall without a release (scrollbar/key) — keep until clamp.
        return;
      }
    }

    const rests = listRestAlongs(
      baseAlongsRef.current,
      tilesRef.current,
      tileLen,
    );
    const passed = passedGatesRef.current;
    let chosen: number | null = null;
    for (const along of rests) {
      const g = gateScrollY(along, vh, tileLen, pitchPx);
      if (g < scrollY - 1) continue;
      if (passed.some((pg) => Math.abs(pg - g) < 2)) continue;
      chosen = g;
      break;
    }
    armedGateRef.current = chosen;
  }, [railMetrics]);

  const paint = useCallback(() => {
    const mask = maskPathRef.current;
    const svg = svgRef.current;
    if (!mask || !svg) return;

    const total = mask.getTotalLength();
    if (total <= 0) return;

    const tileCount = tilesRef.current;
    const tileLen = total / tileCount;
    tileLenRef.current = tileLen;
    const t = tilingRef.current;
    const cw = svg.clientWidth || t.width;
    const pitchPx = t.pitch * (cw / t.width);
    if (pitchPx <= 0) return;

    const scrollY = window.scrollY;
    const vh = window.innerHeight || 1;
    const drawn = Math.min(
      total,
      alongAt(scrollY, vh, DRAW_ANCHOR, tileLen, pitchPx),
    );
    mask.style.strokeDasharray = `${total}`;
    mask.style.strokeDashoffset = `${total - drawn}`;

    const p = Math.max(1, periodRef.current);
    let windowStart =
      Math.floor(
        Math.max(0, (tileLen * (scrollY - vh)) / pitchPx) / p,
      ) * p;
    if (windowStart >= total) {
      windowStart = Math.max(0, Math.floor((total - p) / p) * p);
    }
    const copies = Math.min(
      MAX_TEXT_COPIES,
      Math.max(1, Math.ceil((drawn - windowStart) / p) + 2),
    );
    const prev = windowRef.current;
    if (windowStart !== prev.startOffset || copies !== prev.copies) {
      const next = { startOffset: windowStart, copies };
      windowRef.current = next;
      setTextWindow(next);
    }
  }, []);

  useLayoutEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    const len = el.getComputedTextLength();
    if (len > 0 && Math.abs(len - periodRef.current) > 0.5) {
      periodRef.current = len;
      setPeriod(len);
    }
  }, [text, fontSize]);

  useLayoutEffect(() => {
    syncBaseAlongs();
    paint();
  }, [d, tiles, period, paint, syncBaseAlongs, sampleD]);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const prev = root.style.overflowAnchor;
    // Spec/MDN: overflow-anchor is not inherited; any descendant of the
    // scrolling box (incl. partially visible parents) can be the anchor, so
    // opt out on the document element rather than only this subtree.
    root.style.overflowAnchor = "none";
    return () => {
      root.style.overflowAnchor = prev;
    };
  }, []);

  useLayoutEffect(() => {
    let velocity = 0;
    let position = window.scrollY;
    let rafId: number | null = null;
    let lastTs: number | null = null;
    const reduceMq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduce = reduceMq.matches;
    const onReduceChange = () => {
      reduce = reduceMq.matches;
    };
    reduceMq.addEventListener("change", onReduceChange);

    const stopLoop = () => {
      if (rafId != null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      lastTs = null;
    };

    const tick = (timestamp: number) => {
      // MDN: use the rAF timestamp so motion is refresh-rate independent.
      const prev = lastTs ?? timestamp;
      lastTs = timestamp;
      let dt = (timestamp - prev) / 1000;
      if (dt > 0.064) dt = 0.064;
      if (dt <= 0) {
        rafId = requestAnimationFrame(tick);
        return;
      }

      const max = maxScrollY();
      const gate = armedGateRef.current;
      const gated = mouseEnabledRef.current && gate != null;

      // Decay rest meter when not being filled this frame (wheel fills in onWheel).
      if (gated && position >= gate - 1) {
        restMeterRef.current *= Math.exp(-REST_DECAY * dt);
        if (restMeterRef.current < 1e-3) restMeterRef.current = 0;
      }

      position += velocity * dt;

      if (gated) {
        const ceil = gate + GATE_OVERSCROLL;
        if (position > ceil) {
          position = ceil;
          if (velocity > 0) velocity = 0;
        }
        if (position >= gate - 0.5) {
          const over = Math.max(0, position - gate);
          if (reduce) {
            position = gate;
            if (velocity > 0) velocity = 0;
          } else if (over > 0) {
            velocity +=
              (-GATE_STIFFNESS * over - GATE_DAMPING * velocity) * dt;
          }
          // Pinned: sitting at the soft wall.
          writeGateRef.current({
            sitting: true,
            meter: Math.min(1, restMeterRef.current / REST_RELEASE),
          });
        } else {
          writeGateRef.current({
            sitting: false,
            meter: Math.min(1, restMeterRef.current / REST_RELEASE),
          });
        }
      } else {
        writeGateRef.current({ sitting: false, meter: 0 });
      }

      if (position < -MAX_OVERSCROLL) {
        position = -MAX_OVERSCROLL;
        if (velocity < 0) velocity = 0;
      } else if (position > max + MAX_OVERSCROLL) {
        position = max + MAX_OVERSCROLL;
        if (velocity > 0) velocity = 0;
      }

      if (position < 0) {
        velocity +=
          (-BOUNCE_STIFFNESS * position - BOUNCE_DAMPING * velocity) * dt;
      } else if (position > max && !(gated && gate != null && position <= gate + GATE_OVERSCROLL)) {
        const over = position - max;
        velocity +=
          (-BOUNCE_STIFFNESS * over - BOUNCE_DAMPING * velocity) * dt;
      } else if (!gated || position <= (gate ?? 0)) {
        velocity *= Math.exp(-FRICTION * dt);
      }

      writeScrollY(position);

      // Keep integrating while virtually overscrolled so the soft edge kiss can land.
      const overscrolled =
        position < 0 ||
        position > max ||
        (gated && gate != null && position > gate);
      if (Math.abs(velocity) < STOP_VELOCITY && !overscrolled) {
        // Rest flush on the edge after a quiet kiss (avoid a leftover few-px nudge).
        if (position < 16) position = 0;
        else if (position > max - 16) position = max;
        else position = Math.max(0, Math.min(max, position));
        velocity = 0;
        writeScrollY(position);
        stopLoop();
        return;
      }

      rafId = requestAnimationFrame(tick);
    };

    const startLoop = () => {
      if (rafId != null) return;
      lastTs = null;
      rafId = requestAnimationFrame(tick);
    };

    const releaseGate = (gate: number) => {
      passedGatesRef.current.push(gate);
      armedGateRef.current = null;
      restMeterRef.current = 0;
      writeGateRef.current({ sitting: false, meter: 0 });
      refreshArmedGate();
    };

    const onWheel = (event: WheelEvent) => {
      // Let browser zoom (ctrl/meta + wheel) alone.
      if (event.ctrlKey || event.metaKey) return;
      const dy = wheelDeltaYPx(event);
      if (dy === 0 && event.deltaX === 0) return;
      event.preventDefault();

      if (rafId == null) {
        position = window.scrollY;
      }

      const max = maxScrollY();
      const gate = armedGateRef.current;
      const gated = mouseEnabledRef.current && gate != null;
      const atGate = gated && position >= gate - 0.5;

      // Upward always free. Downward at gate fills rest meter instead of velocity.
      if (atGate && dy > 0) {
        const impulse = dy / SCROLL_HEAVINESS;
        restMeterRef.current += Math.abs(impulse);
        writeGateRef.current({
          sitting: true,
          meter: Math.min(1, restMeterRef.current / REST_RELEASE),
        });
        if (restMeterRef.current >= REST_RELEASE) {
          releaseGate(gate);
          // Small nudge past the wall so we do not immediately re-pin.
          velocity += impulse * IMPULSE_SCALE * 0.35;
          startLoop();
        }
        return;
      }

      let impulse = dy / SCROLL_HEAVINESS;
      // Soften further pushes while already overscrolled (rubber-band feel).
      if ((position <= 0 && impulse < 0) || (position >= max && impulse > 0)) {
        const over =
          position <= 0 ? Math.max(0, -position) : Math.max(0, position - max);
        const t = Math.min(1, over / MAX_OVERSCROLL);
        impulse *= Math.max(0, 1 - t) * 0.55;
      }

      // Approaching an armed gate: zero downward velocity on contact.
      if (gated && impulse > 0 && position >= gate - 1 && position < gate) {
        if (velocity > 0) velocity = 0;
      }

      velocity += impulse * IMPULSE_SCALE;
      startLoop();
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      window.removeEventListener("wheel", onWheel);
      reduceMq.removeEventListener("change", onReduceChange);
      stopLoop();
    };
  }, [refreshArmedGate]);

  useLayoutEffect(() => {
    lastScrollYRef.current = window.scrollY;
    syncBaseAlongs();
    refreshArmedGate();

    const onScroll = () => {
      const scrollY = window.scrollY;
      const dy = scrollY - lastScrollYRef.current;
      lastScrollYRef.current = scrollY;
      paint();

      const vh = window.innerHeight || 1;
      const rearmPx = REARM_VH * vh;

      // Re-arm passed gates when scrolling back above them.
      if (mouseEnabledRef.current && dy < 0) {
        const still: number[] = [];
        for (const g of passedGatesRef.current) {
          if (scrollY < g - rearmPx) {
            // Cleared well above: drop from passed so refresh can arm again.
            continue;
          }
          still.push(g);
        }
        passedGatesRef.current = still;
      }

      // Safety clamp: non-wheel jump past an armed gate.
      const gate = armedGateRef.current;
      if (
        mouseEnabledRef.current &&
        gate != null &&
        scrollY > gate + GATE_OVERSCROLL + 2
      ) {
        window.scrollTo({ top: gate, left: 0, behavior: "instant" });
        lastScrollYRef.current = gate;
        writeGateRef.current({
          sitting: true,
          meter: Math.min(1, restMeterRef.current / REST_RELEASE),
        });
        paint();
        return;
      }

      refreshArmedGate();

      const remaining =
        document.documentElement.scrollHeight - scrollY - vh;
      const scrolledDown = dy > 0;
      const mirrorsGrowth =
        Number.isFinite(lastGrowthHeightRef.current) &&
        Math.abs(dy - lastGrowthHeightRef.current) <= 2;
      if (
        !growingRef.current &&
        scrolledDown &&
        !mirrorsGrowth &&
        remaining < vh * 1.5
      ) {
        const svg = svgRef.current;
        const t = tilingRef.current;
        const cw = svg?.clientWidth || t.width;
        const growthPx = t.pitch * (cw / t.width);
        growingRef.current = true;
        lastGrowthHeightRef.current = growthPx;
        setTiles((count) => count + 1);
      }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [paint, refreshArmedGate, syncBaseAlongs]);

  const maskPad = fontSize * 2.2;

  return (
    <div className="relative bg-transparent">
      <svg
        ref={svgRef}
        width="100%"
        viewBox={`0 0 ${width} ${height}`}
        overflow="visible"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="block w-full"
        style={{
          display: "block",
          overflow: "visible",
        }}
      >
        <defs>
          {/* Mask / draw clock follow sample topology (R→L mid). */}
          <path
            ref={samplePathRef}
            d={sampleD}
            fill="none"
            aria-hidden
          />
          {/* textPath only: mid flats L→R for viewer-upright glyphs. */}
          <path id={trailId} d={textD} fill="none" />
          <mask
            id={maskId}
            maskUnits="userSpaceOnUse"
            x={-maskPad}
            y={-maskPad}
            width={width + maskPad * 2}
            height={height + maskPad * 2}
          >
            <path
              ref={maskPathRef}
              d={d}
              fill="none"
              stroke="white"
              strokeWidth={fontSize * (96 / 34)}
              strokeLinecap="round"
            />
          </mask>
        </defs>

        <text
          ref={measureRef}
          x={0}
          y={-9999}
          aria-hidden="true"
          className="font-heading font-semibold tracking-tighter"
          letterSpacing={-2.4}
          style={{ fontSize, visibility: "hidden" }}
        >
          {unit}
        </text>

        <text
          mask={`url(#${maskId})`}
          className="font-heading font-semibold tracking-tighter"
          letterSpacing={-2.4}
          style={{
            fontSize,
            fill: textColor,
            opacity: trailOpacity,
            // MDN: transition opacity; duration 0 when prefers-reduced-motion.
            transition:
              trailFadeMs > 0 ? `opacity ${trailFadeMs}ms ease` : "none",
          }}
        >
          {/*
            Mid upright via buildInfiniteTextPath (reversed mid flat only), not
            textPath side (Firefox-only per MDN; would also flip columns).
          */}
          <textPath
            href={`#${trailId}`}
            startOffset={textWindow.startOffset}
            dy="-6"
          >
            {repeated}
          </textPath>
        </text>
      </svg>
      {mouse ? (
        <TrailMouse
          svgRef={svgRef}
          pattern={pattern}
          fontSize={fontSize}
          gateRef={gateRef}
          tiles={tiles}
          mouseTint={mouseTint}
        />
      ) : null}
    </div>
  );
}

/**
 * Aceternity UI Wispr Flow text-on-path (blocks/wispr-flow-text-animation).
 * Skiper UI skiper19 scroll stroke (https://skiper-ui.com). Skiper free requires attribution.
 */
