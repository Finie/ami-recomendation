import { mkdir, readFile, writeFile } from "node:fs/promises";
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

type ActivitySegment = "starting" | "light" | "existing" | "heavy";

interface User {
  user_id: number;
  role: string;
  industry: string;
  company_size: CompanySize;
  seniority: Seniority;
  stated_goal: string;
}

interface UserDataset {
  metadata: {
    total_users: number;
    seed: number;
  };
  users: User[];
}

interface GeneratedUserContext {
  user_id: number;
  role_family: string;

  /**
   * Optional so the script still works with your current
   * user-learning-context.json.
   */
  activity_segment?: ActivitySegment;

  primary_topics: CourseTopic[];
  secondary_topics: CourseTopic[];
  likely_skill_gaps: string[];
}

interface UserContextDataset {
  metadata: {
    total_users: number;
    purpose: string;
  };
  contexts: GeneratedUserContext[];
}

interface SurveyResponse {
  survey_response_id: number;
  user_id: number;

  skill_gaps: string[];
  goals: string[];
  preferred_topics: CourseTopic[];

  /**
   * Confidence uses a scale from 1 to 5:
   *
   * 1 = very low confidence
   * 2 = low confidence
   * 3 = moderate confidence
   * 4 = high confidence
   * 5 = very high confidence
   */
  confidence_by_topic: Partial<Record<CourseTopic, number>>;

  submitted_at: string;
}

interface SurveyDataset {
  metadata: {
    total_users: number;
    total_survey_responses: number;
    survey_completion_rate: number;
    confidence_scale: {
      minimum: number;
      maximum: number;
    };
    seed: number;
  };
  survey_responses: SurveyResponse[];
}

interface WeightedValue<T> {
  value: T;
  weight: number;
}

const RANDOM_SEED = 2027;

const USERS_INPUT_PATH = resolve(process.cwd(), "data", "users.json");

const CONTEXT_INPUT_PATH = resolve(
  process.cwd(),
  "data",
  "user-learning-context.json",
);

const SURVEYS_OUTPUT_PATH = resolve(
  process.cwd(),
  "data",
  "survey_responses.json",
);

/**
 * Survey dates will be generated within this period.
 *
 * Keeping the dates fixed makes the generated dataset
 * deterministic and reproducible.
 */
const SURVEY_PERIOD_START = new Date("2025-01-01T08:00:00.000Z");

const SURVEY_PERIOD_END = new Date("2026-06-30T18:00:00.000Z");

/**
 * Deterministic pseudo-random number generator.
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
    throw new Error("Index out of bounds while selecting a value.");
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

  const finalItem = values.at(-1);

  if (finalItem === undefined) {
    throw new Error("Could not select a weighted value.");
  }

  return finalItem.value;
}

function randomInteger(minimum: number, maximum: number): number {
  if (maximum < minimum) {
    throw new Error(`Invalid range: ${minimum} to ${maximum}.`);
  }

  return Math.floor(random() * (maximum - minimum + 1)) + minimum;
}

function shuffle<T>(values: readonly T[]): T[] {
  const result = [...values];

  for (let index = result.length - 1; index > 0; index--) {
    const randomIndex = randomInteger(0, index);

    const currentValue = result[index];
    const randomValue = result[randomIndex];

    if (currentValue === undefined || randomValue === undefined) {
      throw new Error("Unexpected value while shuffling.");
    }

    result[index] = randomValue;
    result[randomIndex] = currentValue;
  }

  return result;
}

function selectRandomValues<T>(
  values: readonly T[],
  minimum: number,
  maximum: number,
): T[] {
  if (values.length === 0) {
    return [];
  }

  const safeMinimum = Math.min(minimum, values.length);

  const safeMaximum = Math.min(maximum, values.length);

  const amount = randomInteger(safeMinimum, safeMaximum);

  return shuffle(values).slice(0, amount);
}

function uniqueValues<T>(values: T[]): T[] {
  return [...new Set(values)];
}

/**
 * Converts a natural language goal into a machine-friendly tag.
 *
 * Example:
 *
 * "Improve operational efficiency"
 * becomes:
 * "improve_operational_efficiency"
 */
