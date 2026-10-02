"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/current-user";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { AuditService } from "@/server/services/audit.service";
import { AuditAction, RoleType, UserStatus } from "@prisma/client";
import { AppError } from "@/lib/errors";
import crypto from "crypto";

const inviteUserSchema = z.object({
  displayName: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please provide a valid email address"),
  roleId: z.string().min(1, "Role is required"),
});

export interface UserActionResult {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Server Action: Invite a new user to the business
 * Enforces `users.manage` permission and strict tenant boundary.
 */
export async function inviteUserAction(
  _prevState: UserActionResult | null,
  formData: FormData
): Promise<UserActionResult> {
  const currentUser = await requirePermission(PERMISSIONS.USERS_MANAGE);

  const rawData = {
    displayName: formData.get("displayName")?.toString().trim() || "",
    email: formData.get("email")?.toString().trim().toLowerCase() || "",
    roleId: formData.get("roleId")?.toString().trim() || "",
  };

  const validated = inviteUserSchema.safeParse(rawData);
  if (!validated.success) {
    return {
      success: false,
      error: validated.error.issues[0]?.message || "Invalid input data",
    };
  }

  const { displayName, email, roleId } = validated.data;

  try {
    // 1. Verify role belongs to this business or is system role
    const role = await prisma.role.findFirst({
      where: {
        id: roleId,
        OR: [
          { businessId: currentUser.businessId },
          { isSystem: true },
        ],
      },
    });

    if (!role) {
      return { success: false, error: "The selected role is invalid or inaccessible." };
    }

    // 2. Check if user profile already exists in this business
    const existingUser = await prisma.userProfile.findFirst({
      where: {
        businessId: currentUser.businessId,
        email,
      },
    });

    if (existingUser) {
      return {
        success: false,
        error: `A user with email ${email} already belongs to this business.`,
      };
    }

    // 3. Generate secure invitation token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await prisma.$transaction(async (tx) => {
      // Create invitation record
      await tx.userInvitation.create({
        data: {
          businessId: currentUser.businessId,
          email,
          roleId: role.id,
          token,
          expiresAt,
          invitedBy: currentUser.id,
        },
      });

      // Create provisional UserProfile with INVITED status
      const newUser = await tx.userProfile.create({
        data: {
          authUserId: `invite_${token.slice(0, 16)}`,
          businessId: currentUser.businessId,
          displayName,
          email,
          status: UserStatus.INVITED,
        },
      });

      // Assign the specified role
      await tx.userRole.create({
        data: {
          userId: newUser.id,
          roleId: role.id,
        },
      });

      // Record audit event
      await AuditService.log({
        businessId: currentUser.businessId,
        userId: currentUser.id,
        action: AuditAction.USER_INVITED,
        entityType: "USER",
        entityId: newUser.id,
        newValues: { email, role: role.name, displayName },
        reason: `User invited by ${currentUser.displayName}`,
      });
    });

    revalidatePath("/users");
    return {
      success: true,
      message: `Invitation successfully sent to ${email}.`,
    };
  } catch (error) {
    console.error("Invite user action error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to invite user.",
    };
  }
}

/**
 * Server Action: Change a user's role
 * Includes MANDATORY Last-Owner Protection.
 */
