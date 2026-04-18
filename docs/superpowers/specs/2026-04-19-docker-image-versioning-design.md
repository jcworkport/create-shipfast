# Docker Image Versioning & Mailpit Migration

**Date:** 2026-04-19
**Status:** Approved

## Problem

1. `oryd/mailslurper:latest-smtps` is AMD64-only — causes Docker performance warnings on Apple Silicon (emulation via Rosetta).
2. All service images are hardcoded to specific tags in templates; users have no visibility into what versions they're getting.
3. No mechanism to pull current stable versions at generation time.

## Goals

- Replace mailslurper with a multi-arch alternative (mailpit).
- Fetch the latest stable tag for each service image from Docker Hub at CLI invocation time.
- Display resolved image tag + date inline in prompt option labels.
- Fall back gracefully to hardcoded defaults when Docker Hub is unreachable.

## Architecture

### New module: `src/image-versions.js`

Responsible for all Docker Hub resolution. Called once from `cli.js` before prompts begin, behind a clack spinner.

```
cli.js
  └─ spinner: "Checking latest image versions..."
       └─ image-versions.js (parallel fetches via Promise.allSettled)
            ├─ fetch postgres latest stable tag
            ├─ fetch mongo latest stable tag
            ├─ fetch oryd/kratos latest stable tag
            └─ fetch axllent/mailpit latest stable tag
       └─ returns: { postgres, mongo, kratos, mailpit }
            each: { tag: string, date: string, fallback: boolean }
  └─ if any fallback: clack note warning user
  └─ collectAnswers(versions) — injects resolved tags into prompt labels
  └─ buildContext(answers, versions) — includes image tags as template variables
```

### Docker Hub API

Endpoint: `https://hub.docker.com/v2/repositories/{repo}/tags?page_size=100&ordering=last_updated`

- No authentication required (public repos).
- Fetch timeout: 5 seconds per image.
- All four fetches run in parallel via `Promise.allSettled()`.

### Tag resolution per image

| Image | Repo path | Stable tag regex | Example |
|-------|-----------|-----------------|---------|
| PostgreSQL | `library/postgres` | `/^\d+\.\d+-alpine$/` | `16.4-alpine` |
| MongoDB | `library/mongo` | `/^\d+\.\d+\.\d+$/` | `7.0.14` |
| Ory Kratos | `oryd/kratos` | `/^v\d+\.\d+\.\d+$/` | `v1.3.1` |
| Mailpit | `axllent/mailpit` | `/^v\d+\.\d+\.\d+$/` | `v1.22.0` |

**Stability filter:** After regex match, discard any tag whose name contains `alpha`, `beta`, `rc`, `dev`, `preview`, or `snapshot` (case-insensitive). Pick the first remaining tag (already sorted by `last_updated` desc).

### Fallback defaults

Hardcoded in `image-versions.js` as a constant, used when a fetch fails:

```js
const DEFAULTS = {
  postgres: { tag: 'postgres:16-alpine',        date: 'unknown' },
  mongo:    { tag: 'mongo:7',                   date: 'unknown' },
  kratos:   { tag: 'oryd/kratos:v1.2',          date: 'unknown' },
  mailpit:  { tag: 'axllent/mailpit:latest',    date: 'unknown' },
};
```

If any image falls back, a clack `note` is shown after the spinner (before prompts):

```
Note: Could not fetch latest versions for: kratos
      Falling back to known-good defaults. Verify manually before deploying.
```

## Prompt Changes

Version info is injected into option labels for database and authentication prompts only. Other prompts (project name, frontend, backend, AWS region) are unchanged.

```
Database:
  ❯ PostgreSQL  (postgres:16.4-alpine · 2026-04-18)
    MongoDB     (mongo:7.0.14 · 2026-04-10)
    None

Authentication:
  ❯ Ory Kratos  (oryd/kratos:v1.3.1 · 2026-03-22)
    Custom JWT scaffold
    None
```

`collectAnswers(versions)` receives the resolved versions object. Labels are constructed as:

```js
`PostgreSQL  (${versions.postgres.tag} · ${versions.postgres.date})`
```

## Template Changes

All hardcoded image strings replaced with Handlebars variables in both `docker-compose.dev.yml.hbs` and `docker-compose.prod.yml.hbs`.

| Old | New variable |
|-----|-------------|
| `postgres:16-alpine` | `{{postgresImage}}` |
| `mongo:7` | `{{mongoImage}}` |
| `oryd/kratos:v1.2` | `{{kratosImage}}` |
| `oryd/mailslurper:latest-smtps` | `{{mailpitImage}}` |

### Mailslurper → Mailpit migration

| | Mailslurper | Mailpit |
|-|-------------|---------|
| Image | `oryd/mailslurper:latest-smtps` | `axllent/mailpit:vX.Y.Z` |
| Architecture | AMD64 only | Multi-arch (AMD64 + ARM64) |
| Web UI port | 4436 | 8025 |
| SMTP port | 4437 | 1025 |
| Maintenance | Abandoned | Active |

Updated service block in both compose files:

```yaml
mailpit:
  image: {{mailpitImage}}
  ports:
    - "8025:8025"
    - "1025:1025"
```

Kratos config (`infra/kratos/kratos.yml.hbs`) references the mail service by hostname — must be updated from `mailslurper:1025` to `mailpit:1025`. The internal SMTP port is the same (1025); only the service name changes.

## Context Changes

`buildContext()` gains four new fields passed through to all Handlebars templates:

```js
postgresImage: versions.postgres.tag,  // e.g. "postgres:16.4-alpine"
mongoImage:    versions.mongo.tag,
kratosImage:   versions.kratos.tag,
mailpitImage:  versions.mailpit.tag,
```

## Testing

- Unit tests for `image-versions.js`: mock `fetch`, verify stable tag selection, pre-release filtering, fallback on network error.
- Generator tests: assert resolved image tags appear verbatim in rendered compose output.
- Existing generator tests: update expected image strings to use variable-resolved values via mock versions object.
