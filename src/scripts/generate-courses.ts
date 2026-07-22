import type { Course, CourseTopic } from "#models/course.js";
import { prisma } from "#database/prisma-client.js";
import { toPrismaCourseTopic } from "#database/mappers/prisma-enum-mappers.js";
import { isMainModule } from "./run-if-main.js";

interface DomainBlueprint {
  topic: CourseTopic;
  focusAreas: string[];
  skills: string[];
}

const BEGINNER_COURSES_PER_DOMAIN = 8;
const INTERMEDIATE_COURSES_PER_DOMAIN = 8;
const ADVANCED_COURSES_PER_DOMAIN = 4;

const domains: DomainBlueprint[] = [
  {
    topic: "Leadership",
    focusAreas: [
      "Leadership",
      "Self-Awareness",
      "Goal Setting",
      "Delegation",
      "Team Motivation",
      "Decision Making",
      "Accountability",
      "Ethical Leadership",
      "Team Coaching",
      "Performance Leadership",
      "Leading Change",
      "Strategic Leadership",
    ],
    skills: [
      "leadership_basics",
      "self_awareness",
      "goal_setting",
      "delegation",
      "team_motivation",
      "decision_making",
      "accountability",
      "ethical_leadership",
      "coaching",
      "performance_management",
      "change_management",
      "strategic_thinking",
    ],
  },
  {
    topic: "People Management",
    focusAreas: [
      "People Management",
      "Employee Onboarding",
      "Team Development",
      "Performance Reviews",
      "Workplace Feedback",
      "Employee Engagement",
      "Conflict Resolution",
      "Talent Development",
      "Team Culture",
      "Employee Retention",
      "Workforce Planning",
      "Organisational Development",
    ],
    skills: [
      "people_management",
      "employee_onboarding",
      "team_development",
      "performance_reviews",
      "feedback",
      "employee_engagement",
      "conflict_resolution",
      "talent_development",
      "team_culture",
      "employee_retention",
      "workforce_planning",
      "organisational_development",
    ],
  },
  {
    topic: "Communication",
    focusAreas: [
      "Business Communication",
      "Active Listening",
      "Business Writing",
      "Workplace Conversations",
      "Presentation Skills",
      "Giving Feedback",
      "Meeting Facilitation",
      "Business Storytelling",
      "Persuasive Communication",
      "Difficult Conversations",
      "Executive Communication",
      "Stakeholder Communication",
    ],
    skills: [
      "business_communication",
      "active_listening",
      "business_writing",
      "workplace_conversations",
      "presentation",
      "feedback",
      "meeting_facilitation",
      "storytelling",
      "persuasion",
      "difficult_conversations",
      "executive_communication",
      "stakeholder_communication",
    ],
  },
  {
    topic: "Sales",
    focusAreas: [
      "Sales",
      "Customer Discovery",
      "Prospecting",
      "Relationship Building",
      "Objection Handling",
      "Sales Presentations",
      "Closing Deals",
      "Pipeline Management",
      "Consultative Selling",
      "Sales Negotiation",
      "Account Management",
      "Revenue Growth",
    ],
    skills: [
      "sales_process",
      "customer_discovery",
      "prospecting",
      "relationship_building",
      "objection_handling",
      "sales_presentations",
      "closing",
      "pipeline_management",
      "consultative_selling",
      "sales_negotiation",
      "account_management",
      "revenue_growth",
    ],
  },
  {
    topic: "Customer Service",
    focusAreas: [
      "Customer Service",
      "Customer Needs",
      "Service Communication",
      "Customer Empathy",
      "Complaint Handling",
      "Service Recovery",
      "Customer Experience",
      "Customer Retention",
      "Support Quality",
      "Service Standards",
      "Customer Success",
      "Customer Experience Strategy",
    ],
    skills: [
      "customer_service",
      "customer_needs",
      "service_communication",
      "customer_empathy",
      "complaint_handling",
      "service_recovery",
      "customer_experience",
      "customer_retention",
      "support_quality",
      "service_standards",
      "customer_success",
      "customer_experience_strategy",
    ],
  },
  {
    topic: "Finance",
    focusAreas: [
      "Financial Literacy",
      "Financial Statements",
      "Business Metrics",
      "Budgeting",
      "Cost Management",
      "Cash Flow",
      "Financial Planning",
      "Financial Forecasting",
      "Profitability Analysis",
      "Pricing Decisions",
      "Investment Analysis",
      "Financial Strategy",
    ],
    skills: [
      "financial_literacy",
      "financial_statements",
      "business_metrics",
      "budgeting",
      "cost_management",
      "cash_flow",
      "financial_planning",
      "financial_forecasting",
      "profitability_analysis",
      "pricing",
      "investment_analysis",
      "financial_strategy",
    ],
  },
  {
    topic: "Strategy",
    focusAreas: [
      "Business Strategy",
      "Strategic Thinking",
      "Market Analysis",
      "Competitive Advantage",
      "Goal Alignment",
      "Strategic Planning",
      "Business Models",
      "Growth Strategy",
      "Scenario Planning",
      "Strategic Execution",
      "Portfolio Strategy",
      "Corporate Strategy",
    ],
    skills: [
      "business_strategy",
      "strategic_thinking",
      "market_analysis",
      "competitive_advantage",
      "goal_alignment",
      "strategic_planning",
      "business_models",
      "growth_strategy",
      "scenario_planning",
      "strategic_execution",
      "portfolio_strategy",
      "corporate_strategy",
    ],
  },
  {
    topic: "Operations",
    focusAreas: [
      "Operations Management",
      "Process Mapping",
      "Work Planning",
      "Resource Management",
      "Quality Management",
      "Inventory Management",
      "Process Improvement",
      "Supply Chain Management",
      "Operational Risk",
      "Service Operations",
      "Operational Excellence",
      "Operations Strategy",
    ],
    skills: [
      "operations_management",
      "process_mapping",
      "work_planning",
      "resource_management",
      "quality_management",
      "inventory_management",
      "process_improvement",
      "supply_chain_management",
      "operational_risk",
      "service_operations",
      "operational_excellence",
      "operations_strategy",
    ],
  },
  {
    topic: "Project Management",
    focusAreas: [
      "Project Management",
      "Project Scope",
      "Project Scheduling",
      "Task Management",
      "Project Communication",
      "Risk Management",
      "Stakeholder Management",
      "Project Budgeting",
      "Agile Project Delivery",
      "Project Monitoring",
      "Programme Management",
      "Project Portfolio Management",
    ],
    skills: [
      "project_management",
      "scope_management",
      "project_scheduling",
      "task_management",
      "project_communication",
      "risk_management",
      "stakeholder_management",
      "project_budgeting",
      "agile_delivery",
      "project_monitoring",
      "programme_management",
      "portfolio_management",
    ],
  },
  {
    topic: "Entrepreneurship",
    focusAreas: [
      "Entrepreneurship",
      "Problem Identification",
      "Customer Validation",
      "Value Propositions",
      "Business Models",
      "Small Business Finance",
      "Product Development",
      "Market Entry",
      "Business Growth",
      "Entrepreneurial Leadership",
      "Business Scaling",
      "Venture Strategy",
    ],
    skills: [
      "entrepreneurship",
      "problem_identification",
      "customer_validation",
      "value_proposition",
      "business_models",
      "small_business_finance",
      "product_development",
      "market_entry",
      "business_growth",
      "entrepreneurial_leadership",
      "business_scaling",
      "venture_strategy",
    ],
  },
];

