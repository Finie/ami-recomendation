import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "../generated/prisma/client.js";
import { createTestPrismaClient } from "./test-prisma-client.js";
import { resetTestDatabase } from "./reset-test-database.js";

/**
 * These tests exercise the real schema against `TEST_DATABASE_URL` (not
 * mocks) so that FK constraints, unique constraints, and cascades are
 * verified as PostgreSQL actually enforces them, per the migration
 * requirements. They require `prisma migrate deploy` to have already been
 * applied to the test database (handled by `src/test/global-setup.ts`).
 */
describe("schema persistence", () => {
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

  it("creates a user and its learning context together", async () => {
    const user = await client.user.create({
      data: {
        role: "Team Lead",
        industry: "Technology",
        companySize: "size_51_200",
        seniority: "mid",
        statedGoal: "Delegate work more effectively",
      },
    });

    await client.userLearningContext.create({
      data: {
        userId: user.userId,
        roleFamily: "leadership",
        activitySegment: "existing",
        primaryTopics: ["leadership", "people_management"],
        secondaryTopics: ["communication"],
        likelySkillGaps: ["delegation", "coaching"],
      },
    });

    const fetched = await client.user.findUniqueOrThrow({
      where: { userId: user.userId },
      include: { learningContext: true },
    });

    expect(fetched.learningContext?.roleFamily).toBe("leadership");
    expect(fetched.learningContext?.primaryTopics).toEqual([
      "leadership",
      "people_management",
    ]);
  });

  it("cascades user deletion to its learning context", async () => {
    const user = await client.user.create({
      data: {
        role: "Accountant",
        industry: "Finance",
        companySize: "size_11_50",
        seniority: "junior",
        statedGoal: "Strengthen financial reporting skills",
      },
    });

    await client.userLearningContext.create({
      data: {
        userId: user.userId,
        roleFamily: "finance",
        activitySegment: "light",
        primaryTopics: ["finance"],
        secondaryTopics: [],
        likelySkillGaps: ["budgeting"],
      },
    });

    await client.user.delete({ where: { userId: user.userId } });

    const remainingContext = await client.userLearningContext.findUnique({
      where: { userId: user.userId },
    });

    expect(remainingContext).toBeNull();
  });

  it("allows at most one survey response per user", async () => {
    const user = await client.user.create({
      data: {
        role: "Sales Representative",
        industry: "Retail",
        companySize: "size_1_10",
        seniority: "entry",
        statedGoal: "Learn the fundamentals of selling",
      },
    });

    await client.surveyResponse.create({
      data: {
        userId: user.userId,
        skillGaps: ["prospecting"],
        goals: ["learn_the_fundamentals_of_selling"],
        preferredTopics: ["sales"],
        confidenceByTopic: { sales: 2 },
        submittedAt: new Date("2025-06-01T00:00:00.000Z"),
      },
    });

    await expect(
      client.surveyResponse.create({
        data: {
          userId: user.userId,
          skillGaps: ["closing"],
          goals: ["improve_closing"],
          preferredTopics: ["sales"],
          confidenceByTopic: { sales: 3 },
          submittedAt: new Date("2025-07-01T00:00:00.000Z"),
        },
      }),
    ).rejects.toThrow();
  });

  it("rejects a course prerequisite that references a nonexistent course", async () => {
    const course = await client.course.create({
      data: {
        title: "Introduction to Delegation",
        topic: "leadership",
        level: "beginner",
        skillsTaught: ["delegation"],
        durationMins: 30,
      },
    });

    await expect(
      client.coursePrerequisite.create({
        data: {
          courseId: course.courseId,
          prerequisiteCourseId: course.courseId + 999_999,
        },
      }),
    ).rejects.toThrow();
  });

  it("cascades course deletion to its usage events", async () => {
    const [user, course] = await Promise.all([
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
          title: "Delegation Fundamentals",
          topic: "leadership",
          level: "beginner",
          skillsTaught: ["delegation"],
          durationMins: 30,
        },
      }),
    ]);

    await client.usageEvent.create({
      data: {
        userId: user.userId,
        courseId: course.courseId,
        eventType: "started",
        progressPct: 10,
        timestamp: new Date("2025-06-01T00:00:00.000Z"),
      },
    });

    await client.course.delete({ where: { courseId: course.courseId } });

    const remainingEvents = await client.usageEvent.findMany({
      where: { courseId: course.courseId },
    });

    expect(remainingEvents).toHaveLength(0);
  });
});
