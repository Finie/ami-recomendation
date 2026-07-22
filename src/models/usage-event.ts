export type UsageEventType = "started" | "completed" | "dropped";

export interface UsageEvent {
  usage_event_id: number;
  user_id: number;
  course_id: number;
  event_type: UsageEventType;
  progress_pct: number;
  quiz_score: number | null;
  timestamp: string;
}
