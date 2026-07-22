import { describe, expect, it } from "vitest";

import type { Course } from "#models/course.js";
import type { SignalScoreResult } from "#models/recommendation.js";
import type { User, UserLearningContext } from "#models/user.js";

import type { CourseFilterService } from "./interface/course-filter-service.js";
import type { ProfileScoringService } from "./interface/profile-scoring-service.js";
import type { RecommendationWeightService } from "./interface/recommendation-weight-service.js";
import type { SurveyScoringService } from "./interface/survey-scoring-service.js";
import type { UsageScoringService } from "./interface/usage-scoring-service.js";

import { DefaultRecommendationService } from "./default-recommendation-service.js";

const COURSE: Course = {
  course_id: 161,
  title: "Project Management Fundamentals",
  topic: "Project Management",
  level: "beginner",
  skills_taught: ["project_management", "scope_management", "task_management"],
  duration_mins: 30,
  prerequisites: [],
};

const USER: User = {
  user_id: 1,
  role: "manager",
  industry: "tech",
  company_size: "51-200",
  seniority: "mid",
  stated_goal: "grow",
};

const CONTEXT: UserLearningContext = {
  user_id: 1,
  role_family: "management",
  activity_segment: "starting",
  primary_topics: ["Project Management"],
  secondary_topics: [],
  likely_skill_gaps: ["project_management"],
};

const EMPTY_RESULT: SignalScoreResult = { score: 0, reasons: [] };

function buildService(input: {
  profileResult: SignalScoreResult;
  surveyResult: SignalScoreResult;
  usageResult: SignalScoreResult;
}): DefaultRecommendationService {
  const userRepository = {
    findById: async () => USER,
    findLearningContext: async () => CONTEXT,
  };

  const courseRepository = {
    findAll: async () => [COURSE],
    findById: async () => COURSE,
    findByIds: async () => [COURSE],
  };

  const surveyRepository = {
    findLatestByUserId: async () => null,
  };

  const usageRepository = {
    findByUserId: async () => [],
    findByUserAndCourse: async () => [],
    findCompletedCourseIds: async () => [],
  };

  const profileScoringService: ProfileScoringService = {
    score: () => input.profileResult,
  };

  const surveyScoringService: SurveyScoringService = {
    score: () => input.surveyResult,
  };

  const usageScoringService: UsageScoringService = {
    score: () => input.usageResult,
  };

  const filterService: CourseFilterService = {
    filter: ({ courses }) => courses,
  };

  const weightService: RecommendationWeightService = {
    getWeights: () => ({ profile: 0.5556, survey: 0.4444, usage: 0 }),
  };

  return new DefaultRecommendationService(
    userRepository,
    courseRepository,
    surveyRepository,
    usageRepository,
    profileScoringService,
    surveyScoringService,
    usageScoringService,
    filterService,
    weightService,
  );
}

