import type { CourseRecommendation } from "#models/recommendation.js";

export interface RecommendationService {
  recommendForUser(
    userId: number,
    limit?: number,
  ): Promise<CourseRecommendation[]>;
}
