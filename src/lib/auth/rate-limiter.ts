/**
 * In-memory sliding-window rate limiter for sensitive authentication endpoints.
 * Protects against brute-force password guessing and credential stuffing.
 */

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const loginAttempts = new Map<string, RateLimitRecord>();

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes window

export class RateLimiter {
  /**
   * Check if an identifier (e.g. IP or email) has exceeded max allowed attempts.
   */
  public static isRateLimited(identifier: string): { limited: boolean; retryAfterSeconds: number } {
    const now = Date.now();
    const record = loginAttempts.get(identifier);

    if (!record) {
      return { limited: false, retryAfterSeconds: 0 };
    }

    if (now > record.resetAt) {
      loginAttempts.delete(identifier);
      return { limited: false, retryAfterSeconds: 0 };
    }

    if (record.count >= MAX_ATTEMPTS) {
      const retryAfterSeconds = Math.ceil((record.resetAt - now) / 1000);
      return { limited: true, retryAfterSeconds };
    }

    return { limited: false, retryAfterSeconds: 0 };
  }

  /**
   * Record a failed attempt
   */
  public static recordFailedAttempt(identifier: string): void {
    const now = Date.now();
    const record = loginAttempts.get(identifier);

    if (!record || now > record.resetAt) {
      loginAttempts.set(identifier, {
        count: 1,
        resetAt: now + WINDOW_MS,
      });
    } else {
      record.count += 1;
    }
  }

  /**
   * Clear record on successful authentication
   */
  public static resetAttempts(identifier: string): void {
    loginAttempts.delete(identifier);
  }
}
