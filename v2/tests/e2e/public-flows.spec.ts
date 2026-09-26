import { expect, test } from "@playwright/test";

/**
 * The public flows a visitor actually uses, end to end, against a running
 * build (BASE_URL, default http://localhost:3000). Replaces the original
 * `connection.spec.ts`, which checked a "v2 Connection Test" homepage that has
 * not existed for months and could only fail.
 *
 * Read-only: nothing here submits an alert, a timeline or any form that
 * writes. A case number is taken from the sitemap-free lookup path by reading
 * one off the queue page, so the test never hardcodes a real person's case.
 *
 *   BASE_URL=http://localhost:3000 npx playwright test tests/e2e/public-flows.spec.ts
 */

test.describe.configure({ mode: "serial" });

test("the case lookup answers a real case number", async ({ page }) => {
  await page.goto("/perm-case-status");
  // A case number from the live data, not a hardcoded one: the decision
  // activity page lists the day's decided cases with links to the lookup.
  await page.goto("/perm-decision-activity");
  const link = page.locator('a[href*="/perm-case-status?case="]').first();
  const href = await link.getAttribute("href");
  expect(href).toBeTruthy();
  await page.goto(href!);
  await expect(page.getByText("The record", { exact: false })).toBeVisible();
  await expect(page.locator("h1")).toBeVisible();
});

test("the processing time calculator gives a date for a filing date", async ({ page }) => {
  await page.goto("/tools/perm-timeline-calculator");
  await expect(page.getByText(/Pick a date above/)).toBeVisible();
  await expect(page.getByText(/isn.t enough published DOL data/)).toHaveCount(0);
  await page.getByLabel(/DOL received your case/i).fill("2025-12-15");
  await expect(page.getByText(/^Most likely$/)).toBeVisible();
  await expect(page.getByText(/^Around /).first()).toBeVisible();
});

test("the alert form refuses an invalid address before sending anything", async ({ page }) => {
  await page.goto("/perm-processing-times");
  const email = page.locator('input[type="email"]').first();
  await email.fill("not-an-address");
  const valid = await email.evaluate((el: HTMLInputElement) => el.checkValidity());
  expect(valid).toBe(false);
});

test("an embed can be framed and a normal page cannot", async ({ request }) => {
  const embed = await request.get("/embed/rfi-deadline");
  expect(embed.status()).toBe(200);
  expect(embed.headers()["content-security-policy"] ?? "").toContain("frame-ancestors *");
  expect(embed.headers()["x-frame-options"]).toBeUndefined();
  const page = await request.get("/tools/rfi-deadline");
  expect(page.headers()["x-frame-options"]).toBe("DENY");
});

test("a language guide sends its lookup form to the case page", async ({ page }) => {
  await page.goto("/zh");
  await expect(page.locator('[lang="zh-Hans"]').first()).toBeVisible();
  const form = page.locator('form[action*="/perm-case-status"]').first();
  await expect(form).toHaveCount(1);
});

test("the search palette finds the new tools", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press(process.platform === "darwin" ? "Meta+k" : "Control+k");
  const input = page.getByRole("combobox").or(page.getByPlaceholder(/search/i)).first();
  await input.fill("green card line");
  await expect(page.getByText("Green card line").first()).toBeVisible();
});

test("the estimate scorecard shows the backtest headline", async ({ page }) => {
  await page.goto("/estimate-scorecard");
  await expect(page.getByText(/Typical miss, real decisions/i)).toBeVisible();
});
