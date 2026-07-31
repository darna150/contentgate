import { expect, test, type Page } from "@playwright/test";
import { clientFixture, requireClientFixture } from "./client-fixture";

const E2E_EMAIL = process.env.CONTENTGATE_E2E_EMAIL;
const E2E_PASSWORD = process.env.CONTENTGATE_E2E_PASSWORD;

/** Floor enforced by src/lib/studio-preview-scale.ts. */
const MIN_SCALE = 0.5;

/** Review viewports the launch acceptance matrix requires. */
const REQUIRED_VIEWPORTS = [
  { label: "1366x768", width: 1366, height: 768 },
  { label: "1280x800", width: 1280, height: 800 },
  { label: "1440x900", width: 1440, height: 900 },
] as const;

async function signIn(page: Page) {
  requireClientFixture(["contentId", "outputWidth", "outputHeight"]);
  if (!E2E_EMAIL || !E2E_PASSWORD) {
    throw new Error("Set CONTENTGATE_E2E_EMAIL and CONTENTGATE_E2E_PASSWORD");
  }
  await page.goto("/login");
  await page.getByLabel("Work email").fill(E2E_EMAIL);
  await page.getByLabel("Password").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: /^(Sign in|Enter workspace)$/ }).click();
  await page.waitForFunction(() => !window.location.pathname.startsWith("/login"), undefined, {
    timeout: 45_000,
  });
}

async function openStudio(page: Page) {
  await page.goto(`/studio/${clientFixture.contentId}`);
  await expect(page.getByTestId("studio-preview-canvas")).toBeVisible({ timeout: 60_000 });
}

/** Scale actually applied in the browser, read off the rendered canvas. */
async function measuredScale(page: Page) {
  const canvas = page.getByTestId("studio-preview-canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("preview canvas has no box");
  return box.width / clientFixture.outputWidth;
}

test.describe("Studio preview reflow", () => {
  test("canvas stays at or above the readable floor on every required viewport", async ({
    page,
  }) => {
    await signIn(page);

    const results: string[] = [];
    for (const viewport of REQUIRED_VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openStudio(page);
      const scale = await measuredScale(page);
      results.push(`${viewport.label}: ${(scale * 100).toFixed(1)}%`);
      expect(scale, `${viewport.label} fell below the floor`).toBeGreaterThanOrEqual(
        MIN_SCALE - 0.005,
      );

      // The page itself must never scroll sideways at a required viewport.
      const horizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      );
      expect(horizontalOverflow, `${viewport.label} overflowed horizontally`).toBe(false);

      await page.screenshot({
        path: `test-results/studio-${viewport.label}.png`,
        fullPage: false,
      });
    }
    console.log("measured scale:", results.join("  |  "));
  });

  test("the floor engages and the stage scrolls when fit would go below 50%", async ({
    page,
  }) => {
    await signIn(page);
    // The QA fixture only ships a square variant, which fits above the floor at
    // every required viewport. A short viewport drives its natural fit under
    // 50% so the floor and the scroll path are genuinely exercised.
    await page.setViewportSize({ width: 1366, height: 600 });
    await openStudio(page);

    const scale = await measuredScale(page);
    expect(scale).toBeGreaterThanOrEqual(MIN_SCALE - 0.005);

    const scrollable = await page
      .getByTestId("studio-preview-viewport")
      .evaluate((node) => node.scrollHeight > node.clientHeight + 1);
    expect(scrollable, "floored canvas must be scrollable").toBe(true);

    await page.screenshot({ path: "test-results/studio-floor-engaged.png" });
  });

  test("zoom controls are keyboard operable and change the canvas", async ({ page }) => {
    await signIn(page);
    await page.setViewportSize({ width: 1366, height: 768 });
    await openStudio(page);

    const group = page.getByRole("radiogroup", { name: /zoom/i });
    await expect(group).toBeVisible();

    const fit = page.getByRole("radio", { name: "Fit" });
    const half = page.getByRole("radio", { name: "50%" });
    const full = page.getByRole("radio", { name: "100%" });
    await expect(fit).toHaveAttribute("aria-checked", "true");

    // Arrow keys move selection within the group (roving tabindex).
    await fit.focus();
    await page.keyboard.press("ArrowRight");
    await expect(half).toHaveAttribute("aria-checked", "true");
    await expect(half).toBeFocused();

    await page.keyboard.press("ArrowRight");
    await expect(full).toHaveAttribute("aria-checked", "true");
    const fullScale = await measuredScale(page);
    expect(fullScale).toBeGreaterThan(0.99);

    // 100% on this fixture overflows, so the stage must scroll.
    const scrollable = await page
      .getByTestId("studio-preview-viewport")
      .evaluate((node) => node.scrollHeight > node.clientHeight + 1);
    expect(scrollable).toBe(true);

    // Home returns to the first option.
    await page.keyboard.press("Home");
    await expect(fit).toHaveAttribute("aria-checked", "true");
  });

  test("format switcher and zoom control share a row without wrapping", async ({ page }) => {
    await signIn(page);
    for (const viewport of REQUIRED_VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openStudio(page);

      const sizeSwitcher = page.getByLabel("Size and format");
      const zoomGroup = page.getByRole("radiogroup", { name: /zoom/i });
      const a = await sizeSwitcher.boundingBox();
      const b = await zoomGroup.boundingBox();
      if (!a || !b) throw new Error("toolbar controls not measurable");

      // Same row: vertical centres within a few pixels of each other.
      const centreA = a.y + a.height / 2;
      const centreB = b.y + b.height / 2;
      expect(
        Math.abs(centreA - centreB),
        `toolbar wrapped at ${viewport.label}`,
      ).toBeLessThan(24);
    }
  });
});
