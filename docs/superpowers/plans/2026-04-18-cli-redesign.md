# CLI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Inquirer with `@clack/prompts` to give the CLI a Claude Code-style aesthetic: ASCII banner, styled prompts with box-drawing chrome, spinner during generation, and a `note()` box for next-steps output.

**Architecture:** `src/cli.js` owns the banner, spinner, and next-steps display. `src/prompts.js` owns all prompt logic using `@clack/prompts`. `src/generator.js` is decoupled from output — `printNextSteps` is removed from it entirely.

**Tech Stack:** `@clack/prompts` (replaces `inquirer`), Node.js ESM

---

## File Map

| File | Change |
|------|--------|
| `package.json` | add `@clack/prompts`, remove `inquirer` |
| `src/prompts.js` | replace `inquirer.prompt()` with `@clack/prompts` calls; `buildContext` unchanged |
| `src/cli.js` | add ASCII banner via `p.intro()`, spinner around `generate()`, next-steps via `p.note()` |
| `src/generator.js` | remove `printNextSteps` call from `generate()` and delete the function |

---

## Task 1: Swap dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install `@clack/prompts` and remove `inquirer`**

```bash
cd /Users/joel/Documents/create-shipfast
npm install @clack/prompts
npm uninstall inquirer
```

Expected: `package.json` now has `"@clack/prompts"` in dependencies, `"inquirer"` is gone.

- [ ] **Step 2: Verify tests still pass (buildContext is unaffected)**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "swap inquirer for @clack/prompts"
```

---

## Task 2: Rewrite `src/prompts.js`

**Files:**
- Modify: `src/prompts.js`

- [ ] **Step 1: Write a failing test that verifies `buildContext` is unchanged after the rewrite**

Add to `test/prompts.test.js` — the existing tests already cover this, so just confirm they cover `backendHasDeps` and `hasVolumes`:

```js
test('sets backendHasDeps true when database is postgresql', () => {
  const ctx = buildContext({ ...base, auth: 'none' });
  expect(ctx.backendHasDeps).toBe(true);
  expect(ctx.hasVolumes).toBe(true);
});

test('sets backendHasDeps false when database is none and auth is none', () => {
  const ctx = buildContext({ ...base, database: 'none', auth: 'none' });
  expect(ctx.backendHasDeps).toBe(false);
  expect(ctx.hasVolumes).toBe(false);
});
```

- [ ] **Step 2: Run tests to verify they fail (new tests not passing yet since file unchanged)**

```bash
npm test -- test/prompts.test.js
```

Expected: the two new tests PASS immediately (buildContext already exists) — confirms the contract we're protecting.

- [ ] **Step 3: Rewrite `src/prompts.js`**

Replace the entire file with:

```js
import * as p from '@clack/prompts';

function cancelOnExit(value) {
  if (p.isCancel(value)) {
    p.cancel('Operation cancelled.');
    process.exit(0);
  }
  return value;
}

export async function collectAnswers() {
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
      { value: 'postgresql', label: 'PostgreSQL' },
      { value: 'mongodb',    label: 'MongoDB' },
      { value: 'none',       label: 'None' },
    ],
  }));

  const auth = cancelOnExit(await p.select({
    message: 'Authentication:',
    options: [
      { value: 'kratos', label: 'Ory Kratos (recommended)' },
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

export function buildContext(answers) {
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
  };
}
```

- [ ] **Step 4: Run all tests**

```bash
npm test
```

Expected: all tests pass (`buildContext` is identical, `collectAnswers` is not unit-tested).

- [ ] **Step 5: Commit**

```bash
git add src/prompts.js test/prompts.test.js
git commit -m "replace inquirer with @clack/prompts in prompts.js"
```

---

## Task 3: Remove `printNextSteps` from `generator.js`

**Files:**
- Modify: `src/generator.js`

- [ ] **Step 1: Remove `printNextSteps` from `generate()` and delete the function**

Replace the `generate` function and everything after it with:

```js
export async function generate(answers, context, outputDir) {
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

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/generator.js
git commit -m "decouple printNextSteps from generator"
```

---

## Task 4: Rewrite `src/cli.js` with banner, spinner, and note

**Files:**
- Modify: `src/cli.js`

- [ ] **Step 1: Replace `src/cli.js` with the new implementation**

```js
#!/usr/bin/env node
import * as p from '@clack/prompts';
import { mkdir } from 'fs/promises';
import { join } from 'path';
import { collectAnswers, buildContext } from './prompts.js';
import { generate } from './generator.js';

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

const answers = await collectAnswers();
const context = buildContext(answers);
const outputDir = join(process.cwd(), answers.projectName);

await mkdir(outputDir, { recursive: true });

const s = p.spinner();
s.start(`Scaffolding ${answers.projectName}`);
await generate(answers, context, outputDir);
s.stop(`Scaffolded ${answers.projectName}`);

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
    ...secrets.map((s) => `  ${s}`),
  ].join('\n'),
  'Next steps',
);

p.outro('Happy shipping!');
```

- [ ] **Step 2: Run the CLI manually to verify the output looks correct**

```bash
node src/cli.js
```

Expected:
- ASCII banner prints
- `◇ Project name` styled prompt appears
- All 6 prompts render with box-drawing chrome
- Spinner shows during generation
- `Note` box shows next steps
- `◆ Happy shipping!` outro closes cleanly
- Ctrl+C at any prompt prints `◆ Operation cancelled.` and exits cleanly

- [ ] **Step 3: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/cli.js
git commit -m "add clack banner, spinner, and note to cli"
```

---

## Self-Review

- **Spec coverage:** Banner ✓, `@clack/prompts` styled prompts ✓, spinner during generation ✓, `note()` for next steps ✓, cancel handling ✓, `inquirer` removed ✓.
- **Placeholders:** None.
- **Type consistency:** `answers` object shape is identical across all tasks — same keys produced by `collectAnswers()`, consumed by `buildContext()` and `cli.js`.
- **`commander` dependency:** `cli.js` no longer uses Commander (no subcommands needed). Removed from the rewrite. Can remove from `package.json` too — add `npm uninstall commander` to Task 1 Step 1 if desired, or leave it (it's unused but harmless).
