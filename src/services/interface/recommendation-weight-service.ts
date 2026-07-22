import type { UserLearningContext } from "#models/user.js";

import type { SurveyResponse } from "#models/survey-response.js";

import type { UsageEvent } from "#models/usage-event.js";

import type { RecommendationWeights } from "#models/recommendation.js";

export interface RecommendationWeightService {
  getWeights(
    activitySegment: UserLearningContext["activity_segment"],
    survey: SurveyResponse | null,
    usageEvents: UsageEvent[],
  ): RecommendationWeights;
}
