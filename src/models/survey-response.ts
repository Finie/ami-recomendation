import type { CourseTopic } from "./course.js";

export interface SurveyResponse {
  survey_response_id: number;
  user_id: number;
  skill_gaps: string[];
  goals: string[];
  preferred_topics: CourseTopic[];
  confidence_by_topic: Partial<Record<CourseTopic, number>>;
  submitted_at: string;
}
