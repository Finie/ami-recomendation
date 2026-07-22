import type { Course } from "#models/course.js";
import type { CourseRepository } from "#repositories/interfaces/course-repository.js";
import {
  courseWithPrerequisites,
  toDomainCourse,
} from "#database/mappers/course-mapper.js";
import type { PrismaClient } from "../../generated/prisma/client.js";

export class PrismaCourseRepository implements CourseRepository {
  public constructor(private readonly client: PrismaClient) {}

  public async findAll(): Promise<Course[]> {
    const rows = await this.client.course.findMany(courseWithPrerequisites);

    return rows.map(toDomainCourse);
  }

  public async findById(courseId: number): Promise<Course | null> {
    const row = await this.client.course.findUnique({
      ...courseWithPrerequisites,
      where: { courseId },
    });

    return row === null ? null : toDomainCourse(row);
  }

  public async findByIds(courseIds: number[]): Promise<Course[]> {
    const rows = await this.client.course.findMany({
      ...courseWithPrerequisites,
      where: { courseId: { in: courseIds } },
    });

    return rows.map(toDomainCourse);
  }
}
