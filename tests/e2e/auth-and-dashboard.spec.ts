import { test, expect } from "@playwright/test";

test.describe("Authentication and dashboard", () => {
  test("user can sign in and view dashboard summaries", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel(/Email/i).fill("test@practice.com");
    await page.getByLabel(/Password/i).fill("Password123!");
    await page.getByRole("button", { name: /Sign In/i }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId("dashboard-view")).toBeVisible();
    await expect(page.getByText("Practice Overview")).toBeVisible();

    const clientRow = page.getByRole("link", { name: "ACME Ltd" });
    await expect(clientRow).toBeVisible();

    const criticalTag = page.getByTestId("critical-count");
    const warningTag = page.getByTestId("warning-count");
    await expect(criticalTag).toContainText("Critical: 0");
    await expect(warningTag).toContainText("Warning: 1");
  });
});
