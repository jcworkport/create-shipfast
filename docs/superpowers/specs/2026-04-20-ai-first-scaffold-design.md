# AI-First Scaffold Design

**Date:** 2026-04-20
**Status:** Approved

## Problem

`create-shipfast` was built for the old developer workflow: generate boilerplate, hand-write the rest. In an AI-first workflow this creates two problems:

1. **Too much generated code** — AI tools get handed a wall of opinionated boilerplate and must mentally filter what's real vs. placeholder. This degrades suggestion quality and increases context noise.
2. **No AI orientation** — generated projects have no CLAUDE.md, AGENTS.md, or any file that tells an AI tool what the project conventions are, where things live, or how to work safely in the codebase.

## Goal

Reposition `create-shipfast` as a **launchpad + map** tool: generate the minimum runnable skeleton that proves the stack works, plus a comprehensive AI context layer that orients any AI tool to the project immediately.

## What Stays the Same

- Generator pipeline: `prompts.js` → `generator.js` → Handlebars templates
- `buildContext` shape and boolean flags (`isNextjs`, `isNestjs`, `isPostgres`, etc.)
- Prompt flow and stack choices (Next.js, NestJS, Postgres/Mongo, Kratos/JWT, AWS region)
- All shared infra templates: `docker-compose.dev.yml`, `docker-compose.prod.yml`, ECS task definitions, GitHub Actions workflows, Kratos config

## What Changes

### 1. Template pruning

Each application template is stripped to the minimum that proves the stack works and boots cleanly.

**Next.js (`templates/frontend/nextjs/`)**
- Keep: `app/layout.tsx`, `app/page.tsx` (hello world), `app/api/health/route.ts`, `next.config.ts`, `tsconfig.json`, `Dockerfile`, `.env.example.hbs`, one passing test
- Remove: pre-built pages, components, auth UI, feature code

**NestJS (`templates/backend/nestjs/`)**
- Keep: `AppModule`, `HealthController` (`GET /health`), `main.ts`, `tsconfig.json`, `Dockerfile`, `.env.example.hbs`, one passing test
- Remove: pre-built modules, guards, decorators, feature scaffolding

**`.env.example.hbs`** is added to both templates. Every env var is documented with a one-line comment explaining what it does and where it's used. This is rendered conditionally based on chosen stack (e.g. database URL only appears if a database is selected).

### 2. AI context files

A new `templates/shared/ai-context/` folder is added. The generator renders these files into every project root unconditionally.

**Files generated:**
- `CLAUDE.md` — for Claude Code (Anthropic)
- `AGENTS.md` — for Codex / OpenAI Agents

Both files are rendered from shared Handlebars partials so content stays in sync:

```
templates/shared/ai-context/
├── CLAUDE.md.hbs          # thin wrapper: includes all three partials
├── AGENTS.md.hbs          # identical structure, different filename convention
└── partials/
    ├── architecture.hbs   # directory map, module connections, where to add things
    ├── conventions.hbs    # naming, file structure, how to write a route/module/test
    └── tooling.hbs        # commands, env vars, deploy steps, linter rules
```

All partials use the same context booleans as the rest of the generator — a Postgres project includes Prisma migration commands, a Kratos project includes auth flow docs, etc.

### 3. AI context file content

The CLAUDE.md / AGENTS.md are written in the voice of "things an AI needs to know to work safely in this project" — not a human tutorial, not a README summary.

**Architecture section**
- Directory tree with one-line purpose per folder
- How frontend/backend/infra connect
- Where to add a new feature ("a new API resource goes in `src/modules/` with its own controller, service, and DTO files")

**Conventions section**
- File and variable naming patterns
- How a new route, module, or component is structured
- What a test file looks like
- Import style rules
- Directives like "always add a DTO for new endpoints", "never modify generated Prisma types directly", "migrations live in `prisma/migrations/` and must be committed"

**Tooling section**
- Every runnable command (`npm run dev`, `npm run test`, `npm run build`, `docker compose up`)
- What each env var does and where it's set
- How to deploy
- What the linter enforces and how to fix violations

## What We're Not Doing

- No new stack choices or framework options (YAGNI)
- No "pull updated configs" mechanism post-generation (separate concern)
- No divergence between CLAUDE.md and AGENTS.md content (same partials, same information)
- No changes to the generator architecture or prompt flow

## Success Criteria

1. A generated project boots with `docker compose up` with no modification
2. A generated project's CLAUDE.md is sufficient for an AI tool to add a new API endpoint without reading any other file
3. Generated application code (excluding infra/config) fits comfortably in a single AI context window
