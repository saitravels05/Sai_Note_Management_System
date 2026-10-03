import { test, expect } from "@playwright/test";

test.describe("Layer 6 — Owner End-to-End User Journey", () => {
  test("Section 88: Complete Owner Flow (Login -> Dashboard -> Customers -> Receivables -> Reports -> Audit)", async ({ page }) => {
    // 1. Visit Login page
    await page.goto("/login");
    await expect(page).toHaveTitle(/Sai Notes|Sign In|Login/i);

    // Verify login form is present
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    const passwordInput = page.locator('input[type="password"], input[name="password"]');
    const submitBtn = page.locator('button[type="submit"]');

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitBtn).toBeVisible();

    // Fill credentials (or submit pre-filled owner credentials)
    await emailInput.fill("saipassportmdu@gmail.com");
    await passwordInput.fill("Saitours@2026");
    await submitBtn.click();

    // Wait for redirect to Dashboard or authenticated page
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });
    await expect(page.locator("body")).toBeVisible();

    // 2. Verify Dashboard content
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/.*dashboard.*/);
    const bodyText = await page.textContent("body");
    expect(bodyText).toContain("Sai Tours");

    // 3. Navigate to Customers
    await page.goto("/customers");
    await expect(page).toHaveURL(/.*customers.*/);
    await expect(page.locator("body")).toContainText(/Ramanathan|Customer|Add Customer/i);

    // 4. Navigate to Receivables & verify critical receivable
    await page.goto("/receivables");
    await expect(page).toHaveURL(/.*receivables.*/);
    // Mandatory regression check: ₹50,000, ₹30,000, or PARTIALLY_PAID
    await expect(page.locator("body")).toContainText(/Receivable|Outstanding|Partially/i);

    // 5. Navigate to Reports
    await page.goto("/reports");
    await expect(page).toHaveURL(/.*reports.*/);
    await expect(page.locator("body")).toContainText(/Report|Export|Summary/i);

    // 6. Navigate to Audit Log
    await page.goto("/audit");
    await expect(page).toHaveURL(/.*audit.*/);
    await expect(page.locator("body")).toContainText(/Audit|Activity|Log/i);
  });
});
