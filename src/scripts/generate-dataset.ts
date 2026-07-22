import { prisma } from "#database/prisma-client.js";
import { assertSafeEnvironment } from "./helpers/assert-safe-environment.js";
import { clearSyntheticDataset } from "./helpers/clear-synthetic-dataset.js";
import {
  printActivitySegmentStatistics,
  validatePersistedDataset,
} from "./helpers/validate-persisted-dataset.js";
import { generateAndSaveCourses } from "./generate-courses.js";
import { generateAndSaveUsers } from "./generate-users.js";
import { generateAndSaveSurveys } from "./generate-surveys.js";
import { generateAndSaveUsageEvents } from "./generate-usage-events.js";
import { isMainModule } from "./run-if-main.js";

/**
 * Tables holding an autoincrement id that gets explicit values during
 * seeding (deterministic cross-references need known ids up front). The
 * underlying sequence is realigned after seeding so any future ad hoc
 * `create()` call keeps allocating fresh, non-colliding ids.
 */
const SEQUENCES: ReadonlyArray<{ table: string; column: string }> = [
  { table: "courses", column: "course_id" },
  { table: "users", column: "user_id" },
  { table: "user_learning_contexts", column: "user_learning_context_id" },
  { table: "survey_responses", column: "survey_response_id" },
  { table: "usage_events", column: "usage_event_id" },
];

async function resetSequences(): Promise<void> {
  for (const { table, column } of SEQUENCES) {
    await prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('${table}', '${column}'), COALESCE((SELECT MAX(${column}) FROM ${table}), 1), (SELECT MAX(${column}) FROM ${table}) IS NOT NULL);`,
    );
  }
}

/**
 * Runs the full synthetic dataset pipeline: clear -> generate+save courses
 * -> generate+save users/contexts -> generate+save surveys -> generate+save
 * usage events -> validate. Each stage fails loudly and stops the pipeline;
 * nothing downstream runs on a failed upstream stage. Shared by both
 * `npm run generate:data` and `npx prisma db seed`.
 */
export async function generateDataset(): Promise<void> {
  assertSafeEnvironment();

  console.log("Clearing any previously seeded synthetic dataset...");
  await clearSyntheticDataset();

  console.log("Generating and saving courses...");
  await generateAndSaveCourses();

  console.log("Generating and saving users and learning contexts...");
  await generateAndSaveUsers();

  console.log("Generating and saving survey responses...");
  await generateAndSaveSurveys();

  console.log("Generating and saving usage events...");
  await generateAndSaveUsageEvents();

  await resetSequences();

  const summary = await validatePersistedDataset();

  console.log("Synthetic dataset generated successfully.");
  console.table(summary);

  await printActivitySegmentStatistics();
}

async function main(): Promise<void> {
  try {
    await generateDataset();
  } catch (error: unknown) {
    console.error("Synthetic dataset generation failed:", error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (isMainModule(import.meta.url)) {
  void main();
}
