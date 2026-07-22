import type { PrismaClient } from "../generated/prisma/client.js";

/**
 * Wipes every row from the test database in dependency-safe (child before
 * parent) order. Integration tests call this between cases so each test
 * starts from a known-empty state without needing a full migrate reset.
 */
export async function resetTestDatabase(client: PrismaClient): Promise<void> {
  await client.$transaction([
    client.usageEvent.deleteMany(),
    client.surveyResponse.deleteMany(),
    client.userLearningContext.deleteMany(),
    client.coursePrerequisite.deleteMany(),
    client.user.deleteMany(),
    client.course.deleteMany(),
  ]);
}
