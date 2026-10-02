import { signSessionToken } from "../src/lib/auth/session";
import { RoleType } from "@prisma/client";
import { PERMISSIONS } from "../src/lib/auth/permissions";

const routes = [
  "/",
  "/dashboard",
  "/records",
  "/records/new",
  "/income",
  "/expenses",
  "/receivables",
  "/payables",
  "/notes",
  "/customers",
  "/suppliers",
  "/reports",
  "/reports/builder",
  "/month-end",
  "/documents",
  "/follow-ups",
  "/users",
  "/audit",
  "/backup",
  "/settings",
  "/quick-entry",
  "/ai",
  "/api/health",
  "/api/auth/me",
];

async function runFullTest() {
  console.log("=== STARTING FULL APPLICATION ROUTE TEST ===");

  const token = await signSessionToken({
    userId: "usr_owner_saipassportmdu",
    authUserId: "auth_owner_saipassportmdu",
    businessId: "biz_sai_tours",
    email: "saipassportmdu@gmail.com",
    displayName: "Sai Tours Proprietor",
    roles: ["OWNER"],
    roleTypes: [RoleType.OWNER],
    permissions: Object.values(PERMISSIONS),
  });

  const cookieHeader = `sai_session=${token}; Path=/; HttpOnly; SameSite=Strict`;

  let passed = 0;
  let failed = 0;
  const failures: { route: string; status: number; reason: string }[] = [];

  for (const route of routes) {
    try {
      const url = `http://localhost:3000${route}`;
      const res = await fetch(url, {
        headers: {
          Cookie: cookieHeader,
        },
      });

      const body = await res.text();
      const hasErrorPage = body.includes("Something Went Wrong") || body.includes("Unhandled Runtime Error");
      const hasDigest = body.includes("digest:");

      if (res.status === 200 && !hasErrorPage && !hasDigest) {
        console.log(`[PASS] ${route} -> Status: 200 OK (${body.length} bytes)`);
        passed++;
      } else {
        console.error(`[FAIL] ${route} -> Status: ${res.status}, errorDetected: ${hasErrorPage || hasDigest}`);
        failed++;
        failures.push({
          route,
          status: res.status,
          reason: hasErrorPage ? "Error boundary triggered" : `Unexpected status code: ${res.status}`,
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[ERROR] ${route} -> Network/Fetch error: ${message}`);
      failed++;
      failures.push({
        route,
        status: 0,
        reason: message,
      });
    }
  }

  console.log("\n==========================================");
  console.log(`TOTAL ROUTES TESTED: ${routes.length}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log("==========================================");

  if (failed > 0) {
    console.error("FAILURES ENCOUNTERED:", JSON.stringify(failures, null, 2));
    process.exit(1);
  } else {
    console.log("ALL ROUTES PASSED WITH ZERO RUNTIME ERRORS!");
    process.exit(0);
  }
}

runFullTest();
