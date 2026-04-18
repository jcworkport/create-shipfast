# Docker Image Versioning & Mailpit Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fetch latest stable Docker image tags from Docker Hub at CLI startup, display them inline in prompts, and replace the AMD64-only mailslurper with multi-arch mailpit.

**Architecture:** A new `src/image-versions.js` module fetches four Docker Hub APIs in parallel with a 5-second timeout and `Promise.allSettled`, returning resolved tags or falling back to hardcoded defaults. Resolved tags flow into `buildContext()` as Handlebars variables (`postgresImage`, `mongoImage`, `kratosImage`, `mailpitImage`) replacing all hardcoded image strings in both compose templates.

**Tech Stack:** Node 18+ native `fetch`, `AbortController`, `@clack/prompts` spinner/note, Handlebars templates, Jest with `--experimental-vm-modules`.

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src/image-versions.js` | Docker Hub fetching, tag resolution, fallback defaults |
| Create | `test/image-versions.test.js` | Unit tests for image-versions module |
| Modify | `src/prompts.js` | Accept `versions` param, inject into database/auth labels; add image fields to `buildContext` |
| Modify | `test/prompts.test.js` | Pass mock versions to `buildContext`, assert image fields |
| Modify | `src/cli.js` | Spinner before prompts, call `fetchImageVersions`, show fallback note, thread versions through |
| Modify | `templates/shared/docker-compose.dev.yml.hbs` | Replace hardcoded images with `{{vars}}`, mailslurper → mailpit |
| Modify | `templates/shared/docker-compose.prod.yml.hbs` | Same as dev compose |
| Modify | `templates/shared/infra/kratos/kratos.yml.hbs` | `mailslurper:1025` → `mailpit:1025` |
| Modify | `test/generator.test.js` | Add test: compose renders image vars from context |

---

## Task 1: Create `src/image-versions.js` — write failing tests first

**Files:**
- Create: `test/image-versions.test.js`
- Create: `src/image-versions.js`

- [ ] **Step 1: Write the failing tests**

Create `test/image-versions.test.js`:

```js
import { jest } from '@jest/globals';
import { fetchImageVersions, isStableTag } from '../src/image-versions.js';

function mockHub(tags) {
  return Promise.resolve({ ok: true, json: async () => ({ results: tags }) });
}

describe('isStableTag', () => {
  test('returns true for clean semver tag names', () => {
    expect(isStableTag('16.4-alpine')).toBe(true);
    expect(isStableTag('7.0.14')).toBe(true);
    expect(isStableTag('v1.3.1')).toBe(true);
  });

  test('returns false for pre-release tag names', () => {
    expect(isStableTag('v1.3.1-alpha.1')).toBe(false);
    expect(isStableTag('v2.0.0-beta')).toBe(false);
    expect(isStableTag('v1.3.0-rc1')).toBe(false);
    expect(isStableTag('16.4-alpine-dev')).toBe(false);
    expect(isStableTag('v1.0.0-preview')).toBe(false);
    expect(isStableTag('v1.0.0-snapshot')).toBe(false);
  });
});

