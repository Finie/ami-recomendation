import type { Course } from "#models/course.js";

import type {
  CourseFilterInput,
  CourseFilterService,
} from "./interface/course-filter-service.js";

export class DefaultCourseFilterService implements CourseFilterService {
  public filter(input: CourseFilterInput): Course[] {
    const { courses, usageEvents } = input;

    const completedCourseIds = new Set(
      usageEvents
        .filter((event) => event.event_type === "completed")
        .map((event) => event.course_id),
    );

    return courses.filter((course) => {
      if (completedCourseIds.has(course.course_id)) {
        return false;
      }

      return course.prerequisites.every((prerequisiteId) =>
        completedCourseIds.has(prerequisiteId),
      );
    });
  }
}
