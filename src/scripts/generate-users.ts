import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

type Seniority =
  | "entry"
  | "junior"
  | "mid"
  | "senior"
  | "manager"
  | "director"
  | "executive";

type CompanySize =
  | "1-10"
  | "11-50"
  | "51-200"
  | "201-500"
  | "501-1000"
  | "1000+";

type CourseTopic =
  | "Leadership"
  | "People Management"
  | "Communication"
  | "Sales"
  | "Customer Service"
  | "Finance"
  | "Strategy"
  | "Operations"
  | "Project Management"
  | "Entrepreneurship";

type ActivitySegment =
  | "starting"
  | "light"
  | "existing"
  | "heavy";

interface User {
  user_id: number;
  role: string;
  industry: string;
  company_size: CompanySize;
  seniority: Seniority;
  stated_goal: string;
}

interface GeneratedUserContext {
  user_id: number;
  role_family: string;
  activity_segment: ActivitySegment;
  primary_topics: CourseTopic[];
  secondary_topics: CourseTopic[];
  likely_skill_gaps: string[];
}

interface UserDataset {
  metadata: {
    total_users: number;
    seed: number;
  };
  users: User[];
}

interface UserContextDataset {
  metadata: {
    total_users: number;
    purpose: string;
    users_by_activity_segment: Record<ActivitySegment, number>;
  };
  contexts: GeneratedUserContext[];
}

interface RoleProfile {
  role: string;
  roleFamily: string;
  allowedSeniorities: Seniority[];
  preferredCompanySizes: CompanySize[];
  primaryTopics: CourseTopic[];
  secondaryTopics: CourseTopic[];
  likelySkills: string[];
  goals: Partial<Record<Seniority, string[]>>;
}

interface WeightedValue<T> {
  value: T;
  weight: number;
}

const TOTAL_USERS = 1_000;
const RANDOM_SEED = 2026;

const USERS_OUTPUT_PATH = resolve(process.cwd(), "data", "users.json");

const CONTEXT_OUTPUT_PATH = resolve(
  process.cwd(),
  "data",
  "user-learning-context.json",
);

/**
 * Small deterministic pseudo-random generator.
 *
 * Using a fixed seed means the same users are generated
 * every time the script runs.
 */
