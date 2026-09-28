# Continue: mouse on `/wispr-infinito`

Branch: `scroll-raton`. Route: http://localhost:3000/wispr-infinito (`app/wispr-infinito/page.tsx`, `mouse` prop on).

Environment is already pinned: Node 24 (`.nvmrc`), pnpm 12.4.2 (`packageManager`), lockfile `pnpm-lock.yaml`, `pnpm-workspace.yaml` allows the `unrs-resolver` build. No `.env`. `pnpm install && pnpm dev`.

## Done

- Infinite edge-rail text trail with heavy momentum scroll (`SCROLL_HEAVINESS=20`) and a small edge bounce.
- Scroll-anchoring cascade is fixed (`overflow-anchor: none` on `documentElement` plus growth guards). Do not remove those guards.
- Mouse sprite from `/scroll` walks that trail. One clock: `along = tileLen * (scrollY + anchor * vh) / pitchPx` (`components/text-trail/rail-clock.ts`). Draw anchor 0.8, mouse anchor 0.5.
- Rest gate in the middle of every lateral column: page freezes, wheel fills `restMeter`, then the mouse stands and scroll continues. Scrolling up re-arms the gate. Measured earlier: freeze, release after ~5 wheels, re-arm, `cascadeCount=0`.
- Local tint on the trail mouse wrap only (`mouseTint`), so the sprite reads on white. Do not edit `components/mouse/*` to recolor it.

## Still wrong (this is the job)

The mouse overlaps the letters except on the top crossing.

Trust screenshots `.cursor/screens/06-right.png` through `10-sitting.png` (01–05 are stale: the sprite was nearly invisible).

- `07-top-cross.png` is correct: mouse walks on top of the letters, feet on the caps, no overlap.
- `06-right.png` and `10-sitting.png`: body sits on the right-column glyphs. Letters occupy the east side of the path; the whole mouse must sit west of the baseline, feet touching it, body toward page center.
- `08-mid-cross.png`: body covers the crossing letters. Text there hangs below the path; the whole mouse must sit above the ink, feet on the top edge of the ink.
- `09-left.png`: roughly correct (body toward center). Re-check with the metric below.

`trail-mouse.tsx` already tries to offset along the body normal `n` using `glyphUp = (ty, -tx)` and `onGlyphFace`. The old “gap to nearest ink = 0” metric reported success while the body covered the glyphs. Do not trust that metric.

Acceptance, per case (right column, top cross, mid cross, left column, sitting on the right-column gate):

- Overlap of mouse ink and glyph ink is 0 (at most ~2% of the mouse box for antialias).
- Contact gap from the foot to the ink edge is ≤ 4px.
- Look at the new screenshot before calling it done.

Geometry: glyphs rise along `glyphUp` (textPath `dy=-6`). If `dot(n, glyphUp) > 0`, the foot clears the far ink edge. Otherwise the foot sits on the near edge (the path side). Rotation must map the sprite’s local up onto `n`. Facing is `scaleX` only (`sprite.setFacing`). Never `scaleY(-1)`.

## Do not touch

`app/scroll/*`, `components/scroll/*`, `components/mouse/*`, `app/page.tsx`, `app/layout.tsx`, `app/globals.css`, `blocks/*`, `components/ui/*`, `app/wispr-flow/*`, `app/skiper19/*`. Do not flip the upside-down crossing text unless asked. Do not commit unless asked.

Delete this file’s “Still wrong” section (or the whole file) once the placement is accepted, and drop the pointer in `AGENTS.md`.
