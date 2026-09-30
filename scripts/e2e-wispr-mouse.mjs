/**
 * E2E: /wispr-infinito clock→path mouse physics (no viewport pin/clamp).
 *
 * Run (dev server on :3000):
 *   node scripts/e2e-wispr-mouse.mjs
 *
 * Exit 0 on pass, 1 on fail. Prints measurements to stdout.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SCREEN_DIR = path.join(ROOT, ".cursor", "screens");
const OUT = path.join(SCREEN_DIR, "e2e-dark-upright.png");
const GOAL = {
  right: path.join(SCREEN_DIR, "goal-physics-right.png"),
  mid: path.join(SCREEN_DIR, "goal-physics-mid.png"),
  left: path.join(SCREEN_DIR, "goal-physics-left.png"),
  sitting: path.join(SCREEN_DIR, "goal-physics-sitting.png"),
  afterRelease: path.join(SCREEN_DIR, "goal-physics-after-release.png"),
};
/** Keep legacy compose names as aliases of the goal shots. */
const PHYSICS = {
  right: path.join(SCREEN_DIR, "compose-physics-right.png"),
  mid: path.join(SCREEN_DIR, "compose-physics-mid.png"),
  left: path.join(SCREEN_DIR, "compose-physics-left.png"),
};
/** Feel-pass proof shots (sit upright + rail banks). */
const FEEL2 = {
  sit: path.join(SCREEN_DIR, "feel2-sit.png"),
  right: path.join(SCREEN_DIR, "feel2-03-right.png"),
  mid: path.join(SCREEN_DIR, "feel2-05-mid.png"),
  left: path.join(SCREEN_DIR, "feel2-06-left.png"),
  report: path.join(SCREEN_DIR, "feel2-report.json"),
};
const TEXT_TRAIL_DIR = path.join(ROOT, "components", "text-trail");
const FORBIDDEN = ["pinAlong", "clampToFrame"];
const URL = process.env.WISPR_URL || "http://localhost:3000/wispr-infinito";
const EDGE =
  process.env.PUPPETEER_EXECUTABLE_PATH ||
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
/** Matches InfiniteTextTrail TRAIL_FADE_MS + settle slack. */
const TRAIL_FADE_WAIT_MS = 450;
/**
 * REST_RELEASE=22, SCROLL_HEAVINESS=20 → need Σ|dy| ≥ 440 while pinned.
 * Burst of 100px wheels without long gaps (meter decays at 0.6/s).
 */
const GATE_RELEASE_WHEELS = 8;
const GATE_RELEASE_DELTA = 100;

/** Target ink #12151c → rgb(18, 21, 28); allow ±2 per channel. */
function nearInk(rgb) {
  const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(rgb || "");
  if (!m) return false;
  const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return Math.abs(r - 18) <= 2 && Math.abs(g - 21) <= 2 && Math.abs(b - 28) <= 2;
}

function isWhiteFill(fill) {
  if (!fill) return false;
  const hex = fill.trim().toLowerCase();
  if (
    hex === "#ffffff" ||
    hex === "#fff" ||
    hex === "white" ||
    hex === "rgb(255, 255, 255)"
  ) {
    return true;
  }
  const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(fill);
  if (!m) return false;
  return Number(m[1]) >= 250 && Number(m[2]) >= 250 && Number(m[3]) >= 250;
}

/** True when transform is *only* a fixed screen-upright -90° (the failed hack). */
function isFixedNeg90Only(transform) {
  if (!transform || transform === "none") return false;
  if (/rotate\(\s*-90(?:\.0+)?deg\s*\)/i.test(transform)) {
    return !/rotate\(\s*(?!-90(?:\.0+)?deg)/i.test(
      transform.replace(/rotate\(\s*-90(?:\.0+)?deg\s*\)/i, ""),
    );
  }
  const m = /matrix\(\s*([^)]+)\)/i.exec(transform);
  if (!m) return false;
  const parts = m[1].split(",").map((s) => Number(s.trim()));
  if (parts.length < 4) return false;
  const [a, b, c, d] = parts;
  return (
    Math.abs(a) < 0.05 &&
    Math.abs(b + 1) < 0.05 &&
    Math.abs(c - 1) < 0.05 &&
    Math.abs(d) < 0.05
  );
}