function toTag(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function topicToTag(topic: CourseTopic): string {
  return toTag(topic);
}

function getSurveyProbability(activitySegment?: ActivitySegment): number {
  switch (activitySegment) {
    case "starting":
      return 0.98;

    case "light":
      return 0.94;

    case "existing":
      return 0.9;

    case "heavy":
      return 0.85;

    default:
      /**
       * Supports the existing context file before
       * activity_segment is added.
       */
      return 0.9;
  }
}

function shouldGenerateSurvey(context: GeneratedUserContext): boolean {
  const probability = getSurveyProbability(context.activity_segment);

  return random() < probability;
}

function generateSkillGaps(context: GeneratedUserContext): string[] {
  /**
   * Most users identify between two and four skill gaps.
   */
  return selectRandomValues(uniqueValues(context.likely_skill_gaps), 2, 4);
}

function generatePreferredTopics(context: GeneratedUserContext): CourseTopic[] {
  /**
   * Primary topics should almost always appear.
   */
  const primaryTopics = context.primary_topics;

  /**
   * Add one or two related topics for variety.
   */
  const secondaryTopics = selectRandomValues(context.secondary_topics, 1, 2);

  return uniqueValues([...primaryTopics, ...secondaryTopics]);
}

function generateGoals(
  user: User,
  context: GeneratedUserContext,
  skillGaps: string[],
): string[] {
  const goals: string[] = [toTag(user.stated_goal)];

  /**
   * About 65% of users also select a skill-specific goal.
   */
  if (skillGaps.length > 0 && random() < 0.65) {
    const selectedSkill = chooseOne(skillGaps);

    goals.push(`develop_${selectedSkill}`);
  }

  /**
   * About 35% select an additional broader topic goal.
   */
  if (context.primary_topics.length > 0 && random() < 0.35) {
    const selectedTopic = chooseOne(context.primary_topics);

    goals.push(`improve_${topicToTag(selectedTopic)}_skills`);
  }

  return uniqueValues(goals).slice(0, 3);
}

function getBaseConfidence(seniority: Seniority): number {
  switch (seniority) {
    case "entry":
      return 2;

    case "junior":
      return 2;

    case "mid":
      return 3;

    case "senior":
      return 3;

    case "manager":
      return 3;

    case "director":
      return 4;

    case "executive":
      return 4;
  }
}

function clampConfidence(value: number): number {
  return Math.max(1, Math.min(5, value));
}

function generateTopicConfidence(
  user: User,
  context: GeneratedUserContext,
  preferredTopics: CourseTopic[],
): Partial<Record<CourseTopic, number>> {
  const confidence: Partial<Record<CourseTopic, number>> = {};

  const baseConfidence = getBaseConfidence(user.seniority);

  for (const topic of preferredTopics) {
    const isPrimaryTopic = context.primary_topics.includes(topic);

    /**
     * Users tend to choose topics where they have
     * moderate or low confidence.
     *
     * Primary role topics receive a small experience
     * advantage, but noise keeps the data realistic.
     */
    const primaryAdjustment = isPrimaryTopic ? 0 : -1;

    const randomAdjustment = chooseWeighted([
      {
        value: -1,
        weight: 30,
      },
      {
        value: 0,
        weight: 50,
      },
      {
        value: 1,
        weight: 20,
      },
    ]);

    confidence[topic] = clampConfidence(
      baseConfidence + primaryAdjustment + randomAdjustment,
    );
  }

  return confidence;
}

function generateSurveyDate(): string {
  const startTime = SURVEY_PERIOD_START.getTime();
  const endTime = SURVEY_PERIOD_END.getTime();

  const timestamp = startTime + random() * (endTime - startTime);

  return new Date(timestamp).toISOString();
}

function generateSurveyResponses(
  users: User[],
  contexts: GeneratedUserContext[],
): SurveyResponse[] {
  const contextsByUserId = new Map(
    contexts.map((context) => [context.user_id, context]),
  );

  const responses: SurveyResponse[] = [];

  for (const user of users) {
    const context = contextsByUserId.get(user.user_id);

    if (context === undefined) {
      throw new Error(`Missing learning context for user ${user.user_id}.`);
    }

    if (!shouldGenerateSurvey(context)) {
      continue;
    }

    const skillGaps = generateSkillGaps(context);

    const preferredTopics = generatePreferredTopics(context);

    responses.push({
      survey_response_id: responses.length + 1,

      user_id: user.user_id,

      skill_gaps: skillGaps,

      goals: generateGoals(user, context, skillGaps),

      preferred_topics: preferredTopics,

      confidence_by_topic: generateTopicConfidence(
        user,
        context,
        preferredTopics,
      ),

      submitted_at: generateSurveyDate(),
    });
  }

  return responses;
}

function validateSurveyResponses(
  users: User[],
  responses: SurveyResponse[],
): void {
  const validUserIds = new Set(users.map((user) => user.user_id));

  const surveyUserIds = new Set<number>();

  for (const response of responses) {
    if (!validUserIds.has(response.user_id)) {
      throw new Error(
        `Survey ${response.survey_response_id} references unknown user ${response.user_id}.`,
      );
    }

    if (surveyUserIds.has(response.user_id)) {
      throw new Error(
        `User ${response.user_id} has more than one survey response.`,
      );
    }

    surveyUserIds.add(response.user_id);

    if (response.skill_gaps.length === 0) {
      throw new Error(`Survey for user ${response.user_id} has no skill gaps.`);
    }

    if (response.goals.length === 0) {
      throw new Error(`Survey for user ${response.user_id} has no goals.`);
    }

    if (response.preferred_topics.length === 0) {
      throw new Error(
        `Survey for user ${response.user_id} has no preferred topics.`,
      );
    }

    for (const [topic, confidence] of Object.entries(
      response.confidence_by_topic,
    )) {
      if (confidence === undefined || confidence < 1 || confidence > 5) {
        throw new Error(
          `Invalid confidence ${confidence} for topic ${topic} on user ${response.user_id}.`,
        );
      }
    }
  }
}

async function readJson<T>(path: string): Promise<T> {
  try {
    const content = await readFile(path, "utf-8");

    return JSON.parse(content) as T;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    throw new Error(`Failed to read JSON file ${path}: ${message}`);
  }
}

async function saveJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), {
    recursive: true,
  });

  await writeFile(path, JSON.stringify(value, null, 2), "utf-8");
}

