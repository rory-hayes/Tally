import { test, expect } from "@playwright/test";

test.describe("Client management", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/Email/i).fill("test@practice.com");
    await page.getByLabel(/Password/i).fill("Password123!");
    await page.getByRole("button", { name: /Sign In/i }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("user can create a new client from the clients page", async ({ page }) => {
    await page.getByRole("menuitem", { name: /Clients/i }).click();
    await expect(page).toHaveURL(/\/clients$/);

    await page.getByRole("button", { name: /Add client/i }).click();
    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible();

    await modal.getByLabel(/Client name/i).fill("Beacon Co");
    await modal.getByRole("button", { name: /Save/i }).click();

    await expect(modal).toBeHidden();
    await expect(page.getByText("Beacon Co")).toBeVisible();
  });
});
