import type { Course } from "#models/course.js";

import type {
  CourseRecommendation,
  RecommendationReason,
  RecommendationWeights,
  SignalScoreResult,
} from "#models/recommendation.js";

import type { ActivitySegment } from "#models/user.js";

import type { CourseRepository } from "#repositories/interfaces/course-repository.js";

import type { SurveyRepository } from "#repositories/interfaces/survey-repository.js";

import type { UsageEventRepository } from "#repositories/interfaces/usage-event-repository.js";

import type { UserRepository } from "#repositories/interfaces/user-repository.js";

import type { CourseFilterService } from "./interface/course-filter-service.js";

import type { ProfileScoringService } from "./interface/profile-scoring-service.js";

import type { RecommendationService } from "./interface/recommendation-service.js";

import type { RecommendationWeightService } from "./interface/recommendation-weight-service.js";

import type { SurveyScoringService } from "./interface/survey-scoring-service.js";

import type { UsageScoringService } from "./interface/usage-scoring-service.js";

export class DefaultRecommendationService implements RecommendationService {
  public constructor(
    private readonly userRepository: UserRepository,

    private readonly courseRepository: CourseRepository,

    private readonly surveyRepository: SurveyRepository,

    private readonly usageRepository: UsageEventRepository,

    private readonly profileScoringService: ProfileScoringService,

    private readonly surveyScoringService: SurveyScoringService,

    private readonly usageScoringService: UsageScoringService,

    private readonly filterService: CourseFilterService,

    private readonly weightService: RecommendationWeightService,
  ) {}

  public async recommendForUser(
    userId: number,
    limit = 10,
  ): Promise<CourseRecommendation[]> {
    this.validateInput(userId, limit);

    const [user, context, survey, usageEvents, courses] = await Promise.all([
      this.userRepository.findById(userId),

      this.userRepository.findLearningContext(userId),

      this.surveyRepository.findLatestByUserId(userId),

      this.usageRepository.findByUserId(userId),

      this.courseRepository.findAll(),
    ]);

    if (user === null) {
      throw new Error(`User ${userId} was not found.`);
    }

    if (context === null) {
      throw new Error(`Learning context for user ${userId} was not found.`);
    }

    const candidateCourses = this.filterService.filter({
      courses,
      user,
      context,
      usageEvents,
    });

    const weights = this.weightService.getWeights(
      context.activity_segment,
      survey,
      usageEvents,
    );

    return candidateCourses
      .map((course) => {
        const profileResult = this.profileScoringService.score(
          course,
          user,
          context,
        );

        const surveyResult = this.surveyScoringService.score(course, survey);

        const usageResult = this.usageScoringService.score(
          course,
          usageEvents,
          courses,
        );

        return this.buildRecommendation({
          course,
          activitySegment: context.activity_segment,
          profileResult,
          surveyResult,
          usageResult,
          weights,
        });
      })
      .sort((first, second) => second.final_score - first.final_score)
      .slice(0, limit);
  }

  private buildRecommendation(input: {
    course: Course;
    activitySegment: ActivitySegment;
    profileResult: SignalScoreResult;
    surveyResult: SignalScoreResult;
    usageResult: SignalScoreResult;
    weights: RecommendationWeights;
  }): CourseRecommendation {
    const {
      course,
      activitySegment,
      profileResult,
      surveyResult,
      usageResult,
      weights,
    } = input;

    const weightedContributions = {
      profile: profileResult.score * weights.profile,
      survey: surveyResult.score * weights.survey,
      usage: usageResult.score * weights.usage,
    };

    const finalScore =
      weightedContributions.profile +
      weightedContributions.survey +
      weightedContributions.usage;

    const reasons = this.collectReasons({
      profile: profileResult,
      survey: surveyResult,
      usage: usageResult,
    });

    return {
      course,

      activity_segment: activitySegment,

      signal_scores: {
        profile: profileResult.score,
        survey: surveyResult.score,
        usage: usageResult.score,
      },

      weights,

      weighted_contributions: weightedContributions,

      final_score: this.roundScore(finalScore),

      reason: this.buildUserFacingReason(course, reasons),

      reasons,
    };
  }