async function main(): Promise<void> {
  const [userDataset, contextDataset] = await Promise.all([
    readJson<UserDataset>(USERS_INPUT_PATH),
    readJson<UserContextDataset>(CONTEXT_INPUT_PATH),
  ]);

  const surveyResponses = generateSurveyResponses(
    userDataset.users,
    contextDataset.contexts,
  );

  validateSurveyResponses(userDataset.users, surveyResponses);

  const completionRate = surveyResponses.length / userDataset.users.length;

  const dataset: SurveyDataset = {
    metadata: {
      total_users: userDataset.users.length,

      total_survey_responses: surveyResponses.length,

      survey_completion_rate: Number(completionRate.toFixed(4)),

      confidence_scale: {
        minimum: 1,
        maximum: 5,
      },

      seed: RANDOM_SEED,
    },

    survey_responses: surveyResponses,
  };

  await saveJson(SURVEYS_OUTPUT_PATH, dataset);

  console.log("Survey responses generated successfully.");

  console.log(`Users: ${userDataset.users.length}`);

  console.log(`Survey responses: ${surveyResponses.length}`);

  console.log(`Survey completion rate: ${(completionRate * 100).toFixed(1)}%`);

  console.log(`Survey file: ${SURVEYS_OUTPUT_PATH}`);
}

main().catch((error: unknown) => {
  console.error("Failed to generate survey responses:", error);

  process.exitCode = 1;
});
