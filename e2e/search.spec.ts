import { expect, test } from "@playwright/test";

test.describe("name checker", () => {
  test("search input runs a check and streams in the availability grid", async ({ page }) => {
    await page.goto("/");

    const input = page.getByLabel("Name to check");
    await expect(input).toBeVisible();
    await input.fill("acme");
    await input.press("Enter");

    // Results header and the Overall card appear once checks settle.
    await expect(page.getByText("results for")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "Overall" })).toBeVisible();

    // Every provider group renders a section, demo mode is labelled honestly.
    for (const title of [
      "Code & registries",
      "Social media",
      "Core domains",
      "Regional domains",
      "Industry domains",
      "Platforms & stores",
      "Community & publishing",
    ]) {
      await expect(page.getByRole("heading", { name: title })).toBeVisible();
    }
    await expect(page.getByText("demo data").first()).toBeVisible();
  });

  test("?q= deep link runs the check immediately", async ({ page }) => {
    await page.goto("/?q=octocat");
    await expect(page.getByText("results for")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("octocat").first()).toBeVisible();
  });
});
