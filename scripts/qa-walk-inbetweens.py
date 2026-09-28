#!/usr/bin/env python3
"""Score walk inbetweens: blobs, foot jump, XOR vs neighbors. Writes debug NDJSON."""

from __future__ import annotations

import json
import time
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import label

ROOT = Path(__file__).resolve().parents[1]
FRAMES = ROOT / "public" / "mouse" / "frames"
LOG = ROOT / ".cursor" / "debug-80aadd.log"


def mask(path: Path) -> np.ndarray:
    arr = np.asarray(Image.open(path).convert("RGBA"))
    return arr[:, :, 3] > 16


def foot_y(m: np.ndarray) -> int:
    rows = np.where(m.any(axis=1))[0]
    return int(rows[-1]) if len(rows) else -1


def centroid(m: np.ndarray) -> tuple[float, float]:
    ys, xs = np.where(m)
    if len(xs) == 0:
        return (-1.0, -1.0)
    return (float(xs.mean()), float(ys.mean()))


def blobs(m: np.ndarray) -> int:
    labeled, n = label(m)
    sizes = [(labeled == i).sum() for i in range(1, n + 1)]
    return int(sum(1 for s in sizes if s > 40))


def emit(hypothesis_id: str, message: str, data: dict) -> None:
    payload = {
        "sessionId": "80aadd",
        "runId": "asset-scan",
        "hypothesisId": hypothesis_id,
        "location": "scripts/qa-walk-inbetweens.py",
        "message": message,
        "data": data,
        "timestamp": int(time.time() * 1000),
    }
    LOG.parent.mkdir(parents=True, exist_ok=True)
    with LOG.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(payload) + "\n")
    print(message, data)


def score_side(side: str) -> None:
    for i in range(8):
        nxt = (i + 1) % 8
        a_path = FRAMES / f"walk-{side}-{i:02d}.png"
        b_path = FRAMES / f"walk-{side}-{i:02d}b.png"
        c_path = FRAMES / f"walk-{side}-{nxt:02d}.png"
        a, mid, c = mask(a_path), mask(b_path), mask(c_path)
        xor_am = int(np.logical_xor(a, mid).sum())
        xor_mc = int(np.logical_xor(mid, c).sum())
        xor_ac = int(np.logical_xor(a, c).sum())
        area_a, area_m, area_c = int(a.sum()), int(mid.sum()), int(c.sum())
        mid_blobs = blobs(mid)
        fy_a, fy_m, fy_c = foot_y(a), foot_y(mid), foot_y(c)
        cx_a, cy_a = centroid(a)
        cx_m, cy_m = centroid(mid)
        cx_c, cy_c = centroid(c)
        # Mid should sit between A and C. Flag if farther from both than they are from each other.
        jump_foot = abs(fy_m - fy_a) > 6 and abs(fy_m - fy_c) > 6
        ghost = mid_blobs > 1
        xor_worse = xor_am + xor_mc > xor_ac * 1.35
        wrap = i == 7
        emit(
            "D" if wrap else "A",
            "inbetween score",
            {
                "side": side,
                "name": b_path.name,
                "wrap": wrap,
                "blobs": mid_blobs,
                "ghost": ghost,
                "areaA": area_a,
                "areaM": area_m,
                "areaC": area_c,
                "xorAM": xor_am,
                "xorMC": xor_mc,
                "xorAC": xor_ac,
                "xorWorse": xor_worse,
                "footA": fy_a,
                "footM": fy_m,
                "footC": fy_c,
                "footJump": jump_foot,
                "cxA": round(cx_a, 1),
                "cxM": round(cx_m, 1),
                "cxC": round(cx_c, 1),
                "cyA": round(cy_a, 1),
                "cyM": round(cy_m, 1),
                "cyC": round(cy_c, 1),
            },
        )
        emit(
            "B",
            "foot baseline",
            {
                "side": side,
                "name": b_path.name,
                "footA": fy_a,
                "footM": fy_m,
                "footC": fy_c,
                "footJump": jump_foot,
            },
        )


def main() -> None:
    score_side("right")
    score_side("left")


if __name__ == "__main__":
    main()
