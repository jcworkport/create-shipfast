# Local Dev + Production Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add first-class local development support to `create-shipfast` so scaffolded apps can be run locally with hot reload via `npm run dev`, and deployed to AWS ECS via `npm run deploy`.

**Architecture:** Replace the single `docker-compose.yml` template with two separate templates (`docker-compose.dev.yml` and `docker-compose.prod.yml`). Add a root `package.json` template with `dev`, `dev:build`, `deploy:build`, and `deploy` scripts. Update both Dockerfiles to use multi-stage builds with a `dev` stage targeted by the dev compose. Update `generator.js` to print correct next steps.

**Tech Stack:** Node.js ESM, Handlebars templates, Docker Compose v2, NestJS (watch mode), Next.js (hot reload)

---

## File Map

| Action | File |
|--------|------|
| Rename | `templates/shared/docker-compose.yml.hbs` → `templates/shared/docker-compose.prod.yml.hbs` |
| Create | `templates/shared/docker-compose.dev.yml.hbs` |
| Create | `templates/shared/package.json.hbs` |
| Modify | `templates/backend/nestjs/Dockerfile.hbs` |
| Modify | `templates/frontend/nextjs/Dockerfile.hbs` |
| Modify | `src/generator.js` (printNextSteps only) |
| Modify | `test/generator.test.js` (add dev/prod compose tests) |

---

### Task 1: Rename docker-compose.yml.hbs to docker-compose.prod.yml.hbs

**Files:**
- Rename: `templates/shared/docker-compose.yml.hbs` → `templates/shared/docker-compose.prod.yml.hbs`

- [ ] **Step 1: Rename the file**

```bash
cd /path/to/create-shipfast
mv templates/shared/docker-compose.yml.hbs templates/shared/docker-compose.prod.yml.hbs
```

- [ ] **Step 2: Run existing tests to confirm nothing broke**

```bash
npm test
```

Expected: all tests pass (generator processes by directory scan, the rename is transparent)

- [ ] **Step 3: Commit**

```bash
git add templates/shared/
git commit -m "rename docker-compose template to docker-compose.prod.yml"
```

---

### Task 2: Create docker-compose.dev.yml.hbs template

**Files:**
- Create: `templates/shared/docker-compose.dev.yml.hbs`

- [ ] **Step 1: Write the failing test**

Add to `test/generator.test.js`:

