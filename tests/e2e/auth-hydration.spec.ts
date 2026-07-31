import { expect, test } from "@playwright/test";

test("the server-rendered login cannot submit before hydration", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    const submit = page.getByRole("button", { name: "Loading sign-in…" });
    await expect(submit).toBeVisible();
    await expect(submit).toBeDisabled();
  } finally {
    await context.close();
  }
});
