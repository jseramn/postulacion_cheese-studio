export const MOUSE_FRAME_SIZE = {
  width: 178,
  height: 155,
} as const;

/** Transparent pixels under the feet, shared by every normalized frame. */
export const MOUSE_FOOT_PAD = 11;

/** Paw line under the body in the 178×155 cell. The path pivots here, not at the frame center. */
export const MOUSE_FOOT_X = 68;

/** One drawing per 3px keeps a 16-frame stride on the old 4-frame distance. */
export const STRIDE_PX = 3;
export const FRAME_MS = 55;
export const START_PX = 40;

/** Held stride drawings. The scroll clock shows one every 1000/15 ms. */
export const STRIDE_POSE_MS = 1000 / 15;

const frame = (name: string) => `/mouse/frames/${name}.png?v=uniform`;

export const walkRightFrames = [
  frame("walk-stride-00"),
  frame("walk-stride-01"),
  frame("walk-stride-02"),
  frame("walk-stride-03"),
  frame("walk-stride-04"),
  frame("walk-stride-05"),
  frame("walk-stride-06"),
  frame("walk-stride-07"),
  frame("walk-stride-08"),
  frame("walk-stride-09"),
  frame("walk-stride-10"),
  frame("walk-stride-11"),
  frame("walk-stride-12"),
  frame("walk-stride-13"),
  frame("walk-stride-14"),
  frame("walk-stride-15"),
] as const;

export const walkLeftFrames = walkRightFrames;

export const poseFrames = {
  sit: frame("pose-sit"),
  sitFront: frame("pose-sit-front"),
  sitTail: frame("pose-sit-tail"),
  rear: frame("pose-rear"),
  sniff: frame("pose-sniff"),
  low: frame("pose-low"),
  lookup: frame("pose-lookup"),
  tailRun: frame("pose-tail-run"),
  sitToFront: frame("pose-sit-to-front"),
  frontToTail: frame("pose-front-to-tail"),
  coil: frame("pose-coil"),
  land: frame("pose-land"),
  sitToSniff: frame("pose-sit-to-sniff"),
  sniffToLow: frame("pose-sniff-to-low"),
  sitToLookup: frame("pose-sit-to-lookup"),
  brake: frame("pose-brake"),
  apex: frame("pose-apex"),
  squash: frame("pose-squash"),
  skid: frame("pose-skid"),
  tailFlick: frame("pose-tail-flick"),
  peek: frame("pose-peek"),
  pushOff: frame("pose-push-off"),
  turnLeft: frame("pose-turn-left"),
  sprintStretch: frame("pose-sprint-stretch"),
} as const;

export type PoseId = keyof typeof poseFrames;
export type WalkDirection = "right" | "left";

const poseBlendByPair: Record<string, string> = {
  [`${poseFrames.sit}>${poseFrames.sniff}`]: poseFrames.sitToSniff,
  [`${poseFrames.sniff}>${poseFrames.sit}`]: poseFrames.sitToSniff,
  [`${poseFrames.sit}>${poseFrames.lookup}`]: poseFrames.sitToLookup,
  [`${poseFrames.lookup}>${poseFrames.sit}`]: poseFrames.sitToLookup,
  [`${poseFrames.sit}>${poseFrames.rear}`]: poseFrames.coil,
  [`${poseFrames.sniff}>${poseFrames.low}`]: poseFrames.sniffToLow,
  [`${poseFrames.sit}>${poseFrames.sitFront}`]: poseFrames.sitToFront,
  [`${poseFrames.sitFront}>${poseFrames.sitTail}`]: poseFrames.frontToTail,
};

export function walkFrame(direction: WalkDirection, index: number): string {
  const frames = direction === "right" ? walkRightFrames : walkLeftFrames;
  const length = frames.length;
  const wrapped = ((index % length) + length) % length;
  return frames[wrapped] ?? frames[0];
}

export function poseBlend(fromSrc: string, toSrc: string): string | null {
  return poseBlendByPair[`${fromSrc}>${toSrc}`] ?? null;
}

/** Clip sequence for a hop, driven by anime.js animation.progress (0–1). */
export function hopClip(progress: number): string {
  if (progress < 0.22) return poseFrames.coil;
  if (progress < 0.5) return poseFrames.apex;
  if (progress < 0.82) return poseFrames.land;
  return poseFrames.sit;
}

export function gaitClip(input: {
  direction: WalkDirection;
  walkIndex: number;
  movedPx: number;
  dtMs: number;
  distanceSinceIdle: number;
}): string {
  if (input.distanceSinceIdle < START_PX) return poseFrames.low;
  return walkFrame(input.direction, input.walkIndex);
}

export const allMouseFrames: readonly string[] = [
  ...walkRightFrames,
  ...walkLeftFrames,
  ...Object.values(poseFrames),
];
