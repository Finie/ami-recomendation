# ami-recomendation

A course recommendation API backed by PostgreSQL and Prisma.

## Getting started

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) with Compose v2 (the easiest way to run the project — no local Node/Postgres needed)
- Node.js 22.x and npm, only if you want to run the app directly on the host instead

### Clone

```bash
git clone <this-repo-url>
cd ami-recomendation
```

### Quick start (Docker)

No `.env.example` is provided (see why in the [`.env`](#env) section) — create `.env` at the project root first, then:

```bash
docker compose up --build -d
docker compose run --rm -e NODE_ENV=development api npm run generate:data
curl "http://localhost:3000/api/users/2/recommendations?limit=5"
```

That's it — see below for the full command reference, and for running without Docker.

## Running with Docker

The whole stack (PostgreSQL, migrations, API) runs via Docker Compose.

### `.env`

Create a `.env` file at the project root (it is git-ignored and never committed) with:

```env
PORT=3000

POSTGRES_DB=ami_recommendation
POSTGRES_USER=ami_user
POSTGRES_PASSWORD=ami_password
POSTGRES_PORT=5432

DATABASE_URL=postgresql://ami_user:ami_password@database:5432/ami_recommendation?schema=public
```

The `database` hostname in `DATABASE_URL` is intentional — it matches the `database` service name in `compose.yaml` and only resolves inside the Compose network.

If you want to run the app directly on the host (`npm run dev`, outside Docker), the `database` hostname won't resolve. Temporarily swap `DATABASE_URL` for the `localhost` variant instead:

```env
DATABASE_URL=postgresql://ami_user:ami_password@localhost:5432/ami_recommendation?schema=public
```

(and make sure a local Postgres is listening on `POSTGRES_PORT`).

### Commands

```bash
# Validate and preview the fully-interpolated Compose config
docker compose config

# Build the image and start database, migrations, and api
docker compose up --build -d

# Populate the database with a synthetic dataset (explicit, not automatic).
# NODE_ENV must be overridden to a non-production value here — the app
# refuses to run synthetic data generation when NODE_ENV=production
# (src/scripts/helpers/assert-safe-environment.ts), which is what the
# `api` service normally runs as.
docker compose run --rm -e NODE_ENV=development api npm run generate:data

# Check container status
docker compose ps

# Tail API logs
docker compose logs -f api

# Try the recommendation endpoint
curl "http://localhost:3000/api/users/2/recommendations?limit=5"

# Stop everything (the database volume is preserved)
docker compose down
```

### Full reset

To wipe the database volume and start clean:

```bash
docker compose down -v
docker compose up --build -d
docker compose run --rm -e NODE_ENV=development api npm run generate:data
```

## Running without Docker

Requires Node.js 22.x and a local PostgreSQL instance.

```bash
npm install

# .env should use the `localhost` DATABASE_URL variant (see above),
# and a Postgres instance must be listening on POSTGRES_PORT.

npm run db:generate   # generate the Prisma client
npm run db:migrate    # apply migrations (creates the schema)
npm run generate:data # populate a synthetic dataset (dev-only, see below)
npm run dev           # start the API with hot reload
```

Other useful scripts:

```bash
npm run build   # compile TypeScript to dist/
npm start       # run the compiled app (node dist/server.js)
npm test        # run the test suite (vitest)
npm run db:studio # open Prisma Studio
```

`npm run generate:data` refuses to run when `NODE_ENV=production` (`src/scripts/helpers/assert-safe-environment.ts` guards against destructive reseeds) — leave `NODE_ENV` unset or `development` for local use.

## Architecture

- **database** — PostgreSQL 16, persists to a named volume (`db_data`), exposes `${POSTGRES_PORT}:5432`, health-checked with `pg_isready`.
- **migrations** — runs `npm run db:deploy` (`prisma migrate deploy`) once the database is healthy, then exits. It uses the same image as `api` and does not restart.
- **api** — runs `npm start` once the database is healthy and migrations have completed successfully. Exposes `${PORT}:3000` and restarts unless stopped.

The Docker image is multi-stage: a `builder` stage installs dependencies, generates the Prisma client, and compiles TypeScript to `dist/`; the `runtime` stage copies over `node_modules`, `dist`, the full `src` tree, and the Prisma schema/config. The full source tree and dev dependencies (`prisma`, `tsx`) are kept in the runtime image because the `migrations` service needs the Prisma CLI and the data-generation scripts run via `tsx` directly against `src/scripts/*.ts`.
