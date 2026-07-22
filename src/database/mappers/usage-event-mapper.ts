import type { UsageEvent } from "#models/usage-event.js";
import type { PrismaClient } from "../../generated/prisma/client.js";

type UsageEventRow = Awaited<
  ReturnType<PrismaClient["usageEvent"]["findMany"]>
>[number];

export function toDomainUsageEvent(row: UsageEventRow): UsageEvent {
  return {
    usage_event_id: row.usageEventId,
    user_id: row.userId,
    course_id: row.courseId,
    event_type: row.eventType,
    progress_pct: row.progressPct,
    quiz_score: row.quizScore,
    timestamp: row.timestamp.toISOString(),
  };
}
