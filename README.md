# A mouse made of holes

Interactive homage microsite. Original cheese-wedge mouse. Not Cheese Studio's official site.

## Run

Node 24 (see `.nvmrc`). Package manager is pnpm 12 (`packageManager` in `package.json`). No `.env` is required.

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Labs: `/scroll`, `/wispr-infinito`.

```bash
pnpm build
pnpm start
pnpm exec eslint components/text-trail app/wispr-infinito
pnpm exec tsc --noEmit -p .
```

## Stack

Next.js App Router, anime.js (scroll path and crumbs), Canvas UI Liquid (background only).
