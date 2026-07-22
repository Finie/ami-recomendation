import { describe, expect, it, vi } from "vitest";
import type { CourseTopic } from "#models/course.js";
import type { User, UserLearningContext } from "#models/user.js";
import type {
  generateSurveyResponses as GenerateSurveyResponses,
  validateSurveyResponses as ValidateSurveyResponses,
} from "./generate-surveys.js";

const users: User[] = [
  {
    user_id: 1,
    role: "Team Lead",
    industry: "Technology",
    company_size: "51-200",
    seniority: "mid",
    stated_goal: "Delegate work more effectively",
  },
  {
    user_id: 2,
    role: "Accountant",
    industry: "Financial Services",
    company_size: "201-500",
    seniority: "senior",
    stated_goal: "Improve financial forecasting",
  },
];

const contexts: UserLearningContext[] = [
  {
    user_id: 1,
    role_family: "leadership",
    activity_segment: "existing",
    primary_topics: ["Leadership", "People Management"],
    secondary_topics: ["Communication"],
    likely_skill_gaps: ["delegation", "coaching", "feedback"],
  },
  {
    user_id: 2,
    role_family: "finance",
    activity_segment: "heavy",
    primary_topics: ["Finance"],
    secondary_topics: ["Strategy"],
    likely_skill_gaps: ["budgeting", "cash_flow", "financial_planning"],
  },
];

async function freshSurveyFunctions(): Promise<{
  generateSurveyResponses: typeof GenerateSurveyResponses;
  validateSurveyResponses: typeof ValidateSurveyResponses;
}> {
  vi.resetModules();

  return import("./generate-surveys.js");
}

describe("generateSurveyResponses", () => {
  it("is deterministic across independent module instances (fixed seed)", async () => {
    const first = await freshSurveyFunctions();
    const second = await freshSurveyFunctions();

    expect(first.generateSurveyResponses(users, contexts)).toEqual(
      second.generateSurveyResponses(users, contexts),
    );
  });

  it("produces confidence scores as integers between 1 and 5", async () => {
    const { generateSurveyResponses } = await freshSurveyFunctions();
    const responses = generateSurveyResponses(users, contexts);

    for (const response of responses) {
      for (const confidence of Object.values(response.confidence_by_topic)) {
        expect(Number.isInteger(confidence)).toBe(true);
        expect(confidence).toBeGreaterThanOrEqual(1);
        expect(confidence).toBeLessThanOrEqual(5);
      }
    }
  });

  it("passes validation on its own output", async () => {
    const { generateSurveyResponses, validateSurveyResponses } =
      await freshSurveyFunctions();
    const responses = generateSurveyResponses(users, contexts);

    expect(() => validateSurveyResponses(users, responses)).not.toThrow();
  });

  it("rejects a second survey response for the same user", async () => {
    const { generateSurveyResponses, validateSurveyResponses } =
      await freshSurveyFunctions();
    const responses = generateSurveyResponses(users, contexts);
    const [first] = responses;

    if (!first) {
      throw new Error("Expected at least one generated survey response.");
    }

    responses.push({ ...first, survey_response_id: 999 });

    expect(() => validateSurveyResponses(users, responses)).toThrow(
      /more than one survey response/,
    );
  });

  it("rejects an out-of-range confidence value", async () => {
    const { generateSurveyResponses, validateSurveyResponses } =
      await freshSurveyFunctions();
    const responses = generateSurveyResponses(users, contexts);
    const [first] = responses;

    if (!first) {
      throw new Error("Expected at least one generated survey response.");
    }

    const [topic] = Object.keys(first.confidence_by_topic);

    if (!topic) {
      throw new Error("Expected at least one confidence entry.");
    }

    first.confidence_by_topic = {
      ...first.confidence_by_topic,
      [topic as CourseTopic]: 6,
    };

    expect(() => validateSurveyResponses(users, responses)).toThrow(
      /Invalid confidence/,
    );
  });
});
