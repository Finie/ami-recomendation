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

No `.env.example` is provided (see why in the [`.env`](#env) section) — create `.env` at the project root first (see below for the required keys), then:

```bash
docker compose up --build -d
docker compose run --rm -e NODE_ENV=development api npm run generate:data
```

The API is now up on `http://localhost:3000`. See below for the full command reference, running without Docker, and an example request/response.

## Running with Docker

The whole stack (PostgreSQL, migrations, API) runs via Docker Compose.

### `.env`

Create a `.env` file at the project root (it is git-ignored and never committed) with:

```env
PORT=3000

POSTGRES_DB=<db-name>
POSTGRES_USER=<db-user>
POSTGRES_PASSWORD=<db-password>
POSTGRES_PORT=5432

DATABASE_URL=postgresql://<db-user>:<db-password>@database:5432/<db-name>?schema=public

# Optional — enables AI-rewritten one-line explanations via `?include_ai_review=true`.
# Get a key from https://aistudio.google.com/apikey. Omit both to disable the feature;
# the API falls back to the deterministic `reason` field only.
GEMINI_API_KEY=<your-gemini-api-key>
GEMINI_MODEL=<gemini-model-name>
```

Pick your own values for the `<...>` placeholders above — they just need to be consistent across `POSTGRES_*` and `DATABASE_URL`.

The `database` hostname in `DATABASE_URL` is intentional — it matches the `database` service name in `compose.yaml` and only resolves inside the Compose network.

If you want to run the app directly on the host (`npm run dev`, outside Docker), the `database` hostname won't resolve. Temporarily swap `DATABASE_URL` for the `localhost` variant instead:

```env
DATABASE_URL=postgresql://<db-user>:<db-password>@localhost:5432/<db-name>?schema=public
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

## API

### `GET /api/users/:userId/recommendations`

Query params:

- `limit` (optional, positive integer, default `10`) — max number of recommendations to return.
- `include_ai_review` (optional, `true`/omit) — when `true`, calls Gemini to rewrite each `reason` into a friendlier `ai_reason` sentence (requires `GEMINI_API_KEY`/`GEMINI_MODEL` to be set; see [`.env`](#env)).

#### Without AI review (default)

Omit `include_ai_review` (or set it to anything other than `true`) to get recommendations with only the deterministic `reason` field — no call to Gemini is made and `ai_reason` is always `null`.

```bash
curl "http://localhost:3000/api/users/2/recommendations?limit=1"
```

```json
{
  "recommendations": [
    {
      "course": {
        "course_id": 42,
        "title": "Leading High-Performing Teams",
        "topic": "Leadership",
        "level": "intermediate",
        "skills_taught": ["delegation", "feedback", "coaching"],
        "duration_mins": 90,
        "prerequisites": []
      },
      "activity_segment": "existing",
      "signal_scores": { "profile": 0.8, "survey": 0.6, "usage": 0.4 },
      "weights": { "profile": 0.5, "survey": 0.3, "usage": 0.2 },
      "weighted_contributions": { "profile": 0.4, "survey": 0.18, "usage": 0.08 },
      "final_score": 0.66,
      "reason": "Matches your primary topic: Leadership",
      "ai_reason": null,
      "reasons": [
        { "signal": "profile", "description": "Matches your primary topic: Leadership" }
      ]
    }
  ]
}
```

#### With AI review

Pass `include_ai_review=true` to additionally have Gemini rewrite each `reason` into a friendlier one-sentence `ai_reason`. This requires `GEMINI_API_KEY` and `GEMINI_MODEL` to be set in `.env`; if they aren't, `ai_reason` falls back to `null` rather than the request failing.

```bash
curl "http://localhost:3000/api/users/2/recommendations?limit=1&include_ai_review=true"
```

```json
{
  "recommendations": [
    {
      "course": {
        "course_id": 42,
        "title": "Leading High-Performing Teams",
        "topic": "Leadership",
        "level": "intermediate",
        "skills_taught": ["delegation", "feedback", "coaching"],
        "duration_mins": 90,
        "prerequisites": []
      },
      "activity_segment": "existing",
      "signal_scores": { "profile": 0.8, "survey": 0.6, "usage": 0.4 },
      "weights": { "profile": 0.5, "survey": 0.3, "usage": 0.2 },
      "weighted_contributions": { "profile": 0.4, "survey": 0.18, "usage": 0.08 },
      "final_score": 0.66,
      "reason": "Matches your primary topic: Leadership",
      "ai_reason": "Since leadership is one of your priorities, this course will help you build the skills to guide your team more effectively.",
      "reasons": [
        { "signal": "profile", "description": "Matches your primary topic: Leadership" }
      ]
    }
  ]
}
```

#### Sample output across activity segments

The weighting and which signals are actually active depend heavily on the user's `activity_segment` and how much survey/usage data they have (see [`default-recommendation-weight-service.ts`](src/services/default-recommendation-weight-service.ts)). Below is real output captured against the seeded dataset (`npm run generate:data`) for three users chosen to represent a cold-start user, a mid-history user, and a heavy user.

##### Cold-start — user 258 (`starting`, no survey, no usage events)

```bash
curl "http://localhost:3000/api/users/258/recommendations?limit=1"
```

```json
{
  "recommendations": [
    {
      "course": {
        "course_id": 25,
        "title": "Building Foundations in Workplace Feedback",
        "topic": "People Management",
        "level": "beginner",
        "skills_taught": ["feedback", "employee_engagement", "talent_development"],
        "duration_mins": 90,
        "prerequisites": []
      },
      "activity_segment": "starting",
      "signal_scores": { "profile": 0.84, "survey": 0, "usage": 0 },
      "weights": { "profile": 1, "survey": 0, "usage": 0 },
      "weighted_contributions": { "profile": 0.84, "survey": 0, "usage": 0 },
      "final_score": 0.84,
      "reason": "Because People Management is one of your learning priorities and you want to strengthen your feedback and employee engagement skills, we recommend Building Foundations in Workplace Feedback.",
      "ai_reason": null,
      "reasons": [
        { "signal": "profile", "description": "Matches your primary topic: People Management" },
        { "signal": "profile", "description": "Addresses skill gaps: feedback, employee_engagement, talent_development" }
      ]
    }
  ]
}
```

With no survey and no usage events, `DefaultRecommendationWeightService` redistributes both of those weights onto `profile`, so the entire ranking for this user comes from `UserLearningContext` (primary/secondary topics and likely skill gaps) alone.

##### Mid-history — user 210 (`existing`, has a survey and 8 usage events)

```bash
curl "http://localhost:3000/api/users/210/recommendations?limit=1"
```

```json
{
  "recommendations": [
    {
      "course": {
        "course_id": 2,
        "title": "Introduction to Self-Awareness",
        "topic": "Leadership",
        "level": "beginner",
        "skills_taught": ["self_awareness", "goal_setting", "team_motivation"],
        "duration_mins": 60,
        "prerequisites": []
      },
      "activity_segment": "existing",
      "signal_scores": { "profile": 0.6, "survey": 0, "usage": 0.6666666666666666 },
      "weights": { "profile": 0.3, "survey": 0.3, "usage": 0.4 },
      "weighted_contributions": { "profile": 0.18, "survey": 0, "usage": 0.26666666666666666 },
      "final_score": 0.4467,
      "reason": "Because Leadership is one of your learning priorities and completed Leadership Fundamentals, we recommend Introduction to Self-Awareness.",
      "ai_reason": null,
      "reasons": [
        { "signal": "profile", "description": "Matches your primary topic: Leadership" },
        { "signal": "survey", "description": "Matches a topic you selected in your survey: Leadership" },
        { "signal": "usage", "description": "Similar topic to a course you completed: Leadership Fundamentals" },
        { "signal": "usage", "description": "Similar topic to a course you completed: Advanced Team Coaching" }
      ]
    }
  ]
}
```

All three signals are active here (`existing` segment, base weights `0.3/0.3/0.4`), and the `reasons` array shows the profile, survey, and usage evidence side by side even though `signal_scores.survey` nets to `0` for this course — see the note below.

##### Heavy usage — user 810 (`heavy`, 50 usage events)

```bash
curl "http://localhost:3000/api/users/810/recommendations?limit=1"
```

```json
{
  "recommendations": [
    {
      "course": {
        "course_id": 42,
        "title": "Introduction to Active Listening",
        "topic": "Communication",
        "level": "beginner",
        "skills_taught": ["active_listening", "business_writing", "presentation"],
        "duration_mins": 60,
        "prerequisites": []
      },
      "activity_segment": "heavy",
      "signal_scores": { "profile": 0.6, "survey": 0.4, "usage": 1 },
      "weights": { "profile": 0.25, "survey": 0.25, "usage": 0.5 },
      "weighted_contributions": { "profile": 0.15, "survey": 0.1, "usage": 0.5 },
      "final_score": 0.75,
      "reason": "Because Communication is one of your learning priorities and completed Stakeholder Communication for Senior Leaders, we recommend Introduction to Active Listening.",
      "ai_reason": null,
      "reasons": [
        { "signal": "profile", "description": "Matches your primary topic: Communication" },
        { "signal": "survey", "description": "Matches a topic you selected in your survey: Communication" },
        { "signal": "usage", "description": "Similar topic to a course you completed: Stakeholder Communication for Senior Leaders" }
      ]
    }
  ]
}
```

`usage` dominates the `heavy` segment's base weights (`0.25/0.25/0.5`), and this user's `usage` signal is already saturated at `1` from several completed Communication-topic courses (`NORMALIZATION_FACTOR = 3` in [`default-usage-scoring-service.ts`](src/services/default-usage-scoring-service.ts) caps it once 3+ net completions accumulate). The real response also includes several more `usage`-signal `reasons` entries — one per matching completed course — trimmed here for brevity.

> **Note on the mid-history example:** you may notice `signal_scores.survey` is `0` even though a `"Matches a topic you selected in your survey"` reason is present. This is because `confidence_by_topic` in the seeded dataset stores integer Likert-style ratings (`1`–`5`, see `generate-surveys.ts`), while `DefaultSurveyScoringService` computes `confidenceScore = 1 - confidence` assuming `confidence` is already normalized to `[0, 1]`. For a rating of `3`, that yields `1 - 3 = -2`, which combined with its `0.3` weight drags the otherwise-positive topic-match score down until the final `Math.max(0, ...)` clamp floors it at `0`. This is a real scale mismatch in the current implementation, not a documentation error — it means the survey confidence sub-signal is effectively broken against this seed data whenever a topic's confidence rating is present, and is worth fixing (e.g. normalizing the generated ratings to `[0, 1]`, or rescaling in the scoring service) before relying on survey confidence in practice.

## Architecture

- **database** — PostgreSQL 16, persists to a named volume (`db_data`), exposes `${POSTGRES_PORT}:5432`, health-checked with `pg_isready`.
- **migrations** — runs `npm run db:deploy` (`prisma migrate deploy`) once the database is healthy, then exits. It uses the same image as `api` and does not restart.
- **api** — runs `npm start` once the database is healthy and migrations have completed successfully. Exposes `${PORT}:3000` and restarts unless stopped.

The Docker image is multi-stage: a `builder` stage installs dependencies, generates the Prisma client, and compiles TypeScript to `dist/`; the `runtime` stage copies over `node_modules`, `dist`, the full `src` tree, and the Prisma schema/config. The full source tree and dev dependencies (`prisma`, `tsx`) are kept in the runtime image because the `migrations` service needs the Prisma CLI and the data-generation scripts run via `tsx` directly against `src/scripts/*.ts`.
