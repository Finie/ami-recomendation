import type { Course } from "#models/course.js";

import type { User, UserLearningContext } from "#models/user.js";

import type { SignalScoreResult } from "#models/recommendation.js";

export interface ProfileScoringService {
  score(
    course: Course,
    user: User,
    context: UserLearningContext,
  ): SignalScoreResult;
}
