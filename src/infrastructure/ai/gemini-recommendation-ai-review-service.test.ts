import { describe, expect, it } from "vitest";

import type { Course } from "#models/course.js";
import type { CourseRecommendation } from "#models/recommendation.js";

import {
  GeminiRecommendationAIReviewService,
  parseGeminiReviewResponse,
  validateReviewCoverage,
} from "./gemini-recommendation-ai-review-service.js";

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

function buildRecommendation(courseId: number): CourseRecommendation {
  return {
    course: buildCourse({ course_id: courseId }),
    activity_segment: "starting",
    signal_scores: { profile: 0.8, survey: 0.2, usage: 0 },
    weights: { profile: 0.6, survey: 0.4, usage: 0 },
    weighted_contributions: { profile: 0.48, survey: 0.08, usage: 0 },
    final_score: 0.56,
    reason: "Because this course matches your goals.",
    ai_reason: null,
    reasons: [],
  };
}

describe("parseGeminiReviewResponse", () => {
  it("parses and validates a well-formed response", () => {
    const raw = JSON.stringify({
      reviews: [{ course_id: 1, ai_reason: "Great course for you." }],
    });

    expect(parseGeminiReviewResponse(raw)).toEqual([
      { course_id: 1, ai_reason: "Great course for you." },
    ]);
  });

  it("throws on an empty response", () => {
    expect(() => parseGeminiReviewResponse(undefined)).toThrow(
      "Gemini returned an empty response",
    );
  });

  it("throws on invalid JSON", () => {
    expect(() => parseGeminiReviewResponse("{not json")).toThrow(
      "Gemini returned invalid JSON",
    );
  });

  it("throws when the parsed payload fails schema validation", () => {
    const raw = JSON.stringify({ reviews: [{ course_id: "one" }] });

    expect(() => parseGeminiReviewResponse(raw)).toThrow(
      /schema validation/,
    );
  });

  it("throws when ai_reason exceeds 300 characters", () => {
    const raw = JSON.stringify({
      reviews: [{ course_id: 1, ai_reason: "a".repeat(301) }],
    });

    expect(() => parseGeminiReviewResponse(raw)).toThrow(
      /schema validation/,
    );
  });

  it("throws when ai_reason is empty", () => {
    const raw = JSON.stringify({
      reviews: [{ course_id: 1, ai_reason: "   " }],
    });

    expect(() => parseGeminiReviewResponse(raw)).toThrow(
      /schema validation/,
    );
  });
});

describe("validateReviewCoverage", () => {
  it("returns reviews when every requested course is covered exactly once", () => {
    const recommendations = [buildRecommendation(1), buildRecommendation(2)];

    const reviews = [
      { course_id: 1, ai_reason: "Reason one." },
      { course_id: 2, ai_reason: "Reason two." },
    ];

    expect(validateReviewCoverage(reviews, recommendations)).toEqual(reviews);
  });

  it("rejects an unknown course_id", () => {
    const recommendations = [buildRecommendation(1)];

    const reviews = [
      { course_id: 1, ai_reason: "Reason one." },
      { course_id: 999, ai_reason: "Unknown course." },
    ];

    expect(() => validateReviewCoverage(reviews, recommendations)).toThrow(
      /unknown course_id/,
    );
  });

  it("rejects a duplicate course_id", () => {
    const recommendations = [buildRecommendation(1)];

    const reviews = [
      { course_id: 1, ai_reason: "Reason one." },
      { course_id: 1, ai_reason: "Reason one again." },
    ];

    expect(() => validateReviewCoverage(reviews, recommendations)).toThrow(
      /duplicate course_id/,
    );
  });

  it("rejects a missing review for a requested course", () => {
    const recommendations = [buildRecommendation(1), buildRecommendation(2)];

    const reviews = [{ course_id: 1, ai_reason: "Reason one." }];

    expect(() => validateReviewCoverage(reviews, recommendations)).toThrow(
      /did not return a review/,
    );
  });
});

describe("GeminiRecommendationAIReviewService constructor", () => {
  it("throws when the API key is blank", () => {
    expect(
      () => new GeminiRecommendationAIReviewService("  ", "gemini-2.5-flash"),
    ).toThrow("GEMINI_API_KEY is required");
  });

  it("throws when the model is blank", () => {
    expect(
      () => new GeminiRecommendationAIReviewService("key", "  "),
    ).toThrow("GEMINI_MODEL is required");
  });
});
