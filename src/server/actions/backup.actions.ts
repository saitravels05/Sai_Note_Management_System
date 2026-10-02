"use server";

import { requireCurrentUser, requirePermission } from "@/lib/auth/current-user";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { BackupService } from "@/server/services/backup/backup.service";
import {
  RestoreVerificationService,
  type ProductionRestoreInput,
} from "@/server/services/backup/restore-verification.service";
import {
  SystemMaintenanceService,
  SystemMaintenanceMode,
} from "@/server/services/system-maintenance.service";
import { BackupScope, BackupType, BackupEnvironment } from "@prisma/client";

/**
 * Server Action: List all backups for the active business.
 */
export async function getBackupsAction(options: { limit?: number; offset?: number } = {}) {
  try {
    const user = await requireCurrentUser();
    await requirePermission(PERMISSIONS.BACKUPS_VIEW);

    const res = await BackupService.getBackups(user.businessId, options);

    const safeBackups = res.items.map((b) => ({
      id: b.id,
      backupType: b.backupType,
      scope: b.scope,
      environment: b.environment,
      status: b.status,
      verificationStatus: b.verificationStatus,
      storageLocation: b.storageLocation,
      sizeBytes: b.sizeBytes.toString(),
      checksum: b.checksum,
      providerReference: b.providerReference,
      startedAt: b.startedAt.toISOString(),
      completedAt: b.completedAt?.toISOString() || null,
      verifiedAt: b.verifiedAt?.toISOString() || null,
      retentionUntil: b.retentionUntil?.toISOString() || null,
      isProtected: b.isProtected,
      error: b.error,
      restoreTests: b.restoreTests.map((t) => ({
        id: t.id,
        environment: t.environment,
        status: t.status,
        safetyModeActive: t.safetyModeActive,
        startedAt: t.startedAt.toISOString(),
        completedAt: t.completedAt?.toISOString() || null,
      })),
      createdAt: b.createdAt.toISOString(),
    }));

    return {
      success: true,
      data: {
        backups: safeBackups,
        totalCount: res.totalCount,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to load backups",
    };
  }
}

/**
 * Server Action: Get backup infrastructure health.
 */
export async function getBackupHealthAction() {
  try {
    const user = await requireCurrentUser();
    await requirePermission(PERMISSIONS.BACKUPS_VIEW);

    const health = await BackupService.getBackupHealth(user.businessId);

    return {
      success: true,
      health,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to load backup health",
    };
  }
}

/**
 * Server Action: On-demand backup creation.
 */
export async function createBackupAction(input: {
  scope?: string;
  backupType?: string;
  environment?: string;
  retentionDays?: number;
} = {}) {
  try {
    const user = await requireCurrentUser();
    await requirePermission(PERMISSIONS.BACKUPS_CREATE);

    const backup = await BackupService.createBackup(user.businessId, user.id, {
      scope: input.scope ? (input.scope as BackupScope) : BackupScope.FULL_SYSTEM,
      backupType: input.backupType ? (input.backupType as BackupType) : BackupType.MANUAL,
      environment: input.environment ? (input.environment as BackupEnvironment) : BackupEnvironment.PRODUCTION,
      retentionDays: input.retentionDays || 30,
    });

    return {
      success: true,
      backup: {
        id: backup.id,
        checksum: backup.checksum,
        sizeBytes: backup.sizeBytes.toString(),
        status: backup.status,
        verificationStatus: backup.verificationStatus,
        createdAt: backup.createdAt.toISOString(),
      },
      message: `Backup ${backup.id} created successfully (${backup.checksum?.slice(0, 8)}). A test restore is recommended to mark it VERIFIED.`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create backup",
    };
  }
}

/**
 * Server Action: Run automated isolated test restore and reconciliation.
 */
export async function runTestRestoreAction(backupId: string) {
  try {
    const user = await requireCurrentUser();
    await requirePermission(PERMISSIONS.BACKUPS_RESTORE_TEST);

    const report = await RestoreVerificationService.runTestRestore(
      user.businessId,
      user.id,
      backupId
    );

    return {
      success: true,
      report,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Test restore failed",
    };
  }
}

/**
 * Server Action: HIGH-RISK Production Restore.
 */
export async function executeProductionRestoreAction(input: ProductionRestoreInput) {
  try {
    const user = await requireCurrentUser();
    await requirePermission(PERMISSIONS.BACKUPS_RESTORE_PRODUCTION);

    const result = await RestoreVerificationService.executeProductionRestore(
      user.businessId,
      user.id,
      input
    );

    return {
      success: true,
      result,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Production restore failed",
    };
  }
}

/**
 * Server Action: Get system maintenance state.
 */
export async function getMaintenanceModeAction() {
  try {
    const user = await requireCurrentUser();
    const state = await SystemMaintenanceService.getState(user.businessId);

    return {
      success: true,
      state,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch maintenance state",
    };
  }
}

/**
 * Server Action: Set system maintenance mode.
 */
export async function setMaintenanceModeAction(
  mode: SystemMaintenanceMode | "NORMAL" | "READ_ONLY" | "MAINTENANCE",
  reason?: string
) {
  try {
    const user = await requireCurrentUser();
    await requirePermission(PERMISSIONS.SYSTEM_MAINTENANCE_MODE);

    const newState = await SystemMaintenanceService.setMode(
      user.businessId,
      user.id,
      mode as SystemMaintenanceMode,
      reason
    );

    return {
      success: true,
      state: newState,
      message: `System mode transitioned to ${mode}.`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update maintenance state",
    };
  }
}
