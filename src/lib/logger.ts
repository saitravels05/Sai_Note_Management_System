type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

const LOG_LEVELS: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

const SENSITIVE_KEYS = new Set([
  "password",
  "passwordhash",
  "secret",
  "auth_secret",
  "token",
  "apikey",
  "api_key",
  "gemini_api_key",
  "openai_api_key",
  "authorization",
  "cookie",
  "database_url",
]);

/**
 * Recursively sanitize sensitive keys from log metadata
 */
function sanitizeMeta(meta: unknown): unknown {
  if (!meta || typeof meta !== "object") {
    return meta;
  }

  if (Array.isArray(meta)) {
    return meta.map(sanitizeMeta);
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lowerKey) || lowerKey.includes("password") || lowerKey.includes("secret")) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeMeta(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

class Logger {
  private currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || "INFO";

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.currentLevel];
  }

  private output(level: LogLevel, message: string, meta?: unknown) {
    if (!this.shouldLog(level)) return;

    const timestamp = new Date().toISOString();
    const cleanMeta = meta ? sanitizeMeta(meta) : undefined;

    if (process.env.NODE_ENV === "production") {
      // Structured JSON in production
      console.log(
        JSON.stringify({
          timestamp,
          level,
          message,
          ...(cleanMeta ? { meta: cleanMeta } : {}),
        })
      );
    } else {
      // Human-readable in development
      const prefix = `[${timestamp}] [${level}]`;
      if (level === "ERROR") {
        console.error(prefix, message, cleanMeta ?? "");
      } else if (level === "WARN") {
        console.warn(prefix, message, cleanMeta ?? "");
      } else {
        console.log(prefix, message, cleanMeta ?? "");
      }
    }
  }

  public debug(message: string, meta?: unknown) {
    this.output("DEBUG", message, meta);
  }

  public info(message: string, meta?: unknown) {
    this.output("INFO", message, meta);
  }

  public warn(message: string, meta?: unknown) {
    this.output("WARN", message, meta);
  }

  public error(message: string, meta?: unknown) {
    this.output("ERROR", message, meta);
  }
}

export const logger = new Logger();
