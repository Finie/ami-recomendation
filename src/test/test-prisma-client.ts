import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

/**
 * Integration tests must never touch the development database, so this
 * creates a dedicated client bound to `TEST_DATABASE_URL` instead of
 * importing the shared `#database/prisma-client.js` singleton.
 */
export function createTestPrismaClient(): PrismaClient {
  const connectionString = process.env.TEST_DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "TEST_DATABASE_URL is not set; integration tests require a dedicated test database.",
    );
  }

  const adapter = new PrismaPg({ connectionString });

  return new PrismaClient({ adapter });
}