function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;

  return (): number => {
    state += 0x6d2b79f5;

    let value = state;

    value = Math.imul(value ^ (value >>> 15), value | 1);

    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

const random = createSeededRandom(RANDOM_SEED);

function chooseOne<T>(values: readonly T[]): T {
  if (values.length === 0) {
    throw new Error("Cannot choose from an empty array.");
  }

  const index = Math.floor(random() * values.length);

  const value = values[index];

  if (value === undefined) {
    throw new Error("Index out of bounds while choosing a value.");
  }

  return value;
}

function chooseWeighted<T>(values: WeightedValue<T>[]): T {
  if (values.length === 0) {
    throw new Error("Cannot choose from an empty weighted array.");
  }

  const totalWeight = values.reduce((sum, item) => sum + item.weight, 0);

  let threshold = random() * totalWeight;

  for (const item of values) {
    threshold -= item.weight;

    if (threshold <= 0) {
      return item.value;
    }
  }

  const last = values[values.length - 1];

  if (last === undefined) {
    throw new Error("Cannot choose from an empty weighted array.");
  }

  return last.value;
}

function uniqueValues<T>(values: T[]): T[] {
  return [...new Set(values)];
}

const industries: WeightedValue<string>[] = [
  {
    value: "Financial Services",
    weight: 14,
  },
  {
    value: "Technology",
    weight: 13,
  },
  {
    value: "Retail",
    weight: 12,
  },
  {
    value: "Professional Services",
    weight: 11,
  },
  {
    value: "Education",
    weight: 10,
  },
  {
    value: "Healthcare",
    weight: 10,
  },
  {
    value: "Manufacturing",
    weight: 9,
  },
  {
    value: "Agriculture",
    weight: 8,
  },
  {
    value: "Logistics",
    weight: 7,
  },
  {
    value: "Hospitality",
    weight: 6,
  },
];

const roleProfiles: RoleProfile[] = [
  {
    role: "Team Lead",
    roleFamily: "leadership",
    allowedSeniorities: ["junior", "mid", "senior"],
    preferredCompanySizes: ["11-50", "51-200", "201-500", "501-1000"],
    primaryTopics: ["Leadership", "People Management"],
    secondaryTopics: ["Communication", "Project Management"],
    likelySkills: [
      "leadership_basics",
      "delegation",
      "coaching",
      "feedback",
      "goal_setting",
      "accountability",
    ],
    goals: {
      junior: [
        "Build confidence as a new team leader",
        "Improve communication with team members",
      ],
      mid: [
        "Delegate work more effectively",
        "Build stronger team accountability",
        "Improve team performance",
      ],
      senior: [
        "Coach team members more effectively",
        "Prepare for a management role",
      ],
    },
  },
  {
    role: "Department Head",
    roleFamily: "leadership",
    allowedSeniorities: ["manager", "director"],
    preferredCompanySizes: ["51-200", "201-500", "501-1000", "1000+"],
    primaryTopics: ["Leadership", "Strategy"],
    secondaryTopics: ["People Management", "Finance"],
    likelySkills: [
      "strategic_thinking",
      "decision_making",
      "change_management",
      "performance_management",
      "goal_alignment",
    ],
    goals: {
      manager: [
        "Improve department performance",
        "Strengthen cross-functional leadership",
      ],
      director: [
        "Lead organisational change",
        "Improve strategic decision making",
      ],
    },
  },
  {
    role: "HR Officer",
    roleFamily: "people_management",
    allowedSeniorities: ["entry", "junior", "mid"],
    preferredCompanySizes: ["11-50", "51-200", "201-500", "501-1000"],
    primaryTopics: ["People Management", "Communication"],
    secondaryTopics: ["Leadership", "Strategy"],
    likelySkills: [
      "employee_onboarding",
      "employee_engagement",
      "feedback",
      "conflict_resolution",
      "talent_development",
    ],
    goals: {
      entry: [
        "Build practical people management skills",
        "Improve employee onboarding",
      ],
      junior: [
        "Improve employee engagement",
        "Handle workplace conversations more effectively",
      ],
      mid: [
        "Strengthen talent development practices",
        "Improve performance review processes",
      ],
    },
  },
  {
    role: "People Manager",
    roleFamily: "people_management",
    allowedSeniorities: ["manager", "senior"],
    preferredCompanySizes: ["51-200", "201-500", "501-1000", "1000+"],
    primaryTopics: ["People Management", "Leadership"],
    secondaryTopics: ["Communication", "Strategy"],
    likelySkills: [
      "people_management",
      "performance_reviews",
      "employee_retention",
      "team_culture",
      "workforce_planning",
    ],
    goals: {
      senior: ["Build a stronger team culture", "Improve employee retention"],
      manager: [
        "Improve performance management",
        "Develop high-potential employees",
      ],
    },
  },
  {
    role: "Sales Representative",
    roleFamily: "sales",
    allowedSeniorities: ["entry", "junior", "mid"],
    preferredCompanySizes: ["1-10", "11-50", "51-200", "201-500"],
    primaryTopics: ["Sales", "Communication"],
    secondaryTopics: ["Customer Service", "Entrepreneurship"],
    likelySkills: [
      "sales_process",
      "prospecting",
      "customer_discovery",
      "objection_handling",
      "closing",
    ],
    goals: {
      entry: [
        "Build confidence in customer conversations",
        "Learn the fundamentals of selling",
      ],
      junior: ["Improve objection handling", "Strengthen prospecting skills"],
      mid: [
        "Improve conversion rates",
        "Build stronger customer relationships",
      ],
    },
  },
  {
    role: "Sales Manager",
    roleFamily: "sales",
    allowedSeniorities: ["manager", "senior"],
    preferredCompanySizes: ["11-50", "51-200", "201-500", "501-1000"],
    primaryTopics: ["Sales", "Leadership"],
    secondaryTopics: ["Communication", "Strategy"],
    likelySkills: [
      "pipeline_management",
      "sales_negotiation",
      "account_management",
      "coaching",
      "revenue_growth",
    ],
    goals: {
      senior: [
        "Improve strategic account management",
        "Strengthen sales negotiation",
      ],
      manager: [
        "Improve sales team performance",
        "Build a predictable sales pipeline",
        "Coach sales representatives more effectively",
      ],
    },
  },
  {
    role: "Customer Support Officer",
    roleFamily: "customer_service",
    allowedSeniorities: ["entry", "junior", "mid"],
    preferredCompanySizes: ["11-50", "51-200", "201-500", "501-1000"],
    primaryTopics: ["Customer Service", "Communication"],
    secondaryTopics: ["Sales", "People Management"],
    likelySkills: [
      "customer_service",
      "customer_empathy",
      "complaint_handling",
      "service_communication",
      "service_recovery",
    ],
    goals: {
      entry: [
        "Improve customer communication",
        "Learn how to handle customer complaints",
      ],
      junior: [
        "Deliver more consistent customer service",
        "Build customer empathy",
      ],
      mid: ["Improve service recovery", "Strengthen customer retention"],
    },
  },
  {
    role: "Customer Experience Manager",
    roleFamily: "customer_service",
    allowedSeniorities: ["manager", "senior"],
    preferredCompanySizes: ["51-200", "201-500", "501-1000", "1000+"],
    primaryTopics: ["Customer Service", "Strategy"],
    secondaryTopics: ["Leadership", "Sales"],
    likelySkills: [
      "customer_experience",
      "customer_retention",
      "customer_success",
      "service_standards",
      "customer_experience_strategy",
    ],
    goals: {
      senior: [
        "Improve the end-to-end customer experience",
        "Strengthen customer retention",
      ],
      manager: [
        "Build consistent customer service standards",
        "Develop a customer experience strategy",
      ],
    },
  },
  {
    role: "Accountant",
    roleFamily: "finance",
    allowedSeniorities: ["junior", "mid", "senior"],
    preferredCompanySizes: ["11-50", "51-200", "201-500", "501-1000"],
    primaryTopics: ["Finance"],
    secondaryTopics: ["Communication", "Strategy", "Operations"],
    likelySkills: [
      "financial_statements",
      "budgeting",
      "cash_flow",
      "financial_reporting",
      "business_metrics",
    ],
    goals: {
      junior: [
        "Strengthen financial reporting skills",
        "Improve understanding of business metrics",
      ],
      mid: [
        "Improve budgeting and cost management",
        "Build stronger cash flow analysis skills",
      ],
      senior: [
        "Improve financial forecasting",
        "Support better business decisions with financial data",
      ],
    },
  },
  {
    role: "Finance Manager",
    roleFamily: "finance",
    allowedSeniorities: ["manager", "senior", "director"],
    preferredCompanySizes: ["51-200", "201-500", "501-1000", "1000+"],
    primaryTopics: ["Finance", "Strategy"],
    secondaryTopics: ["Leadership", "Operations"],
    likelySkills: [
      "financial_planning",
      "financial_forecasting",
      "profitability_analysis",
      "investment_analysis",
      "financial_strategy",
    ],
    goals: {
      senior: [
        "Improve financial planning and forecasting",
        "Strengthen profitability analysis",
      ],
      manager: [
        "Make stronger financial decisions",
        "Improve budgeting and financial control",
      ],
      director: [
        "Develop a stronger financial strategy",
        "Improve investment decision making",
      ],
    },
  },
  {
    role: "Operations Officer",
    roleFamily: "operations",
    allowedSeniorities: ["entry", "junior", "mid"],
    preferredCompanySizes: ["11-50", "51-200", "201-500", "501-1000"],
    primaryTopics: ["Operations", "Project Management"],
    secondaryTopics: ["Communication", "Leadership"],
    likelySkills: [
      "process_mapping",
      "work_planning",
      "resource_management",
      "quality_management",
      "inventory_management",
    ],
    goals: {
      entry: [
        "Understand core operations processes",
        "Improve daily work planning",
      ],
      junior: [
        "Improve process coordination",
        "Strengthen resource management",
      ],
      mid: ["Improve operational efficiency", "Reduce process delays"],
    },
  },
  {
    role: "Operations Manager",
    roleFamily: "operations",
    allowedSeniorities: ["manager", "senior"],
    preferredCompanySizes: ["51-200", "201-500", "501-1000", "1000+"],
    primaryTopics: ["Operations", "Leadership"],
    secondaryTopics: ["Project Management", "Strategy"],
    likelySkills: [
      "process_improvement",
      "supply_chain_management",
      "operational_risk",
      "operational_excellence",
      "operations_strategy",
    ],
    goals: {
      senior: [
        "Improve operational excellence",
        "Strengthen supply chain performance",
      ],
      manager: [
        "Improve operational efficiency",
        "Reduce operational risks",
        "Build stronger team accountability",
      ],
    },
  },
  {
    role: "Project Coordinator",
    roleFamily: "project_management",
    allowedSeniorities: ["entry", "junior", "mid"],
    preferredCompanySizes: ["11-50", "51-200", "201-500", "501-1000"],
    primaryTopics: ["Project Management", "Communication"],
    secondaryTopics: ["Operations", "Leadership"],
    likelySkills: [
      "project_management",
      "scope_management",
      "project_scheduling",
      "task_management",
      "project_communication",
    ],
    goals: {
      entry: [
        "Learn the fundamentals of project coordination",
        "Improve task tracking",
      ],
      junior: [
        "Improve project planning and scheduling",
        "Strengthen project communication",
      ],
      mid: [
        "Improve project delivery",
        "Manage project scope more effectively",
      ],
    },
  },
  {
    role: "Project Manager",
    roleFamily: "project_management",
    allowedSeniorities: ["mid", "senior", "manager"],
    preferredCompanySizes: ["51-200", "201-500", "501-1000", "1000+"],
    primaryTopics: ["Project Management"],
    secondaryTopics: ["Leadership", "Communication", "Operations"],
    likelySkills: [
      "risk_management",
      "stakeholder_management",
      "project_budgeting",
      "agile_delivery",
      "project_monitoring",
    ],
    goals: {
      mid: ["Deliver projects on time", "Improve stakeholder communication"],
      senior: [
        "Manage project risks more effectively",
        "Improve project monitoring and control",
      ],
      manager: [
        "Improve programme delivery",
        "Strengthen project portfolio management",
      ],
    },
  },
  {
    role: "Founder",
    roleFamily: "entrepreneurship",
    allowedSeniorities: ["manager", "director", "executive"],
    preferredCompanySizes: ["1-10", "11-50", "51-200"],
    primaryTopics: ["Entrepreneurship", "Strategy"],
    secondaryTopics: ["Finance", "Sales", "Leadership"],
    likelySkills: [
      "entrepreneurship",
      "customer_validation",
      "value_proposition",
      "business_models",
      "business_growth",
      "business_scaling",
    ],
    goals: {
      manager: [
        "Validate a stronger business model",
        "Improve customer acquisition",
      ],
      director: [
        "Grow the business sustainably",
        "Improve business profitability",
      ],
      executive: [
        "Scale the business successfully",
        "Develop a long-term venture strategy",
      ],
    },
  },
  {
    role: "Business Owner",
    roleFamily: "entrepreneurship",
    allowedSeniorities: ["manager", "director"],
    preferredCompanySizes: ["1-10", "11-50", "51-200"],
    primaryTopics: ["Entrepreneurship", "Finance"],
    secondaryTopics: ["Operations", "Sales", "Strategy"],
    likelySkills: [
      "small_business_finance",
      "market_entry",
      "business_growth",
      "operations_management",
      "customer_retention",
    ],
    goals: {
      manager: [
        "Improve day-to-day business operations",
        "Strengthen customer retention",
      ],
      director: [
        "Improve business profitability",
        "Build a sustainable growth strategy",
      ],
    },
  },
];

const roleFamilyWeights: WeightedValue<string>[] = [
  {
    value: "leadership",
    weight: 15,
  },
  {
    value: "people_management",
    weight: 11,
  },
  {
    value: "sales",
    weight: 15,
  },
  {
    value: "customer_service",
    weight: 10,
  },
  {
    value: "finance",
    weight: 10,
  },
  {
    value: "operations",
    weight: 13,
  },
  {
    value: "project_management",
    weight: 13,
  },
  {
    value: "entrepreneurship",
    weight: 13,
  },
];

const activitySegmentWeights: WeightedValue<ActivitySegment>[] = [
  {
    value: "starting",
    weight: 20,
  },
  {
    value: "light",
    weight: 30,
  },
  {
    value: "existing",
    weight: 35,
  },
  {
    value: "heavy",
    weight: 15,
  },
];

function chooseRoleProfile(): RoleProfile {
  const selectedFamily = chooseWeighted(roleFamilyWeights);

  const matchingProfiles = roleProfiles.filter(
    (profile) => profile.roleFamily === selectedFamily,
  );

  return chooseOne(matchingProfiles);
}

function chooseSeniority(profile: RoleProfile): Seniority {
  return chooseOne(profile.allowedSeniorities);
}

function chooseGoal(profile: RoleProfile, seniority: Seniority): string {
  const directGoals = profile.goals[seniority] ?? [];

  if (directGoals.length > 0) {
    return chooseOne(directGoals);
  }

  const fallbackGoals = Object.values(profile.goals).flatMap(
    (goals) => goals ?? [],
  );

  if (fallbackGoals.length === 0) {
    throw new Error(`No goals configured for ${profile.role}.`);
  }

  return chooseOne(fallbackGoals);
}

function chooseCompanySize(profile: RoleProfile): CompanySize {
  return chooseOne(profile.preferredCompanySizes);
}

function generateUsers(): {
  users: User[];
  contexts: GeneratedUserContext[];
} {
  const users: User[] = [];
  const contexts: GeneratedUserContext[] = [];

  for (let userId = 1; userId <= TOTAL_USERS; userId++) {
    const profile = chooseRoleProfile();
    const seniority = chooseSeniority(profile);

    const user: User = {
      user_id: userId,
      role: profile.role,
      industry: chooseWeighted(industries),
      company_size: chooseCompanySize(profile),
      seniority,
      stated_goal: chooseGoal(profile, seniority),
    };

    const context: GeneratedUserContext = {
      user_id: userId,
      role_family: profile.roleFamily,
      activity_segment: chooseWeighted(activitySegmentWeights),
      primary_topics: uniqueValues(profile.primaryTopics),
      secondary_topics: uniqueValues(profile.secondaryTopics),
      likely_skill_gaps: uniqueValues(profile.likelySkills),
    };

    users.push(user);
    contexts.push(context);
  }

  return {
    users,
    contexts,
  };
}

function validateUsers(users: User[]): void {
  if (users.length !== TOTAL_USERS) {
    throw new Error(
      `Expected ${TOTAL_USERS} users, generated ${users.length}.`,
    );
  }

  const userIds = new Set(users.map((user) => user.user_id));

  if (userIds.size !== users.length) {
    throw new Error("Duplicate user IDs were generated.");
  }

  for (const user of users) {
    if (!user.role.trim()) {
      throw new Error(`User ${user.user_id} has no role.`);
    }

    if (!user.industry.trim()) {
      throw new Error(`User ${user.user_id} has no industry.`);
    }

    if (!user.stated_goal.trim()) {
      throw new Error(`User ${user.user_id} has no stated goal.`);
    }
  }
}

const validActivitySegments = new Set<ActivitySegment>([
  "starting",
  "light",
  "existing",
  "heavy",
]);

function validateContexts(users: User[], contexts: GeneratedUserContext[]): void {
  if (contexts.length !== users.length) {
    throw new Error(
      `Expected ${users.length} contexts, generated ${contexts.length}.`,
    );
  }

  const userIds = new Set(users.map((user) => user.user_id));
  const seenContextIds = new Set<number>();

  for (const context of contexts) {
    if (!userIds.has(context.user_id)) {
      throw new Error(
        `Context references unknown user_id ${context.user_id}.`,
      );
    }

    if (seenContextIds.has(context.user_id)) {
      throw new Error(
        `Duplicate context found for user_id ${context.user_id}.`,
      );
    }

    seenContextIds.add(context.user_id);

    if (!validActivitySegments.has(context.activity_segment)) {
      throw new Error(
        `User ${context.user_id} has an invalid activity segment: ${context.activity_segment}.`,
      );
    }
  }
}

function countUsersByActivitySegment(
  contexts: GeneratedUserContext[],
): Record<ActivitySegment, number> {
  const counts: Record<ActivitySegment, number> = {
    starting: 0,
    light: 0,
    existing: 0,
    heavy: 0,
  };

  for (const context of contexts) {
    counts[context.activity_segment]++;
  }

  return counts;
}

async function saveJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), {
    recursive: true,
  });

  await writeFile(path, JSON.stringify(value, null, 2), "utf-8");
}

async function main(): Promise<void> {
  const { users, contexts } = generateUsers();

  validateUsers(users);
  validateContexts(users, contexts);

  const userDataset: UserDataset = {
    metadata: {
      total_users: users.length,
      seed: RANDOM_SEED,
    },
    users,
  };

  const segmentCounts = countUsersByActivitySegment(contexts);

  const contextDataset: UserContextDataset = {
    metadata: {
      total_users: contexts.length,
      purpose: "Internal context for generating surveys and usage events.",
      users_by_activity_segment: segmentCounts,
    },
    contexts,
  };

  await Promise.all([
    saveJson(USERS_OUTPUT_PATH, userDataset),
    saveJson(CONTEXT_OUTPUT_PATH, contextDataset),
  ]);

  console.log("Activity segment distribution:", segmentCounts);

  console.log("User datasets generated successfully.");
  console.log(`Users: ${users.length}`);
  console.log(`Users file: ${USERS_OUTPUT_PATH}`);
  console.log(`Context file: ${CONTEXT_OUTPUT_PATH}`);
}

main().catch((error: unknown) => {
  console.error("Failed to generate users:", error);

  process.exitCode = 1;
});
