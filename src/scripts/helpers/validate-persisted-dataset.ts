import { prisma } from "#database/prisma-client.js";

export interface DatasetSummary {
  courses: number;
  prerequisiteLinks: number;
  users: number;
  learningContexts: number;
  surveyResponses: number;
  usageEvents: number;
  startedEvents: number;
  completedEvents: number;
  droppedEvents: number;
}

const EXPECTED_COURSE_COUNT = 200;
const COURSE_COUNT_TOLERANCE = 10;

const EXPECTED_USER_COUNT = 1_000;
const USER_COUNT_TOLERANCE = 50;

const MINIMUM_SURVEY_COMPLETION_RATE = 0.7;

/**
 * Re-queries the persisted dataset through Prisma — never trusting that
 * insert calls completing without error means the data is actually
 * correct — and throws on any structural invariant violation. Returns a
 * summary for the orchestrator to print.
 */
export async function validatePersistedDataset(): Promise<DatasetSummary> {
  const [
    courseCount,
    prerequisiteLinkCount,
    userCount,
    learningContextCount,
    surveyResponseCount,
    usageEventCount,
    startedEventCount,
    completedEventCount,
    droppedEventCount,
    usersWithoutContext,
    orphanedPrerequisiteLinks,
    selfReferencingPrerequisites,
    startingUsersWithUsageEvents,
    incompleteCompletedEvents,
    outOfRangeQuizScores,
    completedWithoutStarted,
  ] = await Promise.all([
    prisma.course.count(),
    prisma.coursePrerequisite.count(),
    prisma.user.count(),
    prisma.userLearningContext.count(),
    prisma.surveyResponse.count(),
    prisma.usageEvent.count(),
    prisma.usageEvent.count({ where: { eventType: "started" } }),
    prisma.usageEvent.count({ where: { eventType: "completed" } }),
    prisma.usageEvent.count({ where: { eventType: "dropped" } }),
    prisma.user.count({ where: { learningContext: null } }),
    prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT count(*)::bigint AS count FROM course_prerequisites cp
       WHERE NOT EXISTS (SELECT 1 FROM courses c WHERE c.course_id = cp.course_id)
          OR NOT EXISTS (SELECT 1 FROM courses c WHERE c.course_id = cp.prerequisite_course_id);`,
    ),
    prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      "SELECT count(*)::bigint AS count FROM course_prerequisites WHERE course_id = prerequisite_course_id;",
    ),
    prisma.usageEvent.count({
      where: { user: { learningContext: { activitySegment: "starting" } } },
    }),
    prisma.usageEvent.count({
      where: { eventType: "completed", progressPct: { not: 100 } },
    }),
    prisma.usageEvent.count({
      where: {
        quizScore: { not: null },
        OR: [{ quizScore: { lt: 0 } }, { quizScore: { gt: 100 } }],
      },
    }),
    prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT count(*)::bigint AS count FROM (
         SELECT DISTINCT user_id, course_id FROM usage_events WHERE event_type IN ('completed', 'dropped')
         EXCEPT
         SELECT DISTINCT user_id, course_id FROM usage_events WHERE event_type = 'started'
       ) AS missing_started;`,
    ),
  ]);

  if (Math.abs(courseCount - EXPECTED_COURSE_COUNT) > COURSE_COUNT_TOLERANCE) {
    throw new Error(
      `Expected approximately ${EXPECTED_COURSE_COUNT} courses, found ${courseCount}.`,
    );
  }

  if (Math.abs(userCount - EXPECTED_USER_COUNT) > USER_COUNT_TOLERANCE) {
    throw new Error(
      `Expected approximately ${EXPECTED_USER_COUNT} users, found ${userCount}.`,
    );
  }

  if (learningContextCount !== userCount || usersWithoutContext !== 0) {
    throw new Error(
      `Expected exactly one learning context per user (${userCount} users, ${learningContextCount} contexts, ${usersWithoutContext} users without a context).`,
    );
  }

  if (surveyResponseCount > userCount) {
    throw new Error(
      `Survey response count (${surveyResponseCount}) exceeds user count (${userCount}) — surveys must be unique per user.`,
    );
  }

  if (surveyResponseCount / userCount < MINIMUM_SURVEY_COMPLETION_RATE) {
    throw new Error(
      `Survey completion rate (${surveyResponseCount}/${userCount}) is implausibly low.`,
    );
  }

  const orphanedPrerequisiteCount = Number(
    orphanedPrerequisiteLinks[0]?.count ?? 0n,
  );

  if (orphanedPrerequisiteCount !== 0) {
    throw new Error(
      `${orphanedPrerequisiteCount} course prerequisite rows reference a nonexistent course.`,
    );
  }

  const selfReferenceCount = Number(
    selfReferencingPrerequisites[0]?.count ?? 0n,
  );

  if (selfReferenceCount !== 0) {
    throw new Error(
      `${selfReferenceCount} course prerequisite rows reference themselves.`,
    );
  }

  if (startingUsersWithUsageEvents !== 0) {
    throw new Error(
      `${startingUsersWithUsageEvents} usage events belong to "starting" segment users, expected 0.`,
    );
  }

  if (incompleteCompletedEvents !== 0) {
    throw new Error(
      `${incompleteCompletedEvents} completed usage events do not have 100% progress.`,
    );
  }

  if (outOfRangeQuizScores !== 0) {
    throw new Error(
      `${outOfRangeQuizScores} usage events have a quiz score outside 0-100.`,
    );
  }

  const missingStartedCount = Number(completedWithoutStarted[0]?.count ?? 0n);

  if (missingStartedCount !== 0) {
    throw new Error(
      `${missingStartedCount} completed/dropped usage events have no matching started event for the same user/course.`,
    );
  }

  return {
    courses: courseCount,
    prerequisiteLinks: prerequisiteLinkCount,
    users: userCount,
    learningContexts: learningContextCount,
    surveyResponses: surveyResponseCount,
    usageEvents: usageEventCount,
    startedEvents: startedEventCount,
    completedEvents: completedEventCount,
    droppedEvents: droppedEventCount,
  };
}

