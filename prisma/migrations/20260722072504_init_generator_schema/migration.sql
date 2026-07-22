-- CreateEnum
CREATE TYPE "CourseLevel" AS ENUM ('beginner', 'intermediate', 'advanced');

-- CreateEnum
CREATE TYPE "UsageEventType" AS ENUM ('started', 'completed', 'dropped');

-- CreateEnum
CREATE TYPE "Seniority" AS ENUM ('entry', 'junior', 'mid', 'senior', 'manager', 'director', 'executive');

-- CreateEnum
CREATE TYPE "ActivitySegment" AS ENUM ('starting', 'light', 'existing', 'heavy');

-- CreateEnum
CREATE TYPE "CompanySize" AS ENUM ('1-10', '11-50', '51-200', '201-500', '501-1000', '1000+');

-- CreateEnum
CREATE TYPE "CourseTopic" AS ENUM ('Leadership', 'People Management', 'Communication', 'Sales', 'Customer Service', 'Finance', 'Strategy', 'Operations', 'Project Management', 'Entrepreneurship');

-- CreateTable
CREATE TABLE "users" (
    "user_id" SERIAL NOT NULL,
    "role" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "company_size" "CompanySize" NOT NULL,
    "seniority" "Seniority" NOT NULL,
    "stated_goal" TEXT NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "user_learning_contexts" (
    "user_learning_context_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "role_family" TEXT NOT NULL,
    "activity_segment" "ActivitySegment" NOT NULL,
    "primary_topics" "CourseTopic"[],
    "secondary_topics" "CourseTopic"[],
    "likely_skill_gaps" TEXT[],

    CONSTRAINT "user_learning_contexts_pkey" PRIMARY KEY ("user_learning_context_id")
);

-- CreateTable
CREATE TABLE "courses" (
    "course_id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "topic" "CourseTopic" NOT NULL,
    "level" "CourseLevel" NOT NULL,
    "skills_taught" TEXT[],
    "duration_mins" INTEGER NOT NULL,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("course_id")
);

-- CreateTable
CREATE TABLE "course_prerequisites" (
    "course_id" INTEGER NOT NULL,
    "prerequisite_course_id" INTEGER NOT NULL,

    CONSTRAINT "course_prerequisites_pkey" PRIMARY KEY ("course_id","prerequisite_course_id")
);

-- CreateTable
CREATE TABLE "survey_responses" (
    "survey_response_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "skill_gaps" TEXT[],
    "goals" TEXT[],
    "preferred_topics" "CourseTopic"[],
    "confidence_by_topic" JSONB NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "survey_responses_pkey" PRIMARY KEY ("survey_response_id")
);

-- CreateTable
CREATE TABLE "usage_events" (
    "usage_event_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "course_id" INTEGER NOT NULL,
    "event_type" "UsageEventType" NOT NULL,
    "progress_pct" INTEGER NOT NULL,
    "quiz_score" DOUBLE PRECISION,
    "timestamp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usage_events_pkey" PRIMARY KEY ("usage_event_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_learning_contexts_user_id_key" ON "user_learning_contexts"("user_id");

-- CreateIndex
CREATE INDEX "courses_topic_idx" ON "courses"("topic");

-- CreateIndex
CREATE INDEX "courses_level_idx" ON "courses"("level");

-- CreateIndex
CREATE INDEX "course_prerequisites_prerequisite_course_id_idx" ON "course_prerequisites"("prerequisite_course_id");

-- CreateIndex
CREATE UNIQUE INDEX "survey_responses_user_id_key" ON "survey_responses"("user_id");

-- CreateIndex
CREATE INDEX "usage_events_user_id_idx" ON "usage_events"("user_id");

-- CreateIndex
CREATE INDEX "usage_events_course_id_idx" ON "usage_events"("course_id");

-- CreateIndex
CREATE INDEX "usage_events_user_id_course_id_idx" ON "usage_events"("user_id", "course_id");

-- CreateIndex
CREATE INDEX "usage_events_event_type_idx" ON "usage_events"("event_type");

-- CreateIndex
CREATE INDEX "usage_events_timestamp_idx" ON "usage_events"("timestamp");

-- AddForeignKey
ALTER TABLE "user_learning_contexts" ADD CONSTRAINT "user_learning_contexts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_prerequisites" ADD CONSTRAINT "course_prerequisites_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("course_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_prerequisites" ADD CONSTRAINT "course_prerequisites_prerequisite_course_id_fkey" FOREIGN KEY ("prerequisite_course_id") REFERENCES "courses"("course_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("course_id") ON DELETE CASCADE ON UPDATE CASCADE;
