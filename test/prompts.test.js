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
