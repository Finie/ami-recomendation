import { describe, expect, it, vi } from "vitest";
import type { Course } from "#models/course.js";
import type { User, UserLearningContext } from "#models/user.js";
import type { SurveyResponse } from "#models/survey-response.js";
import type {
  generateUsageEvents as GenerateUsageEvents,
  validateUsageEvents as ValidateUsageEvents,
} from "./generate-usage-events.js";

const courses: Course[] = [
  {
    course_id: 1,
    title: "Leadership Fundamentals",
    topic: "Leadership",
    level: "beginner",
    skills_taught: ["leadership_basics"],
    duration_mins: 30,
    prerequisites: [],
  },
  {
    course_id: 2,
    title: "Practical Leadership",
    topic: "Leadership",
    level: "intermediate",
    skills_taught: ["delegation"],
    duration_mins: 90,
    prerequisites: [1],
  },
];

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
    role: "Team Lead",
    industry: "Technology",
    company_size: "51-200",
    seniority: "mid",
    stated_goal: "Delegate work more effectively",
  },
];

const contexts: UserLearningContext[] = [
  {
    user_id: 1,
    role_family: "leadership",
    activity_segment: "starting",
    primary_topics: ["Leadership"],
    secondary_topics: [],
    likely_skill_gaps: ["delegation"],
  },
  {
    user_id: 2,
    role_family: "leadership",
    activity_segment: "heavy",
    primary_topics: ["Leadership"],
    secondary_topics: [],
    likely_skill_gaps: ["delegation"],
  },
];

const surveys: SurveyResponse[] = [];

async function freshUsageFunctions(): Promise<{
  generateUsageEvents: typeof GenerateUsageEvents;
  validateUsageEvents: typeof ValidateUsageEvents;
}> {
  vi.resetModules();

  return import("./generate-usage-events.js");
}

describe("generateUsageEvents", () => {
  it("is deterministic across independent module instances (fixed seed)", async () => {
    const first = await freshUsageFunctions();
    const second = await freshUsageFunctions();

    expect(
      first.generateUsageEvents(users, courses, contexts, surveys),
    ).toEqual(second.generateUsageEvents(users, courses, contexts, surveys));
  });

  it("gives 'starting' segment users zero usage events", async () => {
    const { generateUsageEvents } = await freshUsageFunctions();
    const { events } = generateUsageEvents(users, courses, contexts, surveys);

    expect(events.some((event) => event.user_id === 1)).toBe(false);
  });

  it("gives completed events exactly 100% progress", async () => {
    const { generateUsageEvents } = await freshUsageFunctions();
    const { events } = generateUsageEvents(users, courses, contexts, surveys);

    for (const event of events.filter((e) => e.event_type === "completed")) {
      expect(event.progress_pct).toBe(100);
    }
  });

  it("passes validation on its own output", async () => {
    const { generateUsageEvents, validateUsageEvents } =
      await freshUsageFunctions();
    const { events } = generateUsageEvents(users, courses, contexts, surveys);

    expect(() =>
      validateUsageEvents(users, courses, contexts, events),
    ).not.toThrow();
  });

  it("rejects an event referencing an unknown course", async () => {
    const { generateUsageEvents, validateUsageEvents } =
      await freshUsageFunctions();
    const { events } = generateUsageEvents(users, courses, contexts, surveys);
    const [first] = events;

    if (!first) {
      throw new Error("Expected at least one generated usage event.");
    }

    first.course_id = 999_999;

    expect(() => validateUsageEvents(users, courses, contexts, events)).toThrow(
      /unknown course/,
    );
  });

  it("rejects a usage event belonging to a starting-segment user", async () => {
    const { validateUsageEvents } = await freshUsageFunctions();

    const invalidEvent = {
      usage_event_id: 1,
      user_id: 1,
      course_id: 2,
      event_type: "started" as const,
      progress_pct: 10,
      quiz_score: null,
      timestamp: new Date().toISOString(),
    };

    expect(() =>
      validateUsageEvents(users, courses, contexts, [invalidEvent]),
    ).toThrow(/should not have usage events/);
  });
});
