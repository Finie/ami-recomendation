import { fileURLToPath } from "node:url";

/**
 * True when the module at `moduleUrl` was invoked directly (e.g. `tsx
 * src/scripts/generate-courses.ts`) rather than imported by another module
 * (e.g. the `generate-dataset.ts` orchestrator).
 */
export function isMainModule(moduleUrl: string): boolean {
  const entryPoint = process.argv[1];

  if (!entryPoint) {
    return false;
  }

  return fileURLToPath(moduleUrl) === entryPoint;
}