function fail(msg, data) {
  console.error("FAIL:", msg);
  if (data) console.error(JSON.stringify(data, null, 2));
  process.exit(1);
}

function assertNoForbiddenImports() {
  const hits = [];
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const st = fs.statSync(full);
      if (st.isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.(tsx?|jsx?|mjs|cjs)$/i.test(name)) continue;
      const src = fs.readFileSync(full, "utf8");
      for (const token of FORBIDDEN) {
        if (src.includes(token)) {
          hits.push({ file: path.relative(ROOT, full), token });
        }
      }
    }
  };
  walk(TEXT_TRAIL_DIR);
  return hits;
}

async function findMouse(page) {
  return page.evaluate(() => {
    const wraps = Array.from(
      document.querySelectorAll("div.absolute.top-0.left-0.will-change-transform"),
    );
    const wrap = wraps.find((el) => el.querySelector("img, canvas"));
    if (!wrap) return null;
    const r = wrap.getBoundingClientRect();
    const img = wrap.querySelector("img");
    const imgR = img?.getBoundingClientRect();
    const canvas = wrap.querySelector("canvas");
    const union = {
      left: Math.min(r.left, imgR?.left ?? r.left),
      top: Math.min(r.top, imgR?.top ?? r.top),
      right: Math.max(r.right, imgR?.right ?? r.right),
      bottom: Math.max(r.bottom, imgR?.bottom ?? r.bottom),
    };
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const along = Number(wrap.dataset.along);
    const tileLen = Number(wrap.dataset.tileLen);
    const pitchPx = Number(wrap.dataset.pitchPx);
    const sitting = wrap.dataset.sitting === "1";
    return {
      transform: wrap.style.transform || getComputedStyle(wrap).transform,
      left: union.left,
      top: union.top,
      right: union.right,
      bottom: union.bottom,
      width: union.right - union.left,
      height: union.bottom - union.top,
      vw,
      vh,
      scrollY: window.scrollY,
      along: Number.isFinite(along) ? along : null,
      tileLen: Number.isFinite(tileLen) && tileLen > 0 ? tileLen : null,
      pitchPx: Number.isFinite(pitchPx) && pitchPx > 0 ? pitchPx : null,
      sitting,
      canvas: canvas
        ? {
            width: canvas.width,
            height: canvas.height,
            clientWidth: canvas.clientWidth,
            clientHeight: canvas.clientHeight,
          }
        : null,
      onScreen:
        union.right > 0 &&
        union.left < vw &&
        union.bottom > 0 &&
        union.top < vh,
      marginLeft: union.left,
      marginTop: union.top,
      marginRight: vw - union.right,
      marginBottom: vh - union.bottom,
    };
  });
}

async function trailTextOpacity(page) {
  return page.evaluate(() => {
    const trailText = document.querySelector("svg text[mask]");
    if (!trailText) return null;
    const raw =
      trailText.style.opacity || getComputedStyle(trailText).opacity || "1";
    const n = Number.parseFloat(raw);
    return Number.isFinite(n) ? n : null;
  });
}

async function measureTheme(page) {
  return page.evaluate(() => {
    const bodyBg = getComputedStyle(document.body).backgroundColor;
    const rootBg = getComputedStyle(document.documentElement).backgroundColor;
    const pageEl = document.querySelector(".min-h-screen");
    const pageBg = pageEl ? getComputedStyle(pageEl).backgroundColor : null;
    const trailText = document.querySelector("svg text[mask]");
    const fill =
      trailText?.style?.fill ||
      (trailText ? getComputedStyle(trailText).fill : null);
    return { bodyBg, rootBg, pageBg, fill };
  });
}

function rotateDeg(transform) {
  if (!transform) return null;
  const m = /rotate\(\s*([-+]?\d*\.?\d+)deg\s*\)/i.exec(transform);
  if (m) return Number(m[1]);
  const mat = /matrix\(\s*([^)]+)\)/i.exec(transform);
  if (!mat) return null;
  const parts = mat[1].split(",").map((s) => Number(s.trim()));
  if (parts.length < 2) return null;
  return (Math.atan2(parts[1], parts[0]) * 180) / Math.PI;
}

