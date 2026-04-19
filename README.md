<h1 align="center">⚡ create-shipfast</h1>

<p align="center">
  <strong>Scaffold a production-ready full-stack app in seconds.</strong><br>
  Next.js · NestJS · PostgreSQL · Ory Kratos · Docker · AWS ECS
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/create-shipfast"><img src="https://img.shields.io/npm/v/create-shipfast.svg?style=for-the-badge&color=CB3837&logo=npm&logoColor=white" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/create-shipfast"><img src="https://img.shields.io/npm/dm/create-shipfast.svg?style=for-the-badge&color=CB3837&logo=npm&logoColor=white" alt="npm downloads"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="MIT License"></a>
</p>

<p align="center">
  <a href="#usage">Usage</a> ·
  <a href="#what-it-generates">What it generates</a> ·
  <a href="#prompts">Prompts</a> ·
  <a href="#output-structure">Output structure</a>
</p>

---

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
