/**
 * Capture compose-*.png as soon as each landmark is first seen.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, ".cursor", "screens");
const URL = process.env.WISPR_URL || "http://localhost:3000/wispr-infinito";
const EDGE =
  process.env.PUPPETEER_EXECUTABLE_PATH ||
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

async function mouseInfo(page) {
  return page.evaluate(() => {
    const wraps = Array.from(
      document.querySelectorAll("div.absolute.top-0.left-0.will-change-transform"),
    );
    const wrap = wraps.find((el) => el.querySelector("img, canvas"));
    if (!wrap) return null;
    const r = wrap.getBoundingClientRect();
    const img = wrap.querySelector("img");
    const ir = img?.getBoundingClientRect();
    const left = Math.min(r.left, ir?.left ?? r.left);
    const top = Math.min(r.top, ir?.top ?? r.top);
    const right = Math.max(r.right, ir?.right ?? r.right);
    const bottom = Math.max(r.bottom, ir?.bottom ?? r.bottom);
    const t = wrap.style.transform || "";
    const rot = /rotate\(\s*([-0-9.]+)deg\s*\)/i.exec(t);
    return {
      transform: t,
      rotate: rot ? Number(rot[1]) : null,
      cx: (left + right) / 2,
      cy: (top + bottom) / 2,
      left,
      top,
      right,
      bottom,
      w: right - left,
      h: bottom - top,
      vw: innerWidth,
      vh: innerHeight,
      scrollY: scrollY,
      marginL: left,
      marginR: innerWidth - right,
      marginT: top,
      marginB: innerHeight - bottom,
    };
  });
}

function normRot(rot) {
  if (rot == null || !Number.isFinite(rot)) return null;
  return (((rot % 360) + 360) % 360);
}

/** Right-column bank: atan2(-1,0) = -90 → 270°. */
function isRightBank(rot) {
  const a = normRot(rot);
  if (a == null) return false;
  return Math.min(Math.abs(a - 270), Math.abs(a - (-90 + 360))) < 28;
}

/** Left-column bank: +90°. */
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

async function shot(page, name) {
  const out = path.join(OUT_DIR, name);
  await new Promise((r) => setTimeout(r, 150));
  await page.screenshot({ path: out, fullPage: false });
  const m = await mouseInfo(page);
  console.log(name, m);
  return m;
}

async function fillRestMeter(page) {
  for (let i = 0; i < 45; i++) {
    await page.mouse.wheel({ deltaY: 150 });
    await new Promise((r) => setTimeout(r, 45));
  }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: true,
    args: ["--no-sandbox", "--window-size=1280,800"],
    defaultViewport: { width: 1280, height: 800 },
  });

  const done = {
    right: false,
    left: false,
    top: false,
    mid: false,
    sit: false,
  };

  try {
    const page = await browser.newPage();
    await page.goto(`${URL}?compose=${Date.now()}`, {
      waitUntil: "networkidle2",
      timeout: 60000,
    });
    await new Promise((r) => setTimeout(r, 1200));
    await page.evaluate(() => window.scrollTo(0, 0));

    let stuckCount = 0;
    let lastCx = null;
    let crossingDir = 0;

    for (
      let step = 0;
      step < 450 && !(done.right && done.left && done.top && done.mid && done.sit);
      step++
    ) {
      const yBefore = await page.evaluate(() => scrollY);
      await page.mouse.wheel({ deltaY: 70 });
      await new Promise((r) => setTimeout(r, 40));
      const yAfter = await page.evaluate(() => scrollY);

      if (Math.abs(yAfter - yBefore) < 1.2) stuckCount += 1;
      else stuckCount = 0;

      if (stuckCount >= 2) {
        if (!done.sit) {
          await shot(page, "compose-sitting.png");
          done.sit = true;
        }
        // Also capture right col if we're sitting on the right rest.
        const atGate = await mouseInfo(page);
        if (
          atGate &&
          !done.right &&
          atGate.cx > atGate.vw * 0.6 &&
          isRightBank(atGate.rotate)
        ) {
          await shot(page, "compose-right-col.png");
          done.right = true;
        }
        await fillRestMeter(page);
        stuckCount = 0;
      }

      const m = await mouseInfo(page);
      if (!m) continue;

      if (lastCx != null) crossingDir = m.cx - lastCx;
      lastCx = m.cx;

      if (
        !done.top &&
        m.scrollY < 800 &&
        flatBank(m.rotate) &&
        m.cx > m.vw * 0.22 &&
        m.cx < m.vw * 0.88
      ) {
        await shot(page, "compose-top-cross.png");
        done.top = true;
      }

      if (
        !done.mid &&
        m.scrollY > 350 &&
        flatBank(m.rotate) &&
        m.cx > m.vw * 0.18 &&
        m.cx < m.vw * 0.88 &&
        crossingDir < -1.5
      ) {
        await shot(page, "compose-mid-cross.png");
        done.mid = true;
      }

      if (!done.right && m.cx > m.vw * 0.62 && isRightBank(m.rotate)) {
        await shot(page, "compose-right-col.png");
        done.right = true;
      }

      if (!done.left && m.cx < m.vw * 0.38 && isLeftBank(m.rotate)) {
        await shot(page, "compose-left-col.png");
        done.left = true;
      }
    }

    console.log("done flags:", done);
    if (!done.right || !done.left || !done.top || !done.mid || !done.sit) {
      console.error("incomplete captures");
      process.exitCode = 1;
    }
  } finally {
    await browser.close().catch(() => {});
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
