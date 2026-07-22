import { describe, expect, it } from "vitest";

import type { Course } from "#models/course.js";
import type { CourseRecommendation } from "#models/recommendation.js";

import type {
  AIRecommendationReview,
  RecommendationAIReviewService,
} from "./recommendation-ai-review-service.js";

import { RecommendationAIEnrichmentService } from "./recommendation-ai-enrichment-service.js";

function buildCourse(overrides: Partial<Course> = {}): Course {
  return {
    course_id: 1,
    title: "Project Management Fundamentals",
    topic: "Project Management",
    level: "beginner",
    skills_taught: ["project_management"],
    duration_mins: 30,
    prerequisites: [],
    ...overrides,
  };
}

function buildRecommendation(
  overrides: Partial<CourseRecommendation> = {},
): CourseRecommendation {
  return {
    course: buildCourse(),
    activity_segment: "starting",
    signal_scores: { profile: 0.8, survey: 0.2, usage: 0 },
    weights: { profile: 0.6, survey: 0.4, usage: 0 },
    weighted_contributions: { profile: 0.48, survey: 0.08, usage: 0 },
    final_score: 0.56,
    reason: "Because Project Management is one of your learning priorities.",
    ai_reason: null,
    reasons: [{ signal: "profile", description: "Matches your primary topic: Project Management" }],
    ...overrides,
  };
}

class FakeAIReviewService implements RecommendationAIReviewService {
  public callCount = 0;
  public lastRecommendations: CourseRecommendation[] = [];

  constructor(
    private readonly behavior:
      | { type: "success"; reviews: AIRecommendationReview[] }
      | { type: "error"; error: Error }
      | { type: "delay"; ms: number; reviews: AIRecommendationReview[] },
  ) {}

  async review(
    recommendations: CourseRecommendation[],
  ): Promise<AIRecommendationReview[]> {
    this.callCount += 1;
    this.lastRecommendations = recommendations;

    if (this.behavior.type === "error") {
      throw this.behavior.error;
    }

    if (this.behavior.type === "delay") {
      await new Promise((resolve) => setTimeout(resolve, this.behavior.ms));
      return this.behavior.reviews;
    }

    return this.behavior.reviews;
  }
}

describe("RecommendationAIEnrichmentService", () => {
  it("attaches ai_reason using course_id and preserves recommendation order", async () => {
    const recommendations = [
      buildRecommendation({ course: buildCourse({ course_id: 1 }) }),
      buildRecommendation({ course: buildCourse({ course_id: 2 }) }),
    ];

    const fake = new FakeAIReviewService({
      type: "success",
      reviews: [
        { course_id: 2, ai_reason: "Great fit for course two." },
        { course_id: 1, ai_reason: "Great fit for course one." },
      ],
    });

    const service = new RecommendationAIEnrichmentService(fake, 5000);

    const result = await service.enrich(recommendations);

    expect(result.map((r) => r.course.course_id)).toEqual([1, 2]);
    expect(result[0]?.ai_reason).toBe("Great fit for course one.");
    expect(result[1]?.ai_reason).toBe("Great fit for course two.");
  });

  it("does not change reason, reasons, scores, weights, or final_score", async () => {
    const recommendation = buildRecommendation();

    const fake = new FakeAIReviewService({
      type: "success",
      reviews: [{ course_id: 1, ai_reason: "Friendly explanation." }],
    });

    const service = new RecommendationAIEnrichmentService(fake, 5000);

    const [result] = await service.enrich([recommendation]);

    expect(result?.reason).toBe(recommendation.reason);
    expect(result?.reasons).toEqual(recommendation.reasons);
    expect(result?.signal_scores).toEqual(recommendation.signal_scores);
    expect(result?.weights).toEqual(recommendation.weights);
    expect(result?.weighted_contributions).toEqual(
      recommendation.weighted_contributions,
    );
    expect(result?.final_score).toBe(recommendation.final_score);
    expect(result?.course).toEqual(recommendation.course);
  });

  it("sends all recommendations in a single review call rather than one per course", async () => {
    const recommendations = Array.from({ length: 5 }, (_, index) =>
      buildRecommendation({ course: buildCourse({ course_id: index + 1 }) }),
    );

    const fake = new FakeAIReviewService({
      type: "success",
      reviews: recommendations.map((r) => ({
        course_id: r.course.course_id,
        ai_reason: `Reason for ${r.course.course_id}`,
      })),
    });

    const service = new RecommendationAIEnrichmentService(fake, 5000);

    await service.enrich(recommendations);

    expect(fake.callCount).toBe(1);
    expect(fake.lastRecommendations).toHaveLength(5);
  });

  it("falls back to ai_reason: null when the AI service throws", async () => {
    const recommendations = [buildRecommendation()];

    const fake = new FakeAIReviewService({
      type: "error",
      error: new Error("Gemini network error"),
    });

    const service = new RecommendationAIEnrichmentService(fake, 5000);

    const result = await service.enrich(recommendations);

    expect(result[0]?.ai_reason).toBeNull();
  });

  it("falls back to ai_reason: null when the AI service times out", async () => {
    const recommendations = [buildRecommendation()];

    const fake = new FakeAIReviewService({
      type: "delay",
      ms: 200,
      reviews: [{ course_id: 1, ai_reason: "Too slow." }],
    });

    const service = new RecommendationAIEnrichmentService(fake, 20);

    const result = await service.enrich(recommendations);

    expect(result[0]?.ai_reason).toBeNull();
  });

  it("does not call the AI service and returns ai_reason: null when the service is null", async () => {
    const recommendations = [buildRecommendation()];

    const service = new RecommendationAIEnrichmentService(null, 5000);

    const result = await service.enrich(recommendations);

    expect(result[0]?.ai_reason).toBeNull();
  });

  it("does not call the AI service for an empty recommendation list", async () => {
    const fake = new FakeAIReviewService({ type: "success", reviews: [] });

    const service = new RecommendationAIEnrichmentService(fake, 5000);

    const result = await service.enrich([]);

    expect(result).toEqual([]);
    expect(fake.callCount).toBe(0);
  });

  it("always returns ai_reason as a non-empty string or null", async () => {
    const recommendations = [
      buildRecommendation({ course: buildCourse({ course_id: 1 }) }),
      buildRecommendation({ course: buildCourse({ course_id: 2 }) }),
    ];

    const fake = new FakeAIReviewService({
      type: "success",
      reviews: [{ course_id: 1, ai_reason: "A valid reason." }],
    });

    const service = new RecommendationAIEnrichmentService(fake, 5000);

    const result = await service.enrich(recommendations);

    for (const recommendation of result) {
      if (recommendation.ai_reason !== null) {
        expect(typeof recommendation.ai_reason).toBe("string");
        expect(recommendation.ai_reason.length).toBeGreaterThan(0);
      }
    }

    expect(result[1]?.ai_reason).toBeNull();
  });
});
