/**
 * Production Safety Guard for Automated Testing
 * 
 * Mandate:
 * Automated tests must NEVER execute destructive operations against a production database,
 * production file storage, or live business environment.
 */

export function assertTestEnvironment(contextName = "Automated Test"): void {
  const nodeEnv = process.env.NODE_ENV?.toLowerCase();
  const appEnv = process.env.APP_ENV?.toLowerCase();
  const dbUrl = process.env.DATABASE_URL || "";

  // 1. Guard against production environment flags
  if (nodeEnv === "production" || appEnv === "production") {
    throw new Error(
      `🚨 PRODUCTION SAFETY GUARD TRIGGERED in ${contextName}: Destructive tests cannot run in a production environment (NODE_ENV=${nodeEnv}, APP_ENV=${appEnv}). Execution halted immediately.`
    );
  }

  // 2. Guard against production database URLs
  const prodIndicators = ["supabase.co", "neon.tech", "rds.amazonaws.com", "prod", "production"];
  for (const indicator of prodIndicators) {
    if (dbUrl.includes(indicator) && !dbUrl.includes("localhost") && !dbUrl.includes("127.0.0.1") && !dbUrl.includes("test")) {
      throw new Error(
        `🚨 PRODUCTION SAFETY GUARD TRIGGERED in ${contextName}: DATABASE_URL appears to target a remote/production host (${indicator}). Execution halted immediately.`
      );
    }
  }
}
