#!/usr/bin/env python3
"""Slice the 8x2 stride sheet into normalized 178x155 PNGs.

Rerun from the repo root:
  scripts/.venv-slice/bin/python scripts/slice-stride-sheet.py
"""

from __future__ import annotations

import importlib.util
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SHEET = ROOT / "assets" / "mouse" / "stride-sheet.png"
FRAMES = ROOT / "public" / "mouse" / "frames"
CONTACT = ROOT / "assets" / "mouse" / "stride-contact.png"

spec = importlib.util.spec_from_file_location(
    "slice_inbetween",
    ROOT / "scripts" / "slice-inbetween-sheet.py",
)
mod = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(mod)

NAMES = [f"walk-stride-{i:02d}" for i in range(16)]


def drop_specks(im: Image.Image, min_area: int = 120) -> Image.Image:
    """Drop tail-tips that the gutter split stole from the neighbor."""
    src = im.copy()
    px = src.load()
    w, h = src.size
    seen = bytearray(w * h)

    def idx(x: int, y: int) -> int:
        return y * w + x

    for y in range(h):
        for x in range(w):
            i = idx(x, y)
            if seen[i] or px[x, y][3] <= mod.ALPHA_ON:
                seen[i] = 1
                continue
            stack = [(x, y)]
            cells: list[tuple[int, int]] = []
            seen[i] = 1
            while stack:
                cx, cy = stack.pop()
                cells.append((cx, cy))
                for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
                    if nx < 0 or ny < 0 or nx >= w or ny >= h:
                        continue
                    j = idx(nx, ny)
                    if seen[j] or px[nx, ny][3] <= mod.ALPHA_ON:
                        seen[j] = 1
                        continue
                    seen[j] = 1
                    stack.append((nx, ny))
            if len(cells) < min_area:
                for cx, cy in cells:
                    px[cx, cy] = (0, 0, 0, 0)
    return src


def main() -> None:
    sheet = mod.reconstruct(SHEET)
    FRAMES.mkdir(parents=True, exist_ok=True)
    rows = mod.bands(mod.ink_rows(sheet), mod.ROW_MIN)
    print("row bands", rows)
    if len(rows) != 2:
        raise SystemExit(f"expected 2 rows, got {len(rows)}")

    crops: list[Image.Image] = []
    for y0, y1 in rows:
        pad = 6
        cy0 = max(0, y0 - pad)
        cy1 = min(sheet.size[1], y1 + pad)
        raw = mod.bands(mod.ink_cols(sheet, cy0, cy1), mod.COL_MIN)
        cells = mod.merge_cells(raw, sheet.size[0])
        print("cells", cells)
        for x0, x1 in cells:
            crop = sheet.crop((x0, cy0, x1, cy1))
            crops.append(crop)

    if len(crops) != 16:
        raise SystemExit(f"expected 16 cells, got {len(crops)}")

    # One scale for the whole cycle, held at the size the walk already
    # read as. Fitting each cell to the frame width made narrow poses
    # larger and wide poses smaller, so the mouse pulsed during scroll.
    source_h = []
    for crop in crops:
        bbox = mod.ink_bbox(crop)
        if bbox:
            source_h.append(bbox[3] - bbox[1])
    source_h.sort()
    median_h = source_h[len(source_h) // 2]
    target_h = 80
    scale = target_h / max(median_h, 1)
    max_w = mod.OUT_W - 8
    max_h = mod.FOOT_Y - 8
    for crop in crops:
        bbox = mod.ink_bbox(crop)
        if not bbox:
            continue
        bw = bbox[2] - bbox[0]
        bh = bbox[3] - bbox[1]
        scale = min(scale, max_w / max(bw, 1), max_h / max(bh, 1))
    print("uniform scale", round(scale, 3), "median source h", median_h)

    contact = Image.new("RGBA", (mod.OUT_W * 8, mod.OUT_H * 2), (0, 0, 0, 255))
    for i, crop in enumerate(crops):
        frame = drop_specks(mod.normalize(crop, scale, lock_scale=True), min_area=400)
        dest = FRAMES / f"{NAMES[i]}.png"
        frame.save(dest)
        contact.paste(frame, ((i % 8) * mod.OUT_W, (i // 8) * mod.OUT_H), frame)
        print("write", dest.name)

    draw = ImageDraw.Draw(contact)
    for i in range(1, 8):
        draw.line((i * mod.OUT_W, 0, i * mod.OUT_W, contact.size[1]), fill=(40, 40, 40, 255))
    draw.line((0, mod.OUT_H, contact.size[0], mod.OUT_H), fill=(40, 40, 40, 255))
    contact.save(CONTACT)
    print("contact", CONTACT)


if __name__ == "__main__":
    main()