export interface ActivitySegmentCounts {
  starting: number;
  light: number;
  existing: number;
  heavy: number;
}

async function countByActivitySegment(): Promise<ActivitySegmentCounts> {
  const rows = await prisma.userLearningContext.groupBy({
    by: ["activitySegment"],
    _count: { _all: true },
  });

  const counts: ActivitySegmentCounts = {
    starting: 0,
    light: 0,
    existing: 0,
    heavy: 0,
  };

  for (const row of rows) {
    counts[row.activitySegment] = row._count._all;
  }

  return counts;
}

/** Usage events grouped by their user's activity segment. */
async function countUsageEventsByActivitySegment(): Promise<ActivitySegmentCounts> {
  const rows = await prisma.$queryRawUnsafe<
    Array<{ activity_segment: keyof ActivitySegmentCounts; count: bigint }>
  >(
    `SELECT ulc.activity_segment, count(ue.*)::bigint AS count
     FROM user_learning_contexts ulc
     LEFT JOIN usage_events ue ON ue.user_id = ulc.user_id
     GROUP BY ulc.activity_segment;`,
  );

  const counts: ActivitySegmentCounts = {
    starting: 0,
    light: 0,
    existing: 0,
    heavy: 0,
  };

  for (const row of rows) {
    counts[row.activity_segment] = Number(row.count);
  }

  return counts;
}

export async function printActivitySegmentStatistics(): Promise<void> {
  const [usersBySegment, usageEventsBySegment] = await Promise.all([
    countByActivitySegment(),
    countUsageEventsByActivitySegment(),
  ]);

  console.log("Users by activity segment:");
  console.table(usersBySegment);

  console.log("Usage events by activity segment:");
  console.table(usageEventsBySegment);
}
