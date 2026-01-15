import { test, expect } from "@playwright/test";

test.describe("Convex Connection", () => {
  test("homepage loads and shows connection test", async ({ page }) => {
    await page.goto("/");

    // Verify page loads
    await expect(page.getByRole("heading", { name: "v2 Connection Test" })).toBeVisible();

    // Verify Convex data loads (connection works)
    await expect(page.getByText("Convex connection verified")).toBeVisible({
      timeout: 10000, // Give Convex time to connect
    });
  });

  test("can add items via UI", async ({ page }) => {
    await page.goto("/");

    // Wait for connection
    await expect(page.getByText("Convex connection verified")).toBeVisible({
      timeout: 10000,
    });

    // Add a test item
    const testText = `E2E Test ${Date.now()}`;
    await page.getByPlaceholder("Enter test text").fill(testText);
    await page.getByRole("button", { name: "Add Item" }).click();

    // Verify it appears in real-time
    await expect(page.getByText(testText)).toBeVisible();
  });
});
