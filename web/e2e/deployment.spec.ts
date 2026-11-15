import { expect, test } from "@playwright/test";

test("public live API calculates a location outside the saved catalog", async ({
  page,
}) => {
  test.skip(
    !process.env.ILARGI_LIVE_CHECK,
    "Only run after connecting the public API.",
  );
  const health = page.waitForResponse(
    (response) => response.url().endsWith("/api/health") && response.ok(),
  );
  await page.goto("/");
  await health;
  await expect(page.getByRole("status")).toHaveCount(0);
  await page.getByRole("button", { name: /Mission analysis/ }).click();
  await page.getByLabel("Latitude (°)").fill("0.7");
  await page.getByLabel("Longitude east (°)").fill("23.5");
  await page.getByRole("button", { name: "Analyze locations" }).click();
  await expect(page.locator(".js-plotly-plot").first()).toBeVisible({
    timeout: 35000,
  });
  await expect(page.locator(".error-banner")).toHaveCount(0);
  await expect(page.getByRole("status")).toHaveCount(0);
});

test("API outage retains multi-point analysis, plots and honest request boundaries", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/**", (route) => route.abort());
  await page.goto("/");
  await expect(page.getByRole("status")).toContainText("exploring the demo");
  await expect(page.locator(".home-intro").getByRole("status")).toBeVisible();
  await expect(
    page.getByRole("contentinfo").getByRole("link", { name: "Data sources" }),
  ).toBeVisible();
  await expect(page.locator(".home-wordmark svg")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Load demo settings" }),
  ).toBeEnabled();
  // Catalog loading is asynchronous and must finish before loading the demo.
  await page.getByRole("button", { name: /Mission analysis/ }).click();
  await expect(page.getByLabel("Site P1").locator("option")).toHaveCount(12);
  await page.getByRole("button", { name: "Load demo settings" }).click();
  await expect(page.getByLabel("Site P3")).toBeVisible();
  await expect(page.locator(".comp-table tbody tr")).toHaveCount(3);
  await page
    .getByRole("button", { name: "View azimuth–elevation plot for P1" })
    .click();
  await expect(page.locator(".js-plotly-plot").first()).toBeVisible();
  await page.getByLabel("UTC date").first().fill("2026-05-01");
  await page.getByRole("button", { name: "Analyze locations" }).click();
  await expect(page.getByRole("alert")).toContainText("needs the live API");
  await expect(page.locator(".comp-table tbody tr")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("education cycles, multiple locations and landing game work without Python", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/**", (route) =>
    route.fulfill({ status: 503, body: "unavailable" }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: /Explore with ILARGI/ }).click();
  await expect(page.getByRole("option").first()).toBeVisible();
  await expect(page.locator(".ilargi-bubble-badges svg")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Start animation", exact: true }),
  ).toBeEnabled();
  await expect(page.locator(".error-banner")).toHaveCount(0);
  await page
    .getByRole("option")
    .filter({ hasText: "Apollo 11" })
    .first()
    .click();
  await expect(page.locator(".edu-site-row.active")).toContainText("Apollo 11");
  await expect(
    page.getByRole("button", { name: "Start animation", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Start animation", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Restart animation", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start landing game" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Start landing game" }).click();
  await expect(page.getByText("Phase 1 · Parking Orbit").first()).toBeVisible();
  await page.getByRole("button", { name: "Calculate my orbit" }).click();
  await page.getByRole("button", { name: /Apply inclination/ }).click();
  await page
    .getByRole("button", { name: "Continue to Phase 2: Orbital descent" })
    .click();
  await expect(
    page.getByText("Phase 2 · Orbital altitude and ΔV").first(),
  ).toBeVisible();
  const altitudes = await page
    .locator(".phase2-alt-box .kpi-value")
    .allTextContents();
  const descent = parseFloat(altitudes[0]) - parseFloat(altitudes[1]);
  await page.getByPlaceholder("e.g. 100").fill(String(descent));
  await page.getByRole("button", { name: "Check subtraction" }).click();
  await page.locator(".red-rocket-btn").click();
  await expect(
    page.getByRole("button", { name: "Restart approach (Phase 3)" }),
  ).toBeVisible({ timeout: 20000 });
  expect(errors).toEqual([]);
});
