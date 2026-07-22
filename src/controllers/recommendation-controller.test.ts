import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Course } from "#models/course.js";
import type { CourseRecommendation } from "#models/recommendation.js";

const recommendForUser = vi.fn();
const enrich = vi.fn();

vi.mock("../composition-root.js", () => ({
  recommendationService: { recommendForUser },
  recommendationAIEnrichmentService: { enrich },
}));

const { getRecommendationsForUser } = await import(
  "./recommendation-controller.js"
);

function buildCourse(): Course {
  return {
    course_id: 1,
    title: "Project Management Fundamentals",
    topic: "Project Management",
    level: "beginner",
    skills_taught: ["project_management"],
    duration_mins: 30,
    prerequisites: [],
  };
}

function buildRecommendation(): CourseRecommendation {
  return {
    course: buildCourse(),
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

function buildApp() {
  const app = express();
  app.get("/api/users/:userId/recommendations", getRecommendationsForUser);
  return app;
}

beforeEach(() => {
  recommendForUser.mockReset();
  enrich.mockReset();
});

describe("getRecommendationsForUser include_ai_review handling", () => {
  it("does not call the AI enrichment service when include_ai_review is omitted", async () => {
    recommendForUser.mockResolvedValue([buildRecommendation()]);

    const response = await request(buildApp()).get(
      "/api/users/1/recommendations",
    );

    expect(response.status).toBe(200);
    expect(enrich).not.toHaveBeenCalled();
    expect(response.body.recommendations[0].ai_reason).toBeNull();
  });

  it("does not call the AI enrichment service when include_ai_review=false", async () => {
    recommendForUser.mockResolvedValue([buildRecommendation()]);

    const response = await request(buildApp()).get(
      "/api/users/1/recommendations?include_ai_review=false",
    );

    expect(response.status).toBe(200);
    expect(enrich).not.toHaveBeenCalled();
  });

  it("calls the AI enrichment service exactly once when include_ai_review=true", async () => {
    const recommendation = buildRecommendation();
    recommendForUser.mockResolvedValue([recommendation]);
    enrich.mockResolvedValue([{ ...recommendation, ai_reason: "Friendly." }]);

    const response = await request(buildApp()).get(
      "/api/users/1/recommendations?include_ai_review=true",
    );

    expect(response.status).toBe(200);
    expect(enrich).toHaveBeenCalledTimes(1);
    expect(response.body.recommendations[0].ai_reason).toBe("Friendly.");
  });

  it("treats any value other than the exact string 'true' as disabled", async () => {
    recommendForUser.mockResolvedValue([buildRecommendation()]);

    const response = await request(buildApp()).get(
      "/api/users/1/recommendations?include_ai_review=1",
    );

    expect(response.status).toBe(200);
    expect(enrich).not.toHaveBeenCalled();
  });
});