```js
test('dev compose is generated with volume mounts', async () => {
  const src = await makeTmpDir();
  const dest = await makeTmpDir();
  const template = `services:
  {{#if hasFrontend}}
  frontend:
    volumes:
      - ./frontend:/app
      - /app/node_modules
    command: npm run dev
    environment:
      - NODE_ENV={{nodeEnv}}
  {{/if}}`;
  await writeFile(join(src, 'docker-compose.dev.yml.hbs'), template);

  await processTemplateDir(src, dest, { hasFrontend: true, nodeEnv: 'development' });

  const result = await readFile(join(dest, 'docker-compose.dev.yml'), 'utf-8');
  expect(result).toContain('./frontend:/app');
  expect(result).toContain('npm run dev');
  expect(result).toContain('NODE_ENV=development');
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --testNamePattern="dev compose"
```

Expected: FAIL — file not found

- [ ] **Step 3: Create the template**

Create `templates/shared/docker-compose.dev.yml.hbs`:

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
    depends_on:
      {{#if hasBackend}}- backend{{/if}}
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
    depends_on:
      {{#if isPostgres}}- postgres-app{{/if}}
      {{#if isMongo}}- mongo{{/if}}
      {{#if isKratos}}- kratos{{/if}}
  {{/if}}

  {{#if isPostgres}}
  postgres-app:
    image: postgres:16-alpine
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
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongo-data:/data/db
  {{/if}}

  {{#if isKratos}}
  kratos:
    image: oryd/kratos:v1.2
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
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: kratos
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - postgres-kratos-data:/var/lib/postgresql/data

  mailslurper:
    image: oryd/mailslurper:latest-smtps
    ports:
      - "4436:4436"
      - "4437:4437"
  {{/if}}

volumes:
  {{#if isPostgres}}postgres-app-data:{{/if}}
  {{#if isMongo}}mongo-data:{{/if}}
  {{#if isKratos}}postgres-kratos-data:{{/if}}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- --testNamePattern="dev compose"
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add templates/shared/docker-compose.dev.yml.hbs test/generator.test.js
git commit -m "add docker-compose.dev.yml template with hot reload volume mounts"
```

---

### Task 3: Create root package.json.hbs template

**Files:**
- Create: `templates/shared/package.json.hbs`

- [ ] **Step 1: Write the failing test**

Add to `test/generator.test.js`:

```js
test('root package.json is generated with dev and deploy scripts', async () => {
  const src = await makeTmpDir();
  const dest = await makeTmpDir();
  const template = `{
  "name": "{{projectName}}",
  "scripts": {
    "dev": "docker compose -f docker-compose.dev.yml up",
    "dev:build": "docker compose -f docker-compose.dev.yml up --build",
    "deploy:build": "docker compose -f docker-compose.prod.yml build",
    "deploy": "node deploy/build-tag-push.js"
  }
}`;
  await writeFile(join(src, 'package.json.hbs'), template);

  await processTemplateDir(src, dest, { projectName: 'my-app' });

  const result = await readFile(join(dest, 'package.json'), 'utf-8');
  const pkg = JSON.parse(result);
  expect(pkg.name).toBe('my-app');
  expect(pkg.scripts.dev).toBe('docker compose -f docker-compose.dev.yml up');
  expect(pkg.scripts.deploy).toBe('node deploy/build-tag-push.js');
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --testNamePattern="root package.json"
```

Expected: FAIL — file not found

- [ ] **Step 3: Create the template**

Create `templates/shared/package.json.hbs`:

```json
{
  "name": "{{projectName}}",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "docker compose -f docker-compose.dev.yml up",
    "dev:build": "docker compose -f docker-compose.dev.yml up --build",
    "deploy:build": "docker compose -f docker-compose.prod.yml build",
    "deploy": "node deploy/build-tag-push.js"
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- --testNamePattern="root package.json"
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add templates/shared/package.json.hbs test/generator.test.js
git commit -m "add root package.json template with dev and deploy scripts"
```

---

### Task 4: Update NestJS Dockerfile to multi-stage with dev target

**Files:**
- Modify: `templates/backend/nestjs/Dockerfile.hbs`

- [ ] **Step 1: Write the failing test**

Add to `test/generator.test.js`:

```js
test('nestjs dockerfile has dev and runner stages', async () => {
  const src = await makeTmpDir();
  const dest = await makeTmpDir();
  const raw = await readFile(
    new URL('../templates/backend/nestjs/Dockerfile.hbs', import.meta.url),
    'utf-8'
  );
  await writeFile(join(src, 'Dockerfile.hbs'), raw);

  await processTemplateDir(src, dest, { isPostgres: false });

  const result = await readFile(join(dest, 'Dockerfile'), 'utf-8');
  expect(result).toContain('AS deps');
  expect(result).toContain('AS dev');
  expect(result).toContain('AS builder');
  expect(result).toContain('AS runner');
  expect(result).toContain('npm run start:dev');
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --testNamePattern="nestjs dockerfile"
```

Expected: FAIL

- [ ] **Step 3: Replace the template content**

Replace the full content of `templates/backend/nestjs/Dockerfile.hbs`:

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci
{{#if isPostgres}}COPY prisma ./prisma/
RUN npx prisma generate{{/if}}

FROM deps AS dev
COPY . .
EXPOSE 3001
CMD ["npm", "run", "start:dev"]

FROM deps AS builder
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
{{#if isPostgres}}COPY --from=builder /app/prisma ./prisma{{/if}}
EXPOSE 3001
CMD ["node", "dist/main"]
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- --testNamePattern="nestjs dockerfile"
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add templates/backend/nestjs/Dockerfile.hbs test/generator.test.js
git commit -m "add multi-stage dev/runner to nestjs dockerfile template"
```

---

### Task 5: Update Next.js Dockerfile to multi-stage with dev target

**Files:**
- Modify: `templates/frontend/nextjs/Dockerfile.hbs`

- [ ] **Step 1: Write the failing test**

Add to `test/generator.test.js`:

```js
test('nextjs dockerfile has dev and runner stages', async () => {
  const src = await makeTmpDir();
  const dest = await makeTmpDir();
  const raw = await readFile(
    new URL('../templates/frontend/nextjs/Dockerfile.hbs', import.meta.url),
    'utf-8'
  );
  await writeFile(join(src, 'Dockerfile.hbs'), raw);

  await processTemplateDir(src, dest, {});

  const result = await readFile(join(dest, 'Dockerfile'), 'utf-8');
  expect(result).toContain('AS deps');
  expect(result).toContain('AS dev');
  expect(result).toContain('AS builder');
  expect(result).toContain('AS runner');
  expect(result).toContain('npm run dev');
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --testNamePattern="nextjs dockerfile"
```

Expected: FAIL

- [ ] **Step 3: Replace the template content**

Replace the full content of `templates/frontend/nextjs/Dockerfile.hbs`:

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM deps AS dev
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

FROM deps AS builder
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- --testNamePattern="nextjs dockerfile"
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add templates/frontend/nextjs/Dockerfile.hbs test/generator.test.js
git commit -m "add multi-stage dev/runner to nextjs dockerfile template"
```

---

### Task 6: Update generator.js printNextSteps

**Files:**
- Modify: `src/generator.js` — `printNextSteps` function only

- [ ] **Step 1: Write the failing test**

Add to `test/generator.test.js`:

```js
import { generate } from '../src/generator.js';
import { mkdtemp } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

test('generate prints dev instructions referencing npm run dev', async () => {
  const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  const outputDir = await mkdtemp(join(tmpdir(), 'gen-test-'));

  const answers = {
    projectName: 'test-app',
    frontend: 'nextjs',
    backend: 'nestjs',
    database: 'postgresql',
    auth: 'none',
    awsRegion: 'eu-west-2',
  };
  const context = {
    ...answers,
    isNextjs: true, isNestjs: true, isPostgres: true,
    isMongo: false, isKratos: false, isJwt: false, isReactSpa: false, isRemix: false,
    isFastify: false, isExpress: false, hasAuth: false, hasDatabase: true,
    hasFrontend: true, hasBackend: true,
  };

  await generate(answers, context, outputDir);

  const allOutput = consoleSpy.mock.calls.flat().join(' ');
  expect(allOutput).toContain('npm run dev');
  expect(allOutput).not.toContain('docker-compose up');
  consoleSpy.mockRestore();
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --testNamePattern="generate prints dev"
```

Expected: FAIL — output still says `docker-compose up`

- [ ] **Step 3: Update printNextSteps in src/generator.js**

Replace the `printNextSteps` function:

```js
function printNextSteps(answers) {
  console.log('\n✅ Project generated!\n');
  console.log('Run locally:');
  console.log(`  cd ${answers.projectName}`);
  console.log('  npm run dev:build   # first run (builds images)');
  console.log('  npm run dev         # subsequent runs\n');
  console.log('Deploy to AWS ECS:');
  console.log('  npm run deploy\n');
  console.log('Add these secrets to your GitHub repository:');
  const secrets = [
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_REGION',
    'ECR_REGISTRY',
    'DATABASE_URL',
  ];
  if (answers.auth === 'kratos') secrets.push('KRATOS_URL');
  secrets.forEach((s) => console.log(`  ${s}`));
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- --testNamePattern="generate prints dev"
```

Expected: PASS

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add src/generator.js test/generator.test.js
git commit -m "update next steps output to reference npm run dev and npm run deploy"
```

---

### Task 7: End-to-end smoke test

**Files:** none — manual verification only

- [ ] **Step 1: Scaffold a test project**

```bash
node src/cli.js
```

Enter: project name `smoke-test`, frontend `Next.js 15`, backend `NestJS`, database `PostgreSQL`, auth `None`, region `eu-west-2`

- [ ] **Step 2: Verify generated files exist**

```bash
ls smoke-test/
```

Expected output includes: `docker-compose.dev.yml`, `docker-compose.prod.yml`, `package.json`, `frontend/Dockerfile`, `backend/Dockerfile`

- [ ] **Step 3: Verify docker-compose.dev.yml has volume mounts**

```bash
grep -A2 "volumes:" smoke-test/docker-compose.dev.yml
```

Expected: `./frontend:/app` and `./backend:/app` appear

- [ ] **Step 4: Verify docker-compose.prod.yml has no volume mounts**

```bash
grep "volumes:" smoke-test/docker-compose.prod.yml
```

Expected: only DB volume declarations, no `./frontend:/app`

- [ ] **Step 5: Verify Dockerfiles have all 4 stages**

```bash
grep "^FROM" smoke-test/frontend/Dockerfile
grep "^FROM" smoke-test/backend/Dockerfile
```

Expected for each:
```
FROM node:20-alpine AS deps
FROM deps AS dev
FROM deps AS builder
FROM node:20-alpine AS runner
```

- [ ] **Step 6: Clean up and final commit**

```bash
rm -rf smoke-test
git add -A
git commit -m "verified local dev and deployment scaffolding end-to-end"
```
