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
