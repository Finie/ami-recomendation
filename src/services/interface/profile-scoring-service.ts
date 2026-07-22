import type { Course } from "../../domain/entities/course.js";

import type { User, UserLearningContext } from "../../domain/entities/user.js";

import type { SignalScoreResult } from "../../domain/entities/recommendation.js";

export interface ProfileScoringService {
  score(
    course: Course,
    user: User,
    context: UserLearningContext,
  ): SignalScoreResult;
}
