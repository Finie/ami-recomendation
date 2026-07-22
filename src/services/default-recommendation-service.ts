import type { Course } from "../../domain/entities/course.js";

import type {
  CourseRecommendation,
  RecommendationWeights,
  SignalScoreResult,
} from "../../domain/entities/recommendation.js";

import type { CourseRepository } from "../../domain/repositories/course-repository.js";

import type { SurveyRepository } from "../../domain/repositories/survey-repository.js";

import type { UsageEventRepository } from "../../domain/repositories/usage-event-repository.js";

import type { UserRepository } from "../../domain/repositories/user-repository.js";

import type { CourseFilterService } from "../services/course-filter-service.js";

import type { ProfileScoringService } from "../services/profile-scoring-service.js";

import type { RecommendationService } from "../services/recommendation-service.js";

import type { RecommendationWeightService } from "../services/recommendation-weight-service.js";

import type { SurveyScoringService } from "../services/survey-scoring-service.js";

import type { UsageScoringService } from "../services/usage-scoring-service.js";

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
    this.validateLimit(limit);

    const [user, context, survey, usageEvents, courses] = await Promise.all([
      this.userRepository.findById(userId),

      this.userRepository.findLearningContext(userId),

      this.surveyRepository.findByUserId(userId),

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
    profileResult: SignalScoreResult;
    surveyResult: SignalScoreResult;
    usageResult: SignalScoreResult;
    weights: RecommendationWeights;
  }): CourseRecommendation {
    const { course, profileResult, surveyResult, usageResult, weights } = input;

    const finalScore =
      profileResult.score * weights.profile +
      surveyResult.score * weights.survey +
      usageResult.score * weights.usage;

    return {
      course,

      final_score: this.roundScore(finalScore),

      weights,

      signals: {
        profile: profileResult,
        survey: surveyResult,
        usage: usageResult,
      },

      reasons: this.collectReasons(profileResult, surveyResult, usageResult),
    };
  }

  private collectReasons(...results: SignalScoreResult[]): string[] {
    return [...new Set(results.flatMap((result) => result.reasons))];
  }

  private roundScore(score: number): number {
    const boundedScore = Math.max(0, Math.min(1, score));

    return Number(boundedScore.toFixed(4));
  }

  private validateLimit(limit: number): void {
    if (!Number.isInteger(limit) || limit <= 0) {
      throw new Error("Recommendation limit must be a positive integer.");
    }
  }
}
