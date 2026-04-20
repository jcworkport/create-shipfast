# AI-First Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reposition `create-shipfast` as a launchpad + map tool — minimal runnable skeleton that boots, plus `CLAUDE.md` and `AGENTS.md` that orient any AI tool to the generated project immediately.

**Architecture:** The generator pipeline (`prompts.js` → `generator.js` → Handlebars templates) is unchanged. `generator.js` gains a `registerPartials()` step so shared Handlebars partials can be referenced in `CLAUDE.md.hbs`/`AGENTS.md.hbs`. Application templates are stripped to bare skeleton (one health endpoint + one test). All feature code is removed from templates; the AI context docs explain how to add it back.

**Tech Stack:** Node.js ESM, Handlebars 4, Jest (ESM via `--experimental-vm-modules`), NestJS + Fastify, Next.js 15 App Router, Prisma (Postgres), Mongoose (MongoDB), Ory Kratos / JWT auth.

---

## File Map

**Modified:**
- `src/generator.js` — add `registerPartials()`, skip `partials/` dirs in `processTemplateDir`, call `registerPartials` in `generate()`
- `templates/backend/nestjs/src/app.module.ts.hbs` — remove `UserModule`/`AuthModule`, add `HealthModule`
- `templates/backend/nestjs/src/app.spec.ts.hbs` — test `HealthController` instead of trivial `true`
- `templates/frontend/nextjs/package.json.hbs` — add `jest` + `ts-jest` + `@types/jest` to devDeps + `test` script

**Created:**
- `templates/shared/partials/architecture.hbs` — directory map + where-to-add-feature partial
- `templates/shared/partials/conventions.hbs` — naming, structure, directives partial
- `templates/shared/partials/tooling.hbs` — commands, env vars, deploy partial
- `templates/shared/CLAUDE.md.hbs` — wrapper using all three partials (Claude Code)
- `templates/shared/AGENTS.md.hbs` — wrapper using all three partials (Codex/OpenAI)
- `templates/backend/nestjs/src/health/health.controller.ts.hbs` — `GET /health` → `{ status: 'ok' }`
- `templates/backend/nestjs/src/health/health.module.ts.hbs` — `HealthModule`
- `templates/backend/nestjs/.env.example.hbs` — documented env vars, stack-conditional
- `templates/frontend/nextjs/src/app/api/health/route.ts.hbs` — `GET /api/health` → `{ status: 'ok' }`
- `templates/frontend/nextjs/.env.example.hbs` — documented env vars, stack-conditional
- `templates/frontend/nextjs/__tests__/smoke.test.ts` — one passing test (static, no `.hbs`)

**Deleted:**
- `templates/backend/nestjs/src/auth/` (all 4 files)
- `templates/backend/nestjs/src/user/` (all 4 files)
- `templates/frontend/nextjs/src/app/(auth)/` (login, register pages)
- `templates/frontend/nextjs/src/app/dashboard/`
- `templates/frontend/nextjs/src/lib/`

**Test file:**
- `test/generator.test.js` — add tests: partials registered, CLAUDE.md generated, health routes generated, .env.example generated, deleted templates absent

---

## Task 1: TDD — Handlebars partials support in generator.js

**Files:**
- Modify: `test/generator.test.js`
- Modify: `src/generator.js`

- [ ] **Step 1: Write three failing tests**

Add to `test/generator.test.js`:

```js
import { generate } from '../src/generator.js';
import Handlebars from 'handlebars';
// Add `readdir` to the existing fs/promises import at the top of the file:
// import { mkdtemp, readFile, writeFile, mkdir, readdir } from 'fs/promises';

describe('Handlebars partials', () => {
  afterEach(() => {
    Handlebars.unregisterPartial('greeting');
  });

  test('processTemplateDir renders {{> partial}} when partial is registered', async () => {
    const src = await makeTmpDir();
    const dest = await makeTmpDir();
    Handlebars.registerPartial('greeting', 'Hello {{name}}');
    await writeFile(join(src, 'output.txt.hbs'), '{{> greeting}}');

    await processTemplateDir(src, dest, { name: 'world' });

    const result = await readFile(join(dest, 'output.txt'), 'utf-8');
    expect(result).toBe('Hello world');
  });

  test('processTemplateDir skips partials/ directory (does not output it)', async () => {
    const src = await makeTmpDir();
    const dest = await makeTmpDir();
    await mkdir(join(src, 'partials'));
    await writeFile(join(src, 'partials', 'foo.hbs'), 'should not appear');
    await writeFile(join(src, 'real.txt.hbs'), 'real content');

    await processTemplateDir(src, dest, {});

    const files = await readdir(dest);
    expect(files).not.toContain('partials');
    expect(files).toContain('real.txt');
  });
});

describe('generate() — AI context files', () => {
  test('generates CLAUDE.md in project root', async () => {
    const dest = await makeTmpDir();
    await generate(
      { frontend: 'none', backend: 'none' },
      { projectName: 'test-app', hasFrontend: false, hasBackend: false,
        isNextjs: false, isNestjs: false, isPostgres: false, isMongo: false,
        isKratos: false, isJwt: false, hasAuth: false, hasDatabase: false,
        hasVolumes: false, backendHasDeps: false, awsRegion: 'eu-west-2',
        postgresImage: '', mongoImage: '', kratosImage: '', mailpitImage: '' },
      dest,
    );
    const files = await readdir(dest);
    expect(files).toContain('CLAUDE.md');
    expect(files).toContain('AGENTS.md');
  });

  test('generated CLAUDE.md contains project name and all three sections', async () => {
    const dest = await makeTmpDir();
    await generate(
      { frontend: 'none', backend: 'none' },
      { projectName: 'my-project', hasFrontend: false, hasBackend: false,
        isNextjs: false, isNestjs: false, isPostgres: false, isMongo: false,
        isKratos: false, isJwt: false, hasAuth: false, hasDatabase: false,
        hasVolumes: false, backendHasDeps: false, awsRegion: 'eu-west-2',
        postgresImage: '', mongoImage: '', kratosImage: '', mailpitImage: '' },
      dest,
    );
    const content = await readFile(join(dest, 'CLAUDE.md'), 'utf-8');
    expect(content).toContain('my-project');
    expect(content).toContain('## Architecture');
    expect(content).toContain('## Conventions');
    expect(content).toContain('## Tooling');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/joel/Documents/create-shipfast && npm test -- --testNamePattern="Handlebars partials|AI context files"
```

