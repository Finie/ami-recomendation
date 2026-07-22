import type { CourseRecommendation } from "#models/recommendation.js";

export interface AIRecommendationReview {
  course_id: number;
  ai_reason: string;
}

export interface RecommendationAIReviewService {
  review(
    recommendations: CourseRecommendation[],
  ): Promise<AIRecommendationReview[]>;
}
