import "dotenv/config";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Applies the committed migrations to `TEST_DATABASE_URL` before the
 * integration suite runs, so repository/persistence tests exercise a real,
 * schema-accurate PostgreSQL database rather than mocks.
 *
 * Skips (with a warning, not a failure) when there is no test database
 * configured or no migrations have been generated yet, so unit-only test
 * runs still work before the database is provisioned.
 */
export default async function setup(): Promise<void> {
  const testDatabaseUrl = process.env.TEST_DATABASE_URL;

  if (!testDatabaseUrl) {
    console.warn(
      "[global-setup] TEST_DATABASE_URL is not set — skipping migration deploy. Integration tests that require a database will fail.",
    );
    return;
  }

  const migrationsDir = resolve(process.cwd(), "prisma", "migrations");

  if (!existsSync(migrationsDir) || readdirSync(migrationsDir).length === 0) {
    console.warn(
      "[global-setup] No Prisma migrations found — skipping migration deploy. Run `npx prisma migrate dev` first.",
    );
    return;
  }

  try {
    execFileSync("npx", ["prisma", "migrate", "deploy"], {
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL: testDatabaseUrl },
    });
  } catch (error: unknown) {
    // Don't let a broken test database take down unit tests that never
    // touch it — integration tests will fail loudly on their own instead.
    console.warn(
      "[global-setup] `prisma migrate deploy` against TEST_DATABASE_URL failed. Integration tests will fail until the test database's migration history is fixed.",
      error,
    );
  }
}
