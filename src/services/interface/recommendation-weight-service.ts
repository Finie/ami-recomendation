import type { UserLearningContext } from "../../domain/entities/user.js";

import type { SurveyResponse } from "../../domain/entities/survey-response.js";

import type { UsageEvent } from "../../domain/entities/usage-event.js";

import type { RecommendationWeights } from "../../domain/entities/recommendation.js";

export interface RecommendationWeightService {
  getWeights(
    activitySegment: UserLearningContext["activity_segment"],
    survey: SurveyResponse | null,
    usageEvents: UsageEvent[],
  ): RecommendationWeights;
}
