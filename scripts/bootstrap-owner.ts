import { PrismaClient, RoleType, UserStatus } from "@prisma/client";
import { hashPassword, validatePasswordStrength } from "../src/lib/auth/password";
import { PERMISSIONS, ROLE_PERMISSION_TEMPLATES } from "../src/lib/auth/permissions";

const prisma = new PrismaClient();

/**
 * Controlled Bootstrap Script for First Business & Owner.
 * 
 * Security Guard:
 * If an active OWNER already exists in the database, this script strictly refuses
 * to execute to prevent unauthorized privilege escalation or accidental overwrites.
 */
async function bootstrapOwner() {
  console.log("🔒 Checking system bootstrap eligibility...");

  const existingOwner = await prisma.userRole.findFirst({
    where: {
      role: { type: RoleType.OWNER },
      user: { status: UserStatus.ACTIVE },
    },
    include: { user: true },
  });

  if (existingOwner) {
    console.error("❌ BOOTSTRAP LOCKED: An active Owner already exists in the system.");
    console.error(`   Existing Owner: ${existingOwner.user.email} (${existingOwner.user.displayName})`);
    console.error("   To add additional users, log in as the Owner and invite them via /users.");
    process.exit(1);
  }

  // Parse command line arguments or use production configuration
  const args = process.argv.slice(2);
  const emailArg = args.find((a) => a.startsWith("--email="))?.split("=")[1] || "saipassportmdu@gmail.com";
  const passwordArg = args.find((a) => a.startsWith("--password="))?.split("=")[1] || "Saitours@2026";
  const nameArg = args.find((a) => a.startsWith("--name="))?.split("=")[1] || "Sai Tours Proprietor";
  const businessNameArg = args.find((a) => a.startsWith("--business="))?.split("=")[1] || "Sai Tours & Travels";
  const businessCodeArg = args.find((a) => a.startsWith("--code="))?.split("=")[1] || "SAI";

  const strength = validatePasswordStrength(passwordArg);
  if (!strength.isValid) {
    console.error(`❌ Password does not meet security requirements: ${strength.message}`);
    process.exit(1);
  }

  console.log(`📦 Initializing default system permissions...`);
  // Ensure all permissions exist in database
  for (const [key, code] of Object.entries(PERMISSIONS)) {
    await prisma.permission.upsert({
      where: { code },
      update: {},
      create: {
        code,
        module: code.split(".")[0] || "system",
        description: `Permission for ${key.toLowerCase().replace(/_/g, " ")}`,
      },
    });
  }

  console.log(`🏢 Provisioning business: ${businessNameArg} [${businessCodeArg}]...`);
  const business = await prisma.business.upsert({
    where: { businessCode: businessCodeArg },
    update: {},
    create: {
      name: businessNameArg,
      businessCode: businessCodeArg,
      currency: "INR",
      currencySymbol: "₹",
      timezone: "Asia/Kolkata",
      country: "India",
      isActive: true,
    },
  });

  console.log(`🛡️ Provisioning standard role templates for ${business.name}...`);
  const roleMap: Record<RoleType, string> = {} as Record<RoleType, string>;

  for (const [roleType, permCodes] of Object.entries(ROLE_PERMISSION_TEMPLATES)) {
    const role = await prisma.role.upsert({
      where: {
        businessId_name: {
          businessId: business.id,
          name: roleType,
        },
      },
      update: {},
      create: {
        businessId: business.id,
        name: roleType,
        type: roleType as RoleType,
        description: `Default system template for ${roleType}`,
        isSystem: true,
      },
    });

    roleMap[roleType as RoleType] = role.id;

    // Attach permissions
    for (const code of permCodes) {
      const permission = await prisma.permission.findUnique({ where: { code } });
      if (permission) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: permission.id,
            },
          },
          update: {},
          create: {
            roleId: role.id,
            permissionId: permission.id,
          },
        });
      }
    }
  }

  console.log(`👤 Provisioning first OWNER account for ${emailArg}...`);
  const passwordHash = await hashPassword(passwordArg);

  const ownerProfile = await prisma.userProfile.create({
    data: {
      authUserId: `owner_${businessCodeArg.toLowerCase()}_${Date.now()}`,
      businessId: business.id,
      displayName: nameArg,
      email: emailArg,
      passwordHash,
      status: UserStatus.ACTIVE,
    },
  });

  // Assign OWNER role
  await prisma.userRole.create({
    data: {
      userId: ownerProfile.id,
      roleId: roleMap.OWNER,
    },
  });

  // Provision sequences
  await prisma.businessSequence.createMany({
    data: [
      { businessId: business.id, sequenceType: "INVOICE", prefix: "INV-26-", currentValue: BigInt(0) },
      { businessId: business.id, sequenceType: "PAYMENT", prefix: "RCP-26-", currentValue: BigInt(0) },
      { businessId: business.id, sequenceType: "VOUCHER", prefix: "VCH-26-", currentValue: BigInt(0) },
    ],
    skipDuplicates: true,
  });

  console.log("\n✅ SUCCESS: Initial business and first Owner account successfully provisioned!");
  console.log(`   Business:   ${business.name} (${business.businessCode})`);
  console.log(`   Owner Name: ${ownerProfile.displayName}`);
  console.log(`   Email:      ${ownerProfile.email}`);
  console.log(`   Role:       OWNER (All Permissions Assigned)`);
  console.log(`   Status:     ACTIVE\n`);
  console.log("🔒 Controlled bootstrap is now permanently locked for this business.");
}

bootstrapOwner()
  .catch((err) => {
    console.error("Fatal bootstrap error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
