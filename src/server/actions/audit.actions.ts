"use server";

import { requireCurrentUser, requirePermission } from "@/lib/auth/current-user";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { AuditService, type AuditSearchFilter } from "@/server/services/audit.service";
import { AuditCategory, AuditAction, AuditSeverity } from "@prisma/client";

export interface AuditSearchResult {
  success: boolean;
  data?: {
    items: unknown[];
    totalCount: number;
    hasMore: boolean;
  };
  error?: string;
}

export interface IntegrityActionResult {
  success: boolean;
  result?: {
    status: "VERIFIED" | "BROKEN" | "NOT_CONFIGURED";
    verifiedCount: number;
    brokenLogId?: string;
    brokenIndex?: number;
    expectedHash?: string;
    actualHash?: string;
    reason?: string;
    verifiedAt: string;
  };
  error?: string;
}

/**
 * Server Action: Search and filter audit trail with strict tenant isolation.
 */
export async function searchAuditLogsAction(
  filter: {
    query?: string;
    category?: string;
    action?: string;
    severity?: string;
    entityType?: string;
    entityId?: string;
    actorName?: string;
    dateRangePreset?: "today" | "yesterday" | "this_week" | "this_month" | "custom";
    startDate?: string;
    endDate?: string;
    correlationId?: string;
    requestId?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<AuditSearchResult> {
  try {
    const user = await requireCurrentUser();
    await requirePermission(PERMISSIONS.AUDIT_VIEW);

    const parsedFilter: AuditSearchFilter = {
      query: filter.query,
      category: filter.category ? (filter.category as AuditCategory) : undefined,
      action: filter.action ? (filter.action as AuditAction) : undefined,
      severity: filter.severity ? (filter.severity as AuditSeverity) : undefined,
      entityType: filter.entityType,
      entityId: filter.entityId,
      actorName: filter.actorName,
      dateRangePreset: filter.dateRangePreset,
      startDate: filter.startDate ? new Date(filter.startDate) : undefined,
      endDate: filter.endDate ? new Date(filter.endDate) : undefined,
      correlationId: filter.correlationId,
      requestId: filter.requestId,
      limit: filter.limit,
      offset: filter.offset,
    };

    const res = await AuditService.search(user.businessId, parsedFilter);

    // Map items to safe DTOs
    const safeItems = res.items.map((log) => ({
      id: log.id,
      action: log.action,
      category: log.category,
      severity: log.severity,
      entityType: log.entityType,
      entityId: log.entityId,
      actorNameSnapshot: log.actorNameSnapshot || "System / API",
      actorRoleSnapshot: log.actorRoleSnapshot || "User",
      reason: log.reason,
      source: log.source,
      changedFields: log.changedFields,
      previousValues: log.previousValues,
      newValues: log.newValues,
      correlationId: log.correlationId,
      requestId: log.requestId,
      previousHash: log.previousHash,
      eventHash: log.eventHash,
      createdAt: log.createdAt.toISOString(),
    }));

    return {
      success: true,
      data: {
        items: safeItems,
        totalCount: res.totalCount,
        hasMore: res.hasMore,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to load audit logs",
    };
  }
}

/**
 * Server Action: Cryptographic Audit Hash-Chain Integrity Verification.
 */
export async function verifyAuditIntegrityAction(): Promise<IntegrityActionResult> {
  try {
    const user = await requireCurrentUser();
    await requirePermission(PERMISSIONS.AUDIT_VERIFY_INTEGRITY);

    const result = await AuditService.verifyIntegrity(user.businessId);

    // Audit the verification event itself
    await AuditService.log({
      businessId: user.businessId,
      userId: user.id,
      action:
        result.status === "VERIFIED"
          ? AuditAction.AUDIT_INTEGRITY_VERIFIED
          : AuditAction.AUDIT_INTEGRITY_TAMPER_DETECTED,
      category: AuditCategory.SECURITY,
      severity: result.status === "VERIFIED" ? AuditSeverity.INFO : AuditSeverity.CRITICAL,
      entityType: "AuditIntegrity",
      entityId: user.businessId,
      reason: `Audit integrity check: ${result.status} (${result.verifiedCount} records checked)`,
      metadata: {
        status: result.status,
        verifiedCount: result.verifiedCount,
        reason: result.reason,
      },
    });

    return {
      success: true,
      result,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to verify audit integrity",
    };
  }
}

/**
 * Server Action: Get entity audit history.
 */
export async function getEntityAuditHistoryAction(entityType: string, entityId: string) {
  try {
    const user = await requireCurrentUser();
    await requirePermission(PERMISSIONS.AUDIT_VIEW);

    const logs = await AuditService.getEntityAuditHistory(
      user.businessId,
      entityType,
      entityId
    );

    return {
      success: true,
      logs: logs.map((log) => ({
        id: log.id,
        action: log.action,
        category: log.category,
        severity: log.severity,
        entityType: log.entityType,
        entityId: log.entityId,
        actorNameSnapshot: log.actorNameSnapshot,
        actorRoleSnapshot: log.actorRoleSnapshot,
        reason: log.reason,
        changedFields: log.changedFields,
        previousValues: log.previousValues,
        newValues: log.newValues,
        createdAt: log.createdAt.toISOString(),
      })),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to load entity audit history",
    };
  }
}

/**
 * Server Action: Get high-priority security investigation events.
 */
export async function getSecurityEventsAction(limit = 50, offset = 0) {
  try {
    const user = await requireCurrentUser();
    await requirePermission(PERMISSIONS.AUDIT_VIEW);

    const { events, total } = await AuditService.getSecurityEvents(
      user.businessId,
      limit,
      offset
    );

    return {
      success: true,
      events: events.map((e) => ({
        id: e.id,
        action: e.action,
        category: e.category,
        severity: e.severity,
        entityType: e.entityType,
        entityId: e.entityId,
        actorNameSnapshot: e.actorNameSnapshot,
        reason: e.reason,
        ipAddress: e.ipAddress,
        createdAt: e.createdAt.toISOString(),
      })),
      total,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to load security events",
    };
  }
}