Expected: FAIL — `processTemplateDir` doesn't skip `partials/`, no `CLAUDE.md` generated.

- [ ] **Step 3: Update `src/generator.js`**

Replace the full file content:

```js
import { readdir, readFile, writeFile, mkdir, copyFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Handlebars from 'handlebars';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const TEMPLATES_DIR = join(__dirname, '..', 'templates');

async function registerPartials(partialsDir) {
  let entries;
  try {
    entries = await readdir(partialsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() && entry.name.endsWith('.hbs')) {
      const name = entry.name.slice(0, -4);
      const content = await readFile(join(partialsDir, entry.name), 'utf-8');
      Handlebars.registerPartial(name, content);
    }
  }
}

export async function processTemplateDir(srcDir, destDir, context) {
  const entries = await readdir(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(srcDir, entry.name);
    const destName = entry.name.endsWith('.hbs')
      ? entry.name.slice(0, -4)
      : entry.name;
    const destPath = join(destDir, destName);

    if (entry.isDirectory()) {
      if (entry.name === 'partials') continue;
      await mkdir(destPath, { recursive: true });
      await processTemplateDir(srcPath, destPath, context);
    } else if (entry.name.endsWith('.hbs')) {
      const raw = await readFile(srcPath, 'utf-8');
      const compiled = Handlebars.compile(raw)(context);
      if (!compiled.trim()) continue;
      await mkdir(dirname(destPath), { recursive: true });
      await writeFile(destPath, compiled, 'utf-8');
    } else {
      await mkdir(dirname(destPath), { recursive: true });
      await copyFile(srcPath, destPath);
    }
  }
}

export async function generate(answers, context, outputDir) {
  await registerPartials(join(TEMPLATES_DIR, 'shared', 'partials'));

  if (answers.frontend !== 'none') {
    await processTemplateDir(
      join(TEMPLATES_DIR, 'frontend', answers.frontend),
      join(outputDir, 'frontend'),
      context,
    );
  }

  if (answers.backend !== 'none') {
    await processTemplateDir(
      join(TEMPLATES_DIR, 'backend', answers.backend),
      join(outputDir, 'backend'),
      context,
    );
  }

  await processTemplateDir(
    join(TEMPLATES_DIR, 'shared'),
    outputDir,
    context,
  );
}
```

- [ ] **Step 4: Run the new tests — they still fail (partials not created yet)**

```bash
cd /Users/joel/Documents/create-shipfast && npm test -- --testNamePattern="Handlebars partials|AI context files"
```

