import { GoogleGenAI, Type } from "@google/genai";
import { z } from "zod";

import type { CourseRecommendation } from "#models/recommendation.js";

import type {
  AIRecommendationReview,
  RecommendationAIReviewService,
} from "#services/recommendation-ai-review-service.js";

const SYSTEM_INSTRUCTION = `
You are a supportive learning and career coach.

You will receive a list of already-ranked course recommendations produced by a deterministic recommendation engine.

For each course, rewrite the supplied explanation into exactly one concise, friendly, natural sentence explaining why the course is useful for the learner.

Rules:
- Address the learner directly using "you".
- Use only the evidence supplied in the request.
- Do not invent user goals, completed courses, preferences, experience, achievements, or skill gaps.
- Do not change the course recommendation.
- Do not suggest a different course.
- Do not mention scores, weights, ranking formulas, signals, algorithms, AI, models, or technical recommendation terminology.
- Do not mention private or sensitive personal information.
- Keep each explanation to one sentence.
- Keep each explanation below 300 characters.
- Avoid exaggerated promises.
- Return one review for every supplied course.
- Preserve each supplied course_id exactly.
`;

const RecommendationReviewSchema = z.object({
  reviews: z.array(
    z.object({
      course_id: z.number().int().positive(),
      ai_reason: z.string().trim().min(1).max(300),
    }),
  ),
});

export type RecommendationReview = z.infer<
  typeof RecommendationReviewSchema
>["reviews"][number];

interface GeminiRecommendationInput {
  course_id: number;
  title: string;
  topic: string;
  level: string;
  deterministic_reason: string;
  supporting_reasons: string[];
}

export function parseGeminiReviewResponse(
  rawText: string | undefined,
): RecommendationReview[] {
  if (!rawText) {
    throw new Error("Gemini returned an empty response");
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error("Gemini returned invalid JSON");
  }

  const result = RecommendationReviewSchema.safeParse(parsed);

  if (!result.success) {
    throw new Error(
      `Gemini response failed schema validation: ${result.error.message}`,
    );
  }

  return result.data.reviews;
}

export function validateReviewCoverage(
  reviews: RecommendationReview[],
  recommendations: CourseRecommendation[],
): AIRecommendationReview[] {
  const requestedCourseIds = new Set(
    recommendations.map((recommendation) => recommendation.course.course_id),
  );

  const seenCourseIds = new Set<number>();

  for (const review of reviews) {
    if (!requestedCourseIds.has(review.course_id)) {
      throw new Error(
        `Gemini returned an unknown course_id: ${review.course_id}`,
      );
    }

    if (seenCourseIds.has(review.course_id)) {
      throw new Error(
        `Gemini returned a duplicate course_id: ${review.course_id}`,
      );
    }

    seenCourseIds.add(review.course_id);
  }

  for (const courseId of requestedCourseIds) {
    if (!seenCourseIds.has(courseId)) {
      throw new Error(
        `Gemini did not return a review for course_id: ${courseId}`,
      );
    }
  }

  return reviews.map((review) => ({
    course_id: review.course_id,
    ai_reason: review.ai_reason,
  }));
}

export class GeminiRecommendationAIReviewService
  implements RecommendationAIReviewService
{
  private readonly ai: GoogleGenAI;

  public constructor(
    apiKey: string,
    private readonly model: string,
  ) {
    if (!apiKey.trim()) {
      throw new Error("GEMINI_API_KEY is required");
    }

    if (!model.trim()) {
      throw new Error("GEMINI_MODEL is required");
    }

    this.ai = new GoogleGenAI({ apiKey });
  }

  public async review(
    recommendations: CourseRecommendation[],
  ): Promise<AIRecommendationReview[]> {
    if (recommendations.length === 0) {
      return [];
    }

    const input = this.buildInput(recommendations);

    const response = await this.ai.models.generateContent({
      model: this.model,
      contents: JSON.stringify({ recommendations: input }),
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.3,
        maxOutputTokens: 2048,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reviews: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  course_id: {
                    type: Type.INTEGER,
                  },
                  ai_reason: {
                    type: Type.STRING,
                    description:
                      "A concise, friendly, one-sentence explanation directly addressing the learner using 'you' and explaining why the course is relevant.",
                  },
                },
                required: ["course_id", "ai_reason"],
              },
            },
          },
          required: ["reviews"],
        },
      },
    });

    const reviews = parseGeminiReviewResponse(response.text);

    return validateReviewCoverage(reviews, recommendations);
  }

  private buildInput(
    recommendations: CourseRecommendation[],
  ): GeminiRecommendationInput[] {
    return recommendations.map((recommendation) => ({
      course_id: recommendation.course.course_id,
      title: recommendation.course.title,
      topic: recommendation.course.topic,
      level: recommendation.course.level,
      deterministic_reason: recommendation.reason,
      supporting_reasons: recommendation.reasons.map(
        (reason) => reason.description,
      ),
    }));
  }
}
