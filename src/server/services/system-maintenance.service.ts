import { prisma } from "@/lib/db";
import { AuditAction, AuditCategory, AuditSeverity } from "@prisma/client";
import { AuditService } from "./audit.service";
import { logger } from "@/lib/logger";

export enum SystemMaintenanceMode {
  NORMAL = "NORMAL",
  READ_ONLY = "READ_ONLY",
  MAINTENANCE = "MAINTENANCE",
}

export interface MaintenanceState {
  mode: SystemMaintenanceMode;
  reason?: string;
  updatedAt: string;
  updatedBy?: string;
}

const MAINTENANCE_SETTING_KEY = "SYSTEM_MAINTENANCE_STATE";

// In-memory cache for ultra-fast middleware checks
const modeCache = new Map<string, MaintenanceState>();

export class SystemMaintenanceService {
  /**
   * Retrieves the current maintenance state for a business.
   */
  public static async getState(businessId: string): Promise<MaintenanceState> {
    const cached = modeCache.get(businessId);
    if (cached) return cached;

    try {
      const setting = await prisma.businessSetting.findUnique({
        where: {
          businessId_key: {
            businessId,
            key: MAINTENANCE_SETTING_KEY,
          },
        },
      });

      if (setting && setting.value && typeof setting.value === "object") {
        const state = setting.value as unknown as MaintenanceState;
        modeCache.set(businessId, state);
        return state;
      }
    } catch (error) {
      logger.warn("Failed to fetch maintenance state from database, defaulting to NORMAL", {
        error: error instanceof Error ? error.message : "Unknown",
        businessId,
      });
    }

    const defaultState: MaintenanceState = {
      mode: SystemMaintenanceMode.NORMAL,
      updatedAt: new Date().toISOString(),
    };
    modeCache.set(businessId, defaultState);
    return defaultState;
  }

  /**
   * Updates system maintenance mode with server enforcement and audit logging.
   */
  public static async setMode(
    businessId: string,
    userId: string,
    mode: SystemMaintenanceMode,
    reason?: string
  ): Promise<MaintenanceState> {
    const previousState = await this.getState(businessId);
    const newState: MaintenanceState = {
      mode,
      reason,
      updatedAt: new Date().toISOString(),
      updatedBy: userId,
    };

    // Persist in DB
    await prisma.businessSetting.upsert({
      where: {
        businessId_key: {
          businessId,
          key: MAINTENANCE_SETTING_KEY,
        },
      },
      create: {
        businessId,
        key: MAINTENANCE_SETTING_KEY,
        value: newState as unknown as object,
      },
      update: {
        value: newState as unknown as object,
      },
    });

    modeCache.set(businessId, newState);

    // Audit log the state transition
    let action: AuditAction = AuditAction.MAINTENANCE_MODE_ENABLED;
    if (mode === SystemMaintenanceMode.NORMAL) {
      action = previousState.mode === SystemMaintenanceMode.READ_ONLY
        ? AuditAction.READ_ONLY_MODE_DISABLED
        : AuditAction.MAINTENANCE_MODE_DISABLED;
    } else if (mode === SystemMaintenanceMode.READ_ONLY) {
      action = AuditAction.READ_ONLY_MODE_ENABLED;
    }

    await AuditService.log({
      businessId,
      userId,
      action,
      category: AuditCategory.SYSTEM,
      severity: mode === SystemMaintenanceMode.NORMAL ? AuditSeverity.INFO : AuditSeverity.WARNING,
      entityType: "SystemMaintenance",
      entityId: businessId,
      reason,
      previousValues: previousState,
      newValues: newState,
      changedFields: ["mode", "reason"],
    });

    logger.info(`System mode set to ${mode} for business ${businessId}`, {
      businessId,
      mode,
      reason,
    });

    return newState;
  }

  /**
   * Server-side write assertion: Throws an error if the system is in READ_ONLY or MAINTENANCE mode.
   * Call this before executing financial mutations, imports, or month-end changes.
   */
  public static async assertCanWrite(businessId: string): Promise<void> {
    const state = await this.getState(businessId);
    if (state.mode === SystemMaintenanceMode.MAINTENANCE) {
      throw new Error(
        `System is in MAINTENANCE mode for emergency operations / disaster recovery. Financial writes and updates are suspended.${state.reason ? " Reason: " + state.reason : ""}`
      );
    }
    if (state.mode === SystemMaintenanceMode.READ_ONLY) {
      throw new Error(
        `System is currently in READ_ONLY mode. Financial records, payments, and closed periods cannot be modified.${state.reason ? " Reason: " + state.reason : ""}`
      );
    }
  }

  /**
   * Server-side access assertion: Throws an error if the system is in MAINTENANCE mode.
   */
  public static async assertCanAccess(businessId: string): Promise<void> {
    const state = await this.getState(businessId);
    if (state.mode === SystemMaintenanceMode.MAINTENANCE) {
      throw new Error(
        `Application is undergoing scheduled disaster recovery / maintenance.${state.reason ? " Reason: " + state.reason : ""}`
      );
    }
  }

  /**
   * Clears in-memory cache (useful for testing).
   */
  public static clearCache() {
    modeCache.clear();
  }
}
