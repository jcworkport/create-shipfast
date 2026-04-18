import { processTemplateDir } from '../src/generator.js';
import { mkdtemp, readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

async function makeTmpDir() {
  return mkdtemp(join(tmpdir(), 'ks-test-'));
}

describe('processTemplateDir', () => {
  test('copies static files unchanged', async () => {
    const src = await makeTmpDir();
    const dest = await makeTmpDir();
    await writeFile(join(src, 'tsconfig.json'), '{"compilerOptions":{}}');

    await processTemplateDir(src, dest, {});

    const result = await readFile(join(dest, 'tsconfig.json'), 'utf-8');
    expect(result).toBe('{"compilerOptions":{}}');
  });

  test('interpolates .hbs files and strips .hbs extension', async () => {
    const src = await makeTmpDir();
    const dest = await makeTmpDir();
    await writeFile(join(src, 'package.json.hbs'), '{"name":"{{projectName}}"}');

    await processTemplateDir(src, dest, { projectName: 'my-app' });

    const result = await readFile(join(dest, 'package.json'), 'utf-8');
    expect(result).toBe('{"name":"my-app"}');
  });

  test('recursively processes subdirectories', async () => {
    const src = await makeTmpDir();
    const dest = await makeTmpDir();
    await mkdir(join(src, 'sub'));
    await writeFile(join(src, 'sub', 'file.txt.hbs'), 'hello {{name}}');

    await processTemplateDir(src, dest, { name: 'world' });

    const result = await readFile(join(dest, 'sub', 'file.txt'), 'utf-8');
    expect(result).toBe('hello world');
  });

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

  test('handlebars conditionals exclude blocks when flag is false', async () => {
    const src = await makeTmpDir();
    const dest = await makeTmpDir();
    await writeFile(join(src, 'app.ts.hbs'), '{{#if isKratos}}import kratos{{/if}}\nalways here');

    await processTemplateDir(src, dest, { isKratos: false });

    const result = await readFile(join(dest, 'app.ts'), 'utf-8');
    expect(result).toBe('\nalways here');
  });
});
