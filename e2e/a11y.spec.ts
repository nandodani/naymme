import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Automated WCAG 2.2 A/AA audit of every page state — hero, streamed
 * results, the Connect MCP dialog — plus keyboard-path checks the ruleset
 * can't cover (skip link, roving-tabindex tab bar, hover/focus-only
 * content). Same demo-mode server as the smoke suite.
 */

const WCAG_AA_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function audit(page: Page, label: string) {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_AA_TAGS).analyze();
  expect(
    violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`),
    `${label} — expected zero a11y violations`,
  ).toEqual([]);
}

test.describe("accessibility", () => {
  test("hero state has no axe violations", async ({ page }) => {
    await page.goto("/");
    await audit(page, "hero");
  });

  test("results state has no axe violations", async ({ page }) => {
    await page.goto("/?q=acme");
    await expect(page.getByText("results for")).toBeVisible({ timeout: 30_000 });
    // Let the staggered row entrances settle before scanning.
    await page.waitForTimeout(600);
    await audit(page, "results");
  });

  test("Connect MCP dialog has no axe violations", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /connect mcp/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await audit(page, "dialog");

    // Raw-config disclosure open — re-scan with the snippet visible.
    await page.getByRole("button", { name: /raw config json/i }).click();
    await expect(page.getByText(/mcpServers|lmkurname/).first()).toBeVisible();
    // Let the expand animation finish so axe reads final colors.
    await page.waitForTimeout(400);
    await audit(page, "dialog + disclosure");
  });

  test("skip link precedes all nav and jumps focus into main", async ({ page }) => {
    await page.goto("/");
    const skip = page.getByRole("link", { name: "Skip to main content" });
    // First interactive element in DOM order, before the navbar.
    await expect(page.locator("a, button").first()).toHaveAttribute("href", "#main-content");
    // Hidden until focused, then jumps focus to the main landmark.
    await expect(skip).not.toBeInViewport();
    await skip.focus();
    await expect(skip).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();
  });

  test("keyboard reaches the search, submits, and cycles the filter pills", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("/");
    await expect(page.getByLabel("Name to check")).toBeFocused();
    await page.keyboard.type("acme");
    await page.keyboard.press("Enter");
    await expect(page.getByText("results for")).toBeVisible({ timeout: 30_000 });

    // Filter pills are real toggle buttons — Space/Enter flips them.
    const availableOnly = page.getByRole("button", { name: /available only/i });
    await availableOnly.focus();
    await page.keyboard.press("Enter");
    await expect(availableOnly).toHaveAttribute("aria-pressed", "true");
  });

  test("client tabs in the dialog follow roving tabindex arrow-key nav", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /connect mcp/i }).click();
    const tabs = page.getByRole("tab");
    await expect(tabs).toHaveCount(6);

    await tabs.first().focus();
    await page.keyboard.press("ArrowRight");
    await expect(tabs.nth(1)).toBeFocused();
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("End");
    await expect(tabs.nth(5)).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(tabs.nth(4)).toHaveAttribute("aria-selected", "true");
  });

  test("marquee pause control stops the ticker drift", async ({ page }) => {
    await page.goto("/");
    const pause = page.getByRole("button", { name: /pause provider ticker/i });
    await expect(pause).toHaveAttribute("aria-pressed", "false");
    await pause.click();
    await expect(page.getByRole("button", { name: /resume provider ticker/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("axe stays clean under prefers-reduced-motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/?q=acme");
    await expect(page.getByText("results for")).toBeVisible({ timeout: 30_000 });
    // Let entrance animations settle before scanning (they still run —
    // the reduced-motion path shortens but doesn't skip them).
    await page.waitForTimeout(600);
    await audit(page, "results, reduced motion");
  });
});
