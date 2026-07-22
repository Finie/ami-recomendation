import type { Course } from "#models/course.js";

import type { UsageEvent } from "#models/usage-event.js";

import type { SignalScoreResult } from "#models/recommendation.js";

export interface UsageScoringService {
  score(
    course: Course,
    usageEvents: UsageEvent[],
    allCourses: Course[],
  ): SignalScoreResult;
}
