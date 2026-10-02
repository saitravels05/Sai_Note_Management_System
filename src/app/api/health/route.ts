import { NextResponse } from "next/server";
import { checkDatabaseHealth } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const probe = searchParams.get("probe");
  const dbHealth = await checkDatabaseHealth();

  const isDegraded = !dbHealth.connected;
  const healthData = {
    status: isDegraded ? "DEGRADED" : "HEALTHY",
    application: "Sai Tours & Travels Accounting & Operations System",
    version: "1.0.0-phase1",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    database: {
      status: dbHealth.status,
      latencyMs: dbHealth.latencyMs,
    },
    services: {
      moneyEngine: "DECIMAL_SAFE_ACTIVE",
      timezone: "Asia/Kolkata",
      defaultCurrency: "INR",
    },
  };

  const statusCode = probe === "readiness" && isDegraded ? 503 : 200;
  return NextResponse.json(healthData, { status: statusCode });
}
