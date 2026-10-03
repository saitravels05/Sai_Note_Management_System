import { PrismaClient, RoleType, UserStatus } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";
import { ROLE_PERMISSION_TEMPLATES } from "../src/lib/auth/permissions";

const prisma = new PrismaClient();

export async function seedTestRolesAndUsers() {
  const business = await prisma.business.findUnique({
    where: { businessCode: "SAI" },
  });

  if (!business) {
    throw new Error("Business SAI not found");
  }

  const businessId = business.id;
  const passwordHash = await hashPassword("TestRolePass@2026");

  const rolesToCreate = [
    { name: "Accountant", type: RoleType.ACCOUNTANT, email: "accountant@saitours.com", displayName: "Test Accountant" },
    { name: "Staff", type: RoleType.STAFF, email: "staff@saitours.com", displayName: "Test Staff" },
    { name: "Viewer", type: RoleType.VIEWER, email: "viewer@saitours.com", displayName: "Test Viewer" },
  ];

  for (const item of rolesToCreate) {
    // 1. Ensure role exists
    let role = await prisma.role.findFirst({
      where: { businessId, type: item.type },
    });

    if (!role) {
      role = await prisma.role.create({
        data: {
          businessId,
          name: item.name,
          type: item.type,
          description: `Standard role for ${item.name}`,
        },
      });

      // Assign permissions
      const perms = ROLE_PERMISSION_TEMPLATES[item.type] || [];
      for (const code of perms) {
        const perm = await prisma.permission.findUnique({ where: { code } });
        if (perm) {
          await prisma.rolePermission.upsert({
            where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
            update: {},
            create: { roleId: role.id, permissionId: perm.id },
          });
        }
      }
    }

    // 2. Ensure test user profile exists
    let user = await prisma.userProfile.findFirst({
      where: { businessId, email: item.email },
    });

    if (!user) {
      user = await prisma.userProfile.create({
        data: {
          businessId,
          authUserId: `auth_${item.type.toLowerCase()}_test`,
          displayName: item.displayName,
          email: item.email,
          passwordHash,
          status: UserStatus.ACTIVE,
        },
      });

      await prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: role.id,
        },
      });
      console.log(`Created user ${item.email} with role ${item.type} (ID: ${user.id})`);
    } else {
      console.log(`User ${item.email} already exists (ID: ${user.id})`);
    }
  }
}

seedTestRolesAndUsers()
  .then(() => {
    console.log("✅ Test roles and users seeded successfully.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Failed to seed test roles:", err);
    process.exit(1);
  });
