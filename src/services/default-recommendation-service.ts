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

      reasons: this.collectReasons({
        profile: profileResult,
        survey: surveyResult,
        usage: usageResult,
      }),
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
