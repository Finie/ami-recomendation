import type { User, UserLearningContext } from "#models/user.js";
import {
  fromPrismaCompanySize,
  fromPrismaCourseTopics,
} from "./prisma-enum-mappers.js";
import type { PrismaClient } from "../../generated/prisma/client.js";

type UserRow = NonNullable<
  Awaited<ReturnType<PrismaClient["user"]["findUnique"]>>
>;

type UserLearningContextRow = NonNullable<
  Awaited<ReturnType<PrismaClient["userLearningContext"]["findUnique"]>>
>;

export function toDomainUser(row: UserRow): User {
  return {
    user_id: row.userId,
    role: row.role,
    industry: row.industry,
    company_size: fromPrismaCompanySize(row.companySize),
    seniority: row.seniority,
    stated_goal: row.statedGoal,
  };
}

export function toDomainUserLearningContext(
  row: UserLearningContextRow,
): UserLearningContext {
  return {
    user_id: row.userId,
    role_family: row.roleFamily,
    activity_segment: row.activitySegment,
    primary_topics: fromPrismaCourseTopics(row.primaryTopics),
    secondary_topics: fromPrismaCourseTopics(row.secondaryTopics),
    likely_skill_gaps: row.likelySkillGaps,
  };
}
