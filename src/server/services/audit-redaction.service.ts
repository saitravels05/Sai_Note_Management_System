/**
 * Centralized Audit Sanitization & Redaction Service (Phase 15)
 * Enforces strict redaction of credentials, tokens, API keys, and secrets.
 * Provides deterministic change diffing and formula-injection defenses.
 */

// Deny-list of keys that must NEVER be recorded in plain text in audit logs or exports
const FORBIDDEN_SECRET_KEYS = new Set([
  "password",
  "passwordhash",
  "newpassword",
  "oldpassword",
  "confirmpassword",
  "token",
  "sessiontoken",
  "refreshtoken",
  "resettoken",
  "invitetoken",
  "apikey",
  "api_key",
  "secret",
  "jwtsecret",
  "authsecret",
  "databaseurl",
  "database_url",
  "storagekey",
  "storage_key",
  "secretkey",
  "accesskey",
  "access_key",
  "credential",
  "credentials",
  "authorization",
  "bearer",
  "cookie",
  "cookies",
  "privatekey",
  "private_key",
  "webhooksecret",
]);

export interface SanitizedDiffResult {
  previousValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  changedFields: string[];
}

export class AuditRedactionService {
  /**
   * Recursively sanitizes any value or nested JSON object, replacing secret keys with '[REDACTED_SECRET]'.
   */
  public static sanitize<T>(data: T): T {
    if (data === null || data === undefined) {
      return data;
    }

    if (typeof data === "string") {
      // Check for raw Authorization header or bearer token strings
      if (/bearer\s+[A-Za-z0-9\-._~+/]+=*/i.test(data)) {
        return "Bearer [REDACTED_TOKEN]" as unknown as T;
      }
      if (/postgres(?:ql)?:\/\/[^:]+:[^@]+@/i.test(data)) {
        return "postgresql://[REDACTED_USER]:[REDACTED_PASS]@[HOST]/[DB]" as unknown as T;
      }
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.sanitize(item)) as unknown as T;
    }

    if (typeof data === "object") {
      const sanitizedObj: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
        const lowerKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (FORBIDDEN_SECRET_KEYS.has(lowerKey) || lowerKey.includes("password") || lowerKey.includes("secret")) {
          sanitizedObj[key] = "[REDACTED_SECRET]";
        } else {
          sanitizedObj[key] = this.sanitize(value);
        }
      }
      return sanitizedObj as T;
    }

    return data;
  }

  /**
   * Calculates a sanitized, deterministic field diff between previous and new states.
   * Only captures fields that actually changed, avoiding storing the entire row if unnecessary.
   */
  public static calculateDiff(
    previousValues?: unknown,
    newValues?: unknown
  ): SanitizedDiffResult {
    if (!previousValues && !newValues) {
      return { previousValues: null, newValues: null, changedFields: [] };
    }

    const prevSanitized = previousValues
      ? (this.sanitize(JSON.parse(JSON.stringify(previousValues))) as Record<string, unknown>)
      : {};
    const newSanitized = newValues
      ? (this.sanitize(JSON.parse(JSON.stringify(newValues))) as Record<string, unknown>)
      : {};

    const allKeys = new Set([...Object.keys(prevSanitized), ...Object.keys(newSanitized)]);
    const changedFields: string[] = [];
    const prevDiff: Record<string, unknown> = {};
    const newDiff: Record<string, unknown> = {};

    for (const key of allKeys) {
      const prevVal = prevSanitized[key];
      const newVal = newSanitized[key];

      const prevStr = JSON.stringify(prevVal);
      const newStr = JSON.stringify(newVal);

      if (prevStr !== newStr) {
        changedFields.push(key);
        if (key in prevSanitized) prevDiff[key] = prevVal;
        if (key in newSanitized) newDiff[key] = newVal;
      }
    }

    return {
      previousValues: Object.keys(prevDiff).length > 0 ? prevDiff : null,
      newValues: Object.keys(newDiff).length > 0 ? newDiff : null,
      changedFields,
    };
  }

  /**
   * Neutralizes formula injection attempts in text values exported to CSV or Excel.
   * Prepends a single quote if string begins with =, +, -, @, tab, or newline.
   */
  public static sanitizeFormulaInjection(val: unknown): string {
    if (val === null || val === undefined) return "";
    const str = String(val);
    if (/^[=+\-@\t\r]/.test(str)) {
      return `'${str}`;
    }
    return str;
  }
}
