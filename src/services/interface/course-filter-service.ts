import type { Course } from "#models/course.js";

import type { User, UserLearningContext } from "#models/user.js";

import type { UsageEvent } from "#models/usage-event.js";

export interface CourseFilterInput {
  courses: Course[];
  user: User;
  context: UserLearningContext;
  usageEvents: UsageEvent[];
}

export interface CourseFilterService {
  filter(input: CourseFilterInput): Course[];
}
