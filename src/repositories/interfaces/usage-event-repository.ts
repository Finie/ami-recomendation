import type { UsageEvent } from "#models/usage-event.js";

export interface UsageEventRepository {
  findByUserId(userId: number): Promise<UsageEvent[]>;

  findByUserAndCourse(userId: number, courseId: number): Promise<UsageEvent[]>;

  /**
   * Course IDs the user has a "completed" event for. Lets the
   * recommendation engine exclude courses already finished without
   * having to filter full usage-event histories itself.
   */
  findCompletedCourseIds(userId: number): Promise<number[]>;
}
