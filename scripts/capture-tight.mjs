/**
 * Capture tight-a/b + report after sole-on-ink clearance pass.
 * Shot A: top+right letter L (arc in TR), mouse on arc not L-hole.
 * Shot B: right column, sole↔ink gap ≈10–18px.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";
import puppeteer from "puppeteer-core";

/** Minimal PNG → {width,height,rgba Buffer} (8-bit RGBA only). */
function decodePng(buf) {
  if (buf[0] !== 0x89) throw new Error("not png");
  let offset = 8;
  let width = 0;
  let height = 0;
  const idats = [];
  while (offset < buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.toString("ascii", offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (data[8] !== 8 || data[9] !== 6) {
        throw new Error(`unsupported png depth/color ${data[8]}/${data[9]}`);
      }
    } else if (type === "IDAT") {
      idats.push(data);
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + len;
  }
  const inflated = zlib.inflateSync(Buffer.concat(idats));
  const stride = width * 4;
  const rgba = Buffer.alloc(height * stride);
  let ip = 0;
  for (let y = 0; y < height; y++) {
    const filter = inflated[ip++];
    const row = inflated.subarray(ip, ip + stride);
    ip += stride;
    const out = rgba.subarray(y * stride, (y + 1) * stride);
    if (filter === 0) {
      row.copy(out);
    } else if (filter === 1) {
      for (let i = 0; i < stride; i++) {
        const left = i >= 4 ? out[i - 4] : 0;
        out[i] = (row[i] + left) & 255;
      }
    } else if (filter === 2) {
      const prev = y > 0 ? rgba.subarray((y - 1) * stride, y * stride) : null;
      for (let i = 0; i < stride; i++) {
        const up = prev ? prev[i] : 0;
        out[i] = (row[i] + up) & 255;
      }
    } else if (filter === 3) {
      const prev = y > 0 ? rgba.subarray((y - 1) * stride, y * stride) : null;
      for (let i = 0; i < stride; i++) {
        const left = i >= 4 ? out[i - 4] : 0;
        const up = prev ? prev[i] : 0;
        out[i] = (row[i] + Math.floor((left + up) / 2)) & 255;
      }
    } else if (filter === 4) {
      const prev = y > 0 ? rgba.subarray((y - 1) * stride, y * stride) : null;
      for (let i = 0; i < stride; i++) {
        const a = i >= 4 ? out[i - 4] : 0;
        const b = prev ? prev[i] : 0;
        const c = prev && i >= 4 ? prev[i - 4] : 0;
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        let pr = a;
        if (pb <= pa && pb <= pc) pr = b;
        else if (pc <= pa && pc <= pb) pr = c;
        out[i] = (row[i] + pr) & 255;
      }
    } else {
      throw new Error(`png filter ${filter}`);
    }
  }
  return { width, height, data: rgba };
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PHASE = path.join(ROOT, ".cursor", "screens", "phases");
const EDGE =
  process.env.PUPPETEER_EXECUTABLE_PATH ||
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const URL = `http://localhost:3000/wispr-infinito?tight=${Date.now()}`;

fs.mkdirSync(PHASE, { recursive: true });

async function mouseSnap(page) {
  return page.evaluate(() => {
    const wraps = Array.from(
      document.querySelectorAll("div.absolute.top-0.left-0.will-change-transform"),
    );
    const wrap = wraps.find((el) => el.querySelector("img, canvas"));
    if (!wrap) return null;
    const r = wrap.getBoundingClientRect();
    const bank = (wrap.dataset.bank || "").split(",");
    const nudge = (wrap.dataset.screenNudge || "0,0").split(",").map(Number);

    const tp = document.querySelector("textPath");
    const text = tp?.parentElement;
    const svg = text?.ownerSVGElement;
    const ctm = text?.getScreenCTM?.();
    const letters = [];
    if (text && typeof text.getNumberOfChars === "function" && svg && ctm) {
      const n = text.getNumberOfChars();
      for (let i = 0; i < n; i++) {
        try {
          const ext = text.getExtentOfChar(i);
          const pt = svg.createSVGPoint();
          pt.x = ext.x + ext.width / 2;
          pt.y = ext.y + ext.height / 2;
          const sp = pt.matrixTransform(ctm);
          const tl = svg.createSVGPoint();
          tl.x = ext.x;
          tl.y = ext.y;
          const br = svg.createSVGPoint();
          br.x = ext.x + ext.width;
          br.y = ext.y + ext.height;
          const sTl = tl.matrixTransform(ctm);
          const sBr = br.matrixTransform(ctm);
          const rot =
            typeof text.getRotationOfChar === "function"
              ? text.getRotationOfChar(i)
              : null;
          letters.push({
            i,
            cx: sp.x,
            cy: sp.y,
            l: Math.min(sTl.x, sBr.x),
            r: Math.max(sTl.x, sBr.x),
            t: Math.min(sTl.y, sBr.y),
            b: Math.max(sTl.y, sBr.y),
            rot,
          });
        } catch {
          /* skip */
        }
      }
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const topBand = letters.filter(
      (g) => g.t < 90 && g.b > -20 && g.cx > vw * 0.2 && g.cx < vw - 40,
    );
    const rightBand = letters.filter(
      (g) => g.r > vw - 140 && g.cy > 20 && g.cy < vh - 20,
    );
    const arcBand = letters.filter((g) => {
      const a = g.rot == null ? null : ((g.rot % 360) + 360) % 360;
      const nearTR = g.cx > vw * 0.65 && g.cy < vh * 0.4;
      if (!nearTR) return false;
      if (a == null) return true;
      const d90 = Math.min(Math.abs(a - 90), Math.abs(a - 0), Math.abs(a - 45));
      return d90 < 55;
    });

    const topLetters = topBand.length
      ? {
          count: topBand.length,
          mid: topBand.reduce((s, g) => s + g.cy, 0) / topBand.length,
          top: Math.min(...topBand.map((g) => g.t)),
          bottom: Math.max(...topBand.map((g) => g.b)),
        }
      : { count: 0, mid: null, top: null, bottom: null };
    const rightLetters = rightBand.length
      ? {
          count: rightBand.length,
          mid: rightBand.reduce((s, g) => s + g.cx, 0) / rightBand.length,
          leftEdge: Math.min(...rightBand.map((g) => g.l)),
          rightEdge: Math.max(...rightBand.map((g) => g.r)),
        }
      : { count: 0, mid: null, leftEdge: null, rightEdge: null };

    const clearRight =
      rightLetters.leftEdge != null ? rightLetters.leftEdge - r.right : null;
    const clearTop =
      topLetters.bottom != null ? r.top - topLetters.bottom : null;

    const holeCx = vw - 160;
    const holeCy = 140;
    const holeDist = Math.hypot(r.left + r.width / 2 - holeCx, r.top + r.height / 2 - holeCy);

    return {
      scrollY: window.scrollY,
      transform: wrap.style.transform,
      bank: wrap.dataset.bank,
      rotate: Number(bank[0]),
      nx: Number(bank[1]),
      ny: Number(bank[2]),
      facing: bank[3] || "",
      sitting: wrap.dataset.sitting === "1",
      clearance: Number(wrap.dataset.clearance || NaN),
      nudge: wrap.dataset.screenNudge,
      nudgeSkipped: wrap.dataset.nudgeSkipped || "",
      nudgeMag: Math.hypot(nudge[0] || 0, nudge[1] || 0),
      box: {
        l: r.left,
        t: r.top,
        r: r.right,
        b: r.bottom,
        cx: r.left + r.width / 2,
        cy: r.top + r.height / 2,
      },
      vw,
      vh,
      topLetters,
      rightLetters,
      arcCount: arcBand.length,
      clearTop,
      clearRight,
      holeDist,
      letterCount: letters.length,
    };
  });
}

/** Scan screenshot: leftmost bright column near right edge vs mouse AABB. */
function pixelClearanceFromPng(buf, mouseBox) {
  const png = decodePng(Buffer.from(buf));
  const { width: w, height: h, data } = png;
  const y0 = Math.max(0, Math.floor(mouseBox.t));
  const y1 = Math.min(h - 1, Math.ceil(mouseBox.b));
  let letterLeft = Infinity;
  for (let y = y0; y <= y1; y++) {
    for (let x = w - 2; x > w * 0.55; x--) {
      const i = (y * w + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (r > 200 && g > 200 && b > 200) {
        if (x < letterLeft) letterLeft = x;
        break;
      }
    }
  }
  // Mouse rightmost bright pixel in box (sprite)
  let mouseRight = -Infinity;
  const mx0 = Math.max(0, Math.floor(mouseBox.l));
  const mx1 = Math.min(w - 1, Math.ceil(mouseBox.r));
  for (let y = y0; y <= y1; y++) {
    for (let x = mx1; x >= mx0; x--) {
      const i = (y * w + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a > 40 && r + g + b > 400) {
        if (x > mouseRight) mouseRight = x;
        break;
      }
    }
  }
  if (!Number.isFinite(letterLeft) || !Number.isFinite(mouseRight)) {
    return null;
  }
  return {
    letterLeft,
    mouseRight,
    mouseBox: {
      l: mouseBox.l,
      r: mouseBox.r,
      t: mouseBox.t,
      b: mouseBox.b,
    },
    clearancePx: letterLeft - mouseRight,
  };
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: true,
    defaultViewport: { width: 1280, height: 800 },
    args: ["--hide-scrollbars"],
  });
  const page = await browser.newPage();
  await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });
  await page.waitForFunction(
    () =>
      document.querySelectorAll("div.absolute.top-0.left-0.will-change-transform")
        .length > 0,
    { timeout: 30000 },
  );
  await new Promise((r) => setTimeout(r, 900));

  let bestA = null;
  let bestB = null;

  for (let y = 0; y <= 1600; y += 6) {
    await page.evaluate((sy) => window.scrollTo(0, sy), y);
    await new Promise((r) => setTimeout(r, 12));
    const m = await mouseSnap(page);
    if (!m || m.sitting) continue;

    const hasTop =
      m.topLetters.count >= 3 &&
      m.topLetters.bottom != null &&
      m.topLetters.bottom < 140;
    const hasRight = m.rightLetters.count >= 5;
    const gapR = m.clearRight;
    const gapT = m.clearTop;

    // A: L composition — top + right letters, mouse in TR quadrant
    if (hasTop && hasRight && m.box.cx > m.vw * 0.5 && m.box.cy < m.vh * 0.55) {
      const closeRight = gapR != null && gapR > -8 && gapR < 60;
      const closeTop = gapT != null && gapT > -40 && gapT < 120;
      const score =
        (closeRight ? 80 : 0) +
        (closeTop ? 80 : 0) +
        (m.arcCount >= 2 ? 40 : 0) +
        (gapR != null ? Math.max(0, 40 - Math.abs(gapR - 14)) : 0) +
        (gapT != null ? Math.max(0, 40 - Math.abs(gapT - 18)) : 0) -
        Math.max(0, m.holeDist - 80) * 0.15 +
        (m.nudgeMag < 1 ? 15 : 0);
      if (!bestA || score > bestA.score) {
        bestA = { ...m, score, scrollY: y };
      }
    }

    // B: right column bank ≈ −90, mid body
    if (
      hasRight &&
      Math.abs(m.rotate + 90) < 12 &&
      m.box.cy > 100 &&
      m.box.cy < m.vh - 140 &&
      gapR != null &&
      gapR > -10 &&
      gapR < 50
    ) {
      const score =
        Math.max(0, 60 - Math.abs(gapR - 14)) +
        (m.clearance >= 8 && m.clearance <= 18 ? 40 : 0) +
        (m.nudgeMag < 1 ? 20 : 0) +
        (m.topLetters.count < 3 ? 10 : 0);
      if (!bestB || score > bestB.score) {
        bestB = { ...m, score, scrollY: y };
      }
    }
  }

  const shots = {};
  const pixel = {};

  async function capture(label, scrollY) {
    await page.evaluate((sy) => window.scrollTo(0, sy), scrollY);
    await new Promise((r) => setTimeout(r, 140));
    const m = await mouseSnap(page);
    const file = path.join(PHASE, `tight-${label}.png`);
    const buf = await page.screenshot({ type: "png" });
    fs.writeFileSync(file, buf);
    const px = m ? pixelClearanceFromPng(buf, m.box) : null;
    return { m, px, file: `phases/tight-${label}.png` };
  }

  if (!bestA) {
    console.error("No Shot A L composition found");
  } else {
    console.log(
      "bestA",
      bestA.scrollY,
      "clearR",
      bestA.clearRight,
      "clearT",
      bestA.clearTop,
      bestA.bank,
      "score",
      bestA.score,
    );
    const cap = await capture("a", bestA.scrollY);
    shots.a = { ...cap.m, scrollY: bestA.scrollY, score: bestA.score };
    pixel.a = cap.px;
  }

  if (!bestB) {
    console.error("No Shot B column found");
  } else {
    console.log(
      "bestB",
      bestB.scrollY,
      "clearR",
      bestB.clearRight,
      "clearance",
      bestB.clearance,
      bestB.bank,
      "score",
      bestB.score,
    );
    const cap = await capture("b", bestB.scrollY);
    shots.b = { ...cap.m, scrollY: bestB.scrollY, score: bestB.score };
    pixel.b = cap.px;
  }

  const bClear = pixel.b?.clearancePx ?? shots.b?.clearRight;
  const aClear = pixel.a?.clearancePx ?? shots.a?.clearRight;
  const [nxN, nyN] = (shots.a?.nudge || "0,0").split(",").map(Number);
  const aNudgeDotN =
    (nxN || 0) * (shots.a?.nx || 0) + (nyN || 0) * (shots.a?.ny || 0);

  const verdict = {
    bBankParallel: shots.b ? Math.abs(shots.b.rotate + 90) < 12 : false,
    bClearancePx: bClear ?? null,
    bSoleOnInk: bClear != null && bClear >= 8 && bClear <= 20,
    aHasTopRightL: !!(
      shots.a &&
      shots.a.topLetters?.count >= 3 &&
      shots.a.rightLetters?.count >= 5
    ),
    aClearancePx: aClear ?? null,
    aNotCornerHole: !!(
      shots.a &&
      ((shots.a.clearTop != null && shots.a.clearTop < 100) ||
        (aClear != null && aClear < 30 && shots.a.box.cy < 220))
    ),
    aNudgeTowardRailOnly: !shots.a || aNudgeDotN <= 0.5,
    aNudgeMag: shots.a?.nudgeMag ?? null,
  };

  const report = {
    shots,
    verdict,
    files: {
      a: "phases/tight-a.png",
      b: "phases/tight-b.png",
    },
    pixel,
    e2e: null,
    fix: {
      COLUMN_PAD: 2,
      SWEEP_BLOOM: 0,
      FOOT_GAP: 4,
      SOLE_EXTENT: 6,
      VERTICAL_FACE: 0.72,
      alongN_column: 12,
      softNudge: "toward-rail n only; no axis residual",
    },
  };

  fs.writeFileSync(
    path.join(PHASE, "tight-report.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(verdict, null, 2));
  await browser.close();

  if (
    !verdict.bSoleOnInk ||
    !verdict.aHasTopRightL ||
    !verdict.aNudgeTowardRailOnly
  ) {
    process.exitCode = 2;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
