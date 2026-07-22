import { describe, expect, it } from "vitest";
import type { CourseTopic } from "#models/course.js";
import type { CompanySize } from "#models/user.js";
import {
  fromPrismaCompanySize,
  fromPrismaCourseTopic,
  fromPrismaCourseTopics,
  toPrismaCompanySize,
  toPrismaCourseTopic,
  toPrismaCourseTopics,
} from "./prisma-enum-mappers.js";

const ALL_COURSE_TOPICS: CourseTopic[] = [
  "Leadership",
  "People Management",
  "Communication",
  "Sales",
  "Customer Service",
  "Finance",
  "Strategy",
  "Operations",
  "Project Management",
  "Entrepreneurship",
];

const ALL_COMPANY_SIZES: CompanySize[] = [
  "1-10",
  "11-50",
  "51-200",
  "201-500",
  "501-1000",
  "1000+",
];

describe("prisma-enum-mappers", () => {
  it("round-trips every CourseTopic through the Prisma enum", () => {
    for (const topic of ALL_COURSE_TOPICS) {
      expect(fromPrismaCourseTopic(toPrismaCourseTopic(topic))).toBe(topic);
    }
  });

  it("round-trips every CompanySize through the Prisma enum", () => {
    for (const companySize of ALL_COMPANY_SIZES) {
      expect(fromPrismaCompanySize(toPrismaCompanySize(companySize))).toBe(
        companySize,
      );
    }
  });

  it("maps human-readable topics to snake_case Prisma identifiers", () => {
    expect(toPrismaCourseTopic("People Management")).toBe(
      "people_management",
    );
    expect(toPrismaCourseTopic("Customer Service")).toBe("customer_service");
  });

  it("maps non-identifier company sizes to mapped Prisma identifiers", () => {
    expect(toPrismaCompanySize("201-500")).toBe("size_201_500");
    expect(toPrismaCompanySize("1000+")).toBe("size_1000_plus");
  });

  it("round-trips arrays of CourseTopic preserving order", () => {
    const topics: CourseTopic[] = ["Sales", "Finance", "Strategy"];

    expect(fromPrismaCourseTopics(toPrismaCourseTopics(topics))).toEqual(
      topics,
    );
  });
});
