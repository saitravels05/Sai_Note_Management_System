"use server";

import { requireCurrentUser } from "@/lib/auth/current-user";
import { AuthorizationService } from "@/server/services/authorization.service";
import { PERMISSIONS } from "@/lib/auth/permissions";
import {
  MonthEndService,
  type ReopenReasonCategory,
  type PreCloseChecklistResult,
  type ClosingSnapshotDTO,
  type VersionDiffResult,
} from "@/server/services/month-end.service";
import { revalidatePath } from "next/cache";

export interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Fetch all financial periods for the active business.
 */
export async function getFinancialPeriodsAction(): Promise<
  ActionResult<Awaited<ReturnType<typeof MonthEndService.getPeriodList>>>
> {
  try {
    const user = await requireCurrentUser();
    const periods = await MonthEndService.getPeriodList(user.businessId);
    return { success: true, data: periods };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to load financial periods.",
    };
  }
}

/**
 * Run deterministic Pre-Close Checklist for a month.
 */
export async function getPeriodChecklistAction(
  year: number,
  month: number
): Promise<ActionResult<PreCloseChecklistResult>> {
  try {
    const user = await requireCurrentUser();
    const result = await MonthEndService.runPreCloseChecklist(user.businessId, year, month);
    return { success: true, data: result };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to run pre-close checklist.",
    };
  }
}

/**
 * Execute final atomic month-end close.
 */
export async function closeFinancialPeriodAction(input: {
  year: number;
  month: number;
  closingNotes?: string | null;
  dataChangeToken?: string;
}): Promise<ActionResult<Awaited<ReturnType<typeof MonthEndService.closeFinancialPeriod>>>> {
  try {
    const user = await requireCurrentUser();

    // Enforce permission server-side (Requirement 5 & 38)
    await AuthorizationService.requirePermission(
      user.permissions,
      user.roles,
      PERMISSIONS.MONTH_END_CLOSE
    );

    const result = await MonthEndService.closeFinancialPeriod({
      businessId: user.businessId,
      userId: user.id,
      year: input.year,
      month: input.month,
      closingNotes: input.closingNotes,
      dataChangeToken: input.dataChangeToken,
    });

    revalidatePath("/month-end");
    revalidatePath(`/month-end/${input.year}-${String(input.month).padStart(2, "0")}`);
    revalidatePath("/reports");
    revalidatePath("/dashboard");

    return { success: true, data: result };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to close financial period.",
    };
  }
}

/**
 * Reopen a closed financial period with mandatory reason (Requirement 52-55).
 */
export async function reopenFinancialPeriodAction(input: {
  year: number;
  month: number;
  reasonCategory: ReopenReasonCategory;
  explanation: string;
}): Promise<ActionResult<Awaited<ReturnType<typeof MonthEndService.reopenFinancialPeriod>>>> {
  try {
    const user = await requireCurrentUser();

    // Enforce permission server-side
    await AuthorizationService.requirePermission(
      user.permissions,
      user.roles,
      PERMISSIONS.MONTH_END_REOPEN
    );

    const isOwnerOrElevated =
      user.roles.includes("OWNER") ||
      user.roles.includes("ADMIN") ||
      user.permissions.includes(PERMISSIONS.MONTH_END_UNLOCK);

    const result = await MonthEndService.reopenFinancialPeriod({
      businessId: user.businessId,
      userId: user.id,
      year: input.year,
      month: input.month,
      reasonCategory: input.reasonCategory,
      explanation: input.explanation,
      isOwnerOrElevated,
    });

    revalidatePath("/month-end");
    revalidatePath(`/month-end/${input.year}-${String(input.month).padStart(2, "0")}`);
    revalidatePath("/reports");
    revalidatePath("/dashboard");

    return { success: true, data: result };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to reopen financial period.",
    };
  }
}

/**
 * Lock a closed period for historical immutability (Requirement 50 & 51).
 */
export async function lockFinancialPeriodAction(input: {
  year: number;
  month: number;
}): Promise<ActionResult<{ success: boolean; periodLabel: string; status: string }>> {
  try {
    const user = await requireCurrentUser();

    await AuthorizationService.requirePermission(
      user.permissions,
      user.roles,
      PERMISSIONS.MONTH_END_LOCK
    );

    const result = await MonthEndService.lockFinancialPeriod(
      user.businessId,
      user.id,
      input.year,
      input.month
    );

    revalidatePath("/month-end");
    revalidatePath(`/month-end/${input.year}-${String(input.month).padStart(2, "0")}`);
    return { success: true, data: result };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to lock financial period.",
    };
  }
}

/**
 * Unlock a locked period with elevated authorization (Requirement 60).
 */
export async function unlockFinancialPeriodAction(input: {
  year: number;
  month: number;
  reason: string;
}): Promise<ActionResult<{ success: boolean; periodLabel: string; status: string }>> {
  try {
    const user = await requireCurrentUser();

    // Requires OWNER role or MONTH_END_UNLOCK permission
    const isOwner = user.roles.includes("OWNER");
    if (!isOwner) {
      await AuthorizationService.requirePermission(
        user.permissions,
        user.roles,
        PERMISSIONS.MONTH_END_UNLOCK
      );
    }

    const result = await MonthEndService.unlockFinancialPeriod(
      user.businessId,
      user.id,
      input.year,
      input.month,
      input.reason
    );

    revalidatePath("/month-end");
    revalidatePath(`/month-end/${input.year}-${String(input.month).padStart(2, "0")}`);
    return { success: true, data: result };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to unlock financial period.",
    };
  }
}

/**
 * Retrieve preserved closing snapshot for a closed period (Requirement 66).
 */
export async function getClosingSnapshotAction(
  year: number,
  month: number
): Promise<ActionResult<ClosingSnapshotDTO | null>> {
  try {
    const user = await requireCurrentUser();
    const snapshot = await MonthEndService.getClosingSnapshot(user.businessId, year, month);
    return { success: true, data: snapshot };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to fetch closing snapshot.",
    };
  }
}

/**
 * Compare Version 1 vs Version 2 for reopened and reclosed periods (Requirement 57).
 */
export async function getClosingVersionDiffAction(
  year: number,
  month: number
): Promise<ActionResult<VersionDiffResult | null>> {
  try {
    const user = await requireCurrentUser();
    const diff = await MonthEndService.getVersionComparison(user.businessId, year, month);
    return { success: true, data: diff };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to calculate version differences.",
    };
  }
}

/**
 * Regenerate missing closing reports strictly from snapshot data (Requirement 72).
 */
export async function regenerateClosingReportAction(input: {
  year: number;
  month: number;
  format?: "EXCEL" | "PDF" | "BOTH";
}): Promise<ActionResult<{ success: boolean; reports: ClosingSnapshotDTO["reports"] }>> {
  try {
    const user = await requireCurrentUser();

    // Requires month_end.close or reports.view
    const hasPerm =
      user.roles.includes("OWNER") ||
      user.permissions.includes(PERMISSIONS.MONTH_END_CLOSE) ||
      user.permissions.includes(PERMISSIONS.REPORTS_VIEW);

    if (!hasPerm) {
      throw new Error("Forbidden: Missing permission to regenerate closing reports.");
    }

    const result = await MonthEndService.regenerateClosingReports(
      user.businessId,
      user.id,
      input.year,
      input.month,
      input.format || "BOTH"
    );

    revalidatePath("/month-end");
    revalidatePath(`/month-end/${input.year}-${String(input.month).padStart(2, "0")}`);
    return { success: true, data: result };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to regenerate closing report.",
    };
  }
}