const beginnerTitleTemplates = [
  (focus: string) => `${focus} Fundamentals`,
  (focus: string) => `Introduction to ${focus}`,
  (focus: string) => `Essential ${focus}`,
  (focus: string) => `Getting Started with ${focus}`,
  (focus: string) => `Building Foundations in ${focus}`,
  (focus: string) => `${focus} for the Workplace`,
  (focus: string) => `Understanding ${focus}`,
  (focus: string) => `Core Principles of ${focus}`,
];

const intermediateTitleTemplates = [
  (focus: string) => `Practical ${focus}`,
  (focus: string) => `Applying ${focus} at Work`,
  (focus: string) => `${focus} for Managers`,
  (focus: string) => `Improving ${focus}`,
  (focus: string) => `Developing Stronger ${focus}`,
  (focus: string) => `${focus} in Practice`,
  (focus: string) => `Managing with ${focus}`,
  (focus: string) => `Effective ${focus}`,
];

const advancedTitleTemplates = [
  (focus: string) => `Advanced ${focus}`,
  (focus: string) => `Strategic ${focus}`,
  (focus: string) => `Mastering ${focus}`,
  (focus: string) => `${focus} for Senior Leaders`,
];

const beginnerDurations = [30, 60, 60, 60, 90, 60, 90, 90];

