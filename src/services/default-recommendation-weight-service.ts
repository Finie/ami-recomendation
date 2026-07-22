import type { RecommendationWeights } from "#models/recommendation.js";

import type { SurveyResponse } from "#models/survey-response.js";

import type { UsageEvent } from "#models/usage-event.js";

import type { ActivitySegment } from "#models/user.js";

import type { RecommendationWeightService } from "./interface/recommendation-weight-service.js";

const BASE_WEIGHTS_BY_SEGMENT: Record<ActivitySegment, RecommendationWeights> = {
  starting: { profile: 0.5, survey: 0.4, usage: 0.1 },
  light: { profile: 0.4, survey: 0.35, usage: 0.25 },
  existing: { profile: 0.3, survey: 0.3, usage: 0.4 },
  heavy: { profile: 0.25, survey: 0.25, usage: 0.5 },
};

export class DefaultRecommendationWeightService
  implements RecommendationWeightService
{
  public getWeights(
    activitySegment: ActivitySegment,
    survey: SurveyResponse | null,
    usageEvents: UsageEvent[],
  ): RecommendationWeights {
    const weights = { ...BASE_WEIGHTS_BY_SEGMENT[activitySegment] };

    if (survey === null) {
      this.redistribute(weights, "survey");
    }

    if (usageEvents.length === 0) {
      this.redistribute(weights, "usage");
    }

    return this.normalize(weights);
  }

  private redistribute(
    weights: RecommendationWeights,
    signal: keyof RecommendationWeights,
  ): void {
    const remaining = (Object.keys(weights) as (keyof RecommendationWeights)[])
      .filter((key) => key !== signal);

    const remainingTotal = remaining.reduce((sum, key) => sum + weights[key], 0);

    const removedWeight = weights[signal];

    weights[signal] = 0;

    if (remainingTotal === 0) {
      return;
    }

    for (const key of remaining) {
      weights[key] += (weights[key] / remainingTotal) * removedWeight;
    }
  }

  private normalize(weights: RecommendationWeights): RecommendationWeights {
    const total = weights.profile + weights.survey + weights.usage;

    if (total === 0) {
      return { profile: 1, survey: 0, usage: 0 };
    }

    return {
      profile: weights.profile / total,
      survey: weights.survey / total,
      usage: weights.usage / total,
    };
  }
}
