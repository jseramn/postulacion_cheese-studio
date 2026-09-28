import {
  animate,
  createTimeline,
  splitText,
  stagger,
  steps,
} from "animejs";

export type TextPresetGroup = "mecanica" | "queso" | "super";

export type TextPreset = {
  id: string;
  label: string;
  hint: string;
  group?: TextPresetGroup;
  mount: (ctx: {
    root: HTMLElement;
    textEl: HTMLElement;
    reduceMotion: boolean;
  }) => void | (() => void);
};

const READ_PAUSE = 1400;
const MILK = "#ebe4d4";
const WHEY = "#d4b45a";
const IDLE_TWITCHES = 6;

const PUNCH_SCALE = [
  { to: 0, duration: 340, ease: "in(3)" },
  { to: 0, duration: 420 },
  { to: 1, duration: 480, ease: "out(3)" },
];
const PUNCH_OPACITY = [
  { to: 0, duration: 340, ease: "in(3)" },
  { to: 0, duration: 420 },
  { to: 1, duration: 480, ease: "out(3)" },
];
const BITE_OUT = {
  opacity: [1, 0],
  scale: [1, 0.18],
  x: ["0rem", "-0.32rem"],
  duration: 240,
  ease: "in(3)",
};
const BITE_IN = {
  opacity: [0, 1],
  scale: [0.18, 1],
  x: 0,
  duration: 380,
  ease: "out(3)",
};
const SNIFF_Y = [
  { to: "0.38rem", duration: 240, ease: "out(2)" },
  { to: "0.08rem", duration: 160, ease: "inOutSine" },
  { to: "0.42rem", duration: 200, ease: "out(2)" },
  { to: 0, duration: 420, ease: "out(3)" },
];
const SNIFF_ROTATE = [
  { to: 7, duration: 240, ease: "out(2)" },
  { to: 2, duration: 160, ease: "inOutSine" },
  { to: 8, duration: 200, ease: "out(2)" },
  { to: 0, duration: 420, ease: "out(3)" },
];
const STEP_Y = [
  { to: "-0.3rem", duration: 130, ease: "out(2)" },
  { to: 0, duration: 150, ease: "in(2)" },
];
const BOUNCE_Y = [
  { to: "-2.75rem", ease: "outExpo", duration: 600 },
  { to: 0, ease: "outBounce", duration: 800, delay: 100 },
];
const BOUNCE_ROTATE = { from: "-1turn", delay: 0 };

function revertSplit(split: { revert: () => unknown; html: string }) {
  if (!split.html) return;
  split.revert();
  // anime.js 4.5 restore does not cancel a pending document.fonts.ready split.
  split.html = "";
}

function holeTargets(chars: HTMLElement[]) {
  const holes = chars.filter((_, i) => (i * 7 + 3) % 3 === 0);
  return holes.length > 0 ? holes : chars;
}

type LetterIdle = { stop: () => void };

function startLetterIdle(
  chars: HTMLElement[],
  options?: { times?: number; onDone?: () => void },
): LetterIdle {
  let stopped = false;
  let current: { revert: () => unknown } | undefined;
  const letters = chars.filter((el) => (el.textContent ?? "").trim().length > 0);
  let played = 0;
  const limit = options?.times;

  const twitch = () => {
    if (stopped) return;
    if (limit !== undefined && played >= limit) {
      options?.onDone?.();
      return;
    }
    if (letters.length === 0) {
      options?.onDone?.();
      return;
    }
    const el = letters[Math.floor(Math.random() * letters.length)]!;
    const saltito = played % 2 === 0;
    played += 1;
    const onComplete = () => {
      if (stopped) return;
      twitch();
    };
    current = animate(
      el,
      saltito
        ? {
            y: [
              { to: "-0.28rem", duration: 90, ease: "out(2)" },
              { to: 0, duration: 110, ease: "in(2)" },
            ],
            onComplete,
          }
        : {
            x: [
              { to: "0.14rem", duration: 50, ease: "out(2)" },
              { to: "-0.12rem", duration: 50, ease: "inOutSine" },
              { to: "0.1rem", duration: 50, ease: "inOutSine" },
              { to: 0, duration: 70, ease: "in(2)" },
            ],
            onComplete,
          },
    );
  };

  twitch();
  return {
    stop() {
      stopped = true;
      current?.revert();
    },
  };
}