const intermediateDurations = [60, 90, 90, 120, 90, 120, 120, 120];

const advancedDurations = [120, 180, 180, 180];

/**
 * Indexes into an array, throwing if the index is out of bounds.
 *
 * Needed because `noUncheckedIndexedAccess` types plain indexing
 * as possibly `undefined`, even where the index is known in-bounds.
 */
function at<T>(array: readonly T[], index: number): T {
  const value = array[index];

  if (value === undefined) {
    throw new Error(`Index ${index} is out of bounds (length ${array.length}).`);
  }

  return value;
}

/**
 * Selects related skills from the same domain.
 *
 * Every course receives:
 * - one primary skill
 * - two supporting skills
 */
function selectSkills(skills: string[], primaryIndex: number): string[] {
  const primarySkill = at(skills, primaryIndex % skills.length);

  const supportingSkillOne = at(skills, (primaryIndex + 1) % skills.length);

  const supportingSkillTwo = at(skills, (primaryIndex + 3) % skills.length);

  return [primarySkill, supportingSkillOne, supportingSkillTwo];
}

function generateDomainCourses(
  domain: DomainBlueprint,
  startingCourseId: number,
): Course[] {
  const courses: Course[] = [];

  const beginnerCourseIds: number[] = [];
  const intermediateCourseIds: number[] = [];

  /*
   * Generate eight beginner courses.
   *
   * Beginner courses do not require prerequisites.
   */
  for (let index = 0; index < BEGINNER_COURSES_PER_DOMAIN; index++) {
    const courseId = startingCourseId + courses.length;
    const focus = at(domain.focusAreas, index);

    beginnerCourseIds.push(courseId);

    courses.push({
      course_id: courseId,
      title: at(beginnerTitleTemplates, index)(focus),
      topic: domain.topic,
      level: "beginner",
      skills_taught: selectSkills(domain.skills, index),
      duration_mins: at(beginnerDurations, index),
      prerequisites: [],
    });
  }

  /*
   * Generate eight intermediate courses.
   *
   * Each intermediate course requires one related
   * beginner course from the same domain.
   */
  for (let index = 0; index < INTERMEDIATE_COURSES_PER_DOMAIN; index++) {
    const courseId = startingCourseId + courses.length;

    /*
     * Reuse the domain's focus areas in a different
     * progression and title pattern.
     */
    const focusIndex =
      (index + BEGINNER_COURSES_PER_DOMAIN) % domain.focusAreas.length;

    const focus = at(domain.focusAreas, focusIndex);

    intermediateCourseIds.push(courseId);

    courses.push({
      course_id: courseId,
      title: at(intermediateTitleTemplates, index)(focus),
      topic: domain.topic,
      level: "intermediate",
      skills_taught: selectSkills(domain.skills, focusIndex),
      duration_mins: at(intermediateDurations, index),
      prerequisites: [at(beginnerCourseIds, index)],
    });
  }

  /*
   * Generate four advanced courses.
   *
   * Each advanced course requires two intermediate
   * courses from the same domain.
   */
  for (let index = 0; index < ADVANCED_COURSES_PER_DOMAIN; index++) {
    const courseId = startingCourseId + courses.length;

    const focusIndex =
      domain.focusAreas.length - ADVANCED_COURSES_PER_DOMAIN + index;

    const focus = at(domain.focusAreas, focusIndex);

    const firstPrerequisiteIndex = index * 2;
    const secondPrerequisiteIndex = firstPrerequisiteIndex + 1;

    courses.push({
      course_id: courseId,
      title: at(advancedTitleTemplates, index)(focus),
      topic: domain.topic,
      level: "advanced",
      skills_taught: selectSkills(domain.skills, focusIndex),
      duration_mins: at(advancedDurations, index),
      prerequisites: [
        at(intermediateCourseIds, firstPrerequisiteIndex),
        at(intermediateCourseIds, secondPrerequisiteIndex),
      ],
    });
  }

  return courses;
}

