import type { CourseTopic } from "#models/course.js";
import type { SurveyResponse } from "#models/survey-response.js";
import { fromPrismaCourseTopics } from "./prisma-enum-mappers.js";
import type { PrismaClient } from "../../generated/prisma/client.js";

type SurveyResponseRow = NonNullable<
  Awaited<ReturnType<PrismaClient["surveyResponse"]["findUnique"]>>
>;

export function toDomainSurveyResponse(row: SurveyResponseRow): SurveyResponse {
  return {
    survey_response_id: row.surveyResponseId,
    user_id: row.userId,
    skill_gaps: row.skillGaps,
    goals: row.goals,
    preferred_topics: fromPrismaCourseTopics(row.preferredTopics),
    confidence_by_topic: row.confidenceByTopic as Partial<
      Record<CourseTopic, number>
    >,
    submitted_at: row.submittedAt.toISOString(),
  };
}
