"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";

const PITCH = 2319;
const START = { x: 876.605, y: 394.131 };
const END = { x: 303.794, y: 2668.89 };
const CURVES =
  "C788.982 335.917 696.198 358.139 691.836 416.303C685.453 501.424 853.722 498.43 941.95 409.714C1016.1 335.156 1008.64 186.907 906.167 142.846C807.014 100.212 712.699 198.494 789.049 245.127C889.053 306.207 986.062 116.979 840.548 43.3233C743.932 -5.58141 678.027 57.1682 672.279 112.188C666.53 167.208 712.538 172.943 736.353 163.088C760.167 153.234 764.14 120.924 746.651 93.3868C717.461 47.4252 638.894 77.8642 601.018 116.979C568.164 150.908 557 201.079 576.467 246.924C593.342 286.664 630.24 310.55 671.68 302.614C756.114 286.446 729.747 206.546 681.86 186.442C630.54 164.898 492 209.318 495.026 287.644C496.837 334.494 518.402 366.466 582.455 367.287C680.013 368.538 771.538 299.456 898.634 292.434C1007.02 286.446 1192.67 309.384 1242.36 382.258C1266.99 418.39 1273.65 443.108 1247.75 474.477C1217.32 511.33 1149.4 511.259 1096.84 466.093C1044.29 420.928 1029.14 380.576 1033.97 324.172C1038.31 273.428 1069.55 228.986 1117.2 216.384C1152.2 207.128 1188.29 213.629 1194.45 245.127C1201.49 281.062 1132.22 280.104 1100.44 272.673C1065.32 264.464 1044.22 234.837 1032.77 201.413C1019.29 162.061 1029.71 131.126 1056.44 100.965C1086.19 67.4032 1143.96 54.5526 1175.78 86.1513C1207.02 117.17 1186.81 143.379 1156.22 166.691C1112.57 199.959 1052.57 186.238 999.784 155.164C957.312 130.164 899.171 63.7054 931.284 26.3214C952.068 2.12513 996.288 3.87363 1007.22 43.58C1018.15 83.2749 1003.56 122.644 975.969 163.376C948.377 204.107 907.272 255.122 913.558 321.045C919.727 385.734 990.968 497.068 1063.84 503.35C1111.46 507.456 1166.79 511.984 1175.68 464.527C1191.52 379.956 1101.26 334.985 1030.29 377.017C971.109 412.064 956.297 483.647 953.797 561.655C947.587 755.413 1197.56 941.828 936.039 1140.66C745.771 1285.32 321.926 950.737 134.536 1202.19C-6.68295 1391.68 -53.4837 1655.38 131.935 1760.5C478.381 1956.91 1124.19 1515 1201.28 1997.83C1273.66 2451.23 100.805 1864.7 303.794 2668.89";

function offsetCurves(dy: number) {
  return CURVES.replace(
    /C([\d.-]+) ([\d.-]+) ([\d.-]+) ([\d.-]+) ([\d.-]+) ([\d.-]+)/g,
    (_, x1, y1, x2, y2, x, y) =>
      `C${x1} ${Number(y1) + dy} ${x2} ${Number(y2) + dy} ${x} ${Number(y) + dy}`,
  );
}

function bridge(
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return `C${from.x + dx * 0.35} ${from.y + dy * 0.35} ${from.x + dx * 0.7} ${from.y + dy * 0.7} ${to.x} ${to.y}`;
}

function buildPath(tiles: number) {
  let d = `M${START.x} ${START.y}`;
  for (let i = 0; i < tiles; i++) {
    if (i > 0) {
      d += bridge(
        { x: END.x, y: END.y + (i - 1) * PITCH },
        { x: START.x, y: START.y + i * PITCH },
      );
    }
    d += offsetCurves(i * PITCH);
  }
  return d;
}

function svgHeight(tiles: number) {
  return END.y + (tiles - 1) * PITCH + 48;
}

const Skiper19 = () => {
  const pathRef = useRef<SVGPathElement>(null);
  const tileLengthRef = useRef(0);
  const growingRef = useRef(false);
  const [tiles, setTiles] = useState(2);
  const d = useMemo(() => buildPath(tiles), [tiles]);
  const height = svgHeight(tiles);

  useLayoutEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    const total = path.getTotalLength();
    if (tileLengthRef.current === 0) {
      tileLengthRef.current = total / tiles;
    }
    paint(path, total, tileLengthRef.current);
    growingRef.current = false;
  }, [d, tiles]);

  useLayoutEffect(() => {
    const onScroll = () => {
      const path = pathRef.current;
      const tileLen = tileLengthRef.current;
      if (!path || tileLen === 0) return;
      const total = path.getTotalLength();
      const drawn = paint(path, total, tileLen);
      const remaining =
        document.documentElement.scrollHeight -
        window.scrollY -
        window.innerHeight;
      const strokeLeft = total - drawn;
      if (
        !growingRef.current &&
        (remaining < window.innerHeight * 1.5 || strokeLeft < tileLen * 0.5)
      ) {
        growingRef.current = true;
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
  }, [tiles]);

  return (
    <section className="w-screen bg-[#FAFDEE]">
      <svg
        width="1278"
        height={height}
        viewBox={`0 0 1278 ${height}`}
        fill="none"
        overflow="visible"
        xmlns="http://www.w3.org/2000/svg"
        className="mx-auto block"
      >
        <path
          ref={pathRef}
          d={d}
          stroke="#C2F84F"
          strokeWidth="20"
          fill="none"
        />
      </svg>
    </section>
  );
};

function paint(path: SVGPathElement, total: number, tileLen: number) {
  const viewport = window.innerHeight || 1;
  const drawn = Math.min(tileLen * (0.5 + window.scrollY / (7 * viewport)), total);
  path.style.strokeDasharray = `${total}`;
  path.style.strokeDashoffset = `${total - drawn}`;
  return drawn;
}

export { Skiper19 };

/**
 * Skiper 19 — React + framer motion
 * Inspired by and adapted from https://comgio.ai/
 * We respect the original creators. This is an inspired rebuild with our own taste and does not claim any ownership.
 * These animations aren’t associated with the comgio.ai . They’re independent recreations meant to study interaction design
 *
 * License & Usage:
 * - Free to use and modify in both personal and commercial projects.
 * - Attribution to Skiper UI is required when using the free version.
 * - No attribution required with Skiper UI Pro.
 *
 * Feedback and contributions are welcome.
 *
 * Author: @gurvinder-singh02
 * Website: https://gxuri.me
 * Twitter: https://x.com/Gur__vi
 */
