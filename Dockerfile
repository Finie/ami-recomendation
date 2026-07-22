# syntax=docker/dockerfile:1

# ---- builder --------------------------------------------------------------
# Installs all dependencies, generates the Prisma client, and compiles
# TypeScript to ./dist.
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# Prisma files must be present before `prisma generate` runs.
# `prisma generate` never connects to a database, but prisma.config.ts
# eagerly resolves DATABASE_URL, so a build-time placeholder is enough.
# tsconfig.json must also be present *before* generating: Prisma's generator
# reads it to decide whether compiled imports should use ".ts" or ".js"
# extensions, and defaults to ".ts" (broken for plain `node`) if it's missing.
COPY tsconfig.json ./
COPY prisma.config.ts ./
COPY prisma ./prisma
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder?schema=public"
RUN npm run db:generate

COPY src ./src
RUN npm run build

# ---- runtime ----------------------------------------------------------------
# Ships the compiled app plus the full source tree, Prisma CLI and tsx.
# The Prisma CLI is needed by the `migrations` service (`npm run db:deploy`)
# and tsx + src/scripts are needed to run `npm run generate:data` on demand.
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src ./src
COPY tsconfig.json ./
COPY prisma.config.ts ./
COPY prisma ./prisma

USER node

EXPOSE 3000

CMD ["npm", "start"]
