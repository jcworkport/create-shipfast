# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## What this is

`create-shipfast` is an `npm init`-style scaffolder (`npx create-shipfast`) that generates a production-ready full-stack app via interactive prompts. It is ESM (`type: module`), Node ≥ 18.

## Commands

```bash
# Run tests
npm test                          # Jest (all tests)

# Run the CLI locally (without publishing)
node src/cli.js

# Run a single test file
node --experimental-vm-modules node_modules/.bin/jest test/generator.test.js
```

## Architecture

The tool has three layers:

1. **`src/prompts.js`** — Collects user answers via Inquirer and builds a flat `context` object of booleans (`isNextjs`, `isKratos`, `hasDatabase`, …). The context is the single source of truth passed to all Handlebars templates.

2. **`src/generator.js`** — Walks `templates/frontend/<choice>`, `templates/backend/<choice>`, and `templates/shared/` in that order, rendering `.hbs` files with the context and copying static files verbatim. Empty-after-render files are skipped (the mechanism for conditional files).

3. **`templates/`** — Handlebars templates organised by layer and framework:
   - `templates/frontend/nextjs/` — Next.js 15 App Router scaffold
   - `templates/backend/nestjs/` — NestJS with Fastify scaffold
   - `templates/shared/` — `docker-compose.{dev,prod}.yml`, root `package.json`, and `infra/` (Kratos config, ECS task definitions, GitHub Actions workflows)

## Adding a new template option

1. Add the choice to the relevant prompt in `src/prompts.js` and add a boolean flag to `buildContext`.
2. Create `templates/frontend/<value>/` or `templates/backend/<value>/` with the scaffold files (use `.hbs` for templated files, plain files are copied as-is).
3. Use `{{#if isYourFlag}}…{{/if}}` blocks in shared templates to conditionally include sections.
4. Add tests in `test/generator.test.js` covering the new combination.
