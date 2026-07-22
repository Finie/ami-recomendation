import type { Course } from "#models/course.js";

import type { SignalScoreResult } from "#models/recommendation.js";

import type { UsageEvent } from "#models/usage-event.js";

import type { UsageScoringService } from "./interface/usage-scoring-service.js";

const STARTED_PROGRESS_THRESHOLD = 50;
const NORMALIZATION_FACTOR = 3;

export class DefaultUsageScoringService implements UsageScoringService {
  public score(
    course: Course,
    usageEvents: UsageEvent[],
    allCourses: Course[],
  ): SignalScoreResult {
    const courseById = new Map(
      allCourses.map((candidate) => [candidate.course_id, candidate]),
    );

    const reasons: string[] = [];

    let signal = 0;

    for (const event of usageEvents) {
      const relatedCourse = courseById.get(event.course_id);

      if (!relatedCourse || relatedCourse.topic !== course.topic) {
        continue;
      }

      if (event.event_type === "completed") {
        signal += 1;

        reasons.push(`Similar topic to a course you completed: ${relatedCourse.title}`);
      } else if (event.event_type === "dropped") {
        signal -= 1;

        reasons.push(`Similar topic to a course you dropped: ${relatedCourse.title}`);
      } else if (
        event.event_type === "started" &&
        event.progress_pct >= STARTED_PROGRESS_THRESHOLD
      ) {
        signal += 0.5;
      }
    }

    const score = signal <= 0 ? 0 : Math.min(1, signal / NORMALIZATION_FACTOR);

    return { score, reasons: [...new Set(reasons)] };
  }
}
