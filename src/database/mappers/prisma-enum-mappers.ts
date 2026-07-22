import type { CourseTopic } from "#models/course.js";
import type { CompanySize } from "#models/user.js";
import {
  CourseTopic as PrismaCourseTopic,
  CompanySize as PrismaCompanySize,
} from "../../generated/prisma/enums.js";

/**
 * `CourseTopic` and `CompanySize` are stored as Prisma enums whose client
 * identifiers can't be the human-readable domain strings (spaces, digits,
 * "+"). Every other enum (CourseLevel, UsageEventType, Seniority,
 * ActivitySegment) uses identifiers identical to the domain string unions,
 * so those pass through without a mapper.
 */

const courseTopicToPrisma: Record<CourseTopic, PrismaCourseTopic> = {
  Leadership: PrismaCourseTopic.leadership,
  "People Management": PrismaCourseTopic.people_management,
  Communication: PrismaCourseTopic.communication,
  Sales: PrismaCourseTopic.sales,
  "Customer Service": PrismaCourseTopic.customer_service,
  Finance: PrismaCourseTopic.finance,
  Strategy: PrismaCourseTopic.strategy,
  Operations: PrismaCourseTopic.operations,
  "Project Management": PrismaCourseTopic.project_management,
  Entrepreneurship: PrismaCourseTopic.entrepreneurship,
};

const prismaCourseTopicToDomain: Record<PrismaCourseTopic, CourseTopic> = {
  [PrismaCourseTopic.leadership]: "Leadership",
  [PrismaCourseTopic.people_management]: "People Management",
  [PrismaCourseTopic.communication]: "Communication",
  [PrismaCourseTopic.sales]: "Sales",
  [PrismaCourseTopic.customer_service]: "Customer Service",
  [PrismaCourseTopic.finance]: "Finance",
  [PrismaCourseTopic.strategy]: "Strategy",
  [PrismaCourseTopic.operations]: "Operations",
  [PrismaCourseTopic.project_management]: "Project Management",
  [PrismaCourseTopic.entrepreneurship]: "Entrepreneurship",
};

export function toPrismaCourseTopic(topic: CourseTopic): PrismaCourseTopic {
  return courseTopicToPrisma[topic];
}

export function fromPrismaCourseTopic(topic: PrismaCourseTopic): CourseTopic {
  return prismaCourseTopicToDomain[topic];
}

export function toPrismaCourseTopics(
  topics: readonly CourseTopic[],
): PrismaCourseTopic[] {
  return topics.map(toPrismaCourseTopic);
}

export function fromPrismaCourseTopics(
  topics: readonly PrismaCourseTopic[],
): CourseTopic[] {
  return topics.map(fromPrismaCourseTopic);
}

const companySizeToPrisma: Record<CompanySize, PrismaCompanySize> = {
  "1-10": PrismaCompanySize.size_1_10,
  "11-50": PrismaCompanySize.size_11_50,
  "51-200": PrismaCompanySize.size_51_200,
  "201-500": PrismaCompanySize.size_201_500,
  "501-1000": PrismaCompanySize.size_501_1000,
  "1000+": PrismaCompanySize.size_1000_plus,
};

const prismaCompanySizeToDomain: Record<PrismaCompanySize, CompanySize> = {
  [PrismaCompanySize.size_1_10]: "1-10",
  [PrismaCompanySize.size_11_50]: "11-50",
  [PrismaCompanySize.size_51_200]: "51-200",
  [PrismaCompanySize.size_201_500]: "201-500",
  [PrismaCompanySize.size_501_1000]: "501-1000",
  [PrismaCompanySize.size_1000_plus]: "1000+",
};

export function toPrismaCompanySize(
  companySize: CompanySize,
): PrismaCompanySize {
  return companySizeToPrisma[companySize];
}

export function fromPrismaCompanySize(
  companySize: PrismaCompanySize,
): CompanySize {
  return prismaCompanySizeToDomain[companySize];
}
