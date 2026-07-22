import type { Course } from "#models/course.js";

import type { SignalScoreResult } from "#models/recommendation.js";

import type { SurveyResponse } from "#models/survey-response.js";

import type { SurveyScoringService } from "./interface/survey-scoring-service.js";

const PREFERRED_TOPIC_WEIGHT = 0.4;
const SKILL_GAP_WEIGHT = 0.3;
const CONFIDENCE_WEIGHT = 0.3;

export class DefaultSurveyScoringService implements SurveyScoringService {
  public score(
    course: Course,
    survey: SurveyResponse | null,
  ): SignalScoreResult {
    if (survey === null) {
      return { score: 0, reasons: [] };
    }

    const reasons: string[] = [];

    const preferredTopicScore = survey.preferred_topics.includes(course.topic)
      ? 1
      : 0;

    if (preferredTopicScore > 0) {
      reasons.push(`Matches a topic you selected in your survey: ${course.topic}`);
    }

    const matchedSkillGaps = course.skills_taught.filter((skill) =>
      survey.skill_gaps.includes(skill),
    );

    const skillGapScore =
      survey.skill_gaps.length === 0
        ? 0
        : matchedSkillGaps.length / survey.skill_gaps.length;

    if (matchedSkillGaps.length > 0) {
      reasons.push(`Addresses survey skill gaps: ${matchedSkillGaps.join(", ")}`);
    }

    const confidence = survey.confidence_by_topic[course.topic];

    const confidenceScore = confidence === undefined ? 0.5 : 1 - confidence;

    if (confidence !== undefined && confidence < 0.5) {
      reasons.push(`Low reported confidence in ${course.topic}`);
    }

    const score =
      preferredTopicScore * PREFERRED_TOPIC_WEIGHT +
      skillGapScore * SKILL_GAP_WEIGHT +
      confidenceScore * CONFIDENCE_WEIGHT;

    return { score: Math.max(0, Math.min(1, score)), reasons };
  }
}
