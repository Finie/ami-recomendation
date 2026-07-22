import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

type CourseLevel = "beginner" | "intermediate" | "advanced";

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

type ActivitySegment = "starting" | "light" | "existing" | "heavy";

type UsageEventType = "started" | "completed" | "dropped";

interface Course {
  course_id: number;
  title: string;
  topic: CourseTopic;
  level: CourseLevel;
  skills_taught: string[];
  duration_mins: number;
  prerequisites: number[];
}

interface CourseDataset {
  courses: Course[];
}

interface User {
  user_id: number;
  role: string;
  industry: string;
  company_size: string;
  seniority: string;
  stated_goal: string;
}

interface UserDataset {
  users: User[];
}

interface UserLearningContext {
  user_id: number;
  role_family: string;
  activity_segment: ActivitySegment;
  primary_topics: CourseTopic[];
  secondary_topics: CourseTopic[];
  likely_skill_gaps: string[];
}

interface UserContextDataset {
  contexts: UserLearningContext[];
}

interface SurveyResponse {
  survey_response_id: number;
  user_id: number;
  skill_gaps: string[];
  goals: string[];
  preferred_topics: CourseTopic[];
  confidence_by_topic: Partial<Record<CourseTopic, number>>;
  submitted_at: string;
}

interface SurveyDataset {
  survey_responses: SurveyResponse[];
}

interface UsageEvent {
  usage_event_id: number;
  user_id: number;
  course_id: number;
  event_type: UsageEventType;
  progress_pct: number;
  quiz_score: number | null;
  timestamp: string;
}

interface UsageDataset {
  metadata: {
    total_users: number;
    users_with_usage: number;
    total_course_interactions: number;
    total_usage_events: number;
    users_by_segment: Record<ActivitySegment, number>;
    seed: number;
  };
  usage_events: UsageEvent[];
}

interface WeightedValue<T> {
  value: T;
  weight: number;
}

interface ActivityConfiguration {
  minimumInteractions: number;
  maximumInteractions: number;
  completionProbability: number;
  dropProbability: number;
}

interface SelectedCourse {
  course: Course;
  relevance: "primary" | "secondary" | "exploratory";
}

const RANDOM_SEED = 2028;

const COURSES_INPUT_PATH = resolve(process.cwd(), "data", "courses.json");

const USERS_INPUT_PATH = resolve(process.cwd(), "data", "users.json");

const CONTEXT_INPUT_PATH = resolve(
  process.cwd(),
  "data",
  "user-learning-context.json",
);

const SURVEYS_INPUT_PATH = resolve(
  process.cwd(),
  "data",
  "survey_responses.json",
);

const USAGE_OUTPUT_PATH = resolve(process.cwd(), "data", "usage_events.json");

const USAGE_PERIOD_START = new Date("2025-01-01T08:00:00.000Z");

const USAGE_PERIOD_END = new Date("2026-06-30T18:00:00.000Z");

const activityConfigurations: Record<ActivitySegment, ActivityConfiguration> = {
  starting: {
    minimumInteractions: 0,
    maximumInteractions: 0,
    completionProbability: 0,
    dropProbability: 0,
  },

  light: {
    minimumInteractions: 1,
    maximumInteractions: 4,
    completionProbability: 0.3,
    dropProbability: 0.25,
  },

  existing: {
    minimumInteractions: 5,
    maximumInteractions: 12,
    completionProbability: 0.55,
    dropProbability: 0.2,
  },

  heavy: {
    minimumInteractions: 13,
    maximumInteractions: 25,
    completionProbability: 0.7,
    dropProbability: 0.12,
  },
};

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

function randomInteger(minimum: number, maximum: number): number {
  if (maximum < minimum) {
    throw new Error(`Invalid range ${minimum}-${maximum}.`);
  }

  return Math.floor(random() * (maximum - minimum + 1)) + minimum;
}

function chooseOne<T>(values: readonly T[]): T {
  if (values.length === 0) {
    throw new Error("Cannot select from an empty array.");
  }

  const index = randomInteger(0, values.length - 1);

  const value = values[index];

  if (value === undefined) {
    throw new Error("Selected array value is undefined.");
  }

  return value;
}

