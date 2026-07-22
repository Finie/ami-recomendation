import type { Course } from "#models/course.js";

import type { SignalScoreResult } from "#models/recommendation.js";

import type { User, UserLearningContext } from "#models/user.js";

import type { ProfileScoringService } from "./interface/profile-scoring-service.js";

const PRIMARY_TOPIC_WEIGHT = 0.6;
const SKILL_GAP_WEIGHT = 0.4;

export class DefaultProfileScoringService implements ProfileScoringService {
  public score(
    course: Course,
    _user: User,
    context: UserLearningContext,
  ): SignalScoreResult {
    const reasons: string[] = [];

    let topicScore = 0;

    if (context.primary_topics.includes(course.topic)) {
      topicScore = 1;

      reasons.push(`Matches your primary topic: ${course.topic}`);
    } else if (context.secondary_topics.includes(course.topic)) {
      topicScore = 0.5;

      reasons.push(`Matches your secondary topic: ${course.topic}`);
    }

    const matchedSkillGaps = course.skills_taught.filter((skill) =>
      context.likely_skill_gaps.includes(skill),
    );

    const skillGapScore =
      context.likely_skill_gaps.length === 0
        ? 0
        : matchedSkillGaps.length / context.likely_skill_gaps.length;

    if (matchedSkillGaps.length > 0) {
      reasons.push(`Addresses skill gaps: ${matchedSkillGaps.join(", ")}`);
    }

    const score =
      topicScore * PRIMARY_TOPIC_WEIGHT + skillGapScore * SKILL_GAP_WEIGHT;

    return { score: Math.min(1, score), reasons };
  }
}
