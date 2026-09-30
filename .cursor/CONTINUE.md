# Continue: mouse on `/wispr-infinito`

Branch: `scroll-raton`. Route: http://localhost:3000/wispr-infinito.

## Physics (current)

Placement clock is pure `alongAt`. No `pinAlong`, no hard foot clamp.

Soft nudge is partial only, clamped to `MAX_SOFT_NUDGE=40`. Never full glue to the frame.

Mid upright comes from `buildInfiniteTextPath` (mid flat reverse only — not entry/exit quarters). Sit uses `rotate(0)` plus fade. Banks are ±90° columns.

Verify with `node scripts/e2e-wispr-mouse.mjs` (`pnpm dev` up).

## Still keep

- Dark page `#12151c`, white letters
- Rest gates + letter fade on sit
- Lab AsciiSweep (no blackout tint)
- Overflow-anchor none + growth guards on the scroller

## Leftovers

- Bend glyph path-tilt (forward quarters ~120–160° into upright mid)
- Letter tip may kiss top of viewport

## Do not touch

`app/scroll/*`, `components/scroll/*`, `components/mouse/*`, home, globals, vendor kits.

Do not reintroduce `pinAlong` / hard foot clamp unless the human asks and accepts path detachment.