function chooseWeighted<T>(values: WeightedValue<T>[]): T {
  const totalWeight = values.reduce((sum, item) => sum + item.weight, 0);

  let threshold = random() * totalWeight;

  for (const item of values) {
    threshold -= item.weight;

    if (threshold <= 0) {
      return item.value;
    }
  }

  const last = values.at(-1);

  if (last === undefined) {
    throw new Error("Cannot select from empty weighted values.");
  }

  return last.value;
}

function shuffle<T>(values: readonly T[]): T[] {
  const result = [...values];

  for (let index = result.length - 1; index > 0; index--) {
    const swapIndex = randomInteger(0, index);

    const current = result[index];
    const replacement = result[swapIndex];

    if (current === undefined || replacement === undefined) {
      throw new Error("Unexpected undefined shuffle value.");
    }

    result[index] = replacement;
    result[swapIndex] = current;
  }

  return result;
}

function uniqueCourses(courses: Course[]): Course[] {
  const byCourseId = new Map<number, Course>();

  for (const course of courses) {
    byCourseId.set(course.course_id, course);
  }

  return [...byCourseId.values()];
}

function hasSkillOverlap(course: Course, skills: string[]): boolean {
  return course.skills_taught.some((skill) => skills.includes(skill));
}

function classifyCourseRelevance(
  course: Course,
  context: UserLearningContext,
  survey?: SurveyResponse,
): SelectedCourse["relevance"] {
  const primaryTopics = new Set(context.primary_topics);

  const secondaryTopics = new Set([
    ...context.secondary_topics,
    ...(survey?.preferred_topics ?? []),
  ]);

  const relevantSkills = [
    ...context.likely_skill_gaps,
    ...(survey?.skill_gaps ?? []),
  ];

  if (
    primaryTopics.has(course.topic) ||
    hasSkillOverlap(course, relevantSkills)
  ) {
    return "primary";
  }

  if (secondaryTopics.has(course.topic)) {
    return "secondary";
  }

  return "exploratory";
}

function selectCoursesForUser(
  courses: Course[],
  context: UserLearningContext,
  survey: SurveyResponse | undefined,
  interactionCount: number,
): SelectedCourse[] {
  if (interactionCount === 0) {
    return [];
  }

  const classifiedCourses = courses.map(
    (course): SelectedCourse => ({
      course,
      relevance: classifyCourseRelevance(course, context, survey),
    }),
  );

  const primary = shuffle(
    classifiedCourses.filter((item) => item.relevance === "primary"),
  );

  const secondary = shuffle(
    classifiedCourses.filter((item) => item.relevance === "secondary"),
  );

  const exploratory = shuffle(
    classifiedCourses.filter((item) => item.relevance === "exploratory"),
  );

  const primaryCount = Math.round(interactionCount * 0.7);

  const secondaryCount = Math.round(interactionCount * 0.2);

  const exploratoryCount = interactionCount - primaryCount - secondaryCount;

  const selected = [
    ...primary.slice(0, primaryCount),
    ...secondary.slice(0, secondaryCount),
    ...exploratory.slice(0, exploratoryCount),
  ];

  if (selected.length < interactionCount) {
    const selectedIds = new Set(selected.map((item) => item.course.course_id));

    const remaining = shuffle(
      classifiedCourses.filter(
        (item) => !selectedIds.has(item.course.course_id),
      ),
    );

    selected.push(...remaining.slice(0, interactionCount - selected.length));
  }

  return shuffle(uniqueCourses(selected.map((item) => item.course))).map(
    (course) => ({
      course,
      relevance: classifyCourseRelevance(course, context, survey),
    }),
  );
}

function getOutcome(
  segment: ActivitySegment,
  selectedCourse: SelectedCourse,
): "completed" | "started" | "dropped" {
  const configuration = activityConfigurations[segment];

  let completionProbability = configuration.completionProbability;

  let dropProbability = configuration.dropProbability;

  if (selectedCourse.relevance === "primary") {
    completionProbability += 0.12;
    dropProbability -= 0.05;
  }

  if (selectedCourse.relevance === "exploratory") {
    completionProbability -= 0.12;
    dropProbability += 0.1;
  }

  if (selectedCourse.course.level === "advanced") {
    completionProbability -= 0.1;
    dropProbability += 0.08;
  }

  completionProbability = Math.max(0, Math.min(0.9, completionProbability));

  dropProbability = Math.max(0, Math.min(0.7, dropProbability));

  const outcomeRoll = random();

  if (outcomeRoll < completionProbability) {
    return "completed";
  }

  if (outcomeRoll < completionProbability + dropProbability) {
    return "dropped";
  }

  return "started";
}

