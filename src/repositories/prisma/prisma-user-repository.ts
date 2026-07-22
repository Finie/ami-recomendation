import type { User, UserLearningContext } from "#models/user.js";
import type { UserRepository } from "#repositories/interfaces/user-repository.js";
import {
  toDomainUser,
  toDomainUserLearningContext,
} from "#database/mappers/user-mapper.js";
import type { PrismaClient } from "../../generated/prisma/client.js";

export class PrismaUserRepository implements UserRepository {
  public constructor(private readonly client: PrismaClient) {}

  public async findById(userId: number): Promise<User | null> {
    const row = await this.client.user.findUnique({ where: { userId } });

    return row === null ? null : toDomainUser(row);
  }

  public async findLearningContext(
    userId: number,
  ): Promise<UserLearningContext | null> {
    const row = await this.client.userLearningContext.findUnique({
      where: { userId },
    });

    return row === null ? null : toDomainUserLearningContext(row);
  }
}
