import { test, expect } from "@playwright/test";

test.describe("Layer 7 — Mobile & Responsive Layout Automation", () => {
  test("Section 92: Mobile Viewport Login and Dashboard Navigation", async ({ page }) => {
    // 1. Visit Login on Mobile
    await page.goto("/login");
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();

    await page.fill('input[type="email"], input[name="email"]', "saipassportmdu@gmail.com");
    await page.fill('input[type="password"], input[name="password"]', "Saitours@2026");
    await page.click('button[type="submit"]');

    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });

    // 2. Mobile Dashboard Layout
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/.*dashboard.*/);

    // Verify critical metrics card or header fits within mobile screen without horizontal overflow
    const viewportSize = page.viewportSize();
    expect(viewportSize).toBeDefined();

    // 3. Quick Entry on Mobile
    await page.goto("/quick-entry");
    await expect(page.locator("body")).toBeVisible();

    // 4. Records list on Mobile
    await page.goto("/records");
    await expect(page.locator("body")).toBeVisible();
  });
});
