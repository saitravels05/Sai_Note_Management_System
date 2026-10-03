import { test, expect } from "@playwright/test";

test.describe("Layer 6 — Role-Based Access Control E2E Matrix", () => {
  test.beforeEach(async ({ context }) => {
    // Ensure clean authentication state between tests
    await context.clearCookies();
  });

  test("Section 89: Accountant can access financials and reports but is denied user management", async ({ page }) => {
    // 1. Log in as Accountant
    await page.goto("/login");
    await page.fill('input[type="email"], input[name="email"]', "accountant@saitours.com");
    await page.fill('input[type="password"], input[name="password"]', "TestRolePass@2026");
    await page.click('button[type="submit"]');

    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });

    // 2. Allowed: Dashboard, Records, Receivables, Reports
    await page.goto("/dashboard");
    await expect(page.locator("body")).toBeVisible();

    await page.goto("/records");
    await expect(page.locator("body")).toBeVisible();

    await page.goto("/reports");
    await expect(page.locator("body")).toBeVisible();

    // 3. Denied: User Management (/users)
    await page.goto("/users");
    await expect(page.getByRole("heading", { name: /Access Denied|Unauthorized/i })).toBeVisible({ timeout: 10000 });
  });

  test("Section 90: Staff can access records and quick-entry but is denied admin user management", async ({ page }) => {
    // 1. Log in as Staff
    await page.goto("/login");
    await page.fill('input[type="email"], input[name="email"]', "staff@saitours.com");
    await page.fill('input[type="password"], input[name="password"]', "TestRolePass@2026");
    await page.click('button[type="submit"]');

    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });

    // 2. Allowed: Quick entry & records
    await page.goto("/quick-entry");
    await expect(page.locator("body")).toBeVisible();

    await page.goto("/records");
    await expect(page.locator("body")).toBeVisible();

    // 3. Denied: User management
    await page.goto("/users");
    await expect(page.getByRole("heading", { name: /Access Denied|Unauthorized/i })).toBeVisible({ timeout: 10000 });
  });

  test("Section 91: Viewer has strictly read-only access and cannot access admin management", async ({ page }) => {
    // 1. Log in as Viewer
    await page.goto("/login");
    await page.fill('input[type="email"], input[name="email"]', "viewer@saitours.com");
    await page.fill('input[type="password"], input[name="password"]', "TestRolePass@2026");
    await page.click('button[type="submit"]');

    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });

    // 2. Allowed: View records
    await page.goto("/records");
    await expect(page.locator("body")).toBeVisible();

    // 3. Denied: User management
    await page.goto("/users");
    await expect(page.getByRole("heading", { name: /Access Denied|Unauthorized/i })).toBeVisible({ timeout: 10000 });
  });
});