describe('fetchImageVersions', () => {
  let fetchSpy;

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  test('resolves latest stable tag for all four images', async () => {
    fetchSpy.mockImplementation((url) => {
      if (url.includes('library/postgres')) {
        return mockHub([
          { name: '16.4-alpine', last_updated: '2026-04-18T10:00:00Z' },
          { name: '16.3-alpine', last_updated: '2026-03-01T00:00:00Z' },
        ]);
      }
      if (url.includes('library/mongo')) {
        return mockHub([
          { name: '7.0.14', last_updated: '2026-04-10T00:00:00Z' },
        ]);
      }
      if (url.includes('oryd/kratos')) {
        return mockHub([
          { name: 'v1.3.1', last_updated: '2026-03-22T00:00:00Z' },
        ]);
      }
      if (url.includes('axllent/mailpit')) {
        return mockHub([
          { name: 'v1.22.0', last_updated: '2026-04-01T00:00:00Z' },
        ]);
      }
    });

    const { versions, failed } = await fetchImageVersions();

    expect(failed).toEqual([]);
    expect(versions.postgres).toEqual({ tag: 'postgres:16.4-alpine', date: '2026-04-18', fallback: false });
    expect(versions.mongo).toEqual({ tag: 'mongo:7.0.14', date: '2026-04-10', fallback: false });
    expect(versions.kratos).toEqual({ tag: 'oryd/kratos:v1.3.1', date: '2026-03-22', fallback: false });
    expect(versions.mailpit).toEqual({ tag: 'axllent/mailpit:v1.22.0', date: '2026-04-01', fallback: false });
  });

  test('skips pre-release tags and picks next stable one', async () => {
    fetchSpy.mockImplementation((url) => {
      if (url.includes('axllent/mailpit')) {
        return mockHub([
          { name: 'v2.0.0-beta', last_updated: '2026-04-19T00:00:00Z' },
          { name: 'v1.22.0', last_updated: '2026-04-01T00:00:00Z' },
        ]);
      }
      if (url.includes('library/postgres')) return mockHub([{ name: '16.4-alpine', last_updated: '2026-04-18T00:00:00Z' }]);
      if (url.includes('library/mongo')) return mockHub([{ name: '7.0.14', last_updated: '2026-04-10T00:00:00Z' }]);
      if (url.includes('oryd/kratos')) return mockHub([{ name: 'v1.3.1', last_updated: '2026-03-22T00:00:00Z' }]);
    });

    const { versions, failed } = await fetchImageVersions();
    expect(failed).toEqual([]);
    expect(versions.mailpit.tag).toBe('axllent/mailpit:v1.22.0');
    expect(versions.mailpit.fallback).toBe(false);
  });

  test('falls back to defaults when fetch throws', async () => {
    fetchSpy.mockImplementation((url) => {
      if (url.includes('oryd/kratos')) return Promise.reject(new Error('network error'));
      if (url.includes('library/postgres')) return mockHub([{ name: '16.4-alpine', last_updated: '2026-04-18T00:00:00Z' }]);
      if (url.includes('library/mongo')) return mockHub([{ name: '7.0.14', last_updated: '2026-04-10T00:00:00Z' }]);
      if (url.includes('axllent/mailpit')) return mockHub([{ name: 'v1.22.0', last_updated: '2026-04-01T00:00:00Z' }]);
    });

    const { versions, failed } = await fetchImageVersions();

    expect(failed).toEqual(['kratos']);
    expect(versions.kratos.fallback).toBe(true);
    expect(versions.kratos.tag).toBe('oryd/kratos:v1.2');
    expect(versions.postgres.fallback).toBe(false);
  });

  test('falls back to defaults when HTTP response is not ok', async () => {
    fetchSpy.mockImplementation((url) => {
      if (url.includes('library/mongo')) {
        return Promise.resolve({ ok: false, status: 503, json: async () => ({}) });
      }
      return mockHub([{ name: '16.4-alpine', last_updated: '2026-04-18T00:00:00Z' }]);
    });

    const { versions, failed } = await fetchImageVersions();

    expect(failed).toContain('mongo');
    expect(versions.mongo.fallback).toBe(true);
    expect(versions.mongo.tag).toBe('mongo:7');
  });

  test('falls back when no stable tag matches regex', async () => {
    fetchSpy.mockImplementation((url) => {
      if (url.includes('library/postgres')) {
        return mockHub([
          { name: 'latest', last_updated: '2026-04-18T00:00:00Z' },
          { name: '16-alpine', last_updated: '2026-04-17T00:00:00Z' },
        ]);
      }
      if (url.includes('library/mongo')) return mockHub([{ name: '7.0.14', last_updated: '2026-04-10T00:00:00Z' }]);
      if (url.includes('oryd/kratos')) return mockHub([{ name: 'v1.3.1', last_updated: '2026-03-22T00:00:00Z' }]);
      if (url.includes('axllent/mailpit')) return mockHub([{ name: 'v1.22.0', last_updated: '2026-04-01T00:00:00Z' }]);
    });

    const { versions, failed } = await fetchImageVersions();

    expect(failed).toEqual(['postgres']);
    expect(versions.postgres.fallback).toBe(true);
    expect(versions.mongo.fallback).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
node --experimental-vm-modules node_modules/.bin/jest test/image-versions.test.js
```

Expected: `Cannot find module '../src/image-versions.js'`

- [ ] **Step 3: Implement `src/image-versions.js`**

Create `src/image-versions.js`:

```js
const PRERELEASE = /alpha|beta|rc|dev|preview|snapshot/i;

const CONFIGS = [
  { key: 'postgres', repo: 'library/postgres',  regex: /^\d+\.\d+-alpine$/, prefix: 'postgres' },
  { key: 'mongo',    repo: 'library/mongo',      regex: /^\d+\.\d+\.\d+$/,  prefix: 'mongo' },
  { key: 'kratos',   repo: 'oryd/kratos',        regex: /^v\d+\.\d+\.\d+$/, prefix: 'oryd/kratos' },
  { key: 'mailpit',  repo: 'axllent/mailpit',    regex: /^v\d+\.\d+\.\d+$/, prefix: 'axllent/mailpit' },
];

const DEFAULTS = {
  postgres: { tag: 'postgres:16-alpine',      date: 'unknown', fallback: true },
  mongo:    { tag: 'mongo:7',                 date: 'unknown', fallback: true },
  kratos:   { tag: 'oryd/kratos:v1.2',        date: 'unknown', fallback: true },
  mailpit:  { tag: 'axllent/mailpit:latest',  date: 'unknown', fallback: true },
};

export function isStableTag(name) {
  return !PRERELEASE.test(name);
}

async function fetchLatestTag(config) {
  const url = `https://hub.docker.com/v2/repositories/${config.repo}/tags?page_size=100&ordering=last_updated`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const tag = data.results.find(t => config.regex.test(t.name) && isStableTag(t.name));
    if (!tag) throw new Error('no stable tag found');
    const date = tag.last_updated ? tag.last_updated.slice(0, 10) : 'unknown';
    return { tag: `${config.prefix}:${tag.name}`, date, fallback: false };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchImageVersions() {
  const results = await Promise.allSettled(CONFIGS.map(fetchLatestTag));
  const versions = {};
  const failed = [];

  for (let i = 0; i < CONFIGS.length; i++) {
    const { key } = CONFIGS[i];
    const result = results[i];
    if (result.status === 'fulfilled') {
      versions[key] = result.value;
    } else {
      versions[key] = DEFAULTS[key];
      failed.push(key);
    }
  }

  return { versions, failed };
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
node --experimental-vm-modules node_modules/.bin/jest test/image-versions.test.js
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/image-versions.js test/image-versions.test.js
git commit -m "add image-versions module with docker hub fetching and fallback"
```

---

## Task 2: Update `src/prompts.js` to accept versions — tests first

**Files:**
- Modify: `test/prompts.test.js`
- Modify: `src/prompts.js`

- [ ] **Step 1: Add failing tests for new `buildContext` signature**

Open `test/prompts.test.js`. Add a `mockVersions` constant and update the existing `buildContext` calls to pass it as a second argument. Add new assertions for image fields. The full updated file:

```js
import { buildContext } from '../src/prompts.js';

const mockVersions = {
  postgres: { tag: 'postgres:16.4-alpine', date: '2026-04-18', fallback: false },
  mongo:    { tag: 'mongo:7.0.14',         date: '2026-04-10', fallback: false },
  kratos:   { tag: 'oryd/kratos:v1.3.1',   date: '2026-03-22', fallback: false },
  mailpit:  { tag: 'axllent/mailpit:v1.22.0', date: '2026-04-01', fallback: false },
};

describe('buildContext', () => {
  const base = {
    projectName: 'acme-app',
    frontend: 'nextjs',
    backend: 'nestjs',
    database: 'postgresql',
    auth: 'kratos',
    awsRegion: 'eu-west-2',
  };

  test('sets boolean flags correctly for nextjs + nestjs + postgresql + kratos', () => {
    const ctx = buildContext(base, mockVersions);
    expect(ctx.isNextjs).toBe(true);
    expect(ctx.isReactSpa).toBe(false);
    expect(ctx.isNestjs).toBe(true);
    expect(ctx.isPostgres).toBe(true);
    expect(ctx.isMongo).toBe(false);
    expect(ctx.isKratos).toBe(true);
    expect(ctx.isJwt).toBe(false);
    expect(ctx.hasAuth).toBe(true);
    expect(ctx.hasDatabase).toBe(true);
    expect(ctx.hasFrontend).toBe(true);
    expect(ctx.hasBackend).toBe(true);
  });

  test('sets hasAuth false when auth is none', () => {
    const ctx = buildContext({ ...base, auth: 'none' }, mockVersions);
    expect(ctx.hasAuth).toBe(false);
    expect(ctx.isKratos).toBe(false);
    expect(ctx.isJwt).toBe(false);
  });

  test('sets hasFrontend false when frontend is none', () => {
    const ctx = buildContext({ ...base, frontend: 'none' }, mockVersions);
    expect(ctx.hasFrontend).toBe(false);
  });

  test('passes raw answer values through unchanged', () => {
    const ctx = buildContext(base, mockVersions);
    expect(ctx.projectName).toBe('acme-app');
    expect(ctx.awsRegion).toBe('eu-west-2');
  });

  test('sets backendHasDeps true when database is postgresql', () => {
    const ctx = buildContext({ ...base, auth: 'none' }, mockVersions);
    expect(ctx.backendHasDeps).toBe(true);
    expect(ctx.hasVolumes).toBe(true);
  });

  test('sets backendHasDeps false when database is none and auth is none', () => {
    const ctx = buildContext({ ...base, database: 'none', auth: 'none' }, mockVersions);
    expect(ctx.backendHasDeps).toBe(false);
    expect(ctx.hasVolumes).toBe(false);
  });

  test('includes resolved image tags from versions', () => {
    const ctx = buildContext(base, mockVersions);
    expect(ctx.postgresImage).toBe('postgres:16.4-alpine');
    expect(ctx.mongoImage).toBe('mongo:7.0.14');
    expect(ctx.kratosImage).toBe('oryd/kratos:v1.3.1');
    expect(ctx.mailpitImage).toBe('axllent/mailpit:v1.22.0');
  });
});
```

- [ ] **Step 2: Run tests to confirm the image fields assertion fails**

```bash
node --experimental-vm-modules node_modules/.bin/jest test/prompts.test.js
```

Expected: `includes resolved image tags from versions` FAIL — `ctx.postgresImage` is `undefined`.

- [ ] **Step 3: Update `src/prompts.js`**

Replace the full file with:

```js
import * as p from '@clack/prompts';

function cancelOnExit(value) {
  if (p.isCancel(value)) {
    p.cancel('Operation cancelled.');
    process.exit(0);
  }
  return value;
}

export async function collectAnswers(versions) {
  const projectName = cancelOnExit(await p.text({
    message: 'Project name:',
    validate: (v) => /^[a-z0-9-]+$/.test(v)
      ? undefined
      : 'Use lowercase letters, numbers, and hyphens only',
  }));

  const frontend = cancelOnExit(await p.select({
    message: 'Frontend:',
    options: [
      { value: 'nextjs', label: 'Next.js 15 (App Router)' },
      { value: 'none',   label: 'None (API only)' },
    ],
  }));

  const backend = cancelOnExit(await p.select({
    message: 'Backend:',
    options: [
      { value: 'nestjs', label: 'NestJS' },
      { value: 'none',   label: 'None (Next.js API routes only)' },
    ],
  }));

  const database = cancelOnExit(await p.select({
    message: 'Database:',
    options: [
      { value: 'postgresql', label: `PostgreSQL  (${versions.postgres.tag} · ${versions.postgres.date})` },
      { value: 'mongodb',    label: `MongoDB     (${versions.mongo.tag} · ${versions.mongo.date})` },
      { value: 'none',       label: 'None' },
    ],
  }));

  const auth = cancelOnExit(await p.select({
    message: 'Authentication:',
    options: [
      { value: 'kratos', label: `Ory Kratos  (${versions.kratos.tag} · ${versions.kratos.date})` },
      { value: 'jwt',    label: 'Custom JWT scaffold' },
      { value: 'none',   label: 'None' },
    ],
  }));

  const awsRegion = cancelOnExit(await p.text({
    message: 'AWS region:',
    initialValue: 'eu-west-2',
  }));

  return { projectName, frontend, backend, database, auth, awsRegion };
}

export function buildContext(answers, versions) {
  return {
    projectName: answers.projectName,
    frontend: answers.frontend,
    backend: answers.backend,
    database: answers.database,
    auth: answers.auth,
    awsRegion: answers.awsRegion,
    isNextjs:   answers.frontend === 'nextjs',
    isReactSpa: answers.frontend === 'react-spa',
    isRemix:    answers.frontend === 'remix',
    isNestjs:   answers.backend === 'nestjs',
    isExpress:  answers.backend === 'express',
    isFastify:  answers.backend === 'fastify',
    isPostgres: answers.database === 'postgresql',
    isMongo:    answers.database === 'mongodb',
    isKratos:   answers.auth === 'kratos',
    isJwt:      answers.auth === 'jwt',
    hasAuth:     answers.auth !== 'none',
    hasDatabase: answers.database !== 'none',
    hasFrontend: answers.frontend !== 'none',
    hasBackend:  answers.backend !== 'none',
    backendHasDeps: answers.database !== 'none' || answers.auth === 'kratos',
    hasVolumes:     answers.database !== 'none' || answers.auth === 'kratos',
    postgresImage: versions.postgres.tag,
    mongoImage:    versions.mongo.tag,
    kratosImage:   versions.kratos.tag,
    mailpitImage:  versions.mailpit.tag,
  };
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
node --experimental-vm-modules node_modules/.bin/jest test/prompts.test.js
```

Expected: All 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/prompts.js test/prompts.test.js
git commit -m "thread versions through collectAnswers and buildContext, inject image labels"
```

---

## Task 3: Update `src/cli.js` to fetch versions before prompts

**Files:**
- Modify: `src/cli.js`

- [ ] **Step 1: Replace `src/cli.js`**

```js
#!/usr/bin/env node
import * as p from '@clack/prompts';
import { mkdir } from 'fs/promises';
import { join } from 'path';
import { collectAnswers, buildContext } from './prompts.js';
import { generate } from './generator.js';
import { fetchImageVersions } from './image-versions.js';

const BANNER = `
   _____ __    _                        __
  / ___// /_  (_)___  ____  ____ ______/ /_
  \\__ \\/ __ \\/ / __ \\/ __ \\/ __ \`/ ___/ __/
 ___/ / / / / / /_/ / /_/ / /_/ (__  ) /_
/____/_/ /_/_/ .___/\\____/\\__,_/____/\\__/
            /_/
`;

console.log(BANNER);
p.intro('scaffold a production-ready app');

const s = p.spinner();
s.start('Checking latest image versions...');
const { versions, failed } = await fetchImageVersions();
s.stop('Image versions resolved.');

if (failed.length > 0) {
  p.note(
    `Could not fetch latest versions for: ${failed.join(', ')}\nFalling back to known-good defaults. Verify manually before deploying.`,
    'Warning',
  );
}

const answers = await collectAnswers(versions);
const context = buildContext(answers, versions);
const outputDir = join(process.cwd(), answers.projectName);

await mkdir(outputDir, { recursive: true });

const gen = p.spinner();
gen.start(`Scaffolding ${answers.projectName}`);
await generate(answers, context, outputDir);
gen.stop(`Scaffolded ${answers.projectName}`);

const secrets = [
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_REGION',
  'ECR_REGISTRY',
];
if (answers.database === 'postgresql') secrets.push('DATABASE_URL');
if (answers.database === 'mongodb') secrets.push('MONGODB_URI');
if (answers.auth === 'kratos') secrets.push('KRATOS_URL');

p.note(
  [
    `cd ${answers.projectName}`,
    `npm run dev:build   # first run`,
    `npm run dev         # subsequent runs`,
    ``,
    `Deploy:  npm run deploy`,
    ``,
    `GitHub secrets to add:`,
    ...secrets.map((secret) => `  ${secret}`),
  ].join('\n'),
  'Next steps',
);

p.outro('Happy shipping!');
```

- [ ] **Step 2: Smoke-test manually**

```bash
node src/cli.js
```

Expected: spinner appears briefly, then prompts show with image version labels for Database and Authentication options. Cancel with Ctrl+C after confirming labels appear.

- [ ] **Step 3: Commit**

```bash
git add src/cli.js
git commit -m "add image version prefetch spinner and fallback warning to cli"
```

---

## Task 4: Add generator test for compose image variable rendering

**Files:**
- Modify: `test/generator.test.js`

- [ ] **Step 1: Add the failing test**

In `test/generator.test.js`, add this test inside the existing `describe('processTemplateDir', ...)` block, after the last test:

```js
  test('dev compose renders resolved image tags from context variables', async () => {
    const src = await makeTmpDir();
    const dest = await makeTmpDir();
    const raw = await readFile(
      new URL('../templates/shared/docker-compose.dev.yml.hbs', import.meta.url),
      'utf-8'
    );
    await writeFile(join(src, 'docker-compose.dev.yml.hbs'), raw);

    await processTemplateDir(src, dest, {
      hasFrontend: false,
      hasBackend: true,
      isPostgres: true,
      isMongo: false,
      isKratos: true,
      backendHasDeps: true,
      hasVolumes: true,
      projectName: 'test-app',
      postgresImage: 'postgres:16.4-alpine',
      mongoImage: 'mongo:7.0.14',
      kratosImage: 'oryd/kratos:v1.3.1',
      mailpitImage: 'axllent/mailpit:v1.22.0',
    });

    const result = await readFile(join(dest, 'docker-compose.dev.yml'), 'utf-8');
    expect(result).toContain('image: postgres:16.4-alpine');
    expect(result).toContain('image: oryd/kratos:v1.3.1');
    expect(result).toContain('image: axllent/mailpit:v1.22.0');
    expect(result).not.toContain('oryd/mailslurper');
    expect(result).not.toContain('postgres:16-alpine');
    expect(result).toContain('8025:8025');
    expect(result).toContain('1025:1025');
  });
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
node --experimental-vm-modules node_modules/.bin/jest test/generator.test.js --testNamePattern="dev compose renders resolved"
```

Expected: FAIL — template still has hardcoded `postgres:16-alpine`, `oryd/mailslurper:latest-smtps`, ports `4436`/`4437`.

- [ ] **Step 3: Update `templates/shared/docker-compose.dev.yml.hbs`**

Replace the full file with:

```yaml
services:
  {{#if hasFrontend}}
  frontend:
    build:
      context: ./frontend
      target: dev
    ports:
      - "3000:3000"
    volumes:
      - ./frontend:/app
      - /app/node_modules
    command: npm run dev
    env_file: .env
    environment:
      - NODE_ENV=development
    {{#if hasBackend}}
    depends_on:
      - backend
    {{/if}}
  {{/if}}

  {{#if hasBackend}}
  backend:
    build:
      context: ./backend
      target: dev
    ports:
      - "3001:3001"
    volumes:
      - ./backend:/app
      - /app/node_modules
    command: npm run start:dev
    env_file: .env
    environment:
      - NODE_ENV=development
      {{#if isPostgres}}- DATABASE_URL=postgresql://postgres:postgres@postgres-app:5432/{{projectName}}{{/if}}
      {{#if isMongo}}- MONGODB_URI=mongodb://mongo:27017/{{projectName}}{{/if}}
      {{#if isKratos}}- KRATOS_URL=http://kratos:4433{{/if}}
    {{#if backendHasDeps}}
    depends_on:
      {{#if isPostgres}}- postgres-app{{/if}}
      {{#if isMongo}}- mongo{{/if}}
      {{#if isKratos}}- kratos{{/if}}
    {{/if}}
  {{/if}}

  {{#if isPostgres}}
  postgres-app:
    image: {{postgresImage}}
    environment:
      POSTGRES_DB: {{projectName}}
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres-app-data:/var/lib/postgresql/data
  {{/if}}

  {{#if isMongo}}
  mongo:
    image: {{mongoImage}}
    ports:
      - "27017:27017"
    volumes:
      - mongo-data:/data/db
  {{/if}}

  {{#if isKratos}}
  kratos:
    image: {{kratosImage}}
    ports:
      - "4433:4433"
      - "4434:4434"
    environment:
      DSN: postgres://postgres:postgres@postgres-kratos:5432/kratos?sslmode=disable
      SERVE_PUBLIC_BASE_URL: http://localhost:4433
    volumes:
      - ./infra/kratos:/etc/config/kratos
    command: serve -c /etc/config/kratos/kratos.yml --dev --watch-courier
    depends_on:
      - postgres-kratos

  postgres-kratos:
    image: {{postgresImage}}
    environment:
      POSTGRES_DB: kratos
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - postgres-kratos-data:/var/lib/postgresql/data

  mailpit:
    image: {{mailpitImage}}
    ports:
      - "8025:8025"
      - "1025:1025"
  {{/if}}

{{#if hasVolumes}}
volumes:
  {{#if isPostgres}}postgres-app-data:{{/if}}
  {{#if isMongo}}mongo-data:{{/if}}
  {{#if isKratos}}postgres-kratos-data:{{/if}}
{{/if}}
```

- [ ] **Step 4: Update `templates/shared/docker-compose.prod.yml.hbs`**

Replace the full file with:

```yaml
services:
  {{#if hasFrontend}}
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    env_file: .env
    {{#if hasBackend}}
    depends_on:
      - backend
    {{/if}}
  {{/if}}

  {{#if hasBackend}}
  backend:
    build: ./backend
    ports:
      - "3001:3001"
    env_file: .env
    {{#if backendHasDeps}}
    depends_on:
      {{#if isPostgres}}- postgres-app{{/if}}
      {{#if isMongo}}- mongo{{/if}}
      {{#if isKratos}}- kratos{{/if}}
    {{/if}}
  {{/if}}

  {{#if isPostgres}}
  postgres-app:
    image: {{postgresImage}}
    environment:
      POSTGRES_DB: {{projectName}}
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres-app-data:/var/lib/postgresql/data
  {{/if}}

  {{#if isMongo}}
  mongo:
    image: {{mongoImage}}
    ports:
      - "27017:27017"
    volumes:
      - mongo-data:/data/db
  {{/if}}

  {{#if isKratos}}
  kratos:
    image: {{kratosImage}}
    ports:
      - "4433:4433"
      - "4434:4434"
    environment:
      DSN: postgres://postgres:postgres@postgres-kratos:5432/kratos?sslmode=disable
      SERVE_PUBLIC_BASE_URL: http://localhost:4433
    volumes:
      - ./infra/kratos:/etc/config/kratos
    command: serve -c /etc/config/kratos/kratos.yml --dev --watch-courier
    depends_on:
      - postgres-kratos

  postgres-kratos:
    image: {{postgresImage}}
    environment:
      POSTGRES_DB: kratos
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - postgres-kratos-data:/var/lib/postgresql/data

  mailpit:
    image: {{mailpitImage}}
    ports:
      - "8025:8025"
      - "1025:1025"
  {{/if}}

{{#if hasVolumes}}
volumes:
  {{#if isPostgres}}postgres-app-data:{{/if}}
  {{#if isMongo}}mongo-data:{{/if}}
  {{#if isKratos}}postgres-kratos-data:{{/if}}
{{/if}}
```

- [ ] **Step 5: Run the generator test to confirm it passes**

```bash
node --experimental-vm-modules node_modules/.bin/jest test/generator.test.js --testNamePattern="dev compose renders resolved"
```

Expected: PASS.

- [ ] **Step 6: Run all generator tests to confirm no regressions**

```bash
node --experimental-vm-modules node_modules/.bin/jest test/generator.test.js
```

Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
git add templates/shared/docker-compose.dev.yml.hbs templates/shared/docker-compose.prod.yml.hbs test/generator.test.js
git commit -m "replace hardcoded image tags with handlebars vars, swap mailslurper for mailpit"
```

---

## Task 5: Update kratos template — mailslurper → mailpit hostname

**Files:**
- Modify: `templates/shared/infra/kratos/kratos.yml.hbs`

- [ ] **Step 1: Update the SMTP connection URI**

In `templates/shared/infra/kratos/kratos.yml.hbs`, line 49, change:

```yaml
    connection_uri: smtps://test:test@mailslurper:1025/?skip_ssl_verify=true
```

to:

```yaml
    connection_uri: smtps://test:test@mailpit:1025/?skip_ssl_verify=true
```

- [ ] **Step 2: Verify the change**

```bash
grep -n "mailpit\|mailslurper" templates/shared/infra/kratos/kratos.yml.hbs
```

Expected output:
```
49:    connection_uri: smtps://test:test@mailpit:1025/?skip_ssl_verify=true
```

No `mailslurper` references remaining.

- [ ] **Step 3: Run full test suite to confirm nothing broken**

```bash
npm test
```

Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add templates/shared/infra/kratos/kratos.yml.hbs
git commit -m "update kratos smtp to point to mailpit instead of mailslurper"
```

---

## Task 6: Final verification

- [ ] **Step 1: Run the full test suite**

```bash
npm test
```

Expected: All tests in `image-versions.test.js`, `prompts.test.js`, and `generator.test.js` PASS.

- [ ] **Step 2: Confirm no remaining mailslurper references in templates**

```bash
grep -r "mailslurper" templates/
```

Expected: no output.

- [ ] **Step 3: Confirm no hardcoded image strings remain in compose templates**

```bash
grep -E "postgres:1|mongo:7|oryd/kratos:v" templates/shared/docker-compose.dev.yml.hbs templates/shared/docker-compose.prod.yml.hbs
```

Expected: no output.
