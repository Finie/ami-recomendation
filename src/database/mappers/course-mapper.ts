import type { Course } from "#models/course.js";
import { fromPrismaCourseTopic } from "./prisma-enum-mappers.js";
import type { Prisma } from "../../generated/prisma/client.js";

export const courseWithPrerequisites = {
  include: { prerequisites: { select: { prerequisiteCourseId: true } } },
} satisfies Prisma.CourseDefaultArgs;

export type CourseRow = Prisma.CourseGetPayload<typeof courseWithPrerequisites>;

export function toDomainCourse(row: CourseRow): Course {
  return {
    course_id: row.courseId,
    title: row.title,
    topic: fromPrismaCourseTopic(row.topic),
    level: row.level,
    skills_taught: row.skillsTaught,
    duration_mins: row.durationMins,
    prerequisites: row.prerequisites.map((link) => link.prerequisiteCourseId),
  };
}
