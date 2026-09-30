import puppeteer from "puppeteer-core";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUTL = path.join(ROOT, ".cursor", "screens", "compose-left-col.png");
const OUTS = path.join(ROOT, ".cursor", "screens", "compose-sitting.png");
const EDGE =
  process.env.PUPPETEER_EXECUTABLE_PATH ||
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

async function info(page) {
  return page.evaluate(() => {
    const wraps = Array.from(
      document.querySelectorAll("div.absolute.top-0.left-0.will-change-transform"),
    );
    const wrap = wraps.find((el) => el.querySelector("img, canvas"));
    if (!wrap) return null;
    const r = wrap.getBoundingClientRect();
    const t = wrap.style.transform || getComputedStyle(wrap).transform;
    return {
      t,
      left: r.left,
      right: r.right,
      top: r.top,
      bottom: r.bottom,
      cx: (r.left + r.right) / 2,
      sy: scrollY,
      vw: innerWidth,
    };
  });
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: true,
    args: ["--no-sandbox", "--window-size=1280,800"],
    defaultViewport: { width: 1280, height: 800 },
  });
  try {
    const page = await browser.newPage();
    await page.goto(`http://localhost:3000/wispr-infinito?L5=${Date.now()}`, {
      waitUntil: "networkidle2",
      timeout: 60000,
    });
    await new Promise((r) => setTimeout(r, 900));
    await page.evaluate(() => window.scrollTo(0, 0));

    let stuck = 0;
    let gotLeft = false;
    let gotSit = false;

    for (let i = 0; i < 500; i++) {
      const y0 = await page.evaluate(() => scrollY);
      await page.mouse.wheel({ deltaY: 50 });
      await new Promise((r) => setTimeout(r, 40));
      const y1 = await page.evaluate(() => scrollY);
      const m = await info(page);
      if (!m) continue;
      if (Math.abs(y1 - y0) < 1) stuck += 1;
      else stuck = 0;

      if (!gotSit && stuck >= 2 && m.cx > m.vw * 0.55) {
        await page.screenshot({ path: OUTS, fullPage: false });
        console.log("SIT", m.sy, m.t, m.cx);
        gotSit = true;
      }

      if (
        !gotLeft &&
        stuck === 0 &&
        m.cx < m.vw * 0.4 &&
        m.t.includes("rotate(90")
      ) {
        await page.screenshot({ path: OUTL, fullPage: false });
        console.log("LEFT_WALK", m.sy, m.t, m.cx);
        gotLeft = true;
      }

      if (stuck >= 2) {
        for (let k = 0; k < 22; k++) {
          await page.mouse.wheel({ deltaY: 90 });
          await new Promise((r) => setTimeout(r, 40));
        }
        stuck = 0;
      }
      if (gotLeft && gotSit) break;
      if (i % 30 === 0) console.log(i, m.sy, m.cx.toFixed(0), m.t.slice(0, 70));
    }

    // Fallback: left at second gate (sit on left rest) — text faded but orientation ok
    if (!gotLeft) {
      stuck = 0;
      for (let i = 0; i < 200 && !gotLeft; i++) {
        const y0 = await page.evaluate(() => scrollY);
        await page.mouse.wheel({ deltaY: 50 });
        await new Promise((r) => setTimeout(r, 40));
        const y1 = await page.evaluate(() => scrollY);
        const m = await info(page);
        if (!m) continue;
        if (Math.abs(y1 - y0) < 1) stuck += 1;
        else stuck = 0;
        if (stuck >= 2 && m.cx < m.vw * 0.45 && m.t.includes("rotate(90")) {
          await page.screenshot({ path: OUTL, fullPage: false });
          console.log("LEFT_GATE", m.sy, m.t, m.cx);
          gotLeft = true;
          break;
        }
        if (stuck >= 2) {
          for (let k = 0; k < 22; k++) {
            await page.mouse.wheel({ deltaY: 90 });
            await new Promise((r) => setTimeout(r, 40));
          }
          stuck = 0;
        }
      }
    }

    console.log({ gotLeft, gotSit });
    if (!gotLeft) process.exitCode = 1;
  } finally {
    await browser.close().catch(() => {});
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
