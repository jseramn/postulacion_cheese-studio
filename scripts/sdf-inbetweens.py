#!/usr/bin/env python3
"""Generate SDF inbetweens for the cheese-mouse sprite clips.

Rerun from the repo root:
  /tmp/mouse-pil/bin/python scripts/sdf-inbetweens.py
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import distance_transform_edt

ROOT = Path(__file__).resolve().parents[1]
FRAMES = ROOT / "public" / "mouse" / "frames"
WHITE = (255, 255, 255, 255)


def alpha_mask(path: Path) -> np.ndarray:
    im = Image.open(path).convert("RGBA")
    arr = np.asarray(im)
    return arr[:, :, 3] > 16


def sdf(mask: np.ndarray) -> np.ndarray:
    inside = distance_transform_edt(mask)
    outside = distance_transform_edt(~mask)
    return inside - outside


def lerp_frame(a_path: Path, b_path: Path, dest: Path, t: float = 0.5) -> bool:
    a = alpha_mask(a_path)
    b = alpha_mask(b_path)
    mixed = (1.0 - t) * sdf(a) + t * sdf(b)
    mask = mixed >= 0
    area_a = int(a.sum())
    area_b = int(b.sum())
    area_m = int(mask.sum())
    lo = min(area_a, area_b)
    hi = max(area_a, area_b)
    if area_m < lo * 0.7 or area_m > hi * 1.35:
        print(f"skip {dest.name}: area {area_m} not in [{lo}, {hi}]")
        Image.open(a_path).save(dest)
        return False
    h, w = mask.shape
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    rgba[mask] = (255, 255, 255, 255)
    Image.fromarray(rgba, "RGBA").save(dest)
    print(f"write {dest.name} area {area_m}")
    return True


def walk_pairs(side: str) -> None:
    for i in range(8):
        nxt = (i + 1) % 8
        src_a = FRAMES / f"walk-{side}-{i:02d}.png"
        src_b = FRAMES / f"walk-{side}-{nxt:02d}.png"
        dest = FRAMES / f"walk-{side}-{i:02d}b.png"
        lerp_frame(src_a, src_b, dest)


def pose_pairs() -> None:
    # Distinct silhouettes (sit vs rear/sniff/lookup) lerp into blobs.
    # Walk pairs stay. Pose starts use the drawn pose-low clip instead.
    return


def main() -> None:
    walk_pairs("right")
    walk_pairs("left")
    pose_pairs()


if __name__ == "__main__":
    main()
