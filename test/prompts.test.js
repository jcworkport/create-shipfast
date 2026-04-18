import { buildContext } from '../src/prompts.js';

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
    const ctx = buildContext(base);
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
    const ctx = buildContext({ ...base, auth: 'none' });
    expect(ctx.hasAuth).toBe(false);
    expect(ctx.isKratos).toBe(false);
    expect(ctx.isJwt).toBe(false);
  });

  test('sets hasFrontend false when frontend is none', () => {
    const ctx = buildContext({ ...base, frontend: 'none' });
    expect(ctx.hasFrontend).toBe(false);
  });

  test('passes raw answer values through unchanged', () => {
    const ctx = buildContext(base);
    expect(ctx.projectName).toBe('acme-app');
    expect(ctx.awsRegion).toBe('eu-west-2');
  });
});
