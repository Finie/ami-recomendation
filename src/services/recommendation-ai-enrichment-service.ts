import type { CourseRecommendation } from "#models/recommendation.js";

import type { RecommendationAIReviewService } from "./recommendation-ai-review-service.js";

export class RecommendationAIEnrichmentService {
  public constructor(
    private readonly aiReviewService: RecommendationAIReviewService | null,
    private readonly timeoutMs: number,
  ) {}

  public async enrich(
    recommendations: CourseRecommendation[],
  ): Promise<CourseRecommendation[]> {
    if (recommendations.length === 0 || this.aiReviewService === null) {
      return this.withNullAIReasons(recommendations);
    }

    try {
      const reviews = await this.withTimeout(
        this.aiReviewService.review(recommendations),
        this.timeoutMs,
      );

      const reviewByCourseId = new Map(
        reviews.map((review) => [review.course_id, review.ai_reason]),
      );

      return recommendations.map((recommendation) => ({
        ...recommendation,
        ai_reason:
          reviewByCourseId.get(recommendation.course.course_id) ?? null,
      }));
    } catch (error) {
      console.error(
        "Failed to generate Gemini recommendation explanations",
        error,
      );

      return this.withNullAIReasons(recommendations);
    }
  }

  private withNullAIReasons(
    recommendations: CourseRecommendation[],
  ): CourseRecommendation[] {
    return recommendations.map((recommendation) => ({
      ...recommendation,
      ai_reason: null,
    }));
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
  ): Promise<T> {
    let timeoutHandle: ReturnType<typeof setTimeout>;

    const timeout = new Promise<never>((_resolve, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error(`AI review timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      return await Promise.race([promise, timeout]);
    } finally {
      clearTimeout(timeoutHandle!);
    }
  }
}
