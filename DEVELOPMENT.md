# Development

WorkshopOS is a TypeScript monorepo (npm workspaces):

```
packages/shared   shared types, zod schemas, Money/date helpers, RBAC + COA constants
packages/api      NestJS backend (also runs as the background worker later)
packages/web      React + Vite frontend
```

## Prerequisites

- Node.js 20+ (22 works)
- Docker (for local Postgres + Redis)

## First-time setup

```bash
# 1. Install dependencies (root installs all workspaces)
npm install

# 2. Configure environment
cp .env.example .env
# edit .env — at minimum set the JWT secrets:
#   openssl rand -base64 48   # for JWT_ACCESS_SECRET and JWT_REFRESH_SECRET

# 3. Start local Postgres + Redis
docker compose -f docker-compose.dev.yml up -d

# 4. Build shared (api/web import its compiled output)
npm run build --workspace @workshopos/shared

# 5. Create the database schema and seed reference data
npm run db:migrate     # creates tables (prisma migrate dev)
npm run db:seed        # roles, permissions, default chart of accounts
```

## Run the app (two terminals)

```bash
npm run dev:api    # http://localhost:3000/api/v1
npm run dev:web    # http://localhost:5173
```

Open http://localhost:5173. On first run you'll get the **setup wizard** —
create your business, first fiscal year, and owner account. Then sign in and
you can browse the chart of accounts and post a manual journal entry.

## Useful commands

| Command | What it does |
|---------|--------------|
| `npm run typecheck` | Typecheck every workspace |
| `npm run test` | Run unit tests (Vitest) across workspaces |
| `npm run build` | Build shared → api → web |
| `npm run db:migrate --workspace @workshopos/api` | Create/apply a dev migration |
| `npm run db:seed --workspace @workshopos/api` | (Re)seed reference data — idempotent |

## Production-style run (all containers)

```bash
cp .env.example .env   # set real secrets
docker compose up --build -d
# web on :8080, api on :3000; the api container runs `prisma migrate deploy` on boot
# then run the seed once:
docker compose exec api npx prisma db seed
```

In production put a reverse proxy (Caddy/Traefik) in front for HTTPS and route
`/api` to the api service and everything else to web — see
[`docs/05-security-and-ops.md`](docs/05-security-and-ops.md).

## A note on `prisma generate` behind restricted networks

`prisma generate` / `migrate` download a query-engine binary from
`binaries.prisma.sh`. In sandboxes that rate-limit large binary streams this can
fail with `ECONNRESET`. On a normal network (and in CI) it works without
intervention. If you hit it, retry, or set a
[`PRISMA_ENGINES_MIRROR`](https://www.prisma.io/docs/orm/reference/environment-variables-reference#prisma_engines_mirror).