function randomTimestamp(minimumDate: Date, maximumDate: Date): Date {
  const minimumTime = minimumDate.getTime();

  const maximumTime = maximumDate.getTime();

  const timestamp = minimumTime + random() * (maximumTime - minimumTime);

  return new Date(timestamp);
}

function addDays(date: Date, numberOfDays: number): Date {
  const result = new Date(date);

  result.setUTCDate(result.getUTCDate() + numberOfDays);

  return result;
}

function buildInteractionEvents(
  userId: number,
  selectedCourse: SelectedCourse,
  outcome: "completed" | "started" | "dropped",
  startDate: Date,
): Omit<UsageEvent, "usage_event_id">[] {
  const courseId = selectedCourse.course.course_id;

  const startedEvent: Omit<UsageEvent, "usage_event_id"> = {
    user_id: userId,
    course_id: courseId,
    event_type: "started",
    progress_pct: 0,
    quiz_score: null,
    timestamp: startDate.toISOString(),
  };

  if (outcome === "started") {
    return [
      {
        ...startedEvent,
        progress_pct: randomInteger(5, 75),
      },
    ];
  }

  const durationInDays = randomInteger(1, 21);

  const outcomeDate = addDays(startDate, durationInDays);

  if (outcome === "completed") {
    return [
      startedEvent,
      {
        user_id: userId,
        course_id: courseId,
        event_type: "completed",
        progress_pct: 100,
        quiz_score: randomInteger(55, 98),
        timestamp: outcomeDate.toISOString(),
      },
    ];
  }

  return [
    startedEvent,
    {
      user_id: userId,
      course_id: courseId,
      event_type: "dropped",
      progress_pct: randomInteger(10, 70),
      quiz_score: null,
      timestamp: outcomeDate.toISOString(),
    },
  ];
}

function generateUsageEvents(
  users: User[],
  courses: Course[],
  contexts: UserLearningContext[],
  surveys: SurveyResponse[],
): {
  events: UsageEvent[];
  interactionCount: number;
} {
  const contextsByUserId = new Map(
    contexts.map((context) => [context.user_id, context]),
  );

  const surveysByUserId = new Map(
    surveys.map((survey) => [survey.user_id, survey]),
  );

  const eventsWithoutIds: Omit<UsageEvent, "usage_event_id">[] = [];

  let totalInteractions = 0;

  for (const user of users) {
    const context = contextsByUserId.get(user.user_id);

    if (context === undefined) {
      throw new Error(`Missing context for user ${user.user_id}.`);
    }

    const configuration = activityConfigurations[context.activity_segment];

    const interactionCount = randomInteger(
      configuration.minimumInteractions,
      configuration.maximumInteractions,
    );

    totalInteractions += interactionCount;

    const selectedCourses = selectCoursesForUser(
      courses,
      context,
      surveysByUserId.get(user.user_id),
      interactionCount,
    );

    let previousInteractionDate = randomTimestamp(
      USAGE_PERIOD_START,
      USAGE_PERIOD_END,
    );

    for (const selectedCourse of selectedCourses) {
      const latestAllowedStart = addDays(USAGE_PERIOD_END, -21);

      if (previousInteractionDate > latestAllowedStart) {
        previousInteractionDate = latestAllowedStart;
      }

      const outcome = getOutcome(context.activity_segment, selectedCourse);

      const interactionEvents = buildInteractionEvents(
        user.user_id,
        selectedCourse,
        outcome,
        previousInteractionDate,
      );

      eventsWithoutIds.push(...interactionEvents);

      previousInteractionDate = addDays(
        previousInteractionDate,
        randomInteger(2, 20),
      );
    }
  }

  eventsWithoutIds.sort(
    (first, second) =>
      new Date(first.timestamp).getTime() -
      new Date(second.timestamp).getTime(),
  );

  const events: UsageEvent[] = eventsWithoutIds.map((event, index) => ({
    usage_event_id: index + 1,
    ...event,
  }));

  return {
    events,
    interactionCount: totalInteractions,
  };
}

