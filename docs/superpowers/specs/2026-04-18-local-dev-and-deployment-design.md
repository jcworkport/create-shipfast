# Design: Local Dev + Production Deployment Separation

**Date:** 2026-04-18  
**Status:** Approved

## Summary

`create-shipfast` currently scaffolds apps that assume immediate deployment. This change adds first-class local development support while keeping the production CI/CD pipeline intact. The user switches between modes via npm scripts.

## What Gets Generated

Every scaffolded project will include:

- `docker-compose.dev.yml` — local dev with volume mounts and hot reload
- `docker-compose.prod.yml` — production builds from Dockerfiles (replaces current `docker-compose.yml`)
- `package.json` (root) — npm scripts wiring both modes
- `deploy/build-tag-push.js` — AWS ECR push + ECS update, with clear comments for swapping providers
- Multi-stage `Dockerfile` in each service (frontend + backend)

## npm Scripts

```json
"scripts": {
  "dev": "docker compose -f docker-compose.dev.yml up",
  "dev:build": "docker compose -f docker-compose.dev.yml up --build",
  "deploy:build": "docker compose -f docker-compose.prod.yml build",
  "deploy": "node deploy/build-tag-push.js"
}
```

- `npm run dev` — start everything locally with hot reload
- `npm run dev:build` — same but forces image rebuild (first run)
- `npm run deploy` — build prod images, push to ECR, update ECS service

## docker-compose.dev.yml

Differences from prod compose:
- Each app service mounts source code: `./frontend:/app`, `./backend:/app`
- Anonymous volume protects node_modules: `/app/node_modules`
- Overrides `command` to run dev server: `npm run dev` (Next.js), `npm run start:dev` (NestJS)
- Sets `NODE_ENV=development`
- Targets the `dev` stage in the Dockerfile: `target: dev`

Databases and infra (Postgres, Mongo, Kratos) are identical in both files.

## docker-compose.prod.yml

The current `docker-compose.yml` template renamed and cleaned up. Builds from final Dockerfile stage, no volume mounts, no dev commands.

## Multi-Stage Dockerfiles

Both frontend and backend Dockerfiles use 4 stages:

1. **deps** — `npm ci`, shared by dev and prod
2. **dev** — copies source, runs `npm run dev` (targeted by dev compose)
3. **builder** — runs `npm run build`, prod only
4. **runner** — minimal image with only dist + prod deps, prod only

## deploy/build-tag-push.js

Scaffolded script that:
1. Builds prod Docker images (`docker compose -f docker-compose.prod.yml build`)
2. Tags and pushes each image to AWS ECR
3. Updates the ECS service to trigger a rolling deploy

Contains clearly marked comments (`# TODO: set your ECR repo URL`, `# TODO: set your ECS cluster/service`) so users can easily adapt to another provider.

## Template Changes Required

| File | Action |
|------|--------|
| `templates/shared/docker-compose.yml.hbs` | Rename to `docker-compose.prod.yml.hbs`, no changes to content |
| `templates/shared/docker-compose.dev.yml.hbs` | New file |
| `templates/shared/package.json.hbs` | New file (root package.json with scripts) |
| `templates/frontend/nextjs/Dockerfile.hbs` | Add multi-stage structure |
| `templates/backend/nestjs/Dockerfile.hbs` | Add multi-stage structure |
| `templates/shared/deploy/build-tag-push.js.hbs` | New file (or update existing) |
| `src/generator.js` | Copy new templates, remove old docker-compose copy |

## Testing

- Run `npx create-shipfast`, scaffold a Next.js + NestJS + Postgres project
- Verify `npm run dev` starts all containers with hot reload working (edit a file, confirm change appears without rebuild)
- Verify `npm run deploy:build` produces production images with no dev dependencies
