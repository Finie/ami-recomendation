import type { CourseTopic } from "./course.js";

export type Seniority =
  | "entry"
  | "junior"
  | "mid"
  | "senior"
  | "manager"
  | "director"
  | "executive";

export type CompanySize =
  | "1-10"
  | "11-50"
  | "51-200"
  | "201-500"
  | "501-1000"
  | "1000+";

export type ActivitySegment = "starting" | "light" | "existing" | "heavy";

export interface User {
  user_id: number;
  role: string;
  industry: string;
  company_size: CompanySize;
  seniority: Seniority;
  stated_goal: string;
}

export interface UserLearningContext {
  user_id: number;
  role_family: string;
  activity_segment: ActivitySegment;
  primary_topics: CourseTopic[];
  secondary_topics: CourseTopic[];
  likely_skill_gaps: string[];
}