function validateUsageEvents(
  users: User[],
  courses: Course[],
  contexts: UserLearningContext[],
  events: UsageEvent[],
): void {
  const validUserIds = new Set(users.map((user) => user.user_id));

  const validCourseIds = new Set(courses.map((course) => course.course_id));

  const eventIds = new Set<number>();

  const startingUserIds = new Set(
    contexts
      .filter((context) => context.activity_segment === "starting")
      .map((context) => context.user_id),
  );

  for (const event of events) {
    if (eventIds.has(event.usage_event_id)) {
      throw new Error(`Duplicate usage event ID ${event.usage_event_id}.`);
    }

    eventIds.add(event.usage_event_id);

    if (!validUserIds.has(event.user_id)) {
      throw new Error(`Usage event references unknown user ${event.user_id}.`);
    }

    if (!validCourseIds.has(event.course_id)) {
      throw new Error(
        `Usage event references unknown course ${event.course_id}.`,
      );
    }

    if (startingUserIds.has(event.user_id)) {
      throw new Error(
        `Starting user ${event.user_id} should not have usage events.`,
      );
    }

    if (event.progress_pct < 0 || event.progress_pct > 100) {
      throw new Error(`Invalid progress ${event.progress_pct}.`);
    }

    if (event.event_type === "completed" && event.progress_pct !== 100) {
      throw new Error(
        `Completed event ${event.usage_event_id} must have 100% progress.`,
      );
    }

    if (
      event.quiz_score !== null &&
      (event.quiz_score < 0 || event.quiz_score > 100)
    ) {
      throw new Error(`Invalid quiz score ${event.quiz_score}.`);
    }
  }
}

function countUsersBySegment(
  contexts: UserLearningContext[],
): Record<ActivitySegment, number> {
  const result: Record<ActivitySegment, number> = {
    starting: 0,
    light: 0,
    existing: 0,
    heavy: 0,
  };

  for (const context of contexts) {
    result[context.activity_segment]++;
  }

  return result;
}

async function readJson<T>(path: string): Promise<T> {
  try {
    const contents = await readFile(path, "utf-8");

    return JSON.parse(contents) as T;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    throw new Error(`Failed to read ${path}: ${message}`);
  }
}

async function saveJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), {
    recursive: true,
  });

  await writeFile(path, JSON.stringify(value, null, 2), "utf-8");
}

async function main(): Promise<void> {
  const [courseDataset, userDataset, contextDataset, surveyDataset] =
    await Promise.all([
      readJson<CourseDataset>(COURSES_INPUT_PATH),
      readJson<UserDataset>(USERS_INPUT_PATH),
      readJson<UserContextDataset>(CONTEXT_INPUT_PATH),
      readJson<SurveyDataset>(SURVEYS_INPUT_PATH),
    ]);

  const { events, interactionCount } = generateUsageEvents(
    userDataset.users,
    courseDataset.courses,
    contextDataset.contexts,
    surveyDataset.survey_responses,
  );

  validateUsageEvents(
    userDataset.users,
    courseDataset.courses,
    contextDataset.contexts,
    events,
  );

  const usersWithUsage = new Set(events.map((event) => event.user_id)).size;

  const dataset: UsageDataset = {
    metadata: {
      total_users: userDataset.users.length,

      users_with_usage: usersWithUsage,

      total_course_interactions: interactionCount,

      total_usage_events: events.length,

      users_by_segment: countUsersBySegment(contextDataset.contexts),

      seed: RANDOM_SEED,
    },

    usage_events: events,
  };

  await saveJson(USAGE_OUTPUT_PATH, dataset);

  console.log("Usage events generated successfully.");

  console.log(`Course interactions: ${interactionCount}`);

  console.log(`Usage events: ${events.length}`);

  console.log(`Users with usage: ${usersWithUsage}`);

  console.log(`Output: ${USAGE_OUTPUT_PATH}`);
}

main().catch((error: unknown) => {
  console.error("Failed to generate usage events:", error);

  process.exitCode = 1;
});
