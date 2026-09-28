#!/usr/bin/env python3
"""Slice the drawn 8x4 inbetween sheet into normalized 178x155 PNGs.

Rerun from the repo root:
  scripts/.venv-slice/bin/python scripts/slice-inbetween-sheet.py
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SHEET = ROOT / "assets" / "mouse" / "inbetween-sheet.png"
FRAMES = ROOT / "public" / "mouse" / "frames"
CONTACT = ROOT / "assets" / "mouse" / "inbetween-contact.png"

OUT_W, OUT_H = 178, 155
FOOT_Y = 144  # last opaque row, matches existing clips
MIN_CELL_W = 50
ROW_MIN = 40
COL_MIN = 8
ALPHA_ON = 16

ROW_NAMES = [
    [f"walk-right-{i:02d}c" for i in range(8)],
    [f"walk-left-{i:02d}c" for i in range(8)],
    [
        "pose-sit-to-front",
        "pose-front-to-tail",
        "pose-coil",
        "pose-land",
        "pose-sit-to-sniff",
        "pose-sniff-to-low",
        "pose-sit-to-lookup",
        "pose-brake",
    ],
    [
        "pose-apex",
        "pose-squash",
        "pose-skid",
        "pose-tail-flick",
        "pose-peek",
        "pose-push-off",
        "pose-turn-left",
        "pose-sprint-stretch",
    ],
]


def bands(vals: list[int], min_w: int) -> list[tuple[int, int]]:
    out: list[tuple[int, int]] = []
    i = 0
    n = len(vals)
    while i < n:
        if vals[i] >= min_w:
            j = i
            while j < n and vals[j] >= min_w:
                j += 1
            out.append((i, j))
            i = j
        else:
            i += 1
    return out


def reconstruct(path: Path) -> Image.Image:
    src = Image.open(path).convert("RGBA")
    pix = src.load()
    w, h = src.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = pix[x, y]
            if a > ALPHA_ON:
                pix[x, y] = (255, 255, 255, a)
            else:
                pix[x, y] = (0, 0, 0, 0)
    return src


def ink_rows(im: Image.Image) -> list[int]:
    a = im.getchannel("A")
    w, h = im.size
    px = a.load()
    return [sum(1 for x in range(w) if px[x, y] > ALPHA_ON) for y in range(h)]


def ink_cols(im: Image.Image, y0: int, y1: int) -> list[int]:
    a = im.getchannel("A")
    w, _ = im.size
    px = a.load()
    return [
        sum(1 for y in range(y0, y1) if px[x, y] > ALPHA_ON) for x in range(w)
    ]


def merge_cells(raw: list[tuple[int, int]], width: int) -> list[tuple[int, int]]:
    bodies = [b for b in raw if b[1] - b[0] >= MIN_CELL_W]
    thin = [b for b in raw if b[1] - b[0] < MIN_CELL_W]
    if len(bodies) != 8:
        raise SystemExit(f"expected 8 bodies, got {len(bodies)}: {bodies}")
    expanded = [list(b) for b in bodies]
    for t0, t1 in thin:
        mid = (t0 + t1) / 2
        idx = min(
            range(len(expanded)),
            key=lambda i: abs((expanded[i][0] + expanded[i][1]) / 2 - mid),
        )
        expanded[idx][0] = min(expanded[idx][0], t0)
        expanded[idx][1] = max(expanded[idx][1], t1)
    # split leftover gutters at midpoints so tails stay with the nearer mouse
    for i in range(len(expanded) - 1):
        gap0 = expanded[i][1]
        gap1 = expanded[i + 1][0]
        if gap1 > gap0:
            mid = (gap0 + gap1) // 2
            expanded[i][1] = mid
            expanded[i + 1][0] = mid
    expanded[0][0] = max(0, expanded[0][0] - 4)
    expanded[-1][1] = min(width, expanded[-1][1] + 4)
    return [(a, b) for a, b in expanded]


# Match the original sheet extraction (walk-right-00 is ~116x111).
REF_BODY_H = 111
# Wide leap poses were drawn larger on the sheet; cap so the head
# matches the walk cycle instead of filling the canvas.
WIDE_ASPECT = 1.35
WIDE_MAX_W = 130


def ink_bbox(im: Image.Image) -> tuple[int, int, int, int] | None:
    a = im.getchannel("A")
    return a.point(lambda v: 255 if v > ALPHA_ON else 0).getbbox()


def normalize(crop: Image.Image, scale: float, *, lock_scale: bool = False) -> Image.Image:
    bbox = ink_bbox(crop)
    canvas = Image.new("RGBA", (OUT_W, OUT_H), (0, 0, 0, 0))
    if not bbox:
        return canvas
    x0, y0, x1, y1 = bbox
    trimmed = crop.crop((x0, y0, x1, y1))
    bw, bh = trimmed.size
    fit = scale
    if not lock_scale:
        max_w = OUT_W - 8
        max_h = FOOT_Y - 8
        if bw / max(bh, 1) >= WIDE_ASPECT:
            max_w = min(max_w, WIDE_MAX_W)
        if bw * fit > max_w:
            fit = max_w / bw
        if bh * fit > max_h:
            fit = max_h / bh
    nw = max(1, round(bw * fit))
    nh = max(1, round(bh * fit))
    scaled = trimmed.resize((nw, nh), Image.Resampling.LANCZOS)
    px = (OUT_W - nw) // 2
    py = FOOT_Y + 1 - nh
    canvas.paste(scaled, (px, py), scaled)
    return canvas


def main() -> None:
    sheet = reconstruct(SHEET)
    FRAMES.mkdir(parents=True, exist_ok=True)
    rows = bands(ink_rows(sheet), ROW_MIN)
    print("row bands", rows)
    if len(rows) != 4:
        raise SystemExit(f"expected 4 rows, got {len(rows)}")

    contact = Image.new("RGBA", (OUT_W * 8, OUT_H * 4), (0, 0, 0, 255))
    names_written: list[str] = []
    crops: list[tuple[int, int, Image.Image]] = []
    heights: list[int] = []

    for ri, (y0, y1) in enumerate(rows):
        pad = 6
        cy0 = max(0, y0 - pad)
        cy1 = min(sheet.size[1], y1 + pad)
        raw = bands(ink_cols(sheet, cy0, cy1), COL_MIN)
        cells = merge_cells(raw, sheet.size[0])
        print(f"row {ri} cells", cells)
        for ci, (x0, x1) in enumerate(cells):
            crop = sheet.crop((x0, cy0, x1, cy1))
            bbox = ink_bbox(crop)
            if bbox:
                heights.append(bbox[3] - bbox[1])
            crops.append((ri, ci, crop))

    heights.sort()
    median_h = heights[len(heights) // 2] if heights else REF_BODY_H
    scale = REF_BODY_H / median_h
    print("median source h", median_h, "shared scale", round(scale, 3))

    for ri, ci, crop in crops:
        frame = normalize(crop, scale)
        name = ROW_NAMES[ri][ci]
        dest = FRAMES / f"{name}.png"
        frame.save(dest)
        contact.paste(frame, (ci * OUT_W, ri * OUT_H), frame)
        names_written.append(name)
        print("write", dest.name)

    draw = ImageDraw.Draw(contact)
    for i in range(1, 8):
        draw.line((i * OUT_W, 0, i * OUT_W, contact.size[1]), fill=(40, 40, 40, 255))
    for i in range(1, 4):
        draw.line((0, i * OUT_H, contact.size[0], i * OUT_H), fill=(40, 40, 40, 255))
    contact.save(CONTACT)
    print("contact", CONTACT)

    removed = 0
    for path in FRAMES.glob("*b.png"):
        path.unlink()
        removed += 1
        print("remove", path.name)
    print("removed sdf", removed, "wrote", len(names_written))


if __name__ == "__main__":
    main()
