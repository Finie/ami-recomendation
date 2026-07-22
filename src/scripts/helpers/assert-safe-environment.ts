import { env } from "#config/env.js";

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

/** Hostname and database name only — never credentials. */
export interface DatabaseTarget {
  hostname: string;
  port: string;
  databaseName: string;
}

export function describeDatabaseTarget(databaseUrl: string): DatabaseTarget {
  const parsed = new URL(databaseUrl);

  return {
    hostname: parsed.hostname,
    port: parsed.port || "5432",
    databaseName: parsed.pathname.replace(/^\//, ""),
  };
}

function looksLikeProductionTarget(target: DatabaseTarget): boolean {
  const isRemoteHost = !LOCAL_HOSTNAMES.has(target.hostname);
  const nameMentionsProd = /prod/i.test(target.databaseName);
  const hostMentionsProd = /prod/i.test(target.hostname);

  return hostMentionsProd || (isRemoteHost && nameMentionsProd);
}

/**
 * Guards the destructive dataset-generation pipeline (full delete + reseed)
 * against ever running somewhere it could destroy real data.
 *
 * Never logs the full connection string, since it may carry credentials —
 * only the hostname/port/database name, which are safe to print.
 */
export function assertSafeEnvironment(): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Synthetic dataset generation is disabled in production (NODE_ENV=production).",
    );
  }

  const target = describeDatabaseTarget(env.DATABASE_URL);

  if (looksLikeProductionTarget(target)) {
    throw new Error(
      `Refusing to run synthetic dataset generation against a database that looks like production ` +
        `(host "${target.hostname}", database "${target.databaseName}"). ` +
        "Point DATABASE_URL at a development or test database to proceed.",
    );
  }
}
