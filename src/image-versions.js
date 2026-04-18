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
