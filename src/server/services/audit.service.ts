import { prisma } from "@/lib/db";
import {
  AuditAction,
  AuditCategory,
  AuditSeverity,
  Prisma,
} from "@prisma/client";
import { logger } from "@/lib/logger";
import { createHash } from "node:crypto";
import { AuditRedactionService } from "./audit-redaction.service";

export const GENESIS_AUDIT_HASH = "GENESIS_SAI_AUDIT_V1_0000000000000000000000000000000000000000000000000000";

export interface LogAuditInput {
  businessId: string;
  userId?: string;
  actorNameSnapshot?: string;
  actorRoleSnapshot?: string;
  action: AuditAction;
  category?: AuditCategory;
  severity?: AuditSeverity;
  entityType: string;
  entityId: string;
  previousValues?: unknown;
  newValues?: unknown;
  changedFields?: string[];
  reason?: string;
  source?: string;
  requestId?: string;
  correlationId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditSearchFilter {
  query?: string;
  category?: AuditCategory;
  action?: AuditAction;
  severity?: AuditSeverity;
  entityType?: string;
  entityId?: string;
  userId?: string;
  actorName?: string;
  dateRangePreset?: "today" | "yesterday" | "this_week" | "this_month" | "custom";
  startDate?: Date;
  endDate?: Date;
  correlationId?: string;
  requestId?: string;
  limit?: number;
  offset?: number;
}

export interface IntegrityVerificationResult {
  status: "VERIFIED" | "BROKEN" | "NOT_CONFIGURED";
  verifiedCount: number;
  brokenLogId?: string;
  brokenIndex?: number;
  expectedHash?: string;
  actualHash?: string;
  reason?: string;
  verifiedAt: string;
}

/**
 * Deterministic JSON serialization for canonical hashing.
 * Orders keys alphabetically so hashes remain deterministic across platforms and runtimes.
 */
export function canonicalizeJson(obj: unknown): string {
  if (obj === null || obj === undefined) return "null";
  if (typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) {
    return "[" + obj.map((item) => canonicalizeJson(item)).join(",") + "]";
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const pairs = keys.map(
    (k) => `${JSON.stringify(k)}:${canonicalizeJson((obj as Record<string, unknown>)[k])}`
  );
  return "{" + pairs.join(",") + "}";
}

/**
 * Calculates SHA-256 hash for an audit log entry linked to the previous entry hash.
 */
export function calculateAuditHash(
  previousHash: string,
  canonicalPayload: string
): string {
  return createHash("sha256")
    .update(`v1:${previousHash}:${canonicalPayload}`)
    .digest("hex");
}

/**
 * Infer default AuditCategory based on action name if not explicitly provided.
 */
function inferCategory(action: AuditAction): AuditCategory {
  const act = String(action);
  if (act.includes("LOGIN") || act.includes("PASSWORD")) return AuditCategory.AUTHENTICATION;
  if (act.includes("SECURITY") || act.includes("RATE_LIMIT") || act.includes("PERMISSION"))
    return AuditCategory.SECURITY;
  if (act.includes("CUSTOMER")) return AuditCategory.CUSTOMER;
  if (act.includes("SUPPLIER")) return AuditCategory.SUPPLIER;
  if (act.includes("FOLLOWUP") || act.includes("PROMISE") || act.includes("COMMUNICATION"))
    return AuditCategory.CRM;
  if (act.includes("IMPORT")) return AuditCategory.IMPORT;
  if (act.includes("EXPORT")) return AuditCategory.EXPORT;
  if (act.includes("REPORT")) return AuditCategory.REPORT;
  if (act.includes("MONTH_") || act.includes("MONTH_CLOSE") || act.includes("MONTH_REOPEN"))
    return AuditCategory.MONTH_END;
  if (act.includes("DOCUMENT")) return AuditCategory.DOCUMENT;
  if (act.includes("USER") || act.includes("ROLE")) return AuditCategory.USER_MANAGEMENT;
  if (act.includes("BACKUP")) return AuditCategory.BACKUP;
  if (act.includes("RESTORE")) return AuditCategory.RESTORE;
  if (act.includes("MAINTENANCE") || act.includes("READ_ONLY")) return AuditCategory.SYSTEM;
  return AuditCategory.FINANCIAL;
}

/**
 * Infer default AuditSeverity based on action and category.
 */
function inferSeverity(action: AuditAction, category: AuditCategory): AuditSeverity {
  const act = String(action);
  if (
    category === AuditCategory.SECURITY ||
    act.includes("SECURITY") ||
    act.includes("TAMPER") ||
    act.includes("RATE_LIMIT")
  ) {
    return AuditSeverity.SECURITY;
  }
  if (
    act.includes("VOID") ||
    act.includes("FAILED") ||
    act.includes("REJECTED") ||
    act.includes("QUARANTINED") ||
    act.includes("PURGED") ||
    act.includes("MAINTENANCE")
  ) {
    return AuditSeverity.WARNING;
  }
  if (act.includes("RESTORE_FAILED") || act.includes("BACKUP_FAILED")) {
    return AuditSeverity.CRITICAL;
  }
  return AuditSeverity.INFO;
}

/**
 * Append-only Financial & System Audit Service (Phase 15).
 * Guarantees immutability, tamper-evident hash chaining, and centralized redaction.
 * NOTE: Absolutely NO updateAudit or deleteAudit methods are implemented or permitted.
 */
export class AuditService {
  /**
   * Appends an audit log entry.
   * Calculates diffs, redacts secrets, resolves actor snapshot, and chains the SHA-256 hash.
   */
  public static async log(input: LogAuditInput): Promise<string | null> {
    try {
      const category = input.category || inferCategory(input.action);
      const severity = input.severity || inferSeverity(input.action, category);

      // Resolve actor snapshot if not provided but userId is present
      let actorName = input.actorNameSnapshot;
      let actorRole = input.actorRoleSnapshot;
      if (!actorName && input.userId) {
        try {
          const profile = await prisma.userProfile.findUnique({
            where: { id: input.userId },
            include: { userRoles: { include: { role: true } } },
          });
          if (profile) {
            actorName = profile.displayName;
            actorRole = profile.userRoles[0]?.role?.name || "User";
          }
        } catch {
          // Non-blocking fallback
          actorName = "User (" + input.userId + ")";
        }
      }

      // Calculate diff and sanitize secrets
      const diff = AuditRedactionService.calculateDiff(
        input.previousValues,
        input.newValues
      );
      const changedFields = input.changedFields && input.changedFields.length > 0
        ? input.changedFields
        : diff.changedFields;

      const sanitizedPrev = diff.previousValues as Prisma.InputJsonValue ?? Prisma.JsonNull;
      const sanitizedNew = diff.newValues as Prisma.InputJsonValue ?? Prisma.JsonNull;
      const sanitizedMeta = input.metadata
        ? (AuditRedactionService.sanitize(input.metadata) as Prisma.InputJsonValue)
        : Prisma.JsonNull;

      // Find the last recorded audit log for this business to continue the tamper-evident chain
      const lastLog = await prisma.auditLog.findFirst({
        where: { businessId: input.businessId },
        orderBy: { createdAt: "desc" },
        select: { eventHash: true },
      });

      const previousHash = lastLog?.eventHash || GENESIS_AUDIT_HASH;

      // Construct canonical payload for hashing
      const canonicalPayloadObj = {
        businessId: input.businessId,
        userId: input.userId || null,
        actorNameSnapshot: actorName || null,
        action: input.action,
        category,
        entityType: input.entityType,
        entityId: input.entityId,
        reason: input.reason || null,
        changedFields,
        previousValues: diff.previousValues,
        newValues: diff.newValues,
        correlationId: input.correlationId || null,
        requestId: input.requestId || null,
      };

      const canonicalPayload = canonicalizeJson(canonicalPayloadObj);
      const eventHash = calculateAuditHash(previousHash, canonicalPayload);

      const createdLog = await prisma.auditLog.create({
        data: {
          businessId: input.businessId,
          userId: input.userId,
          actorNameSnapshot: actorName,
          actorRoleSnapshot: actorRole,
          action: input.action,
          category,
          severity,
          entityType: input.entityType,
          entityId: input.entityId,
          previousValues: sanitizedPrev,
          newValues: sanitizedNew,
          changedFields,
          reason: input.reason,
          source: input.source || "WEB_APP",
          requestId: input.requestId,
          correlationId: input.correlationId,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          metadata: sanitizedMeta,
          previousHash,
          eventHash,
        },
      });

      logger.info(
        `Audit log recorded: [${category}] ${input.action} on ${input.entityType} (${input.entityId})`,
        {
          businessId: input.businessId,
          action: input.action,
          logId: createdLog.id,
        }
      );

      return createdLog.id;
    } catch (error) {
      // Never crash the main application thread if writing audit fails, but log at highest priority
      logger.error("Failed to write to audit log", {
        error: error instanceof Error ? error.message : "Unknown",
        entity: input.entityType,
        action: input.action,
      });
      return null;
    }
  }

  /**
   * Search audit logs with multi-dimensional criteria, tenant isolation, and pagination.
   */
  public static async search(businessId: string, filter: AuditSearchFilter = {}) {
    const where: Prisma.AuditLogWhereInput = {
      businessId,
    };

    if (filter.category) {
      where.category = filter.category;
    }

    if (filter.action) {
      where.action = filter.action;
    }

    if (filter.severity) {
      where.severity = filter.severity;
    }

    if (filter.entityType) {
      where.entityType = { equals: filter.entityType, mode: "insensitive" };
    }

    if (filter.entityId) {
      where.entityId = filter.entityId;
    }

    if (filter.userId) {
      where.userId = filter.userId;
    }

    if (filter.correlationId) {
      where.correlationId = filter.correlationId;
    }

    if (filter.requestId) {
      where.requestId = filter.requestId;
    }

    if (filter.actorName) {
      where.actorNameSnapshot = { contains: filter.actorName, mode: "insensitive" };
    }

    // Date Range Presets
    if (filter.dateRangePreset) {
      const now = new Date();
      if (filter.dateRangePreset === "today") {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        where.createdAt = { gte: start };
      } else if (filter.dateRangePreset === "yesterday") {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        where.createdAt = { gte: start, lt: end };
      } else if (filter.dateRangePreset === "this_week") {
        const day = now.getDay();
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
        where.createdAt = { gte: start };
      } else if (filter.dateRangePreset === "this_month") {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        where.createdAt = { gte: start };
      }
    } else if (filter.startDate || filter.endDate) {
      where.createdAt = {};
      if (filter.startDate) where.createdAt.gte = filter.startDate;
      if (filter.endDate) where.createdAt.lte = filter.endDate;
    }

    // Text Query search across entityId, reason, actor name, or request ID
    if (filter.query) {
      const q = filter.query.trim();
      where.OR = [
        { entityId: { contains: q, mode: "insensitive" } },
        { entityType: { contains: q, mode: "insensitive" } },
        { reason: { contains: q, mode: "insensitive" } },
        { actorNameSnapshot: { contains: q, mode: "insensitive" } },
        { correlationId: { contains: q, mode: "insensitive" } },
        { requestId: { contains: q, mode: "insensitive" } },
      ];
    }

    const limit = Math.min(Math.max(filter.limit || 50, 1), 200);
    const offset = Math.max(filter.offset || 0, 0);

    const [items, totalCount] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      items,
      totalCount,
      limit,
      offset,
      hasMore: offset + items.length < totalCount,
    };
  }

  /**
   * Retrieves chronological audit history for a single specific entity.
   */
  public static async getEntityAuditHistory(
    businessId: string,
    entityType: string,
    entityId: string
  ) {
    return prisma.auditLog.findMany({
      where: {
        businessId,
        entityType: { equals: entityType, mode: "insensitive" },
        entityId,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  /**
   * Retrieves high-priority security events for security investigations.
   */
  public static async getSecurityEvents(businessId: string, limit = 50, offset = 0) {
    const where: Prisma.AuditLogWhereInput = {
      businessId,
      OR: [
        { severity: AuditSeverity.SECURITY },
        { severity: AuditSeverity.CRITICAL },
        { category: AuditCategory.SECURITY },
        { action: AuditAction.LOGIN_FAILED },
        { action: AuditAction.SECURITY_RATE_LIMIT_TRIGGERED },
        { action: AuditAction.SECURITY_PERMISSION_DENIED },
        { action: AuditAction.SECURITY_SUSPICIOUS_ACTIVITY },
        { action: AuditAction.DOCUMENT_REJECTED },
        { action: AuditAction.DOCUMENT_QUARANTINED },
      ],
    };

    const [events, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { events, total };
  }

  /**
   * Cryptographically verifies the tamper-evident SHA-256 hash chain for a business.
   * Returns VERIFIED, BROKEN, or NOT_CONFIGURED.
   * Never silently repairs a broken chain.
   */
  public static async verifyIntegrity(
    businessId: string
  ): Promise<IntegrityVerificationResult> {
    const logs = await prisma.auditLog.findMany({
      where: { businessId },
      orderBy: { createdAt: "asc" },
    });

    if (logs.length === 0) {
      return {
        status: "NOT_CONFIGURED",
        verifiedCount: 0,
        verifiedAt: new Date().toISOString(),
        reason: "No audit records found to verify",
      };
    }

    let expectedPreviousHash = GENESIS_AUDIT_HASH;

    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];

      // Check 1: Chain continuity
      if (log.previousHash && log.previousHash !== expectedPreviousHash) {
        return {
          status: "BROKEN",
          verifiedCount: i,
          brokenLogId: log.id,
          brokenIndex: i,
          expectedHash: expectedPreviousHash,
          actualHash: log.previousHash,
          reason: `Chain broken at record index ${i} (${log.id}): previousHash does not match preceding eventHash`,
          verifiedAt: new Date().toISOString(),
        };
      }

      // Check 2: Content integrity hash verification if eventHash was saved
      if (log.eventHash) {
        const canonicalPayloadObj = {
          businessId: log.businessId,
          userId: log.userId,
          actorNameSnapshot: log.actorNameSnapshot,
          action: log.action,
          category: log.category,
          entityType: log.entityType,
          entityId: log.entityId,
          reason: log.reason,
          changedFields: log.changedFields,
          previousValues: log.previousValues,
          newValues: log.newValues,
          correlationId: log.correlationId,
          requestId: log.requestId,
        };

        const canonical = canonicalizeJson(canonicalPayloadObj);
        const computedHash = calculateAuditHash(log.previousHash || expectedPreviousHash, canonical);

        if (computedHash !== log.eventHash) {
          return {
            status: "BROKEN",
            verifiedCount: i,
            brokenLogId: log.id,
            brokenIndex: i,
            expectedHash: log.eventHash,
            actualHash: computedHash,
            reason: `Data tampering detected at record index ${i} (${log.id}): recomputed SHA-256 hash does not match eventHash`,
            verifiedAt: new Date().toISOString(),
          };
        }

        expectedPreviousHash = log.eventHash;
      } else {
        // Legacy record without eventHash, advance chain with fallback
        expectedPreviousHash = log.previousHash || expectedPreviousHash;
      }
    }

    return {
      status: "VERIFIED",
      verifiedCount: logs.length,
      verifiedAt: new Date().toISOString(),
    };
  }
}
