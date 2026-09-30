/**
 * Capture final-* proof shots + final-report.json.
 * True right column: |nx|≈1, |ny| small, mid-viewport (not top corner).
 * Requires pnpm dev on :3000.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PHASE = path.join(ROOT, ".cursor", "screens", "phases");
const URL = process.env.WISPR_URL || "http://localhost:3000/wispr-infinito";
const EDGE =
  process.env.PUPPETEER_EXECUTABLE_PATH ||
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

async function findMouse(page) {
  return page.evaluate(() => {
    const wraps = Array.from(
      document.querySelectorAll("div.absolute.top-0.left-0.will-change-transform"),
    );
    const wrap = wraps.find((el) => el.querySelector("img"));
    if (!wrap) return null;
    const r = wrap.getBoundingClientRect();
    const bank = wrap.dataset.bank || "";
    const parts = bank.split(",");
    return {
      scrollY: window.scrollY,
      transform: wrap.style.transform || "",
      bank,
      rotate: parts[0] ? Number(parts[0]) : null,
      nx: parts[1] ? Number(parts[1]) : null,
      ny: parts[2] ? Number(parts[2]) : null,
      facing: parts[3] || null,
      sitting: wrap.dataset.sitting === "1",
      box: {
        l: +r.left.toFixed(1),
        t: +r.top.toFixed(1),
        r: +r.right.toFixed(1),
        b: +r.bottom.toFixed(1),
        cx: +((r.left + r.right) / 2).toFixed(1),
        cy: +((r.top + r.bottom) / 2).toFixed(1),
      },
    };
  });
}

async function midLetterProbe(page) {
  return page.evaluate(() => {
    const tp = document.querySelector("textPath");
    const text = tp?.parentElement;
    const svg = text?.ownerSVGElement;
    const ctm = text?.getScreenCTM();
    if (!text?.getNumberOfChars || !svg || !ctm) {
      return { measurable: false, reason: "no SVGTextContentElement/CTM" };
    }
    const n = text.getNumberOfChars();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let upright = 0;
    let inverted = 0;
    let best = null;
    for (let i = 0; i < n; i++) {
      try {
        const ext = text.getExtentOfChar(i);
        const pt = svg.createSVGPoint();
        pt.x = ext.x + ext.width / 2;
        pt.y = ext.y + ext.height / 2;
        const sp = pt.matrixTransform(ctm);
        if (sp.x < vw * 0.2 || sp.x > vw * 0.8) continue;
        if (sp.y < vh * 0.3 || sp.y > vh * 0.85) continue;
        const rot = text.getRotationOfChar(i);
        if (rot == null || !Number.isFinite(rot)) continue;
        const a = ((rot % 360) + 360) % 360;
        const dUp = Math.min(a, 360 - a);
        const dInv = Math.abs(a - 180);
        if (dUp >= 40 && dInv >= 40) continue;
        const score = (sp.x - vw / 2) ** 2 + (sp.y - vh / 2) ** 2;
        if (dInv < 40) {
          inverted += 1;
          if (best == null || score < best.d) {
            best = { i, rot, d: score, kind: "inv", x: sp.x, y: sp.y };
          }
        } else if (dUp < 40) {
          upright += 1;
          if (best == null || score < best.d) {
            best = { i, rot, d: score, kind: "up", x: sp.x, y: sp.y };
          }
        }
      } catch {
        /* skip */
      }
    }
    if (upright + inverted === 0) {
      return { measurable: false, reason: "no mid-band flat char rotation" };
    }
    return {
      measurable: true,
      upright: inverted === 0 && upright > 0,
      mostlyUpright: upright > inverted && upright > 0,
      uprightCount: upright,
      invertedCount: inverted,
      rot: best?.rot ?? null,
      sample: best,
    };
  });
}

async function pathLengthCheck(page) {
  return page.evaluate(() => {
    const tp = document.querySelector("textPath");
    const href = tp?.getAttribute("href");
    const textPath = href ? document.querySelector(href) : null;
    const mask = document.querySelector("mask path");
    const textLen = textPath?.getTotalLength?.() ?? null;
    const maskLen = mask?.getTotalLength?.() ?? null;
    return {
      maskLen,
      textLen,
      equal:
        maskLen != null &&
        textLen != null &&
        Math.abs(maskLen - textLen) < 0.5,
    };
  });
}