export async function changeUserRoleAction(
  _prevState: UserActionResult | null,
  formData: FormData
): Promise<UserActionResult> {
  const currentUser = await requirePermission(PERMISSIONS.USERS_MANAGE);

  const targetUserId = formData.get("userId")?.toString().trim() || "";
  const newRoleId = formData.get("newRoleId")?.toString().trim() || "";

  if (!targetUserId || !newRoleId) {
    return { success: false, error: "Target user ID and new role are required." };
  }

  try {
    // 1. Verify target user belongs to current business
    const targetUser = await prisma.userProfile.findFirst({
      where: {
        id: targetUserId,
        businessId: currentUser.businessId,
      },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!targetUser) {
      return { success: false, error: "Target user not found in this business." };
    }

    // 2. Verify new role exists and is accessible
    const targetRole = await prisma.role.findFirst({
      where: {
        id: newRoleId,
        OR: [
          { businessId: currentUser.businessId },
          { isSystem: true },
        ],
      },
    });

    if (!targetRole) {
      return { success: false, error: "Selected role does not exist." };
    }

    // 3. CRITICAL: LAST-OWNER PROTECTION
    // If target user is currently an OWNER and the new role is NOT OWNER,
    // verify there is at least one OTHER active OWNER in the business.
    const isCurrentlyOwner = targetUser.userRoles.some(
      (ur) => ur.role.type === RoleType.OWNER || ur.role.name.toUpperCase() === "OWNER"
    );

    if (isCurrentlyOwner && targetRole.type !== RoleType.OWNER) {
      const activeOwnersCount = await prisma.userRole.count({
        where: {
          user: {
            businessId: currentUser.businessId,
            status: UserStatus.ACTIVE,
          },
          role: {
            type: RoleType.OWNER,
          },
        },
      });

      if (activeOwnersCount <= 1) {
        throw new AppError(
          "Security restriction: Cannot demote the last remaining active OWNER of the business. Designate another active Owner before changing this role.",
          400,
          "LAST_OWNER_PROTECTION"
        );
      }
    }

    // 4. Update the user's role transactionally
    await prisma.$transaction(async (tx) => {
      // Remove existing roles for this user
      await tx.userRole.deleteMany({
        where: { userId: targetUser.id },
      });

      // Add new role
      await tx.userRole.create({
        data: {
          userId: targetUser.id,
          roleId: targetRole.id,
        },
      });

      // Audit role change
      await AuditService.log({
        businessId: currentUser.businessId,
        userId: currentUser.id,
        action: AuditAction.ROLE_CHANGED,
        entityType: "USER",
        entityId: targetUser.id,
        previousValues: {
          roles: targetUser.userRoles.map((ur) => ur.role.name),
        },
        newValues: {
          roles: [targetRole.name],
        },
        reason: `Role changed by ${currentUser.displayName}`,
      });
    });

    revalidatePath("/users");
    return {
      success: true,
      message: `Role for ${targetUser.displayName} updated to ${targetRole.name}.`,
    };
  } catch (error) {
    console.error("Change user role error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to change user role.",
    };
  }
}

/**
 * Server Action: Deactivate user account
 * Preserves historical references (created_by, audited mutations).
 * Enforces Last-Owner Protection.
 */
export async function deactivateUserAction(
  _prevState: UserActionResult | null,
  formData: FormData
): Promise<UserActionResult> {
  const currentUser = await requirePermission(PERMISSIONS.USERS_MANAGE);
  const targetUserId = formData.get("userId")?.toString().trim() || "";

  if (!targetUserId) {
    return { success: false, error: "User ID is required." };
  }

  try {
    const targetUser = await prisma.userProfile.findFirst({
      where: {
        id: targetUserId,
        businessId: currentUser.businessId,
      },
      include: {
        userRoles: {
          include: { role: true },
        },
      },
    });

    if (!targetUser) {
      return { success: false, error: "User not found." };
    }

    // CRITICAL: LAST-OWNER PROTECTION
    const isOwner = targetUser.userRoles.some((ur) => ur.role.type === RoleType.OWNER);
    if (isOwner) {
      const activeOwnersCount = await prisma.userRole.count({
        where: {
          user: {
            businessId: currentUser.businessId,
            status: UserStatus.ACTIVE,
          },
          role: {
            type: RoleType.OWNER,
          },
        },
      });

      if (activeOwnersCount <= 1) {
        throw new AppError(
          "Security restriction: Cannot deactivate the last remaining active OWNER of the business.",
          400,
          "LAST_OWNER_PROTECTION"
        );
      }
    }

    await prisma.userProfile.update({
      where: { id: targetUser.id },
      data: { status: UserStatus.INACTIVE },
    });

    await AuditService.log({
      businessId: currentUser.businessId,
      userId: currentUser.id,
      action: AuditAction.USER_DEACTIVATED,
      entityType: "USER",
      entityId: targetUser.id,
      reason: `User deactivated by ${currentUser.displayName}`,
    });

    revalidatePath("/users");
    return {
      success: true,
      message: `Account for ${targetUser.displayName} has been deactivated.`,
    };
  } catch (error) {
    console.error("Deactivate user error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to deactivate user.",
    };
  }
}

/**
 * Server Action: Reactivate an inactive user account
 */
export async function reactivateUserAction(
  _prevState: UserActionResult | null,
  formData: FormData
): Promise<UserActionResult> {
  const currentUser = await requirePermission(PERMISSIONS.USERS_MANAGE);
  const targetUserId = formData.get("userId")?.toString().trim() || "";

  if (!targetUserId) {
    return { success: false, error: "User ID is required." };
  }

  try {
    const targetUser = await prisma.userProfile.findFirst({
      where: {
        id: targetUserId,
        businessId: currentUser.businessId,
      },
    });

    if (!targetUser) {
      return { success: false, error: "User not found." };
    }

    await prisma.userProfile.update({
      where: { id: targetUser.id },
      data: { status: UserStatus.ACTIVE },
    });

    await AuditService.log({
      businessId: currentUser.businessId,
      userId: currentUser.id,
      action: AuditAction.USER_ACTIVATED,
      entityType: "USER",
      entityId: targetUser.id,
      reason: `User reactivated by ${currentUser.displayName}`,
    });

    revalidatePath("/users");
    return {
      success: true,
      message: `Account for ${targetUser.displayName} has been reactivated.`,
    };
  } catch (error) {
    console.error("Reactivate user error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to reactivate user.",
    };
  }
}
