import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError, AppError } from "@/lib/errors";
import { FinancialPeriodStatus } from "@prisma/client";

/**
 * Server-Side Multi-Tenant Authorization & Period Protection Layer.
 * 
 * Rules:
 * 1. UI hiding is NOT authorization.
 * 2. Multi-tenant isolation: All queries MUST be scoped to the authenticated user's businessId.
 * 3. Period Lock: Modifications to CLOSED or LOCKED financial periods are strictly rejected.
 */
export class AuthorizationService {
  /**
   * Enforce user profile exists and is active
   */
  public static async requireAuthenticatedUser(authUserId?: string) {
    if (!authUserId) {
      throw new UnauthorizedError("Session expired or user not authenticated");
    }

    const profile = await prisma.userProfile.findUnique({
      where: { authUserId },
    });

    if (!profile || profile.status !== "ACTIVE") {
      throw new ForbiddenError("User profile is inactive or not found");
    }

    return profile;
  }

  /**
   * Enforce tenant isolation: User can only access their assigned business
   */
  public static async requireBusinessAccess(userProfile: { businessId: string }, targetBusinessId: string) {
    if (userProfile.businessId !== targetBusinessId) {
      throw new ForbiddenError("Cross-tenant access prohibited. You do not have permission for this business.");
    }
  }

  /**
   * Enforce specific permission server-side
   */
  public static async requirePermission(userPermissions: string[], userRoles: string[], permissionCode: string) {
    if (userRoles.includes("OWNER")) {
      return true;
    }
    if (!userPermissions.includes(permissionCode) && !userPermissions.includes("*")) {
      throw new ForbiddenError(`Forbidden: Missing required permission ${permissionCode}`);
    }
    return true;
  }

  /**
   * Check if a transaction date falls into an OPEN financial period.
   * If closed or locked, modification is blocked.
   */
  public static async requireOpenFinancialPeriod(businessId: string, transactionDate: Date) {
    const year = transactionDate.getFullYear();
    const month = transactionDate.getMonth() + 1; // 1-indexed

    const period = await prisma.financialPeriod.findUnique({
      where: {
        businessId_year_month: {
          businessId,
          year,
          month,
        },
      },
    });

    if (period && period.status !== FinancialPeriodStatus.OPEN) {
      throw new AppError(
        `Financial period ${month}/${year} is ${period.status}. Historical ledger modifications are locked.`,
        422,
        "PERIOD_LOCKED"
      );
    }

    return period;
  }
}
