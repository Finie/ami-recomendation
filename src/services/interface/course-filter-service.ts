import type { Course } from "../../domain/entities/course.js";

import type { User, UserLearningContext } from "../../domain/entities/user.js";

import type { UsageEvent } from "../../domain/entities/usage-event.js";

export interface CourseFilterInput {
  courses: Course[];
  user: User;
  context: UserLearningContext;
  usageEvents: UsageEvent[];
}

export interface CourseFilterService {
  filter(input: CourseFilterInput): Course[];
}
