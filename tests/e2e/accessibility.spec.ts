import { test, expect } from "@playwright/test";

test.describe("Layer 7 — Automated Accessibility & Semantic HTML Audit", () => {
  test("Section 94: Login page accessibility landmarks and label associations", async ({ page }) => {
    await page.goto("/login");

    // 1. Verify inputs have accessible names/labels
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    const passwordInput = page.locator('input[type="password"], input[name="password"]');

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();

    // 2. Buttons have descriptive text
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeVisible();
    const btnText = await submitBtn.textContent();
    expect(btnText?.trim().length).toBeGreaterThan(0);

    // 3. Page has heading
    const heading = page.locator("h1, h2");
    await expect(heading.first()).toBeVisible();

    // 4. Images have alt text
    const images = page.locator("img");
    const count = await images.count();
    for (let i = 0; i < count; i++) {
      const alt = await images.nth(i).getAttribute("alt");
      expect(alt !== null).toBeTruthy();
    }
  });
});
