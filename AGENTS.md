# postulacion_cheese-studio

Interactive storytelling microsite.

Active handoff (read before editing `/wispr-infinito`): [`.cursor/CONTINUE.md`](.cursor/CONTINUE.md).

## Stack
- Next.js (App Router)
- anime.js — scroll / interaction motor
- Canvas UI — aesthetic / GPU layer

## Agent topology
- Parent chat = orchestrator only (no product code).
- Implementation via Task subagents with **explicit** Cursor allowlist `model` slugs (see `.cursor/rules/01-models.mdc`).
- Subagent `model` is independent of the Cursor model picker (even if the picker is empty).


## Cursor UI modes + ask first
All Cursor modes (Agent, Plan, Ask, Debug, Multitask) inherit the orchestrator hard rules — switching mode does not let the parent write product code. Plan markdown is fine; implementing plans and Debug patches go through Tasks with explicit `model`. Ask clarifying questions before `CreatePlan`, before the first Task on a new outcome, and before claiming Done (1–3 short questions). Project overlay wins over Never Block when that would skip questions.

## Models
- `cursor-grok-4.7-high` — complex / greenfield / motion architecture (default for complex work)
- `cursor-grok-4.7-medium` — follow-ups / polish; also maps human `low` (no `*-low` slug in Cursor)
- `composer-2.5` — commits, shell, move/copy, mechanical deploy
- **Only these three.** Never Fast (incl. UI “High Fast”). Never xhigh. Never `cursor-grok-4.6-*` / 4.5 / inherit / Auto / omit `model` on Task launch **or resume**.
- Bare effort words: `high` → `cursor-grok-4.7-high`; `medium`/`low` → `cursor-grok-4.7-medium`. If human says `xhigh` or picks Fast: refuse.
- Cursor allowlist drift: intersection with this table; if empty → stop (do not fall back to 4.6 / Fast / xhigh / inherit).
- If Cursor rejects a slug: stop and report — do not fall back to 4.6 or Fast.

## Typography
- Cheese brand reference: **Benzin Semibold** (see `.cursor/rules/05-typography.mdc`).
- Develop a project type **family** coherent with that feel — do not lock Benzin as the only font.

## Official docs
Before product code: canonical official docs (nextjs.org, anime.js, Canvas UI). **No Context7.** Writers consult; orchestrator enforces in Task prompts. See `.cursor/rules/04-official-docs.mdc`.

## UI kits + MCPs (official only)
- Core: Next.js + anime.js + Canvas UI.
- Additive registries in `components.json`: `@magicui`, `@aceternity`, `@skiper-ui`, `@canvas-ui`.
- **Magic UI** has its own official MCP (list/search/get registry items). **Aceternity / Skiper / Canvas** use the **shadcn** MCP + registries (no separate official Aceternity/Skiper/anime MCP).
- **anime.js**: no official MCP yet — docs only; never third-party anime MCP.
- **Free only** — no Pro/license keys. Skiper free needs attribution. Paywall → pick another free item.
- Install = `shadcn add` (copies source + npm deps of that item). MCP = discovery only.
- Details: `.cursor/rules/07-ui-registries-mcp.mdc`.

## Engram / Gentle
Session start: `mem_context` for this repo. When a look or constraint is accepted, `mem_save` so later chats do not undo it. Before changing home, honor Engram “do not regress”. Labs (`/raton`, `/x-flame`, mouse prototypes) are intentional rehearsal — merge into home without rewriting splash. No beat roadmap unless asked.


## Scaffold
Work only in this repo directory. Never `/tmp`. See `.cursor/rules/12-next-app.mdc`.

## Routing
Organic (ODD) by default. SDD only on request or accepted proposal. On Cursor, RDD 4R is unmanaged — never invent PASS.

Detailed rules live in `.cursor/rules/*.mdc` (version-controlled project rules).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
