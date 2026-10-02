import { requirePermission } from "@/lib/auth/current-user";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/layout/AppShell";
import { UserManagementTable, type SerializedUser, type SerializedRole } from "@/components/users/UserManagementTable";
import { redirect } from "next/navigation";

export const metadata = {
  title: "User Management & Access Control | Sai Tours & Travels",
  description: "Manage users, invitations, and role-based permissions.",
};

export default async function UsersPage() {
  let currentUser;
  try {
    currentUser = await requirePermission(PERMISSIONS.USERS_VIEW);
  } catch {
    redirect("/unauthorized");
  }

  const canManageUsers = hasPermission(
    currentUser.permissions,
    currentUser.roleTypes,
    PERMISSIONS.USERS_MANAGE
  );

  // Fetch users belonging strictly to current business
  const userProfiles = await prisma.userProfile.findMany({
    where: { businessId: currentUser.businessId },
    include: {
      userRoles: {
        include: {
          role: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // Fetch accessible roles (business-specific or system templates)
  const rolesData = await prisma.role.findMany({
    where: {
      OR: [
        { businessId: currentUser.businessId },
        { isSystem: true },
      ],
    },
    orderBy: { name: "asc" },
  });

  const serializedUsers: SerializedUser[] = userProfiles.map((up) => {
    const primaryRole = up.userRoles[0]?.role;
    return {
      id: up.id,
      displayName: up.displayName,
      email: up.email,
      phone: up.phone,
      status: up.status as SerializedUser["status"],
      roleName: primaryRole?.name || "Staff",
      roleId: primaryRole?.id || "",
      roleType: primaryRole?.type || "STAFF",
      createdAt: up.createdAt.toISOString(),
      lastActiveAt: up.lastActiveAt ? up.lastActiveAt.toISOString() : null,
    };
  });

  const serializedRoles: SerializedRole[] = rolesData.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    description: r.description,
  }));

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
        <UserManagementTable
          users={serializedUsers}
          roles={serializedRoles}
          currentUserId={currentUser.id}
          canManageUsers={canManageUsers}
        />
      </div>
    </AppShell>
  );
}
