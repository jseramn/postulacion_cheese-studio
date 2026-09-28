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
  viewHeight,
  type Pattern,
} from "./pattern";

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

export type InfiniteTextTrailProps = {
  pattern?: Pattern;
  text?: string;
  fontSize?: number;
  textOpacity?: number;
  textColor?: string;
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
}: InfiniteTextTrailProps) {
  const tiling = pattern.tiling;
  const rawId = useId().replace(/:/g, "");
  const trailId = `trail-${rawId}`;
  const maskId = `mask-${rawId}`;

  const svgRef = useRef<SVGSVGElement>(null);
  const maskPathRef = useRef<SVGPathElement>(null);
  const measureRef = useRef<SVGTextElement>(null);
  const tilesRef = useRef(2);
  const periodRef = useRef(estimatePeriod(text, fontSize));
  const windowRef = useRef({ startOffset: 0, copies: 4 });
  const tilingRef = useRef(tiling);
  const growingRef = useRef(false);
  const lastScrollYRef = useRef(0);
  const lastGrowthHeightRef = useRef(Number.NaN);

  const [tiles, setTiles] = useState(2);
  const [textWindow, setTextWindow] = useState({ startOffset: 0, copies: 4 });
  const [period, setPeriod] = useState(() => estimatePeriod(text, fontSize));

  const d = useMemo(() => buildInfinitePath(pattern, tiles), [pattern, tiles]);
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
  });

  const paint = useCallback(() => {
    const mask = maskPathRef.current;
    const svg = svgRef.current;
    if (!mask || !svg) return;

    const total = mask.getTotalLength();
    if (total <= 0) return;

    const tileCount = tilesRef.current;
    const tileLen = total / tileCount;
    const t = tilingRef.current;
    const cw = svg.clientWidth || t.width;
    const pitchPx = t.pitch * (cw / t.width);
    if (pitchPx <= 0) return;

    const scrollY = window.scrollY;
    const vh = window.innerHeight || 1;
    const drawn = Math.min(
      total,
      (tileLen * (scrollY + 0.8 * vh)) / pitchPx,
    );
    mask.style.strokeDasharray = `${total}`;
    mask.style.strokeDashoffset = `${total - drawn}`;

    const p = Math.max(1, periodRef.current);
    let windowStart =
      Math.floor(Math.max(0, (tileLen * (scrollY - vh)) / pitchPx) / p) * p;
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
    paint();
  }, [d, tiles, period, paint]);

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
      position += velocity * dt;

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
      } else if (position > max) {
        const over = position - max;
        velocity +=
          (-BOUNCE_STIFFNESS * over - BOUNCE_DAMPING * velocity) * dt;
      } else {
        velocity *= Math.exp(-FRICTION * dt);
      }

      writeScrollY(position);

      // Keep integrating while virtually overscrolled so the soft edge kiss can land.
      const overscrolled = position < 0 || position > max;
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
      let impulse = dy / SCROLL_HEAVINESS;
      // Soften further pushes while already overscrolled (rubber-band feel).
      if ((position <= 0 && impulse < 0) || (position >= max && impulse > 0)) {
        const over =
          position <= 0 ? Math.max(0, -position) : Math.max(0, position - max);
        const t = Math.min(1, over / MAX_OVERSCROLL);
        impulse *= Math.max(0, 1 - t) * 0.55;
      }

      velocity += impulse * IMPULSE_SCALE;
      startLoop();
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      window.removeEventListener("wheel", onWheel);
      stopLoop();
    };
  }, []);

  useLayoutEffect(() => {
    lastScrollYRef.current = window.scrollY;
    const onScroll = () => {
      const scrollY = window.scrollY;
      const dy = scrollY - lastScrollYRef.current;
      lastScrollYRef.current = scrollY;
      paint();

      const vh = window.innerHeight || 1;
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
  }, [paint]);

  const maskPad = fontSize * 2.2;

  return (
    <div className="relative bg-white">
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
          <path id={trailId} d={d} fill="none" />
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
          style={{ fontSize, fill: textColor, opacity: textOpacity }}
        >
          <textPath
            href={`#${trailId}`}
            startOffset={textWindow.startOffset}
            dy="-6"
          >
            {repeated}
          </textPath>
        </text>
      </svg>
    </div>
  );
}

/**
 * Aceternity UI Wispr Flow text-on-path (blocks/wispr-flow-text-animation).
 * Skiper UI skiper19 scroll stroke (https://skiper-ui.com). Skiper free requires attribution.
 */
