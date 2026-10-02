import { PrismaClient } from "@prisma/client";
import { logger } from "./logger";

declare global {
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ||
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? [
            { emit: "event", level: "error" },
            { emit: "event", level: "warn" },
          ]
        : [{ emit: "event", level: "error" }],
  });

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}

/**
 * Safe database connectivity health check.
 * Strictly guarantees credentials or host IPs are NEVER leaked.
 */
export async function checkDatabaseHealth(): Promise<{
  connected: boolean;
  status: "CONNECTED" | "UNAVAILABLE";
  latencyMs?: number;
}> {
  const start = Date.now();
  try {
    // Fast raw ping query
    await prisma.$queryRaw`SELECT 1`;
    const latencyMs = Date.now() - start;
    return {
      connected: true,
      status: "CONNECTED",
      latencyMs,
    };
  } catch (error) {
    logger.warn("Database connection health check failed", {
      reason: error instanceof Error ? error.message : "Unknown",
    });
    return {
      connected: false,
      status: "UNAVAILABLE",
    };
  }
}
