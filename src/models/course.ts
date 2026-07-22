export type CourseLevel = "beginner" | "intermediate" | "advanced";

export type CourseTopic =
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

export interface Course {
  course_id: number;
  title: string;
  topic: CourseTopic;
  level: CourseLevel;
  skills_taught: string[];
  duration_mins: number;
  prerequisites: number[];
}