function playBiteThenRestore(
  chars: HTMLElement[],
  onComplete: () => void,
) {
  return createTimeline({ onComplete })
    .add(chars, BITE_OUT, stagger(48, { from: "last" }))
    .add(chars, BITE_IN, stagger(36, { from: "first" }));
}

export const TEXT_PRESETS: TextPreset[] = [
  {
    id: "palabras",
    label: "Palabras",
    hint: "Cada palabra sube desde el recorte.",
    group: "mecanica",
    mount({ textEl, reduceMotion }) {
      if (reduceMotion) return;
      const split = splitText(textEl, {
        words: { wrap: "clip" },
        accessible: true,
      }).addEffect(({ words }) =>
        animate(words, {
          y: ["100%", "0%"],
          duration: 750,
          ease: "out(3)",
          delay: stagger(100),
          loop: true,
          loopDelay: READ_PAUSE,
        }),
      );
      return () => revertSplit(split);
    },
  },
  {
    id: "rebote",
    label: "Rebote",
    hint: "Las letras saltan y giran una vuelta, como el ejemplo de Animation.",
    group: "mecanica",
    mount({ textEl, reduceMotion }) {
      if (reduceMotion) return;
      const split = splitText(textEl, {
        words: false,
        chars: true,
        accessible: true,
      }).addEffect(({ chars }) =>
        animate(chars, {
          y: BOUNCE_Y,
          rotate: BOUNCE_ROTATE,
          delay: stagger(50),
          ease: "inOutCirc",
          loopDelay: READ_PAUSE,
          loop: true,
        }),
      );
      return () => revertSplit(split);
    },
  },
  {
    id: "suero",
    label: "Suero",
    hint: "Cada letra salta de milk a whey, sin beige en el medio.",
    group: "mecanica",
    mount({ textEl, reduceMotion }) {
      if (reduceMotion) return;
      const split = splitText(textEl, {
        chars: true,
        accessible: true,
      }).addEffect(({ chars }) =>
        animate(chars, {
          color: [MILK, WHEY],
          duration: 900,
          ease: steps(1),
          delay: stagger(40),
          loop: true,
          alternate: true,
          loopDelay: 800,
        }),
      );
      return () => revertSplit(split);
    },
  },
  {
    id: "agujeros",
    label: "Agujeros",
    hint: "Letras al azar se agujerean y vuelven, como el queso suizo.",
    group: "queso",
    mount({ textEl, reduceMotion }) {
      if (reduceMotion) return;
      const split = splitText(textEl, {
        chars: true,
        accessible: true,
      }).addEffect(({ chars }) => {
        const targets = holeTargets(chars);
        return animate(targets, {
          scale: PUNCH_SCALE,
          opacity: PUNCH_OPACITY,
          delay: stagger(70, { from: "random" }),
          loop: true,
          loopDelay: READ_PAUSE,
        });
      });
      return () => revertSplit(split);
    },
  },
  {
    id: "mordisco",
    label: "Mordisco",
    hint: "Una letra salta o se sacude, luego el ratón se come el título.",
    group: "queso",
    mount({ textEl, reduceMotion }) {
      if (reduceMotion) return;
      const split = splitText(textEl, {
        chars: true,
        accessible: true,
      }).addEffect(({ chars }) => {
        let stopped = false;
        let idle: LetterIdle | undefined;
        let bite: { revert: () => unknown } | undefined;
        let pauseTimer: ReturnType<typeof setTimeout> | undefined;

        const cycle = () => {
          if (stopped) return;
          idle = startLetterIdle(chars, {
            times: IDLE_TWITCHES,
            onDone: () => {
              if (stopped) return;
              bite = playBiteThenRestore(chars, () => {
                if (stopped) return;
                pauseTimer = setTimeout(cycle, READ_PAUSE);
              });
            },
          });
        };

        cycle();
        return () => {
          stopped = true;
          idle?.stop();
          bite?.revert();
          if (pauseTimer) clearTimeout(pauseTimer);
        };
      });
      return () => revertSplit(split);
    },
  },
  {
    id: "olfato",
    label: "Olfato",
    hint: "El título se agacha a olfatear, dos cabezadas, y se queda.",
    group: "queso",
    mount({ textEl, reduceMotion }) {
      if (reduceMotion) return;
      const split = splitText(textEl, {
        chars: true,
        accessible: true,
      }).addEffect(({ chars }) =>
        animate(chars, {
          y: SNIFF_Y,
          rotate: SNIFF_ROTATE,
          delay: stagger(22),
          loop: true,
          loopDelay: READ_PAUSE,
        }),
      );
      return () => revertSplit(split);
    },
  },
  {
    id: "paso",
    label: "Paso",
    hint: "Un paso parejo, como el caminar del ratón.",
    group: "queso",
    mount({ textEl, reduceMotion }) {
      if (reduceMotion) return;
      const split = splitText(textEl, {
        chars: true,
        accessible: true,
      }).addEffect(({ chars }) =>
        animate(chars, {
          y: STEP_Y,
          delay: stagger(140),
          loop: true,
          loopDelay: READ_PAUSE,
        }),
      );
      return () => revertSplit(split);
    },
  },
  {
    id: "palabra-hueco",
    label: "Palabra-hueco",
    hint: "Cada palabra entra recortada, luego se agujerean letras.",
    group: "super",
    mount({ textEl, reduceMotion }) {
      if (reduceMotion) return;
      const split = splitText(textEl, {
        words: { wrap: "clip" },
        chars: true,
        accessible: true,
      }).addEffect(({ words, chars }) =>
        createTimeline({
          loop: true,
          loopDelay: READ_PAUSE,
        })
          .add(
            words,
            { y: ["100%", "0%"], duration: 750, ease: "out(3)" },
            stagger(100),
          )
          .add(
            holeTargets(chars),
            { scale: PUNCH_SCALE, opacity: PUNCH_OPACITY },
            stagger(70, { from: "random" }),
          ),
      );
      return () => revertSplit(split);
    },
  },
  {
    id: "salto-hueco",
    label: "Salto-hueco",
    hint: "Las letras saltan; al aterrizar, algunas se perforan.",
    group: "super",
    mount({ textEl, reduceMotion }) {
      if (reduceMotion) return;
      const split = splitText(textEl, {
        words: false,
        chars: true,
        accessible: true,
      }).addEffect(({ chars }) =>
        createTimeline({
          loop: true,
          loopDelay: READ_PAUSE,
          defaults: { ease: "inOutCirc" },
        })
          .add(
            chars,
            { y: BOUNCE_Y, rotate: BOUNCE_ROTATE },
            stagger(50),
          )
          .add(
            holeTargets(chars),
            { scale: PUNCH_SCALE, opacity: PUNCH_OPACITY },
            stagger(70, { from: "random" }),
          ),
      );
      return () => revertSplit(split);
    },
  },
  {
    id: "whey-paso",
    label: "Whey-paso",
    hint: "El color salta a whey y después camina.",
    group: "super",
    mount({ textEl, reduceMotion }) {
      if (reduceMotion) return;
      const split = splitText(textEl, {
        chars: true,
        accessible: true,
      }).addEffect(({ chars }) =>
        createTimeline({
          loop: true,
          loopDelay: READ_PAUSE,
        })
          .add(
            chars,
            { color: [MILK, WHEY], duration: 900, ease: steps(1) },
            stagger(40),
          )
          .add(chars, { y: STEP_Y }, stagger(140)),
      );
      return () => revertSplit(split);
    },
  },
  {
    id: "nido",
    label: "Nido",
    hint: "Las palabras se montan; las letras alternan saltito y sacudida.",
    group: "super",
    mount({ textEl, reduceMotion }) {
      if (reduceMotion) return;
      const split = splitText(textEl, {
        words: { wrap: "clip" },
        chars: true,
        accessible: true,
      }).addEffect(({ words, chars }) => {
        let stopped = false;
        let idle: LetterIdle | undefined;
        let enter: { revert: () => unknown } | undefined;
        let pauseTimer: ReturnType<typeof setTimeout> | undefined;

        const cycle = () => {
          if (stopped) return;
          enter = animate(words, {
            y: ["100%", "0%"],
            duration: 750,
            ease: "out(3)",
            delay: stagger(100),
            onComplete: () => {
              if (stopped) return;
              idle = startLetterIdle(chars, {
                times: IDLE_TWITCHES,
                onDone: () => {
                  if (stopped) return;
                  pauseTimer = setTimeout(cycle, READ_PAUSE);
                },
              });
            },
          });
        };

        cycle();
        return () => {
          stopped = true;
          idle?.stop();
          enter?.revert();
          if (pauseTimer) clearTimeout(pauseTimer);
        };
      });
      return () => revertSplit(split);
    },
  },
  {
    id: "comelon",
    label: "Comelón",
    hint: "Entran las palabras, el ratón las toca y se las come.",
    group: "super",
    mount({ textEl, reduceMotion }) {
      if (reduceMotion) return;
      const split = splitText(textEl, {
        words: { wrap: "clip" },
        chars: true,
        accessible: true,
      }).addEffect(({ words, chars }) => {
        let stopped = false;
        let idle: LetterIdle | undefined;
        let enter: { revert: () => unknown } | undefined;
        let bite: { revert: () => unknown } | undefined;
        let pauseTimer: ReturnType<typeof setTimeout> | undefined;

        const cycle = () => {
          if (stopped) return;
          enter = animate(words, {
            y: ["100%", "0%"],
            duration: 750,
            ease: "out(3)",
            delay: stagger(100),
            onComplete: () => {
              if (stopped) return;
              idle = startLetterIdle(chars, {
                times: IDLE_TWITCHES,
                onDone: () => {
                  if (stopped) return;
                  bite = playBiteThenRestore(chars, () => {
                    if (stopped) return;
                    pauseTimer = setTimeout(cycle, READ_PAUSE);
                  });
                },
              });
            },
          });
        };

        cycle();
        return () => {
          stopped = true;
          idle?.stop();
          enter?.revert();
          bite?.revert();
          if (pauseTimer) clearTimeout(pauseTimer);
        };
      });
      return () => revertSplit(split);
    },
  },
  {
    id: "cabeceo",
    label: "Cabeceo",
    hint: "Primero olfatea, después rebota.",
    group: "super",
    mount({ textEl, reduceMotion }) {
      if (reduceMotion) return;
      const split = splitText(textEl, {
        chars: true,
        accessible: true,
      }).addEffect(({ chars }) =>
        createTimeline({
          loop: true,
          loopDelay: READ_PAUSE,
        })
          .add(
            chars,
            { y: SNIFF_Y, rotate: SNIFF_ROTATE },
            stagger(22),
          )
          .add(
            chars,
            { y: BOUNCE_Y, rotate: BOUNCE_ROTATE, ease: "inOutCirc" },
            stagger(50),
          ),
      );
      return () => revertSplit(split);
    },
  },
  {
    id: "whey-hueco",
    label: "Whey-hueco",
    hint: "Suero sólido, después agujeros.",
    group: "super",
    mount({ textEl, reduceMotion }) {
      if (reduceMotion) return;
      const split = splitText(textEl, {
        chars: true,
        accessible: true,
      }).addEffect(({ chars }) =>
        createTimeline({
          loop: true,
          loopDelay: READ_PAUSE,
        })
          .add(
            chars,
            { color: [MILK, WHEY], duration: 900, ease: steps(1) },
            stagger(40),
          )
          .add(
            holeTargets(chars),
            { scale: PUNCH_SCALE, opacity: PUNCH_OPACITY },
            stagger(70, { from: "random" }),
          ),
      );
      return () => revertSplit(split);
    },
  },
  {
    id: "paso-mordido",
    label: "Paso-mordido",
    hint: "Un paso parejo y luego el mordisco.",
    group: "super",
    mount({ textEl, reduceMotion }) {
      if (reduceMotion) return;
      const split = splitText(textEl, {
        chars: true,
        accessible: true,
      }).addEffect(({ chars }) =>
        createTimeline({
          loop: true,
          loopDelay: READ_PAUSE,
        })
          .add(chars, { y: STEP_Y }, stagger(140))
          .add(chars, BITE_OUT, stagger(48, { from: "last" }))
          .add(chars, BITE_IN, stagger(36, { from: "first" })),
      );
      return () => revertSplit(split);
    },
  },
  {
    id: "palabra-nariz",
    label: "Palabra-nariz",
    hint: "Cada palabra olfatea al llegar.",
    group: "super",
    mount({ textEl, reduceMotion }) {
      if (reduceMotion) return;
      const split = splitText(textEl, {
        words: { wrap: "clip" },
        accessible: true,
      }).addEffect(({ words }) =>
        animate(words, {
          y: [
            { to: ["100%", "0%"], duration: 280, ease: "out(3)" },
            { to: "0.38rem", duration: 240, ease: "out(2)" },
            { to: "0.08rem", duration: 160, ease: "inOutSine" },
            { to: "0.42rem", duration: 200, ease: "out(2)" },
            { to: 0, duration: 420, ease: "out(3)" },
          ],
          rotate: [
            { to: 0, duration: 280, ease: "out(3)" },
            { to: 7, duration: 240, ease: "out(2)" },
            { to: 2, duration: 160, ease: "inOutSine" },
            { to: 8, duration: 200, ease: "out(2)" },
            { to: 0, duration: 420, ease: "out(3)" },
          ],
          delay: stagger(100),
          loop: true,
          loopDelay: READ_PAUSE,
        }),
      );
      return () => revertSplit(split);
    },
  },
  {
    id: "raton-whey",
    label: "Ratón-whey",
    hint: "Rebota, se tiñe de whey y sigue tocando letras.",
    group: "super",
    mount({ textEl, reduceMotion }) {
      if (reduceMotion) return;
      const split = splitText(textEl, {
        words: false,
        chars: true,
        accessible: true,
      }).addEffect(({ chars }) => {
        let stopped = false;
        let idle: LetterIdle | undefined;
        let intro: { revert: () => unknown } | undefined;
        let pauseTimer: ReturnType<typeof setTimeout> | undefined;

        const cycle = () => {
          if (stopped) return;
          intro = createTimeline({
            onComplete: () => {
              if (stopped) return;
              idle = startLetterIdle(chars, {
                times: IDLE_TWITCHES,
                onDone: () => {
                  if (stopped) return;
                  pauseTimer = setTimeout(cycle, READ_PAUSE);
                },
              });
            },
          })
            .add(
              chars,
              { y: BOUNCE_Y, rotate: BOUNCE_ROTATE, ease: "inOutCirc" },
              stagger(50),
            )
            .add(
              chars,
              { color: [MILK, WHEY], duration: 900, ease: steps(1) },
              stagger(40),
            );
        };

        cycle();
        return () => {
          stopped = true;
          idle?.stop();
          intro?.revert();
          if (pauseTimer) clearTimeout(pauseTimer);
        };
      });
      return () => revertSplit(split);
    },
  },
];
