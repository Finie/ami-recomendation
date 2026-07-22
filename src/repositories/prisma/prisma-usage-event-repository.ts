import type { UsageEvent } from "#models/usage-event.js";
import type { UsageEventRepository } from "#repositories/interfaces/usage-event-repository.js";
import { toDomainUsageEvent } from "#database/mappers/usage-event-mapper.js";
import type { PrismaClient } from "../../generated/prisma/client.js";

export class PrismaUsageEventRepository implements UsageEventRepository {
  public constructor(private readonly client: PrismaClient) {}

  public async findByUserId(userId: number): Promise<UsageEvent[]> {
    const rows = await this.client.usageEvent.findMany({ where: { userId } });

    return rows.map(toDomainUsageEvent);
  }

  public async findByUserAndCourse(
    userId: number,
    courseId: number,
  ): Promise<UsageEvent[]> {
    const rows = await this.client.usageEvent.findMany({
      where: { userId, courseId },
    });

    return rows.map(toDomainUsageEvent);
  }

  public async findCompletedCourseIds(userId: number): Promise<number[]> {
    const rows = await this.client.usageEvent.findMany({
      where: { userId, eventType: "completed" },
      select: { courseId: true },
      distinct: ["courseId"],
    });

    return rows.map((row) => row.courseId);
  }
}