Expected: partials-skip test passes, CLAUDE.md tests fail (templates don't exist yet).

- [ ] **Step 5: Commit**

```bash
git -C /Users/joel/Documents/create-shipfast add src/generator.js test/generator.test.js
git -C /Users/joel/Documents/create-shipfast commit -m "add handlebars partials support and skip partials dirs"
```

---

## Task 2: Create shared Handlebars partials

**Files:**
- Create: `templates/shared/partials/architecture.hbs`
- Create: `templates/shared/partials/conventions.hbs`
- Create: `templates/shared/partials/tooling.hbs`

- [ ] **Step 1: Create `templates/shared/partials/architecture.hbs`**

```handlebars
## Architecture

### Directory Map

{{#if hasFrontend}}
**Frontend** (`frontend/`) — Next.js App Router application
- `frontend/src/app/` — Pages and layouts (file-system routing)
- `frontend/src/app/api/` — Next.js API route handlers (server-side only)
- `frontend/public/` — Static assets served at `/`
{{/if}}
{{#if hasBackend}}
**Backend** (`backend/`) — NestJS API server (Fastify transport, port 3001)
- `backend/src/` — Application source
- `backend/src/health/` — Health check module (`GET /api/health`)
{{#if isPostgres}}- `backend/prisma/` — Prisma schema (`schema.prisma`) and migration files{{/if}}
{{/if}}

**Infrastructure** (project root)
- `docker-compose.dev.yml` — Local dev stack (hot reload, volume mounts)
- `docker-compose.prod.yml` — Production Docker Compose
- `infra/ecs/` — AWS ECS task definitions
- `infra/.github/` — GitHub Actions CI/CD workflows
{{#if isKratos}}- `infra/kratos/` — Ory Kratos identity server config{{/if}}
- `deploy/` — `build-tag-push.js` script for ECR deployment

### Adding a New Feature

{{#if hasBackend}}
**New NestJS API resource:**
1. Create `backend/src/<feature>/` containing:
   - `<feature>.module.ts` — declares controllers and providers
   - `<feature>.controller.ts` — HTTP handlers, delegates to service
   - `<feature>.service.ts` — business logic
   - `<feature>.dto.ts` — request/response shape classes
2. Add `<Feature>Module` to the `imports` array in `backend/src/app.module.ts`
{{/if}}
{{#if hasFrontend}}
**New Next.js page:**
1. Create `frontend/src/app/<path>/page.tsx` — the URL path mirrors the folder path
2. For a new API route: `frontend/src/app/api/<path>/route.ts` exporting named HTTP method handlers
{{/if}}
```

- [ ] **Step 2: Create `templates/shared/partials/conventions.hbs`**

```handlebars
## Conventions

{{#if hasBackend}}
### Backend (NestJS)

- **File naming:** `<feature>.module.ts`, `<feature>.controller.ts`, `<feature>.service.ts`, `<feature>.dto.ts`
- **DTOs are required:** always define a DTO class for request bodies — never use `any` or `object`
- **Layer separation:** services own business logic; controllers only parse requests and call services
- **Imports use `.js` extension** (Node ESM): `import { X } from './x.service.js'`
- **Every controller method** that handles external input gets a corresponding unit test
{{#if isPostgres}}
- **Prisma:** never edit files in `node_modules/.prisma` or `generated/` — regenerate with `npx prisma generate`
- **Migrations must be committed:** after `npx prisma migrate dev`, commit the new file in `prisma/migrations/`
- **Schema changes:** edit `prisma/schema.prisma`, run `npx prisma migrate dev --name <description>`, then `npx prisma generate`
{{/if}}
{{#if isKratos}}
- **Auth:** identity management is handled by Ory Kratos — do not implement login/registration in the backend directly. Validate sessions by calling the Kratos `/sessions/whoami` endpoint using `KRATOS_PUBLIC_URL`.
{{/if}}
{{#if isJwt}}
- **Auth:** JWT tokens are signed with `JWT_SECRET`. Use `@nestjs/jwt` and `@nestjs/passport` — guards go in `src/auth/`.
{{/if}}
{{/if}}

{{#if hasFrontend}}
### Frontend (Next.js)

- **Pages** are `src/app/<path>/page.tsx` — always named `page.tsx`
- **Server vs client components:** server components are default. Add `'use client'` only when you need `useState`, `useEffect`, or browser-only APIs
- **API routes** export named HTTP method handlers: `export function GET() {}`, `export async function POST(req: Request) {}`
- **Environment variables:** `NEXT_PUBLIC_` prefix = browser-accessible; no prefix = server-only (never sent to browser)
- **Imports:** use `@/` alias for `src/` (configured in `tsconfig.json`)
{{/if}}

### Git

- Commit messages: short imperative lowercase (`add health endpoint`, `fix cors config`)
- Always commit `.env.example` when adding new environment variables
- Never commit `.env` — it is gitignored
```

- [ ] **Step 3: Create `templates/shared/partials/tooling.hbs`**

```handlebars
## Tooling

### Commands

**From project root:**

| Command | What it does |
|---------|-------------|
| `npm run dev` | Start full local stack with Docker Compose (hot reload) |
| `npm run dev:build` | Rebuild images and start local stack |
| `node deploy/build-tag-push.js` | Build and push Docker images to AWS ECR |

{{#if hasBackend}}
**From `backend/`:**

| Command | What it does |
|---------|-------------|
| `npm run start:dev` | Run backend with hot reload (requires Docker deps running) |
| `npm test` | Run unit tests |
| `npm run build` | Compile TypeScript to `dist/` |
{{#if isPostgres}}| `npx prisma migrate dev --name <desc>` | Create and apply a new migration |
| `npx prisma generate` | Regenerate Prisma client after schema change |
| `npx prisma studio` | Open Prisma Studio (browser-based DB viewer) |{{/if}}
{{/if}}

{{#if hasFrontend}}
**From `frontend/`:**

| Command | What it does |
|---------|-------------|
| `npm run dev` | Run Next.js dev server (requires Docker deps running) |
| `npm run build` | Build for production |
| `npm test` | Run unit tests |
{{/if}}

### Environment Variables

Copy `.env.example` to `.env` in each service directory before running locally.

{{#if hasBackend}}
**`backend/.env`:**

| Variable | Description |
|----------|-------------|
| `PORT` | Port the backend listens on (default: `3001`) |
| `FRONTEND_URL` | Frontend origin for CORS (`http://localhost:3000` locally) |
{{#if isPostgres}}| `DATABASE_URL` | PostgreSQL connection string (`postgresql://user:pass@localhost:5432/{{projectName}}`) |{{/if}}
{{#if isMongo}}| `MONGODB_URI` | MongoDB connection URI (`mongodb://localhost:27017/{{projectName}}`) |{{/if}}
{{#if isJwt}}| `JWT_SECRET` | Secret for signing JWT tokens — long random string in production |{{/if}}
{{#if isKratos}}| `KRATOS_ADMIN_URL` | Kratos admin API, not exposed to browser (`http://localhost:4434`) |
| `KRATOS_PUBLIC_URL` | Kratos public API (`http://localhost:4433`) |{{/if}}
{{/if}}

{{#if hasFrontend}}
**`frontend/.env`:**

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Backend API base URL (`http://localhost:3001` locally) |
{{#if isKratos}}| `NEXT_PUBLIC_KRATOS_URL` | Kratos public API URL accessible from browser (`http://localhost:4433`) |{{/if}}
{{/if}}

### Deploy

1. Ensure AWS credentials are configured and `AWS_REGION` matches `{{awsRegion}}`
2. Run `node deploy/build-tag-push.js` from the project root — builds and pushes images to ECR
3. ECS task definitions are in `infra/ecs/` — update and re-apply after infrastructure changes
```

- [ ] **Step 4: Run full test suite — existing tests must still pass**

```bash
cd /Users/joel/Documents/create-shipfast && npm test
```

Expected: all previously passing tests still pass.

- [ ] **Step 5: Commit**

```bash
git -C /Users/joel/Documents/create-shipfast add templates/shared/partials/
git -C /Users/joel/Documents/create-shipfast commit -m "add ai context handlebars partials (architecture, conventions, tooling)"
```

---

## Task 3: Create CLAUDE.md.hbs and AGENTS.md.hbs

**Files:**
- Create: `templates/shared/CLAUDE.md.hbs`
- Create: `templates/shared/AGENTS.md.hbs`

- [ ] **Step 1: Create `templates/shared/CLAUDE.md.hbs`**

```handlebars
# CLAUDE.md

This file tells Claude Code how to work safely in this project. Read it before making any changes.

**Project:** `{{projectName}}`
**Stack:**{{#if isNextjs}} Next.js (frontend){{/if}}{{#if hasBackend}} + {{/if}}{{#if isNestjs}}NestJS/Fastify (backend){{/if}}{{#if isPostgres}} + PostgreSQL/Prisma{{/if}}{{#if isMongo}} + MongoDB/Mongoose{{/if}}{{#if isKratos}} + Ory Kratos (auth){{/if}}{{#if isJwt}} + JWT auth{{/if}}

---

{{> architecture}}

---

{{> conventions}}

---

{{> tooling}}
```

- [ ] **Step 2: Create `templates/shared/AGENTS.md.hbs`**

```handlebars
# AGENTS.md

This file tells AI coding agents how to work safely in this project. Read it before making any changes.

**Project:** `{{projectName}}`
**Stack:**{{#if isNextjs}} Next.js (frontend){{/if}}{{#if hasBackend}} + {{/if}}{{#if isNestjs}}NestJS/Fastify (backend){{/if}}{{#if isPostgres}} + PostgreSQL/Prisma{{/if}}{{#if isMongo}} + MongoDB/Mongoose{{/if}}{{#if isKratos}} + Ory Kratos (auth){{/if}}{{#if isJwt}} + JWT auth{{/if}}

---

{{> architecture}}

---

{{> conventions}}

---

{{> tooling}}
```

- [ ] **Step 3: Run the AI context tests from Task 1 — they should now pass**

```bash
cd /Users/joel/Documents/create-shipfast && npm test -- --testNamePattern="AI context files"
```

Expected: PASS — `CLAUDE.md` and `AGENTS.md` generated, contain project name and all three section headers.

- [ ] **Step 4: Run full test suite**

```bash
cd /Users/joel/Documents/create-shipfast && npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git -C /Users/joel/Documents/create-shipfast add templates/shared/CLAUDE.md.hbs templates/shared/AGENTS.md.hbs
git -C /Users/joel/Documents/create-shipfast commit -m "add CLAUDE.md and AGENTS.md template generation"
```

---

## Task 4: Add NestJS health module and update app.module

**Files:**
- Create: `templates/backend/nestjs/src/health/health.controller.ts.hbs`
- Create: `templates/backend/nestjs/src/health/health.module.ts.hbs`
- Modify: `templates/backend/nestjs/src/app.module.ts.hbs`

- [ ] **Step 1: Write failing test in `test/generator.test.js`**

```js
describe('nestjs template — health endpoint', () => {
  test('generates health controller with GET /health', async () => {
    const src = await makeTmpDir();
    const dest = await makeTmpDir();
    const raw = await readFile(
      new URL('../templates/backend/nestjs/src/health/health.controller.ts.hbs', import.meta.url),
      'utf-8'
    );
    await mkdir(join(src, 'health'), { recursive: true });
    await writeFile(join(src, 'health', 'health.controller.ts.hbs'), raw);

    await processTemplateDir(src, dest, {});

    const result = await readFile(join(dest, 'health', 'health.controller.ts'), 'utf-8');
    expect(result).toContain("@Get()");
    expect(result).toContain("status: 'ok'");
  });

  test('app.module includes HealthModule not UserModule', async () => {
    const src = await makeTmpDir();
    const dest = await makeTmpDir();
    const raw = await readFile(
      new URL('../templates/backend/nestjs/src/app.module.ts.hbs', import.meta.url),
      'utf-8'
    );
    await writeFile(join(src, 'app.module.ts.hbs'), raw);

    await processTemplateDir(src, dest, { isPostgres: false, isMongo: false, hasAuth: false });

    const result = await readFile(join(dest, 'app.module.ts'), 'utf-8');
    expect(result).toContain('HealthModule');
    expect(result).not.toContain('UserModule');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/joel/Documents/create-shipfast && npm test -- --testNamePattern="nestjs template — health"
```

Expected: FAIL — files don't exist yet.

- [ ] **Step 3: Create `templates/backend/nestjs/src/health/health.controller.ts.hbs`**

```handlebars
import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok' };
  }
}
```

- [ ] **Step 4: Create `templates/backend/nestjs/src/health/health.module.ts.hbs`**

```handlebars
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';

@Module({ controllers: [HealthController] })
export class HealthModule {}
```

- [ ] **Step 5: Replace `templates/backend/nestjs/src/app.module.ts.hbs`**

```handlebars
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
{{#if isPostgres}}import { PrismaModule } from './prisma/prisma.module.js';{{/if}}
{{#if isMongo}}import { MongooseModule } from '@nestjs/mongoose';{{/if}}
import { HealthModule } from './health/health.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    {{#if isPostgres}}PrismaModule,{{/if}}
    {{#if isMongo}}MongooseModule.forRoot(process.env.MONGODB_URI),{{/if}}
    HealthModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 6: Run health tests — they should now pass**

```bash
cd /Users/joel/Documents/create-shipfast && npm test -- --testNamePattern="nestjs template — health"
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git -C /Users/joel/Documents/create-shipfast add templates/backend/nestjs/src/health/ templates/backend/nestjs/src/app.module.ts.hbs
git -C /Users/joel/Documents/create-shipfast commit -m "add nestjs health module and simplify app.module"
```

---

## Task 5: Update NestJS app.spec.ts to test HealthController

**Files:**
- Modify: `templates/backend/nestjs/src/app.spec.ts.hbs`

- [ ] **Step 1: Replace `templates/backend/nestjs/src/app.spec.ts.hbs`**

```handlebars
import { Test } from '@nestjs/testing';
import { HealthController } from './health/health.controller.js';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();
    controller = module.get(HealthController);
  });

  it('returns ok status', () => {
    expect(controller.check()).toEqual({ status: 'ok' });
  });
});
```

- [ ] **Step 2: Run full test suite**

```bash
cd /Users/joel/Documents/create-shipfast && npm test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git -C /Users/joel/Documents/create-shipfast add templates/backend/nestjs/src/app.spec.ts.hbs
git -C /Users/joel/Documents/create-shipfast commit -m "update nestjs test template to test health controller"
```

---

## Task 6: Delete pruned NestJS files

**Files to delete:**
- `templates/backend/nestjs/src/auth/auth.controller.ts.hbs`
- `templates/backend/nestjs/src/auth/auth.module.ts.hbs`
- `templates/backend/nestjs/src/auth/auth.service.ts.hbs`
- `templates/backend/nestjs/src/auth/session.guard.ts.hbs`
- `templates/backend/nestjs/src/user/user.controller.ts.hbs`
- `templates/backend/nestjs/src/user/user.entity.ts.hbs`
- `templates/backend/nestjs/src/user/user.module.ts.hbs`
- `templates/backend/nestjs/src/user/user.service.ts.hbs`

- [ ] **Step 1: Write a test asserting auth/user files are not generated**

Add to `test/generator.test.js`:

```js
describe('nestjs template — pruned files absent', () => {
  test('generate() does not produce auth or user modules', async () => {
    const dest = await makeTmpDir();
    await generate(
      { frontend: 'none', backend: 'nestjs' },
      { projectName: 'test-app', hasFrontend: false, hasBackend: true,
        isNextjs: false, isNestjs: true, isPostgres: false, isMongo: false,
        isKratos: false, isJwt: false, hasAuth: false, hasDatabase: false,
        hasVolumes: false, backendHasDeps: false, awsRegion: 'eu-west-2',
        postgresImage: '', mongoImage: '', kratosImage: '', mailpitImage: '' },
      dest,
    );
    let authExists = true;
    try { await readdir(join(dest, 'backend', 'src', 'auth')); } catch { authExists = false; }
    let userExists = true;
    try { await readdir(join(dest, 'backend', 'src', 'user')); } catch { userExists = false; }
    expect(authExists).toBe(false);
    expect(userExists).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify — currently FAILS (files still exist)**

```bash
cd /Users/joel/Documents/create-shipfast && npm test -- --testNamePattern="pruned files absent"
```

Expected: FAIL.

- [ ] **Step 3: Delete the pruned files**

```bash
rm -rf /Users/joel/Documents/create-shipfast/templates/backend/nestjs/src/auth
rm -rf /Users/joel/Documents/create-shipfast/templates/backend/nestjs/src/user
```

- [ ] **Step 4: Run test — should now pass**

```bash
cd /Users/joel/Documents/create-shipfast && npm test -- --testNamePattern="pruned files absent"
```

Expected: PASS.

- [ ] **Step 5: Run full test suite**

```bash
cd /Users/joel/Documents/create-shipfast && npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git -C /Users/joel/Documents/create-shipfast add -A templates/backend/nestjs/src/
git -C /Users/joel/Documents/create-shipfast commit -m "remove auth and user modules from nestjs template"
```

---

## Task 7: Add NestJS .env.example

**Files:**
- Create: `templates/backend/nestjs/.env.example.hbs`

- [ ] **Step 1: Write failing test**

Add to `test/generator.test.js`:

```js
describe('nestjs template — .env.example', () => {
  test('generates .env.example with PORT and FRONTEND_URL', async () => {
    const dest = await makeTmpDir();
    await generate(
      { frontend: 'none', backend: 'nestjs' },
      { projectName: 'test-app', hasFrontend: false, hasBackend: true,
        isNextjs: false, isNestjs: true, isPostgres: false, isMongo: false,
        isKratos: false, isJwt: false, hasAuth: false, hasDatabase: false,
        hasVolumes: false, backendHasDeps: false, awsRegion: 'eu-west-2',
        postgresImage: '', mongoImage: '', kratosImage: '', mailpitImage: '' },
      dest,
    );
    const content = await readFile(join(dest, 'backend', '.env.example'), 'utf-8');
    expect(content).toContain('PORT=3001');
    expect(content).toContain('FRONTEND_URL=');
  });

  test('generates DATABASE_URL when postgres selected', async () => {
    const dest = await makeTmpDir();
    await generate(
      { frontend: 'none', backend: 'nestjs' },
      { projectName: 'test-app', hasFrontend: false, hasBackend: true,
        isNextjs: false, isNestjs: true, isPostgres: true, isMongo: false,
        isKratos: false, isJwt: false, hasAuth: false, hasDatabase: true,
        hasVolumes: true, backendHasDeps: true, awsRegion: 'eu-west-2',
        postgresImage: 'postgres:16', mongoImage: '', kratosImage: '', mailpitImage: '' },
      dest,
    );
    const content = await readFile(join(dest, 'backend', '.env.example'), 'utf-8');
    expect(content).toContain('DATABASE_URL=');
    expect(content).toContain('test-app');
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
cd /Users/joel/Documents/create-shipfast && npm test -- --testNamePattern="nestjs template — .env.example"
```

Expected: FAIL.

- [ ] **Step 3: Create `templates/backend/nestjs/.env.example.hbs`**

```handlebars
# Port the backend API listens on
PORT=3001

# Frontend origin allowed for CORS
FRONTEND_URL=http://localhost:3000
{{#if isPostgres}}
# PostgreSQL connection string
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/{{projectName}}
{{/if}}
{{#if isMongo}}
# MongoDB connection URI
MONGODB_URI=mongodb://localhost:27017/{{projectName}}
{{/if}}
{{#if isJwt}}
# Secret used to sign JWT tokens — use a long random string in production
JWT_SECRET=change-me-in-production
{{/if}}
{{#if isKratos}}
# Ory Kratos admin API (internal — not exposed to the browser)
KRATOS_ADMIN_URL=http://localhost:4434

# Ory Kratos public API
KRATOS_PUBLIC_URL=http://localhost:4433
{{/if}}
```

- [ ] **Step 4: Run tests — should pass**

```bash
cd /Users/joel/Documents/create-shipfast && npm test -- --testNamePattern="nestjs template — .env.example"
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git -C /Users/joel/Documents/create-shipfast add templates/backend/nestjs/.env.example.hbs test/generator.test.js
git -C /Users/joel/Documents/create-shipfast commit -m "add nestjs .env.example template with stack-conditional vars"
```

---

## Task 8: Add Next.js health API route and .env.example

**Files:**
- Create: `templates/frontend/nextjs/src/app/api/health/route.ts.hbs`
- Create: `templates/frontend/nextjs/.env.example.hbs`

- [ ] **Step 1: Write failing tests**

Add to `test/generator.test.js`:

```js
describe('nextjs template — health route and env', () => {
  test('generates GET /api/health route returning ok', async () => {
    const dest = await makeTmpDir();
    await generate(
      { frontend: 'nextjs', backend: 'none' },
      { projectName: 'test-app', hasFrontend: true, hasBackend: false,
        isNextjs: true, isNestjs: false, isPostgres: false, isMongo: false,
        isKratos: false, isJwt: false, hasAuth: false, hasDatabase: false,
        hasVolumes: false, backendHasDeps: false, awsRegion: 'eu-west-2',
        postgresImage: '', mongoImage: '', kratosImage: '', mailpitImage: '' },
      dest,
    );
    const content = await readFile(
      join(dest, 'frontend', 'src', 'app', 'api', 'health', 'route.ts'),
      'utf-8'
    );
    expect(content).toContain('export function GET');
    expect(content).toContain("status: 'ok'");
  });

  test('generates frontend .env.example with NEXT_PUBLIC_API_URL', async () => {
    const dest = await makeTmpDir();
    await generate(
      { frontend: 'nextjs', backend: 'none' },
      { projectName: 'test-app', hasFrontend: true, hasBackend: false,
        isNextjs: true, isNestjs: false, isPostgres: false, isMongo: false,
        isKratos: false, isJwt: false, hasAuth: false, hasDatabase: false,
        hasVolumes: false, backendHasDeps: false, awsRegion: 'eu-west-2',
        postgresImage: '', mongoImage: '', kratosImage: '', mailpitImage: '' },
      dest,
    );
    const content = await readFile(join(dest, 'frontend', '.env.example'), 'utf-8');
    expect(content).toContain('NEXT_PUBLIC_API_URL=');
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
cd /Users/joel/Documents/create-shipfast && npm test -- --testNamePattern="nextjs template — health route"
```

Expected: FAIL.

- [ ] **Step 3: Create `templates/frontend/nextjs/src/app/api/health/route.ts.hbs`**

```handlebars
import { NextResponse } from 'next/server';

export function GET() {
  return NextResponse.json({ status: 'ok' });
}
```

- [ ] **Step 4: Create `templates/frontend/nextjs/.env.example.hbs`**

```handlebars
# Backend API base URL
NEXT_PUBLIC_API_URL=http://localhost:3001
{{#if isKratos}}
# Ory Kratos public API URL (browser-accessible)
NEXT_PUBLIC_KRATOS_URL=http://localhost:4433
{{/if}}
```

- [ ] **Step 5: Run tests — should pass**

```bash
cd /Users/joel/Documents/create-shipfast && npm test -- --testNamePattern="nextjs template — health route"
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git -C /Users/joel/Documents/create-shipfast add templates/frontend/nextjs/src/app/api/ templates/frontend/nextjs/.env.example.hbs test/generator.test.js
git -C /Users/joel/Documents/create-shipfast commit -m "add nextjs health route and .env.example template"
```

---

## Task 9: Delete pruned Next.js files

**Files to delete:**
- `templates/frontend/nextjs/src/app/(auth)/login/page.tsx.hbs`
- `templates/frontend/nextjs/src/app/(auth)/register/page.tsx.hbs`
- `templates/frontend/nextjs/src/app/dashboard/page.tsx.hbs`
- `templates/frontend/nextjs/src/lib/auth.ts.hbs`

- [ ] **Step 1: Write failing test**

Add to `test/generator.test.js`:

```js
describe('nextjs template — pruned files absent', () => {
  test('generate() does not produce auth pages or dashboard', async () => {
    const dest = await makeTmpDir();
    await generate(
      { frontend: 'nextjs', backend: 'none' },
      { projectName: 'test-app', hasFrontend: true, hasBackend: false,
        isNextjs: true, isNestjs: false, isPostgres: false, isMongo: false,
        isKratos: false, isJwt: false, hasAuth: false, hasDatabase: false,
        hasVolumes: false, backendHasDeps: false, awsRegion: 'eu-west-2',
        postgresImage: '', mongoImage: '', kratosImage: '', mailpitImage: '' },
      dest,
    );
    let authExists = true;
    try { await readdir(join(dest, 'frontend', 'src', 'app', '(auth)')); } catch { authExists = false; }
    let dashExists = true;
    try { await readdir(join(dest, 'frontend', 'src', 'app', 'dashboard')); } catch { dashExists = false; }
    let libExists = true;
    try { await readdir(join(dest, 'frontend', 'src', 'lib')); } catch { libExists = false; }
    expect(authExists).toBe(false);
    expect(dashExists).toBe(false);
    expect(libExists).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
cd /Users/joel/Documents/create-shipfast && npm test -- --testNamePattern="nextjs template — pruned"
```

Expected: FAIL.

- [ ] **Step 3: Delete the pruned files**

```bash
rm -rf "/Users/joel/Documents/create-shipfast/templates/frontend/nextjs/src/app/(auth)"
rm -rf /Users/joel/Documents/create-shipfast/templates/frontend/nextjs/src/app/dashboard
rm -rf /Users/joel/Documents/create-shipfast/templates/frontend/nextjs/src/lib
```

- [ ] **Step 4: Run test — should pass**

```bash
cd /Users/joel/Documents/create-shipfast && npm test -- --testNamePattern="nextjs template — pruned"
```

Expected: PASS.

- [ ] **Step 5: Run full test suite**

```bash
cd /Users/joel/Documents/create-shipfast && npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git -C /Users/joel/Documents/create-shipfast add -A templates/frontend/nextjs/src/ test/generator.test.js
git -C /Users/joel/Documents/create-shipfast commit -m "remove auth pages, dashboard, and lib from nextjs template"
```

---

## Task 10: Add Next.js jest config and smoke test

**Files:**
- Modify: `templates/frontend/nextjs/package.json.hbs`
- Create: `templates/frontend/nextjs/__tests__/smoke.test.ts`

- [ ] **Step 1: Write failing test**

Add to `test/generator.test.js`:

```js
describe('nextjs template — test setup', () => {
  test('generated package.json includes test script', async () => {
    const dest = await makeTmpDir();
    await generate(
      { frontend: 'nextjs', backend: 'none' },
      { projectName: 'test-app', hasFrontend: true, hasBackend: false,
        isNextjs: true, isNestjs: false, isPostgres: false, isMongo: false,
        isKratos: false, isJwt: false, hasAuth: false, hasDatabase: false,
        hasVolumes: false, backendHasDeps: false, awsRegion: 'eu-west-2',
        postgresImage: '', mongoImage: '', kratosImage: '', mailpitImage: '' },
      dest,
    );
    const pkg = JSON.parse(await readFile(join(dest, 'frontend', 'package.json'), 'utf-8'));
    expect(pkg.scripts.test).toBeDefined();
    expect(pkg.devDependencies.jest).toBeDefined();
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
cd /Users/joel/Documents/create-shipfast && npm test -- --testNamePattern="nextjs template — test setup"
```

Expected: FAIL.

- [ ] **Step 3: Replace `templates/frontend/nextjs/package.json.hbs`**

```handlebars
{
  "name": "{{projectName}}-frontend",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "jest"
  },
  "dependencies": {
    "next": "latest",
    "react": "latest",
    "react-dom": "latest"
  },
  "devDependencies": {
    "@types/node": "latest",
    "@types/react": "latest",
    "@types/jest": "latest",
    "jest": "latest",
    "ts-jest": "latest",
    "typescript": "latest"
  },
  "jest": {
    "preset": "ts-jest",
    "testEnvironment": "node",
    "testPathIgnorePatterns": ["/node_modules/", "/.next/"]
  }
}
```

- [ ] **Step 4: Create `templates/frontend/nextjs/__tests__/smoke.test.ts`**

Note: this is a static `.ts` file (no `.hbs` — no interpolation needed):

```typescript
describe('frontend', () => {
  it('passes', () => {
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 5: Run tests — should pass**

```bash
cd /Users/joel/Documents/create-shipfast && npm test -- --testNamePattern="nextjs template — test setup"
```

Expected: PASS.

- [ ] **Step 6: Run full test suite**

```bash
cd /Users/joel/Documents/create-shipfast && npm test
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git -C /Users/joel/Documents/create-shipfast add templates/frontend/nextjs/package.json.hbs "templates/frontend/nextjs/__tests__/" test/generator.test.js
git -C /Users/joel/Documents/create-shipfast commit -m "add jest config and smoke test to nextjs template"
```

---

## Verification

- [ ] **Run full test suite one final time**

```bash
cd /Users/joel/Documents/create-shipfast && npm test
```

Expected: all tests pass.

- [ ] **Smoke test: generate a project and verify structure**

```bash
cd /tmp && node /Users/joel/Documents/create-shipfast/src/cli.js
# Choose: nextjs frontend, nestjs backend, postgresql, kratos auth, eu-west-2
# Then verify:
ls <project-name>/           # should contain CLAUDE.md, AGENTS.md, .env files absent (only .env.example)
cat <project-name>/CLAUDE.md # should contain project name, Architecture/Conventions/Tooling sections
ls <project-name>/frontend/src/app/api/health/  # route.ts
ls <project-name>/backend/src/health/           # health.controller.ts, health.module.ts
# auth and user dirs should NOT exist:
ls <project-name>/backend/src/  # should show: health/, prisma/, app.module.ts, app.spec.ts, main.ts
ls <project-name>/frontend/src/app/  # should show: api/, layout.tsx, page.tsx, icon.svg
```
