import type { Course } from "../../domain/entities/course.js";

import type { UsageEvent } from "../../domain/entities/usage-event.js";

import type { SignalScoreResult } from "../../domain/entities/recommendation.js";

export interface UsageScoringService {
  score(
    course: Course,
    usageEvents: UsageEvent[],
    allCourses: Course[],
  ): SignalScoreResult;
}
