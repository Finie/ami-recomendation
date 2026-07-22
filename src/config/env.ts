import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.string().min(1),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().trim().min(1).default("gemini-3.6-flash"),
  AI_REVIEW_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .finite()
    .catch(5000)
    .default(5000),
});

// this file is for loading enviromental variables and validating them using zod schema
function parseEnv(): z.infer<typeof schema> {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    throw new Error(
      `Invalid environment configuration:\n${result.error.message}`,
    );
  }
  return result.data;
}

export const env = parseEnv();
export type Env = typeof env;