describe("DefaultRecommendationService reason building", () => {
  it("produces a natural sentence from a topic and skill-gap match", async () => {
    const service = buildService({
      profileResult: {
        score: 0.84,
        reasons: [
          "Matches your primary topic: Project Management",
          "Addresses skill gaps: project_management, scope_management, task_management",
        ],
      },
      surveyResult: {
        score: 0.25,
        reasons: [
          "Matches a topic you selected in your survey: Project Management",
          "Addresses survey skill gaps: project_management",
        ],
      },
      usageResult: EMPTY_RESULT,
    });

    const [recommendation] = await service.recommendForUser(1);

    expect(recommendation.reason).toBe(
      "Because Project Management is one of your learning priorities and you want to strengthen your project management and scope management skills, we recommend Project Management Fundamentals.",
    );
  });

  it("does not repeat the same topic when both profile and survey match it", async () => {
    const service = buildService({
      profileResult: {
        score: 1,
        reasons: ["Matches your primary topic: Project Management"],
      },
      surveyResult: {
        score: 1,
        reasons: [
          "Matches a topic you selected in your survey: Project Management",
        ],
      },
      usageResult: EMPTY_RESULT,
    });

    const [recommendation] = await service.recommendForUser(1);

    const [evidenceClause] = recommendation.reason.split(", we recommend");
    const occurrences = evidenceClause.split("Project Management").length - 1;
    expect(occurrences).toBe(1);
  });

  it("converts underscore-separated skills into readable text", async () => {
    const service = buildService({
      profileResult: {
        score: 0.5,
        reasons: ["Addresses skill gaps: scope_management"],
      },
      surveyResult: EMPTY_RESULT,
      usageResult: EMPTY_RESULT,
    });

    const [recommendation] = await service.recommendForUser(1);

    expect(recommendation.reason).toContain("scope management");
    expect(recommendation.reason).not.toContain("scope_management");
  });

  it("includes no more than two skill names even when more contributed", async () => {
    const service = buildService({
      profileResult: {
        score: 0.5,
        reasons: [
          "Addresses skill gaps: project_management, scope_management, task_management",
        ],
      },
      surveyResult: EMPTY_RESULT,
      usageResult: EMPTY_RESULT,
    });

    const [recommendation] = await service.recommendForUser(1);

    expect(recommendation.reason).toContain("project management");
    expect(recommendation.reason).toContain("scope management");
    expect(recommendation.reason).not.toContain("task management");
  });

  it("produces a complete sentence for a topic-only match", async () => {
    const service = buildService({
      profileResult: EMPTY_RESULT,
      surveyResult: {
        score: 0.4,
        reasons: ["Matches a topic you selected in your survey: Project Management"],
      },
      usageResult: EMPTY_RESULT,
    });

    const [recommendation] = await service.recommendForUser(1);

    expect(recommendation.reason).toBe(
      "Because you selected Project Management as a preferred topic, we recommend Project Management Fundamentals.",
    );
  });

  it("mentions a completed course when usage evidence exists", async () => {
    const service = buildService({
      profileResult: EMPTY_RESULT,
      surveyResult: {
        score: 0.3,
        reasons: ["Addresses survey skill gaps: project_management"],
      },
      usageResult: {
        score: 0.3,
        reasons: [
          "Similar topic to a course you completed: Introduction to Bookkeeping",
        ],
      },
    });

    const [recommendation] = await service.recommendForUser(1);

    expect(recommendation.reason).toContain("Introduction to Bookkeeping");
  });

  it("falls back to a generic sentence when there is no usable evidence", async () => {
    const service = buildService({
      profileResult: EMPTY_RESULT,
      surveyResult: EMPTY_RESULT,
      usageResult: EMPTY_RESULT,
    });

    const [recommendation] = await service.recommendForUser(1);

    expect(recommendation.reason).toBe(
      "Because this course matches your current learning goals and experience level, we recommend Project Management Fundamentals.",
    );
  });

  it("never returns an empty, null, or undefined reason", async () => {
    const service = buildService({
      profileResult: EMPTY_RESULT,
      surveyResult: EMPTY_RESULT,
      usageResult: EMPTY_RESULT,
    });

    const [recommendation] = await service.recommendForUser(1);

    expect(recommendation.reason).toBeTypeOf("string");
    expect(recommendation.reason.length).toBeGreaterThan(0);
  });

  it("keeps the detailed reasons array unchanged alongside the new reason field", async () => {
    const profileReasons = ["Matches your primary topic: Project Management"];
    const surveyReasons = [
      "Matches a topic you selected in your survey: Project Management",
    ];

    const service = buildService({
      profileResult: { score: 0.6, reasons: profileReasons },
      surveyResult: { score: 0.4, reasons: surveyReasons },
      usageResult: EMPTY_RESULT,
    });

    const [recommendation] = await service.recommendForUser(1);

    expect(recommendation.reasons).toEqual([
      { signal: "profile", description: profileReasons[0] },
      { signal: "survey", description: surveyReasons[0] },
    ]);
  });

  it("does not affect scores, weights, contributions, or ordering", async () => {
    const service = buildService({
      profileResult: {
        score: 0.84,
        reasons: ["Matches your primary topic: Project Management"],
      },
      surveyResult: {
        score: 0.25,
        reasons: ["Matches a topic you selected in your survey: Project Management"],
      },
      usageResult: EMPTY_RESULT,
    });

    const recommendations = await service.recommendForUser(1);

    expect(recommendations).toHaveLength(1);
    expect(recommendations[0].signal_scores).toEqual({
      profile: 0.84,
      survey: 0.25,
      usage: 0,
    });
    expect(recommendations[0].weights).toEqual({
      profile: 0.5556,
      survey: 0.4444,
      usage: 0,
    });
    expect(recommendations[0].final_score).toBe(0.5778);
  });
});
