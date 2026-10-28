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
  // On the live site Cloudflare's lookup check stands in front of the case page
  // for every scripted browser (rule 4, Oct 3 2026), and this test never tries to
  // get past it. The embedded lookup runs the same lookup without it, so the
  // morning check reads that instead, and says so in its output.
  if (await page.getByRole("heading", { name: "Performing security verification" }).isVisible()) {
    const number = new URL(href!, "https://permtracker.app").searchParams.get("case")!;
    console.log("note: the case page is behind Cloudflare's lookup check here; checked the embedded lookup instead");
    await page.goto(`/embed/case-status?case=${encodeURIComponent(number)}`);
    await expect(page.getByText(number, { exact: true })).toBeVisible();
    await expect(page.getByText("Employer", { exact: true })).toBeVisible();
    return;
  }
  await expect(page.getByText("The record", { exact: false })).toBeVisible();
  await expect(page.locator("h1")).toBeVisible();
});

test("the processing time calculator gives a date for a filing date", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/tools/perm-timeline-calculator");
  await expect(page.getByText(/Pick a date above/)).toBeVisible();
  await expect(page.getByText(/isn.t enough published DOL data/)).toHaveCount(0);
  // Two months back is always still in DOL's line (the queue runs about ten months behind), so it gets a date.
  // A fixed date stops working once the queue passes its month: "2025-12-15" did in October 2026.
  const filed = new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10);
  // A date typed before the page's script starts is dropped (the dev server takes about 8 s), so fill again
  // until the answer shows.
  await expect(async () => {
    await page.getByLabel(/DOL received your case/i).fill(filed);
    await expect(page.getByText(/^Around /).first()).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 45_000 });
  await expect(page.getByText(/^Most likely$/)).toBeVisible();
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
  test.setTimeout(90_000);
  await page.goto("/");
  const input = page.getByRole("combobox").or(page.getByPlaceholder(/search/i)).first();
  // The shortcut does nothing until the page's script is listening (about 8 s on the dev server): press again
  // until the palette opens.
  await expect(async () => {
    await page.keyboard.press(process.platform === "darwin" ? "Meta+k" : "Control+k");
    await expect(input).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 45_000 });
  await input.fill("green card line");
  // The tool's name is "Your place in line" (its address and old name are "green card line").
  await expect(page.getByRole("option", { name: /Your place in line/ }).first()).toBeVisible();
});

test("the estimate scorecard shows the backtest headline", async ({ page }) => {
  await page.goto("/estimate-scorecard");
  await expect(page.getByText(/Typical miss on real decisions/i).first()).toBeVisible();
});

test("PERM by the numbers draws every tile and the card sorter, which pauses", async ({ page }) => {
  await page.goto("/perm-by-the-numbers");
  await expect(page.locator("h1")).toHaveText(/PERM by the numbers/i);
  // Every tile renders: each heading carries the tile's id, and the page throws rather than drawing a tile
  // with no data.
  for (const id of ["line", "decided", "holds", "filed", "jobs", "employers", "new-employers", "rfi", "wage-requests", "dol-page", "bulletins"]) {
    await expect(page.locator(`#${id}-h`), `tile #${id}`).toHaveCount(1);
  }
  await expect(page.getByRole("link", { name: /Download the files/ })).toHaveAttribute("href", "/open-data");
  const pause = page.getByRole("button", { name: "Pause the card sorter" });
  await pause.scrollIntoViewIfNeeded();
  await pause.click();
  await expect(page.getByRole("button", { name: "Play the card sorter" })).toBeVisible();
});

test("the layoff page names how many states it reads", async ({ page }) => {
  await page.goto("/layoffs");
  await expect(page.locator("h1")).toBeVisible();
  await expect(page.getByText(/\d+\s+states and DC/i).first()).toBeVisible();
});

test("the green card timeline plans a certified case and keeps the case in the address", async ({ page }) => {
  // A certified PERM: the plan starts at the I-140 and counts the PERM as behind the reader.
  await page.goto("/tools/green-card-timeline?where=perm-certified&date=2026-09-01&pd=2025-10-20");
  await expect(page.getByText("Before this plan starts")).toBeVisible();
  await expect(page.getByRole("link", { name: /I-140/ }).first()).toBeVisible();
  // A changed input goes into the address, so a reload or a shared link opens the same plan.
  await page.getByLabel("Country of birth").selectOption("india");
  await expect(page).toHaveURL(/country=india/);
  await page.reload();
  await expect(page.getByLabel("Country of birth")).toHaveValue("india");
  await expect(page.getByText(/^Government fees, the whole way$/)).toBeVisible();
});

test("a filing month opens to a day, and the day's list filters by status", async ({ page }) => {
  await page.goto("/perm-queue/2026-01");
  const day = page.getByRole("link", { name: /^January 14, 2026: .* filed/ });
  await expect(day).toBeVisible();
  await day.click();
  await expect(page).toHaveURL(/\/perm-queue\/2026-01\/14$/);
  await expect(page.getByRole("heading", { level: 1, name: "Filed January 14, 2026" })).toBeVisible();
  // A status chip narrows the list and the count says so.
  const chip = page.getByRole("group", { name: "Status" }).getByRole("button").first();
  await chip.click();
  await expect(chip).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/^\d[\d,]* of \d[\d,]* PERM cases, /)).toBeVisible();
  // Every case is a lookup of its own.
  await expect(page.locator('a[href^="/perm-case-status?case=G-"]').first()).toBeVisible();
});

test("the queue wall goes back to a past day and returns to today", async ({ page }) => {
  await page.goto("/perm-queue");
  const slider = page.getByRole("slider", { name: "Day" });
  await expect(slider).toHaveAttribute("aria-valuetext", "Today");
  await page.getByRole("button", { name: "A day earlier" }).click();
  await expect(page.getByText(/cases still pending at the end of .*, against [\d,]+ today\./)).toBeVisible();
  await expect(page.getByText("Today", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Back to today" }).click();
  await expect(slider).toHaveAttribute("aria-valuetext", "Today");
});
