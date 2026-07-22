import { env } from "#config/env.js";

import { prisma } from "#database/prisma-client.js";

import { GeminiRecommendationAIReviewService } from "#infrastructure/ai/gemini-recommendation-ai-review-service.js";

import { PrismaCourseRepository } from "#repositories/prisma/prisma-course-repository.js";

import { PrismaSurveyRepository } from "#repositories/prisma/prisma-survey-repository.js";

import { PrismaUsageEventRepository } from "#repositories/prisma/prisma-usage-event-repository.js";

import { PrismaUserRepository } from "#repositories/prisma/prisma-user-repository.js";

import { DefaultCourseFilterService } from "./services/default-course-filter-service.js";

import { DefaultProfileScoringService } from "./services/default-profile-scoring-service.js";

import { DefaultRecommendationService } from "./services/default-recommendation-service.js";

import { DefaultRecommendationWeightService } from "./services/default-recommendation-weight-service.js";

import { DefaultSurveyScoringService } from "./services/default-survey-scoring-service.js";

import { DefaultUsageScoringService } from "./services/default-usage-scoring-service.js";

import { RecommendationAIEnrichmentService } from "./services/recommendation-ai-enrichment-service.js";

const courseRepository = new PrismaCourseRepository(prisma);

const userRepository = new PrismaUserRepository(prisma);

const surveyRepository = new PrismaSurveyRepository(prisma);

const usageEventRepository = new PrismaUsageEventRepository(prisma);

const profileScoringService = new DefaultProfileScoringService();

const surveyScoringService = new DefaultSurveyScoringService();

const usageScoringService = new DefaultUsageScoringService();

const courseFilterService = new DefaultCourseFilterService();

const recommendationWeightService = new DefaultRecommendationWeightService();

export const recommendationService = new DefaultRecommendationService(
  userRepository,
  courseRepository,
  surveyRepository,
  usageEventRepository,
  profileScoringService,
  surveyScoringService,
  usageScoringService,
  courseFilterService,
  recommendationWeightService,
);

const geminiAIReviewService = env.GEMINI_API_KEY
  ? new GeminiRecommendationAIReviewService(
      env.GEMINI_API_KEY,
      env.GEMINI_MODEL,
    )
  : null;

export const recommendationAIEnrichmentService =
  new RecommendationAIEnrichmentService(
    geminiAIReviewService,
    env.AI_REVIEW_TIMEOUT_MS,
  );
