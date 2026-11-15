import { expect, test } from "@playwright/test";

test("API outage retains multi-point analysis, plots and honest request boundaries", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/**", (route) => route.abort());
  await page.goto("/");
  await expect(page.getByRole("status")).toContainText("Saved scientific demo");
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
  expect(errors).toEqual([]);
});
