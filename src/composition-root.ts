import { prisma } from "#database/prisma-client.js";

import { PrismaCourseRepository } from "#repositories/prisma/prisma-course-repository.js";
import { PrismaUserRepository } from "#repositories/prisma/prisma-user-repository.js";
import { PrismaSurveyRepository } from "#repositories/prisma/prisma-survey-repository.js";
import { PrismaUsageEventRepository } from "#repositories/prisma/prisma-usage-event-repository.js";

export const courseRepository = new PrismaCourseRepository(prisma);

export const userRepository = new PrismaUserRepository(prisma);

export const surveyRepository = new PrismaSurveyRepository(prisma);

export const usageEventRepository = new PrismaUsageEventRepository(prisma);
