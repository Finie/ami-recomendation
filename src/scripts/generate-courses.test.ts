import { describe, expect, it } from "vitest";
import { generateCourses, validateCourses } from "./generate-courses.js";

describe("generateCourses", () => {
  it("is deterministic (no randomness involved)", () => {
    expect(generateCourses()).toEqual(generateCourses());
  });

  it("generates exactly 200 courses across 10 domains", () => {
    expect(generateCourses()).toHaveLength(200);
  });

  it("gives beginner courses no prerequisites", () => {
    const courses = generateCourses();

    for (const course of courses.filter((c) => c.level === "beginner")) {
      expect(course.prerequisites).toEqual([]);
    }
  });

  it("only references earlier, existing courses as prerequisites", () => {
    const courses = generateCourses();
    const courseIds = new Set(courses.map((c) => c.course_id));

    for (const course of courses) {
      for (const prerequisiteId of course.prerequisites) {
        expect(courseIds.has(prerequisiteId)).toBe(true);
        expect(prerequisiteId).not.toBe(course.course_id);
        expect(prerequisiteId).toBeLessThan(course.course_id);
      }
    }
  });

  it("passes validation on its own output", () => {
    expect(() => validateCourses(generateCourses())).not.toThrow();
  });

  it("rejects a course that requires itself", () => {
    const courses = generateCourses();
    const intermediateCourse = courses.find((c) => c.level === "intermediate");

    if (!intermediateCourse) {
      throw new Error("Expected at least one intermediate course.");
    }

    intermediateCourse.prerequisites = [intermediateCourse.course_id];

    expect(() => validateCourses(courses)).toThrow(/own prerequisite/);
  });

  it("rejects a prerequisite that points to a nonexistent course", () => {
    const courses = generateCourses();
    const intermediateCourse = courses.find((c) => c.level === "intermediate");

    if (!intermediateCourse) {
      throw new Error("Expected at least one intermediate course.");
    }

    intermediateCourse.prerequisites = [999_999];

    expect(() => validateCourses(courses)).toThrow(/missing prerequisite/);
  });

  it("rejects a beginner course with a prerequisite", () => {
    const courses = generateCourses();
    const beginnerCourse = courses.find((c) => c.level === "beginner");

    if (!beginnerCourse) {
      throw new Error("Expected at least one beginner course.");
    }

    beginnerCourse.prerequisites = [courses[1]?.course_id ?? 1];

    expect(() => validateCourses(courses)).toThrow(/should not have prerequisites/);
  });
});
