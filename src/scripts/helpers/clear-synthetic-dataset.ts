import { prisma } from "#database/prisma-client.js";

/**
 * Deletes any previously seeded synthetic dataset in dependency-safe
 * (child before parent) order, so the pipeline can be rerun deterministically.
 * This is the only place a full wipe happens — individual generators never
 * delete data outside what they themselves are about to reinsert.
 */
export async function clearSyntheticDataset(): Promise<void> {
  try {
    await prisma.$transaction([
      prisma.usageEvent.deleteMany(),
      prisma.surveyResponse.deleteMany(),
      prisma.userLearningContext.deleteMany(),
      prisma.coursePrerequisite.deleteMany(),
      prisma.user.deleteMany(),
      prisma.course.deleteMany(),
    ]);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to clear the previous synthetic dataset: ${message}`);
  }
}