export function generateCourses(): Course[] {
  const courses: Course[] = [];

  for (const domain of domains) {
    const startingCourseId = courses.length + 1;

    const domainCourses = generateDomainCourses(domain, startingCourseId);

    courses.push(...domainCourses);
  }

  return courses;
}

export function validateCourses(courses: Course[]): void {
  const courseIds = new Set(courses.map((course) => course.course_id));

  const courseTitles = new Set(
    courses.map((course) => course.title.toLowerCase()),
  );

  if (courses.length !== 200) {
    throw new Error(`Expected 200 courses, generated ${courses.length}.`);
  }

  if (courseIds.size !== courses.length) {
    throw new Error("Duplicate course IDs were generated.");
  }

  if (courseTitles.size !== courses.length) {
    throw new Error("Duplicate course titles were generated.");
  }

  for (const course of courses) {
    if (course.skills_taught.length === 0) {
      throw new Error(`Course ${course.course_id} has no skills.`);
    }

    if (course.level === "beginner" && course.prerequisites.length > 0) {
      throw new Error(
        `Beginner course ${course.course_id} should not have prerequisites.`,
      );
    }

    for (const prerequisiteId of course.prerequisites) {
      if (prerequisiteId === course.course_id) {
        throw new Error(
          `Course ${course.course_id} cannot be its own prerequisite.`,
        );
      }

      if (!courseIds.has(prerequisiteId)) {
        throw new Error(
          `Course ${course.course_id} references missing prerequisite ${prerequisiteId}.`,
        );
      }

      if (prerequisiteId >= course.course_id) {
        throw new Error(
          `Course ${course.course_id} has an invalid future prerequisite ${prerequisiteId}.`,
        );
      }
    }

    if (new Set(course.prerequisites).size !== course.prerequisites.length) {
      throw new Error(`Course ${course.course_id} has duplicate prerequisites.`);
    }
  }
}

/**
 * Persists an already-generated, already-validated course dataset to
 * PostgreSQL. Courses are inserted before prerequisite rows, in a single
 * transaction, since prerequisite rows reference course_id via a foreign
 * key.
 */
export async function saveCourses(courses: Course[]): Promise<void> {
  const prerequisiteRows = courses.flatMap((course) =>
    course.prerequisites.map((prerequisiteCourseId) => ({
      courseId: course.course_id,
      prerequisiteCourseId,
    })),
  );

  try {
    await prisma.$transaction([
      prisma.course.createMany({
        data: courses.map((course) => ({
          courseId: course.course_id,
          title: course.title,
          topic: toPrismaCourseTopic(course.topic),
          level: course.level,
          skillsTaught: course.skills_taught,
          durationMins: course.duration_mins,
        })),
      }),
      ...(prerequisiteRows.length > 0
        ? [prisma.coursePrerequisite.createMany({ data: prerequisiteRows })]
        : []),
    ]);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to save courses: ${message}`);
  }
}

export async function generateAndSaveCourses(): Promise<Course[]> {
  const courses = generateCourses();

  validateCourses(courses);

  await saveCourses(courses);

  return courses;
}

async function main(): Promise<void> {
  const courses = await generateAndSaveCourses();

  const levelCounts = {
    beginner: courses.filter((course) => course.level === "beginner").length,
    intermediate: courses.filter((course) => course.level === "intermediate")
      .length,
    advanced: courses.filter((course) => course.level === "advanced").length,
  };

  console.log("Course dataset generated and inserted successfully.");
  console.log(`Domains: ${domains.length}`);
  console.log(`Courses: ${courses.length}`);
  console.log(`Beginner: ${levelCounts.beginner}`);
  console.log(`Intermediate: ${levelCounts.intermediate}`);
  console.log(`Advanced: ${levelCounts.advanced}`);
}

if (isMainModule(import.meta.url)) {
  main()
    .catch((error: unknown) => {
      console.error("Failed to generate the course dataset:", error);
      process.exitCode = 1;
    })
    .finally(() => {
      void prisma.$disconnect();
    });
}
