import type { Course } from "./course.js";
import type { ActivitySegment } from "./user.js";

export interface RecommendationWeights {
  profile: number;
  survey: number;
  usage: number;
}

export interface SignalScores {
  profile: number;
  survey: number;
  usage: number;
}

export interface WeightedContributions {
  profile: number;
  survey: number;
  usage: number;
}

export interface RecommendationReason {
  signal: "profile" | "survey" | "usage" | "filter";

  description: string;
}

export interface SignalScoreResult {
  score: number;
  reasons: string[];
}

export interface CourseRecommendation {
  course: Course;
  activity_segment: ActivitySegment;
  signal_scores: SignalScores;
  weights: RecommendationWeights;
  weighted_contributions: WeightedContributions;
  final_score: number;
  reason: string;
  reasons: RecommendationReason[];
}
