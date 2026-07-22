import type { Course } from "../../domain/entities/course.js";

import type { SurveyResponse } from "../../domain/entities/survey-response.js";

import type { SignalScoreResult } from "../../domain/entities/recommendation.js";

export interface SurveyScoringService {
  score(course: Course, survey: SurveyResponse | null): SignalScoreResult;
}