async function releaseSit(page) {
  for (let i = 0; i < 12; i++) {
    await page.mouse.wheel({ deltaY: 100 });
    await new Promise((r) => setTimeout(r, 16));
  }
  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 40));
    const m = await findMouse(page);
    if (m && !m.sitting) break;
  }
  await new Promise((r) => setTimeout(r, 400));
}

function nearAngle(deg, target, tol) {
  if (deg == null) return false;
  const d = Math.abs((((deg - target) % 360) + 540) % 360 - 180);
  return d < tol;
}

/** True vertical right climb — reject top-corner entry (box.t < 0, |ny| large). */
function isTrueRightColumn(m) {
  if (!m || m.sitting) return false;
  if (m.nx == null || m.ny == null || m.rotate == null) return false;
  if (m.nx > -0.92) return false;
  if (Math.abs(m.ny) > 0.2) return false;
  if (!nearAngle(m.rotate, -90, 12) && !nearAngle(m.rotate, 270, 12)) {
    return false;
  }
  if (m.box.cx < 900) return false;
  if (m.box.t < 40) return false;
  if (m.box.cy < 80 || m.box.cy > 520) return false;
  return true;
}

async function main() {
  fs.mkdirSync(PHASE, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: true,
    args: ["--no-sandbox", "--window-size=1280,800"],
    defaultViewport: { width: 1280, height: 800 },
  });
  const page = await browser.newPage();
  await page.goto(`${URL}?final=${Date.now()}`, {
    waitUntil: "networkidle2",
    timeout: 60000,
  });
  await new Promise((r) => setTimeout(r, 600));

  const lengths = await pathLengthCheck(page);
  console.log("pathLengths:", JSON.stringify(lengths));

  const landmarks = {
    top: null,
    right: null,
    mid: null,
    left: null,
    sit: null,
  };
  let passedSit = false;
  let bestRight = null;
  let bestRightScore = Infinity;

  for (let step = 0; step < 900; step++) {
    await page.mouse.wheel({ deltaY: 50 });
    await new Promise((r) => setTimeout(r, 20));
    const m = await findMouse(page);
    if (!m) continue;

    if (m.sitting && !landmarks.sit) {
      await new Promise((r) => setTimeout(r, 400));
      landmarks.sit = (await findMouse(page)) || m;
      await page.screenshot({
        path: path.join(PHASE, "final-sit.png"),
        fullPage: false,
      });
      console.log("sit", landmarks.sit.scrollY, landmarks.sit.bank);
      await releaseSit(page);
      passedSit = true;
      continue;
    }

    const deg = m.rotate;
    const nx = m.nx;
    const ny = m.ny;
    const near0 =
      deg != null &&
      Math.min(Math.abs(deg), Math.abs(Math.abs(deg) - 360)) < 20;

    // Top cross before first sit: flat bank, early scroll.
    if (
      !landmarks.top &&
      !passedSit &&
      near0 &&
      ny != null &&
      ny < -0.55 &&
      m.scrollY < 350 &&
      m.box.cx > 500
    ) {
      landmarks.top = m;
      await page.screenshot({
        path: path.join(PHASE, "final-02-top.png"),
        fullPage: false,
      });
      console.log("top", m.scrollY, m.bank);
    }

    // Collect best true right before sit (prefer mid-viewport cy).
    if (!passedSit && isTrueRightColumn(m)) {
      const score = Math.abs(m.box.cy - 280);
      if (score < bestRightScore) {
        bestRightScore = score;
        bestRight = m;
      }
    }

    if (
      !landmarks.mid &&
      passedSit &&
      near0 &&
      ny != null &&
      ny < -0.55 &&
      m.scrollY > 750 &&
      m.box.cx > 350 &&
      m.box.cx < 1000
    ) {
      landmarks.mid = m;
      await page.screenshot({
        path: path.join(PHASE, "final-05-mid.png"),
        fullPage: false,
      });
      landmarks.midLetter = await midLetterProbe(page);
      console.log("mid", m.scrollY, m.bank, JSON.stringify(landmarks.midLetter));
    }

    if (
      !landmarks.left &&
      passedSit &&
      deg != null &&
      Math.abs(Math.abs(deg) - 90) < 12 &&
      nx != null &&
      nx > 0.7 &&
      m.box.t > -60
    ) {
      landmarks.left = m;
      await page.screenshot({
        path: path.join(PHASE, "final-06-left.png"),
        fullPage: false,
      });
      console.log("left", m.scrollY, m.bank);
    }

    if (
      landmarks.top &&
      landmarks.mid &&
      landmarks.left &&
      landmarks.sit &&
      bestRight
    ) {
      break;
    }
  }

  // Revisit best right column for a clean shot (scroll may have passed sit).
  if (bestRight?.scrollY != null) {
    await page.evaluate((y) => window.scrollTo(0, y), bestRight.scrollY);
    await new Promise((r) => setTimeout(r, 200));
    await page.mouse.wheel({ deltaY: 2 });
    await new Promise((r) => setTimeout(r, 350));
    let m = await findMouse(page);
    // Walk a little if we landed on sit or corner.
    for (let i = 0; i < 40 && (!m || !isTrueRightColumn(m)); i++) {
      await page.mouse.wheel({ deltaY: i < 20 ? -40 : 40 });
      await new Promise((r) => setTimeout(r, 18));
      m = await findMouse(page);
    }
    if (m && isTrueRightColumn(m)) {
      landmarks.right = m;
      await page.screenshot({
        path: path.join(PHASE, "final-03-right.png"),
        fullPage: false,
      });
      console.log("right", m.scrollY, m.bank);
    } else {
      landmarks.right = bestRight;
      console.warn("right revisit weak; using wheel-walk sample", bestRight.bank);
      await page.evaluate((y) => window.scrollTo(0, y), bestRight.scrollY);
      await new Promise((r) => setTimeout(r, 300));
      await page.screenshot({
        path: path.join(PHASE, "final-03-right.png"),
        fullPage: false,
      });
    }
  }

  let letter = landmarks.midLetter || null;
  if (!letter?.measurable && landmarks.mid?.scrollY != null) {
    await page.evaluate((y) => window.scrollTo(0, y), landmarks.mid.scrollY);
    await new Promise((r) => setTimeout(r, 200));
    await page.mouse.wheel({ deltaY: 2 });
    await new Promise((r) => setTimeout(r, 400));
    landmarks.mid = (await findMouse(page)) || landmarks.mid;
    await page.screenshot({
      path: path.join(PHASE, "final-05-mid.png"),
      fullPage: false,
    });
    letter = await midLetterProbe(page);
  }
  console.log("midLetter:", JSON.stringify(letter));

  const sitRot = landmarks.sit?.rotate ?? null;
  const sitRotAbs =
    sitRot == null
      ? null
      : Math.min(Math.abs(sitRot), Math.abs(Math.abs(sitRot) - 360));

  const rightOk =
    landmarks.right &&
    isTrueRightColumn(landmarks.right) &&
    nearAngle(landmarks.right.rotate, -90, 12) &&
    landmarks.right.facing === "right";

  const report = {
    pathLengths: lengths,
    midLetter: letter,
    midGlyphsUpright: letter?.measurable
      ? letter.upright || letter.mostlyUpright
      : null,
    shots: {
      top: landmarks.top,
      mid: landmarks.mid,
      right: landmarks.right,
      left: landmarks.left,
      sit: landmarks.sit
        ? {
            scrollY: landmarks.sit.scrollY,
            sitting: landmarks.sit.sitting,
            rotate: landmarks.sit.rotate,
            bank: landmarks.sit.bank,
            rotateNearZero: sitRotAbs != null && sitRotAbs <= 8,
          }
        : null,
    },
    rightColumnOk: !!rightOk,
    files: {
      top: "phases/final-02-top.png",
      mid: "phases/final-05-mid.png",
      right: "phases/final-03-right.png",
      left: "phases/final-06-left.png",
      sit: "phases/final-sit.png",
    },
    approach:
      "true-right via |nx|≈1+|ny|<0.2+mid-viewport; text-only isRtlFlat×3+control band; mouse sample unchanged",
  };
  const reportPath = path.join(PHASE, "final-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log("report:", reportPath);

  const ok =
    lengths.equal &&
    letter?.measurable &&
    (letter.upright || letter.mostlyUpright) &&
    landmarks.mid &&
    rightOk &&
    landmarks.left &&
    landmarks.top &&
    landmarks.sit?.sitting &&
    sitRotAbs != null &&
    sitRotAbs <= 8;

  await browser.close();
  if (!ok) {
    console.error("CAPTURE incomplete", {
      lengths: lengths.equal,
      letter: letter?.uprightCount,
      mid: !!landmarks.mid,
      rightOk,
      left: !!landmarks.left,
      top: !!landmarks.top,
      sit: landmarks.sit?.sitting,
      sitRotAbs,
    });
    process.exit(1);
  }
  console.log("CAPTURE OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
