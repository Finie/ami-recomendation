import type { Course } from "#models/course.js";

import type { SurveyResponse } from "#models/survey-response.js";

import type { SignalScoreResult } from "#models/recommendation.js";

export interface SurveyScoringService {
  score(course: Course, survey: SurveyResponse | null): SignalScoreResult;
}
