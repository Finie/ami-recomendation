import type { SurveyResponse } from "#models/survey-response.js";

export interface SurveyRepository {
  findLatestByUserId(userId: number): Promise<SurveyResponse | null>;
}
