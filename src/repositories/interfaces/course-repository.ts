import type { Course } from "#models/course.js";

export interface CourseRepository {
  findAll(): Promise<Course[]>;

  findById(courseId: number): Promise<Course | null>;

  findByIds(courseIds: number[]): Promise<Course[]>;
}
