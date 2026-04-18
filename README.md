# create-shipfast

[![npm version](https://img.shields.io/npm/v/create-shipfast.svg)](https://www.npmjs.com/package/create-shipfast)
[![npm downloads](https://img.shields.io/npm/dm/create-shipfast.svg)](https://www.npmjs.com/package/create-shipfast)
[![License: MIT](https://img.shields.io/npm/l/create-shipfast.svg)](https://opensource.org/licenses/MIT)

Scaffold a production-ready client web application in seconds.

```bash
npx create-shipfast
```

## What it generates

Answer a few prompts and get a fully wired project:

- **Frontend:** Next.js 15 (App Router)
- **Backend:** NestJS with Fastify
- **Database:** PostgreSQL (Prisma) or MongoDB
- **Auth:** Ory Kratos or custom JWT scaffold
- **CI/CD:** GitHub Actions (test + deploy to AWS ECS)
- **Infra:** Docker Compose for local dev, ECS task definitions for production

## Usage

```bash
npx create-shipfast
```

Or install globally:

```bash
npm install -g create-shipfast
create-shipfast
```

## Prompts

| Prompt | Options |
|--------|---------|
| Project name | lowercase, hyphens |
| Frontend | Next.js 15, React SPA, Remix, None |
| Backend | NestJS, Express, Fastify, None |
| Database | PostgreSQL, MongoDB, None |
| Authentication | Ory Kratos, JWT, None |
| AWS region | default: eu-west-2 |

## Output structure

```
my-app/
├── frontend/          # Next.js app
├── backend/           # NestJS API
├── .github/workflows/ # CI + deploy pipelines
├── infra/             # Kratos config, ECS task definitions
├── docker-compose.yml
└── .env.example
```

## License

MIT
