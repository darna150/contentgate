import { expect, test, type Page, type TestInfo } from "@playwright/test";

const E2E_EMAIL = process.env.CONTENTGATE_E2E_EMAIL;
const E2E_PASSWORD = process.env.CONTENTGATE_E2E_PASSWORD;

type BrowserIssue = {
  kind: "console" | "pageerror" | "requestfailed" | "http";
  message: string;
};

function requireCredentials() {
  if (!E2E_EMAIL || !E2E_PASSWORD) {
    throw new Error(
      [
        "Missing live QA credentials.",
        "Run with CONTENTGATE_E2E_EMAIL and CONTENTGATE_E2E_PASSWORD.",
      ].join("\n")
    );
  }
}

function isBenignBrowserIssue(issue: BrowserIssue) {
  return issue.kind === "requestfailed" && issue.message.includes("net::ERR_ABORTED");
}

async function signIn(page: Page) {
  requireCredentials();
  await page.goto("/login");
  await page.getByLabel("Work email").fill(E2E_EMAIL!);
  await page.getByLabel("Password").fill(E2E_PASSWORD!);
  await page.getByRole("button", { name: /^(Sign in|Enter workspace)$/ }).click();
  await page.waitForFunction(
    () => !window.location.pathname.startsWith("/login"),
    undefined,
    { timeout: 45_000 }
  );
}

async function attachBrowserIssues(testInfo: TestInfo, issues: BrowserIssue[]) {
  await testInfo.attach("browser-issues.json", {
    contentType: "application/json",
    body: Buffer.from(JSON.stringify(issues, null, 2)),
  });
}

test.describe("Knowledge Hub live QA", () => {
  test("mobile Ask composer is not clipped and answers with approved sources", async ({
    page,
  }, testInfo) => {
    const issues: BrowserIssue[] = [];

    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) {
        issues.push({
          kind: "console",
          message: `${message.type()}: ${message.text()}`,
        });
      }
    });
    page.on("pageerror", (error) => {
      issues.push({ kind: "pageerror", message: error.message });
    });
    page.on("requestfailed", (request) => {
      issues.push({
        kind: "requestfailed",
        message: `${request.method()} ${request.url()} — ${
          request.failure()?.errorText ?? "unknown"
        }`,
      });
    });
    page.on("response", (response) => {
      const status = response.status();
      if (status >= 500) {
        issues.push({
          kind: "http",
          message: `${status} ${response.request().method()} ${response.url()}`,
        });
      }
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page);
    await page.goto("/ask");

    const input = page.getByPlaceholder(/Ask a question/i);
    await expect(input).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: /^Ask$/ })).toBeVisible();

    const inputBox = await input.evaluate((node) => {
      const textarea = node as HTMLTextAreaElement;
      const rect = textarea.getBoundingClientRect();
      const styles = window.getComputedStyle(textarea);
      return {
        height: rect.height,
        scrollHeight: textarea.scrollHeight,
        overflowY: styles.overflowY,
        placeholder: textarea.placeholder,
      };
    });

    await testInfo.attach("mobile-ask-input-box.json", {
      contentType: "application/json",
      body: Buffer.from(JSON.stringify(inputBox, null, 2)),
    });

    expect(
      inputBox.height,
      `Ask textarea is too short for its wrapped mobile placeholder: ${JSON.stringify(inputBox)}`
    ).toBeGreaterThanOrEqual(60);
    expect(
      inputBox.overflowY,
      `Ask textarea clips wrapped placeholder/text: ${JSON.stringify(inputBox)}`
    ).not.toBe("hidden");

    await input.fill("What is Nimbus 1?");
    await page.getByRole("button", { name: /^Ask$/ }).click();

    await expect(page.getByText(/From approved sources/i).first()).toBeVisible({
      timeout: 60_000,
    });
    await expect(
      page
        .locator("main")
        .getByText(/Run on Air|cloud-soft cushioning|real-world speed/i)
        .first()
    ).toBeVisible();
    await expect(page.getByText(/Something went wrong/i)).toHaveCount(0);

    await testInfo.attach("knowledge-hub-answer.png", {
      contentType: "image/png",
      body: await page.screenshot({ fullPage: true }),
    });
    await attachBrowserIssues(testInfo, issues);

    expect(
      issues.filter((issue) => issue.kind !== "console" && !isBenignBrowserIssue(issue)),
      `Browser/network issues: ${JSON.stringify(issues, null, 2)}`
    ).toEqual([]);
  });

  test("no-evidence path returns a safe message without crashing", async ({
    page,
  }, testInfo) => {
    const issues: BrowserIssue[] = [];

    page.on("pageerror", (error) => {
      issues.push({ kind: "pageerror", message: error.message });
    });
    page.on("response", (response) => {
      if (response.status() >= 500) {
        issues.push({
          kind: "http",
          message: `${response.status()} ${response.request().method()} ${response.url()}`,
        });
      }
    });

    await signIn(page);
    await page.goto("/ask");

    const input = page.getByPlaceholder(/Ask a question/i);
    await expect(input).toBeVisible({ timeout: 30_000 });

    // Question that should not match any approved source paragraph
    await input.fill(
      "What is the molecular weight of polyethylene glycol 3350 in milligrams per litre?"
    );
    await page.getByRole("button", { name: /^Ask$/ }).click();

    // Must get a safe "not found" message — not a 500 or an error boundary
    await expect(
      page.getByText(/could not verify|no matching|not found/i).first()
    ).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(/Something went wrong/i)).toHaveCount(0);

    await testInfo.attach("knowledge-hub-no-evidence.png", {
      contentType: "image/png",
      body: await page.screenshot({ fullPage: true }),
    });

    expect(
      issues,
      `Errors on no-evidence path: ${JSON.stringify(issues, null, 2)}`
    ).toEqual([]);
  });
});
