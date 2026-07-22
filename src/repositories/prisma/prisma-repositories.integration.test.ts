import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { createTestPrismaClient } from "#test/test-prisma-client.js";
import { resetTestDatabase } from "#test/reset-test-database.js";
import { PrismaCourseRepository } from "./prisma-course-repository.js";
import { PrismaUserRepository } from "./prisma-user-repository.js";
import { PrismaSurveyRepository } from "./prisma-survey-repository.js";
import { PrismaUsageEventRepository } from "./prisma-usage-event-repository.js";

/**
 * Verifies that Prisma-backed repositories return the same domain shapes
 * the JSON-era interfaces promised (human-readable enum strings, plain
 * `number[]` prerequisites) rather than leaking Prisma-specific
 * identifiers or relation objects into recommendation services.
 */
describe("Prisma repositories", () => {
  let client: PrismaClient;

  beforeAll(() => {
    client = createTestPrismaClient();
  });

  afterEach(async () => {
    await resetTestDatabase(client);
  });

  afterAll(async () => {
    await client.$disconnect();
  });

  it("PrismaCourseRepository restores prerequisites as number[] and human-readable topics", async () => {
    const beginner = await client.course.create({
      data: {
        title: "Leadership Fundamentals",
        topic: "leadership",
        level: "beginner",
        skillsTaught: ["leadership_basics"],
        durationMins: 30,
      },
    });

    const intermediate = await client.course.create({
      data: {
        title: "Practical Leadership",
        topic: "leadership",
        level: "intermediate",
        skillsTaught: ["delegation"],
        durationMins: 90,
      },
    });

    await client.coursePrerequisite.create({
      data: {
        courseId: intermediate.courseId,
        prerequisiteCourseId: beginner.courseId,
      },
    });

    const repository = new PrismaCourseRepository(client);

    const found = await repository.findById(intermediate.courseId);

    expect(found).not.toBeNull();
    expect(found?.topic).toBe("Leadership");
    expect(found?.prerequisites).toEqual([beginner.courseId]);

    const all = await repository.findAll();
    expect(all.map((course) => course.course_id).sort()).toEqual(
      [beginner.courseId, intermediate.courseId].sort(),
    );

    const byIds = await repository.findByIds([beginner.courseId]);
    expect(byIds).toHaveLength(1);
    expect(byIds[0]?.prerequisites).toEqual([]);
  });

  it("PrismaUserRepository restores human-readable company size and topics", async () => {
    const user = await client.user.create({
      data: {
        role: "Finance Manager",
        industry: "Financial Services",
        companySize: "size_201_500",
        seniority: "senior",
        statedGoal: "Improve financial planning and forecasting",
      },
    });

    await client.userLearningContext.create({
      data: {
        userId: user.userId,
        roleFamily: "finance",
        activitySegment: "existing",
        primaryTopics: ["finance", "strategy"],
        secondaryTopics: ["leadership"],
        likelySkillGaps: ["financial_planning"],
      },
    });

    const repository = new PrismaUserRepository(client);

    const foundUser = await repository.findById(user.userId);
    expect(foundUser?.company_size).toBe("201-500");
    expect(foundUser?.seniority).toBe("senior");

    const context = await repository.findLearningContext(user.userId);
    expect(context?.primary_topics).toEqual(["Finance", "Strategy"]);
    expect(context?.secondary_topics).toEqual(["Leadership"]);
    expect(context?.activity_segment).toBe("existing");
  });

  it("PrismaSurveyRepository restores human-readable preferred topics", async () => {
    const user = await client.user.create({
      data: {
        role: "Sales Manager",
        industry: "Retail",
        companySize: "size_51_200",
        seniority: "manager",
        statedGoal: "Improve sales team performance",
      },
    });

    await client.surveyResponse.create({
      data: {
        userId: user.userId,
        skillGaps: ["sales_negotiation"],
        goals: ["improve_sales_team_performance"],
        preferredTopics: ["sales", "leadership"],
        confidenceByTopic: { Sales: 3, Leadership: 2 },
        submittedAt: new Date("2025-06-01T00:00:00.000Z"),
      },
    });

    const repository = new PrismaSurveyRepository(client);
    const survey = await repository.findLatestByUserId(user.userId);

    expect(survey?.preferred_topics).toEqual(["Sales", "Leadership"]);
    expect(survey?.confidence_by_topic).toEqual({ Sales: 3, Leadership: 2 });

    const missing = await repository.findLatestByUserId(user.userId + 999_999);
    expect(missing).toBeNull();
  });

  it("PrismaUsageEventRepository filters by user and by user+course", async () => {
    const [user, courseA, courseB] = await Promise.all([
      client.user.create({
        data: {
          role: "Team Lead",
          industry: "Technology",
          companySize: "size_51_200",
          seniority: "mid",
          statedGoal: "Delegate work more effectively",
        },
      }),
      client.course.create({
        data: {
          title: "Leadership Fundamentals",
          topic: "leadership",
          level: "beginner",
          skillsTaught: ["leadership_basics"],
          durationMins: 30,
        },
      }),
      client.course.create({
        data: {
          title: "Sales Fundamentals",
          topic: "sales",
          level: "beginner",
          skillsTaught: ["sales_process"],
          durationMins: 30,
        },
      }),
    ]);

    await client.usageEvent.createMany({
      data: [
        {
          userId: user.userId,
          courseId: courseA.courseId,
          eventType: "started",
          progressPct: 10,
          timestamp: new Date("2025-06-01T00:00:00.000Z"),
        },
        {
          userId: user.userId,
          courseId: courseA.courseId,
          eventType: "completed",
          progressPct: 100,
          quizScore: 88,
          timestamp: new Date("2025-06-05T00:00:00.000Z"),
        },
        {
          userId: user.userId,
          courseId: courseB.courseId,
          eventType: "started",
          progressPct: 20,
          timestamp: new Date("2025-06-02T00:00:00.000Z"),
        },
      ],
    });

    const repository = new PrismaUsageEventRepository(client);

    const allForUser = await repository.findByUserId(user.userId);
    expect(allForUser).toHaveLength(3);

    const forCourseA = await repository.findByUserAndCourse(
      user.userId,
      courseA.courseId,
    );
    expect(forCourseA).toHaveLength(2);
    expect(forCourseA.every((event) => event.course_id === courseA.courseId)).toBe(
      true,
    );

    const completedEvent = forCourseA.find(
      (event) => event.event_type === "completed",
    );
    expect(completedEvent?.progress_pct).toBe(100);
    expect(completedEvent?.quiz_score).toBe(88);
  });
});
