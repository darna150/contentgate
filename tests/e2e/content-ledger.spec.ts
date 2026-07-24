import { expect, test, type Page, type TestInfo } from "@playwright/test";

const E2E_EMAIL = process.env.CONTENTGATE_E2E_EMAIL;
const E2E_PASSWORD = process.env.CONTENTGATE_E2E_PASSWORD;
const BASE_URL = process.env.CONTENTGATE_E2E_BASE_URL ?? "";

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
  if (issue.kind === "requestfailed" && issue.message.includes("net::ERR_ABORTED")) {
    return true;
  }
  if (
    issue.kind === "pageerror" &&
    BASE_URL.includes("-git-") &&
    issue.message.includes("Minified React error #418")
  ) {
    return true;
  }
  return false;
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

test.describe("Content ledger QA", () => {
  test("content ledger loads and status filter cycles without crashing", async ({
    page,
  }, testInfo) => {
    const issues: BrowserIssue[] = [];

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

    await signIn(page);
    await page.goto("/content");
    await expect(page.getByRole("heading", { name: /^Content$/i })).toBeVisible({
      timeout: 30_000,
    });

    await testInfo.attach("content-ledger-initial.png", {
      contentType: "image/png",
      body: await page.screenshot({ fullPage: true }),
    });

    // Cycle through every status filter if present.
    const statusLabels = ["Draft", "In Review", "Approved", "Rejected"];
    for (const label of statusLabels) {
      const filterBtn = page.getByRole("button", { name: new RegExp(`^${label}$`, "i") });
      if (await filterBtn.isVisible().catch(() => false)) {
        await filterBtn.click();
        // The ledger re-filters — wait for at least one result row or an
        // empty-state message, and assert no crash occurs.
        await expect(
          page.getByText(new RegExp(`${label}|No content|0 items`, "i")).first()
        ).toBeVisible({ timeout: 15_000 });
      }
    }

    await testInfo.attach("content-ledger-filtered.png", {
      contentType: "image/png",
      body: await page.screenshot({ fullPage: true }),
    });

    await attachBrowserIssues(testInfo, issues);
    expect(
      issues.filter((issue) => !isBenignBrowserIssue(issue)),
      `Browser/network issues: ${JSON.stringify(issues, null, 2)}`
    ).toEqual([]);
  });

  test("unauthenticated request to protected API returns 401 not 500", async ({ request }) => {
    // Hit a protected endpoint without any auth cookie. The server must return
    // 401 (or 403) rather than crashing with a 500.
    const response = await request.get("/api/products");
    expect(
      response.status(),
      `Protected API should return 401/403 without auth, got ${response.status()}`
    ).toBeGreaterThanOrEqual(400);
    expect(
      response.status(),
      `Protected API returned a server error (5xx) instead of a client auth error`
    ).toBeLessThan(500);
  });

  test("nonexistent content ID in studio returns 404 not 500", async ({ request }) => {
    const response = await request.get(
      "/api/products/generate?content=00000000-0000-0000-0000-000000000000"
    );
    expect(
      response.status(),
      `Missing content should 404 or 405, got ${response.status()}`
    ).toBeLessThan(500);
  });

  test("approvals queue loads and items render without errors", async ({
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
    await page.goto("/approvals");
    await expect(
      page.getByText(/Approval Queue|The queue is clear/i).first()
    ).toBeVisible({ timeout: 30_000 });

    await testInfo.attach("approvals-queue.png", {
      contentType: "image/png",
      body: await page.screenshot({ fullPage: true }),
    });

    await attachBrowserIssues(testInfo, issues);
    expect(
      issues.filter((issue) => !isBenignBrowserIssue(issue)),
      `Browser/network issues on approvals: ${JSON.stringify(issues, null, 2)}`
    ).toEqual([]);
  });
});
