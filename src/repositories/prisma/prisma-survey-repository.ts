import type { SurveyResponse } from "#models/survey-response.js";
import type { SurveyRepository } from "#repositories/interfaces/survey-repository.js";
import { toDomainSurveyResponse } from "#database/mappers/survey-mapper.js";
import type { PrismaClient } from "../../generated/prisma/client.js";

export class PrismaSurveyRepository implements SurveyRepository {
  public constructor(private readonly client: PrismaClient) {}

  /**
   * Each user has at most one survey response (enforced by a unique
   * constraint on `user_id`), so "latest" reduces to a direct lookup.
   */
  public async findLatestByUserId(
    userId: number,
  ): Promise<SurveyResponse | null> {
    const row = await this.client.surveyResponse.findUnique({
      where: { userId },
    });

    return row === null ? null : toDomainSurveyResponse(row);
  }
}