  private collectReasons(results: {
    profile: SignalScoreResult;
    survey: SignalScoreResult;
    usage: SignalScoreResult;
  }): RecommendationReason[] {
    const reasons = (
      Object.entries(results) as [RecommendationReason["signal"], SignalScoreResult][]
    ).flatMap(([signal, result]) =>
      result.reasons.map((description) => ({ signal, description })),
    );

    const seen = new Set<string>();

    return reasons.filter(({ signal, description }) => {
      const key = `${signal}:${description}`;

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);

      return true;
    });
  }

  private buildUserFacingReason(
    course: Course,
    reasons: RecommendationReason[],
  ): string {
    const descriptions = reasons.map((reason) => reason.description);

    const clauses = [
      this.buildTopicClause(descriptions, course.topic),
      this.buildSkillClause(descriptions),
      this.buildUsageClause(descriptions),
    ]
      .filter((clause): clause is string => clause !== undefined)
      .slice(0, 2);

    if (clauses.length === 0) {
      return `Because this course matches your current learning goals and experience level, we recommend ${course.title}.`;
    }

    return `Because ${clauses.join(" and ")}, we recommend ${course.title}.`;
  }

  private buildTopicClause(
    descriptions: string[],
    topic: string,
  ): string | undefined {
    if (descriptions.some((d) => d.startsWith("Matches your primary topic:"))) {
      return `${topic} is one of your learning priorities`;
    }

    if (
      descriptions.some((d) =>
        d.startsWith("Matches a topic you selected in your survey:"),
      )
    ) {
      return `you selected ${topic} as a preferred topic`;
    }

    if (
      descriptions.some((d) => d.startsWith("Matches your secondary topic:"))
    ) {
      return `${topic} matches one of your areas of interest`;
    }

    return undefined;
  }

  private buildSkillClause(descriptions: string[]): string | undefined {
    const skills = this.extractSkills(descriptions);

    if (skills.length === 0) {
      return undefined;
    }

    const humanized = skills.slice(0, 2).map((skill) => skill.replace(/_/g, " "));

    const skillList =
      humanized.length === 1
        ? humanized[0]
        : `${humanized[0]} and ${humanized[1]}`;

    return `you want to strengthen your ${skillList} skills`;
  }

  private extractSkills(descriptions: string[]): string[] {
    const prefixes = ["Addresses skill gaps: ", "Addresses survey skill gaps: "];

    const skills: string[] = [];
    const seen = new Set<string>();

    for (const prefix of prefixes) {
      const match = descriptions.find((d) => d.startsWith(prefix));

      if (!match) {
        continue;
      }

      const listed = match
        .slice(prefix.length)
        .split(",")
        .map((skill) => skill.trim())
        .filter((skill) => skill.length > 0);

      for (const skill of listed) {
        if (!seen.has(skill)) {
          seen.add(skill);
          skills.push(skill);
        }
      }
    }

    return skills;
  }

  private buildUsageClause(descriptions: string[]): string | undefined {
    const prefix = "Similar topic to a course you completed: ";

    const match = descriptions.find((d) => d.startsWith(prefix));

    if (!match) {
      return undefined;
    }

    return `completed ${match.slice(prefix.length)}`;
  }

  private roundScore(score: number): number {
    const boundedScore = Math.max(0, Math.min(1, score));

    return Number(boundedScore.toFixed(4));
  }

  private validateInput(userId: number, limit: number): void {
    this.validateUserId(userId);
    this.validateLimit(limit);
  }

  private validateUserId(userId: number): void {
    if (!Number.isInteger(userId) || userId <= 0) {
      throw new Error("User id must be a positive integer.");
    }
  }

  private validateLimit(limit: number): void {
    if (!Number.isInteger(limit) || limit <= 0) {
      throw new Error("Recommendation limit must be a positive integer.");
    }
  }
}
