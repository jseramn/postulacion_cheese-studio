/**
 * Capture upright-* proof shots + upright-report.json for mid glyph orientation.
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
        // Horizontal rail only (columns are ~±90). Capitals are taller than
        // wide, so do not use extent aspect as a flatness test.
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

async function main() {
  fs.mkdirSync(PHASE, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: true,
    args: ["--no-sandbox", "--window-size=1280,800"],
    defaultViewport: { width: 1280, height: 800 },
  });
  const page = await browser.newPage();
  await page.goto(`${URL}?upright=${Date.now()}`, {
    waitUntil: "networkidle2",
    timeout: 60000,
  });
  await new Promise((r) => setTimeout(r, 600));

  const lengths = await pathLengthCheck(page);
  console.log("pathLengths:", JSON.stringify(lengths));

  const landmarks = { right: null, mid: null, left: null, sit: null };
  let passedSit = false;

  for (let step = 0; step < 800; step++) {
    await page.mouse.wheel({ deltaY: 55 });
    await new Promise((r) => setTimeout(r, 22));
    const m = await findMouse(page);
    if (!m) continue;

    if (m.sitting && !landmarks.sit) {
      await new Promise((r) => setTimeout(r, 400));
      landmarks.sit = (await findMouse(page)) || m;
      await page.screenshot({
        path: path.join(PHASE, "upright-sit.png"),
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

    if (
      !landmarks.right &&
      !passedSit &&
      deg != null &&
      Math.abs(Math.abs(deg) - 90) < 15 &&
      nx != null &&
      nx < -0.7 &&
      m.box.cx > 700
    ) {
      landmarks.right = m;
      await page.screenshot({
        path: path.join(PHASE, "upright-03-right.png"),
        fullPage: false,
      });
      console.log("right", m.scrollY, m.bank);
    }

    // Real mid: after first sit release, flat bank ny≈-1, not the top cross.
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
        path: path.join(PHASE, "upright-05-mid.png"),
        fullPage: false,
      });
      // Probe while still on mid (later scrollTo can miss text window).
      landmarks.midLetter = await midLetterProbe(page);
      console.log("mid", m.scrollY, m.bank, JSON.stringify(landmarks.midLetter));
    }

    if (
      !landmarks.left &&
      passedSit &&
      deg != null &&
      Math.abs(Math.abs(deg) - 90) < 12 &&
      nx != null &&
      nx > 0.7
    ) {
      landmarks.left = m;
      await page.screenshot({
        path: path.join(PHASE, "upright-06-left.png"),
        fullPage: false,
      });
      console.log("left", m.scrollY, m.bank);
    }

    if (landmarks.right && landmarks.mid && landmarks.left && landmarks.sit) {
      break;
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
      path: path.join(PHASE, "upright-05-mid.png"),
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

  const report = {
    pathLengths: lengths,
    midLetter: letter,
    midGlyphsUpright: letter.measurable
      ? letter.upright || letter.mostlyUpright
      : null,
    shots: {
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
    files: {
      mid: "phases/upright-05-mid.png",
      right: "phases/upright-03-right.png",
      left: "phases/upright-06-left.png",
      sit: "phases/upright-sit.png",
    },
    approach:
      "text-only buildInfiniteTextPath (reverse R→L flats via M+cubic+M); mouse sample unchanged",
  };
  const reportPath = path.join(PHASE, "upright-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log("report:", reportPath);

  const ok =
    lengths.equal &&
    letter.measurable &&
    (letter.upright || letter.mostlyUpright) &&
    landmarks.mid &&
    landmarks.right &&
    landmarks.left &&
    landmarks.sit?.sitting &&
    sitRotAbs != null &&
    sitRotAbs <= 8;

  await browser.close();
  if (!ok) {
    console.error("CAPTURE incomplete or mid glyphs not upright");
    process.exit(1);
  }
  console.log("CAPTURE OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
