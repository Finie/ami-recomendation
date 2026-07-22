import { beforeEach, describe, expect, it, vi } from "vitest";
import type { generateUsers as GenerateUsers } from "./generate-users.js";

/**
 * `generate-users.ts` seeds its pseudo-random generator once at module load
 * and mutates that state on every call, so proving "same seed -> same
 * output" requires a fresh module instance per generation, not two calls
 * against the same imported module.
 */
async function freshGenerateUsers(): Promise<typeof GenerateUsers> {
  vi.resetModules();

  const module = await import("./generate-users.js");

  return module.generateUsers;
}

beforeEach(() => {
  vi.resetModules();
});

describe("generateUsers", () => {
  it("is deterministic across independent module instances (fixed seed)", async () => {
    const first = await freshGenerateUsers();
    const second = await freshGenerateUsers();

    expect(first()).toEqual(second());
  });

  it("generates exactly 1000 users and 1000 contexts", async () => {
    const generateUsers = await freshGenerateUsers();
    const { users, contexts } = generateUsers();

    expect(users).toHaveLength(1000);
    expect(contexts).toHaveLength(1000);
  });

  it("generates exactly one context per user", async () => {
    const generateUsers = await freshGenerateUsers();
    const { users, contexts } = generateUsers();

    const contextUserIds = new Set(contexts.map((c) => c.user_id));

    expect(contextUserIds.size).toBe(users.length);

    for (const user of users) {
      expect(contextUserIds.has(user.user_id)).toBe(true);
    }
  });

  it("keeps the activity segment distribution within expected tolerances", async () => {
    const module = await import("./generate-users.js");
    const { contexts } = module.generateUsers();

    const counts = module.countUsersByActivitySegment(contexts);
    const total = contexts.length;

    // Configured weights: starting 20, light 30, existing 35, heavy 15 (out of 100).
    expect(counts.starting / total).toBeGreaterThan(0.1);
    expect(counts.starting / total).toBeLessThan(0.3);
    expect(counts.existing / total).toBeGreaterThan(0.25);
    expect(counts.existing / total).toBeLessThan(0.45);
  });
});