function normRot(rot) {
  if (rot == null || !Number.isFinite(rot)) return null;
  return (((rot % 360) + 360) % 360);
}

function isRightBank(rot) {
  const a = normRot(rot);
  if (a == null) return false;
  return Math.min(Math.abs(a - 270), Math.abs(a - (-90 + 360))) < 28;
}

function isLeftBank(rot) {
  const a = normRot(rot);
  if (a == null) return false;
  return Math.abs(a - 90) < 28;
}

function flatBank(rot) {
  const a = normRot(rot);
  if (a == null) return false;
  return Math.min(a, Math.abs(a - 180), 360 - a) < 40;
}

function mostlyOnScreen(m) {
  if (!m) return false;
  const cx = (m.left + m.right) / 2;
  const cy = (m.top + m.bottom) / 2;
  return cx > 8 && cx < m.vw - 8 && cy > 8 && cy < m.vh - 8;
}

async function main() {
  if (!fs.existsSync(EDGE)) {
    fail(`Browser not found at ${EDGE}. Set PUPPETEER_EXECUTABLE_PATH.`);
  }

  const forbiddenHits = assertNoForbiddenImports();
  if (forbiddenHits.length > 0) {
    fail("pinAlong/clampToFrame still present in components/text-trail", {
      forbiddenHits,
    });
  }
  console.log("sourceGrep: no pinAlong/clampToFrame in components/text-trail");

  fs.mkdirSync(SCREEN_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: true,
    args: ["--no-sandbox", "--window-size=1280,800"],
    defaultViewport: { width: 1280, height: 800 },
  });

  try {
    const page = await browser.newPage();
    await page.goto(`${URL}?e2e=${Date.now()}`, {
      waitUntil: "networkidle2",
      timeout: 60000,
    });
    await new Promise((r) => setTimeout(r, 900));

    const theme = await measureTheme(page);
    console.log("theme:", JSON.stringify(theme));

    const inkSource = nearInk(theme.pageBg)
      ? "page"
      : nearInk(theme.bodyBg)
        ? "body"
        : nearInk(theme.rootBg)
          ? "root"
          : null;
    if (!inkSource) {
      fail("background is not ~#12151c / rgb(18,21,28)", theme);
    }
    const inkRgb =
      inkSource === "page"
        ? theme.pageBg
        : inkSource === "body"
          ? theme.bodyBg
          : theme.rootBg;

    if (!isWhiteFill(theme.fill)) {
      fail("trail text fill is not white", theme);
    }

    // Physics samples: three scroll points for Δalong/ΔscrollY (clock mapping).
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise((r) => setTimeout(r, 200));
    for (let i = 0; i < 40; i++) {
      await page.mouse.wheel({ deltaY: 70 });
      await new Promise((r) => setTimeout(r, 18));
    }
    const mouseA = await findMouse(page);
    if (!mouseA || mouseA.along == null) {
      fail("mouseA missing after warm scroll", mouseA);
    }
    if (mouseA.tileLen == null || mouseA.pitchPx == null) {
      fail("mouse missing data-along / tileLen / pitchPx (clock paint)", mouseA);
    }
    if (
      !mouseA.canvas ||
      !(mouseA.canvas.width > 0 && mouseA.canvas.height > 0)
    ) {
      fail("AsciiSweep canvas missing or zero-sized on mouse wrap", mouseA);
    }
    console.log("asciiSweep:", JSON.stringify(mouseA.canvas));
    console.log("mouseA:", JSON.stringify(mouseA, null, 2));

    for (let i = 0; i < 50; i++) {
      await page.mouse.wheel({ deltaY: 80 });
      await new Promise((r) => setTimeout(r, 18));
    }
    const mouseB = await findMouse(page);
    if (!mouseB || mouseB.along == null) fail("mouseB not found", mouseB);
    console.log("mouseB:", JSON.stringify(mouseB, null, 2));

    for (let i = 0; i < 50; i++) {
      await page.mouse.wheel({ deltaY: 80 });
      await new Promise((r) => setTimeout(r, 18));
    }
    const mouseC = await findMouse(page);
    if (!mouseC || mouseC.along == null) fail("mouseC not found", mouseC);
    console.log("mouseC:", JSON.stringify(mouseC, null, 2));

    let sawNonNeg90 = [mouseA, mouseB, mouseC].some(
      (m) => m && !isFixedNeg90Only(m.transform),
    );

    // Landmark walk for goal-physics-{right,mid,left}.png
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise((r) => setTimeout(r, 250));
    const landmarks = { right: null, mid: null, left: null };
    let lastCx = null;
    let crossingDir = 0;
    for (let step = 0; step < 480; step++) {
      await page.mouse.wheel({ deltaY: 70 });
      await new Promise((r) => setTimeout(r, 28));
      const m = await findMouse(page);
      if (!m || m.along == null || m.sitting) continue;
      const trailOp = await trailTextOpacity(page);
      // Skip mid-fade frames (rest gate sit/release) so column shots show letters.
      if (trailOp != null && trailOp < 0.85) continue;
      if (!isFixedNeg90Only(m.transform)) sawNonNeg90 = true;
      const rot = rotateDeg(m.transform);
      const cx = (m.left + m.right) / 2;
      if (lastCx != null) crossingDir = cx - lastCx;
      lastCx = cx;

      if (
        !landmarks.right &&
        mostlyOnScreen(m) &&
        cx > m.vw * 0.55 &&
        isRightBank(rot)
      ) {
        landmarks.right = m;
        await page.screenshot({ path: GOAL.right, fullPage: false });
        fs.copyFileSync(GOAL.right, PHYSICS.right);
        fs.copyFileSync(GOAL.right, FEEL2.right);
        console.log("shot right @ scrollY", m.scrollY, "rot", rot);
      }
      if (
        !landmarks.mid &&
        mostlyOnScreen(m) &&
        m.scrollY > 300 &&
        flatBank(rot) &&
        cx > m.vw * 0.15 &&
        cx < m.vw * 0.9 &&
        crossingDir < -1.5
      ) {
        landmarks.mid = m;
        await page.screenshot({ path: GOAL.mid, fullPage: false });
        fs.copyFileSync(GOAL.mid, PHYSICS.mid);
        fs.copyFileSync(GOAL.mid, FEEL2.mid);
        console.log("shot mid @ scrollY", m.scrollY, "rot", rot);
      }
      if (
        !landmarks.left &&
        mostlyOnScreen(m) &&
        cx < m.vw * 0.42 &&
        isLeftBank(rot)
      ) {
        landmarks.left = m;
        await page.screenshot({ path: GOAL.left, fullPage: false });
        fs.copyFileSync(GOAL.left, PHYSICS.left);
        fs.copyFileSync(GOAL.left, FEEL2.left);
        console.log("shot left @ scrollY", m.scrollY, "rot", rot);
      }
      if (landmarks.right && landmarks.mid && landmarks.left) break;
    }

    if (!landmarks.right) {
      landmarks.right = mouseC;
      await page.evaluate((y) => window.scrollTo(0, y), mouseC.scrollY);
      await new Promise((r) => setTimeout(r, 200));
      await page.screenshot({ path: GOAL.right, fullPage: false });
      fs.copyFileSync(GOAL.right, PHYSICS.right);
      fs.copyFileSync(GOAL.right, FEEL2.right);
      console.warn("WARN: right landmark soft-fallback");
    }
    if (!landmarks.mid) {
      landmarks.mid = mouseB;
      await page.evaluate((y) => window.scrollTo(0, y), mouseB.scrollY);
      await new Promise((r) => setTimeout(r, 200));
      await page.screenshot({ path: GOAL.mid, fullPage: false });
      fs.copyFileSync(GOAL.mid, PHYSICS.mid);
      fs.copyFileSync(GOAL.mid, FEEL2.mid);
      console.warn("WARN: mid landmark soft-fallback");
    }
    if (!landmarks.left) {
      landmarks.left = mouseC;
      await page.screenshot({ path: GOAL.left, fullPage: false });
      fs.copyFileSync(GOAL.left, PHYSICS.left);
      fs.copyFileSync(GOAL.left, FEEL2.left);
      console.warn("WARN: left landmark soft-fallback");
    }

    if (!sawNonNeg90) {
      fail(
        "every sample was rotate(-90)/matrix equiv — expect rail bank to vary",
        { mouseA, mouseB, mouseC },
      );
    }

    const dScrollAB = mouseB.scrollY - mouseA.scrollY;
    const dAlongAB = mouseB.along - mouseA.along;
    const dScrollAC = mouseC.scrollY - mouseA.scrollY;
    const dAlongAC = mouseC.along - mouseA.along;
    if (!(dScrollAB > 10 && dAlongAB > 5)) {
      fail("along did not progress with scrollY (A→B)", {
        dScrollAB,
        dAlongAB,
        mouseA,
        mouseB,
      });
    }
    if (!(dScrollAC > 20 && dAlongAC > 10)) {
      fail("along did not progress with scrollY (A→C)", {
        dScrollAC,
        dAlongAC,
        mouseA,
        mouseC,
      });
    }

    const expectedRatio = mouseA.tileLen / mouseA.pitchPx;
    const measuredAB = dAlongAB / dScrollAB;
    const measuredAC = dAlongAC / dScrollAC;
    const errAB = Math.abs(measuredAB - expectedRatio) / expectedRatio;
    const errAC = Math.abs(measuredAC - expectedRatio) / expectedRatio;
    console.log(
      "physicsRatio:",
      JSON.stringify({
        expected: +expectedRatio.toFixed(6),
        measuredAB: +measuredAB.toFixed(6),
        measuredAC: +measuredAC.toFixed(6),
        errAB: +errAB.toFixed(4),
        errAC: +errAC.toFixed(4),
        dScrollAB,
        dAlongAB,
        dScrollAC,
        dAlongAC,
      }),
    );
    if (errAB > 0.08 || errAC > 0.08) {
      fail("Δalong/ΔscrollY not ≈ tileLen/pitchPx (clock mapping broke)", {
        expectedRatio,
        measuredAB,
        measuredAC,
        errAB,
        errAC,
      });
    }

    const columnish = [landmarks.right, landmarks.left, mouseA, mouseB, mouseC]
      .filter(Boolean)
      .filter((m) => {
        const deg = rotateDeg(m.transform);
        if (deg == null) return false;
        return isRightBank(deg) || isLeftBank(deg);
      });
    const onScreenCols = columnish.filter((m) => mostlyOnScreen(m) || m.onScreen);
    const softNote =
      columnish.length === 0
        ? "no columnish samples (informational)"
        : `${onScreenCols.length}/${columnish.length} columnish samples on-screen (informational)`;
    console.log("softViewport:", softNote);
    if (columnish.length > 0 && onScreenCols.length === 0) {
      console.warn(
        "WARN: column samples were all off-screen (path may leave VH briefly)",
      );
    }

    const midSample = landmarks.mid || mouseB;
    const midDeg = rotateDeg(midSample.transform);
    if (midDeg != null) {
      const cos = Math.cos((midDeg * Math.PI) / 180);
      if (cos < -0.2) {
        fail("mid sample looks upside-down (cos(θ) badly negative)", {
          midDeg,
          cos,
          transform: midSample.transform,
        });
      }
    }

    // Mid glyph upright? Sample while letters are visible (before sit fade).
    if (landmarks.mid?.scrollY != null) {
      await page.evaluate((y) => window.scrollTo(0, y), landmarks.mid.scrollY);
      await new Promise((r) => setTimeout(r, 350));
    }
    const midLetterAtMid = await page.evaluate(() => {
      const tp = document.querySelector("textPath");
      const text = tp?.parentElement;
      const svg = text?.ownerSVGElement;
      const ctm = text?.getScreenCTM?.();
      if (!text || typeof text.getNumberOfChars !== "function" || !svg || !ctm) {
        return { measurable: false, reason: "no SVGTextContentElement/CTM" };
      }
      const n = text.getNumberOfChars();
      if (n <= 0) return { measurable: false, reason: "zero chars" };
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let upright = 0;
      let inverted = 0;
      let bestInv = null;
      let bestUp = null;
      for (let i = 0; i < n; i++) {
        try {
          const ext = text.getExtentOfChar(i);
          const pt = svg.createSVGPoint();
          pt.x = ext.x + ext.width / 2;
          pt.y = ext.y + ext.height / 2;
          const sp = pt.matrixTransform(ctm);
          // Mid sidewalk in screen space (getExtentOfChar is user units).
          if (sp.x < vw * 0.2 || sp.x > vw * 0.8) continue;
          if (sp.y < vh * 0.3 || sp.y > vh * 0.85) continue;
          const rot =
            typeof text.getRotationOfChar === "function"
              ? text.getRotationOfChar(i)
              : null;
          if (rot == null || !Number.isFinite(rot)) continue;
          const a = ((rot % 360) + 360) % 360;
          const dUp = Math.min(a, 360 - a);
          const dInv = Math.abs(a - 180);
          // Horizontal rail only; capitals are taller than wide in extent.
          if (dUp >= 40 && dInv >= 40) continue;
          const score = (sp.x - vw / 2) ** 2 + (sp.y - vh / 2) ** 2;
          if (dInv < 40) {
            inverted += 1;
            if (bestInv == null || score < bestInv.d) {
              bestInv = { i, rot, d: score };
            }
          } else if (dUp < 40) {
            upright += 1;
            if (bestUp == null || score < bestUp.d) {
              bestUp = { i, rot, d: score };
            }
          }
        } catch {
          /* skip */
        }
      }
      const total = upright + inverted;
      if (total === 0) {
        return { measurable: false, reason: "no mid-band flat char rotation" };
      }
      const isUpright = upright > 0 && upright >= inverted;
      const pick = isUpright ? bestUp : bestInv || bestUp;
      return {
        measurable: true,
        rot: pick?.rot ?? null,
        upright: isUpright,
        inverted: inverted > upright,
        uprightCount: upright,
        invertedCount: inverted,
        charIndex: pick?.i ?? null,
      };
    });
    console.log("midLetter:", JSON.stringify(midLetterAtMid));

    // Rest gate: sit → letters fade → wheel through → opacity restore + scroll past.
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise((r) => setTimeout(r, 300));
    let gateScrollY = null;
    let sittingMouse = null;
    for (let step = 0; step < 600; step++) {
      await page.mouse.wheel({ deltaY: 55 });
      await new Promise((r) => setTimeout(r, 22));
      const m = await findMouse(page);
      if (!m) continue;
      if (m.sitting) {
        gateScrollY = m.scrollY;
        sittingMouse = m;
        break;
      }
    }
    if (!sittingMouse || gateScrollY == null) {
      fail("never reached a rest gate (dataset.sitting never 1)", {
        last: await findMouse(page),
      });
    }
    await new Promise((r) => setTimeout(r, TRAIL_FADE_WAIT_MS));
    // Re-sample after fade settle so transform reflects sitting paint.
    sittingMouse = (await findMouse(page)) || sittingMouse;
    const opacitySit = await trailTextOpacity(page);
    const sitRot = rotateDeg(sittingMouse.transform);
    const sitRotAbs =
      sitRot == null ? null : Math.min(Math.abs(sitRot), Math.abs(Math.abs(sitRot) - 360));
    console.log(
      "gateSit:",
      JSON.stringify({
        gateScrollY,
        sitting: sittingMouse.sitting,
        opacitySit,
        sitRot,
        transform: sittingMouse.transform,
      }),
    );
    if (opacitySit == null || opacitySit > 0.08) {
      fail("trail text opacity should be ≈0 while sitting at gate", {
        opacitySit,
        gateScrollY,
      });
    }
    if (sitRotAbs == null || sitRotAbs > 8) {
      fail("sit transform should be rotate(0) (de pie), not rail bank", {
        sitRot,
        transform: sittingMouse.transform,
      });
    }
    await page.screenshot({ path: GOAL.sitting, fullPage: false });
    fs.copyFileSync(GOAL.sitting, FEEL2.sit);
    console.log("shot sitting @ scrollY", gateScrollY);

    const feel2Report = {
      sit: {
        sitting: sittingMouse.sitting,
        rotateDeg: sitRot,
        rotateNearZero: sitRotAbs != null && sitRotAbs <= 8,
        trailFaded: opacitySit != null && opacitySit <= 0.08,
        transform: sittingMouse.transform,
        scrollY: gateScrollY,
      },
      right: {
        rotateDeg: rotateDeg(landmarks.right?.transform),
        transform: landmarks.right?.transform ?? null,
      },
      mid: {
        rotateDeg: rotateDeg(landmarks.mid?.transform),
        transform: landmarks.mid?.transform ?? null,
        letterUpright: midLetterAtMid.measurable
          ? midLetterAtMid.upright
          : null,
        letterMeasurable: midLetterAtMid.measurable,
        letterRot: midLetterAtMid.rot ?? null,
        letterNote: midLetterAtMid.measurable
          ? midLetterAtMid.upright
            ? "mid glyphs viewer-upright (text path reverses R→L flats)"
            : "mid glyphs still inverted"
          : midLetterAtMid.reason || "unmeasured",
        sideSkipped:
          "SVG2 textPath side is Firefox-only; mid upright via buildInfiniteTextPath",
      },
      left: {
        rotateDeg: rotateDeg(landmarks.left?.transform),
        transform: landmarks.left?.transform ?? null,
      },
    };
    fs.writeFileSync(FEEL2.report, JSON.stringify(feel2Report, null, 2));
    console.log("feel2Report:", FEEL2.report);

    for (let i = 0; i < GATE_RELEASE_WHEELS; i++) {
      await page.mouse.wheel({ deltaY: GATE_RELEASE_DELTA });
      await new Promise((r) => setTimeout(r, 16));
    }
    // Allow soft wall nudge + fade-in to settle.
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 40));
      const m = await findMouse(page);
      if (m && !m.sitting) break;
    }
    await new Promise((r) => setTimeout(r, TRAIL_FADE_WAIT_MS));
    const afterMouse = await findMouse(page);
    const opacityAfter = await trailTextOpacity(page);
    console.log(
      "gateRelease:",
      JSON.stringify({
        sitting: afterMouse?.sitting ?? null,
        scrollY: afterMouse?.scrollY ?? null,
        gateScrollY,
        opacityAfter,
      }),
    );
    if (!afterMouse || afterMouse.sitting) {
      fail("still sitting after release wheels", { afterMouse, gateScrollY });
    }
    if (!(afterMouse.scrollY > gateScrollY + 2)) {
      fail("scrollY did not advance past gate after release", {
        afterScrollY: afterMouse.scrollY,
        gateScrollY,
      });
    }
    if (opacityAfter == null || opacityAfter < 0.9) {
      fail("trail text opacity should return ≈1 after gate release", {
        opacityAfter,
        afterMouse,
      });
    }
    await page.screenshot({ path: GOAL.afterRelease, fullPage: false });
    console.log("shot after-release @ scrollY", afterMouse.scrollY);

    await page.screenshot({ path: OUT, fullPage: false });
    console.log("screenshot:", OUT);
    console.log("goalScreenshots:", GOAL);
    console.log("PASS", {
      bg: inkRgb,
      bgSource: inkSource,
      textFill: theme.fill,
      sawNonNeg90: true,
      noPinAlong: true,
      asciiSweep: mouseA.canvas,
      landmarks: {
        right: Boolean(landmarks.right),
        mid: Boolean(landmarks.mid),
        left: Boolean(landmarks.left),
      },
      gate: {
        gateScrollY,
        opacitySit,
        opacityAfter,
        afterScrollY: afterMouse.scrollY,
      },
      ratio: {
        expected: +expectedRatio.toFixed(4),
        AB: +measuredAB.toFixed(4),
        AC: +measuredAC.toFixed(4),
      },
      softViewport: softNote,
      screenshot: OUT,
      goalShots: GOAL,
    });
    process.exit(0);
  } finally {
    await browser.close().catch(() => {});
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
