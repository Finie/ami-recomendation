import type { CourseRecommendation } from "../../domain/entities/recommendation.js";

export interface RecommendationService {
  recommendForUser(
    userId: number,
    limit?: number,
  ): Promise<CourseRecommendation[]>;
}
