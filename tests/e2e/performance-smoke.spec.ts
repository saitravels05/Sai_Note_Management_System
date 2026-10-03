import { test, expect } from "@playwright/test";

test.describe("Layer 7 — Performance Smoke & Route Response Latency", () => {
  test("Section 96: Key pages load within acceptable interactive thresholds", async ({ page }) => {
    const routesToTest = ["/login", "/api/health"];

    for (const route of routesToTest) {
      const startTime = Date.now();
      const response = await page.goto(route);
      const duration = Date.now() - startTime;

      expect(response?.status()).toBe(200);
      // Ensure local server responds within 5000ms
      expect(duration).toBeLessThan(5000);
    }
  });
});
