import { z } from "zod";

/**
 * Server-only environment variable schema.
 * These are NEVER exposed to the client bundle.
 */
const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DIRECT_DATABASE_URL: z.string().optional(),
  AUTH_SECRET: z.string().min(16, "AUTH_SECRET should be at least 16 characters").default("dev-secret-key-change-in-production-1234"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  LOG_LEVEL: z.enum(["DEBUG", "INFO", "WARN", "ERROR"]).default("INFO"),
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  LOCAL_UPLOAD_DIR: z.string().default("./uploads"),
  MAX_UPLOAD_SIZE_BYTES: z.coerce.number().default(10485760), // 10MB default
  AI_PROVIDER: z.enum(["gemini", "openai"]).default("gemini"),
  GEMINI_API_KEY: z.string().optional().default(""),
  OPENAI_API_KEY: z.string().optional().default(""),
  DEFAULT_TIMEZONE: z.string().default("Asia/Kolkata"),
});

/**
 * Public client-accessible environment variable schema.
 * Prefixed with NEXT_PUBLIC_
 */
const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().default("Sai Tours & Travels Accounting System"),
  NEXT_PUBLIC_DEFAULT_CURRENCY: z.string().default("INR"),
  NEXT_PUBLIC_DEFAULT_LOCALE: z.string().default("en-IN"),
});

function validateEnv() {
  const isServer = typeof window === "undefined";

  const clientResult = clientEnvSchema.safeParse({
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_DEFAULT_CURRENCY: process.env.NEXT_PUBLIC_DEFAULT_CURRENCY,
    NEXT_PUBLIC_DEFAULT_LOCALE: process.env.NEXT_PUBLIC_DEFAULT_LOCALE,
  });

  if (!clientResult.success) {
    console.error("❌ Invalid public environment variables:", clientResult.error.format());
    throw new Error("Invalid public environment variables");
  }

  let serverEnv = {} as z.infer<typeof serverEnvSchema>;

  if (isServer) {
    const serverResult = serverEnvSchema.safeParse(process.env);
    if (!serverResult.success) {
      console.error("❌ Invalid server environment configuration:");
      console.error(JSON.stringify(serverResult.error.format(), null, 2));
      throw new Error("Missing or invalid server environment variables. Check .env.local");
    }
    serverEnv = serverResult.data;
  }

  return {
    server: serverEnv,
    client: clientResult.data,
  };
}

export const env = validateEnv();
