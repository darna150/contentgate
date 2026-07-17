import { expect, test, type Page, type TestInfo } from "@playwright/test";

const E2E_EMAIL = process.env.CONTENTGATE_E2E_EMAIL;
const E2E_PASSWORD = process.env.CONTENTGATE_E2E_PASSWORD;
const TEMPLATE_NAME = "ContentGate Local Friendly";
const PLATFORM_ASSIGNMENT_ID =
  process.env.CONTENTGATE_E2E_ASSIGNMENT_ID ??
  "3a6cbcb0-23b4-476b-8deb-ad2e48d20516";
const OUTPUT_SIZE = "leaderboard";
const OUTPUT_SIZE_LABEL = "Leaderboard";
const LIVE_EDIT_TEXT = `QA Live ${Date.now().toString().slice(-5)}`;
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
        "Example:",
        'CONTENTGATE_E2E_BASE_URL="https://contentgate-delta.vercel.app" CONTENTGATE_E2E_EMAIL="you@example.com" CONTENTGATE_E2E_PASSWORD="..." npm run test:e2e -- --headed',
      ].join("\n")
    );
  }
}

async function attachBrowserIssues(testInfo: TestInfo, issues: BrowserIssue[]) {
  await testInfo.attach("browser-issues.json", {
    contentType: "application/json",
    body: Buffer.from(JSON.stringify(issues, null, 2)),
  });
}

function isBenignBrowserIssue(issue: BrowserIssue) {
  // Next/Vercel commonly aborts RSC prefetches and speculative HEAD/OPTIONS
  // probes during navigation. Those are useful to record but should not fail
  // the content generation story.
  if (issue.kind === "requestfailed" && issue.message.includes("net::ERR_ABORTED")) {
    return true;
  }

  // Vercel branch previews can inject preview-toolbar scripts that emit a
  // minified hydration warning even when the same build passes local dev E2E.
  // Keep production/local strict; only tolerate this on ephemeral git previews.
  if (
    issue.kind === "pageerror" &&
    BASE_URL.includes("-git-") &&
    issue.message.includes("Minified React error #418")
  ) {
    return true;
  }

  return false;
}

async function attachScreenshot(page: Page, testInfo: TestInfo, name: string) {
  await testInfo.attach(`${name}.png`, {
    contentType: "image/png",
    body: await page.screenshot({ fullPage: true }),
  });
}

async function signIn(page: Page) {
  requireCredentials();

  await page.goto("/login");
  await page.getByLabel("Work email").fill(E2E_EMAIL!);
  await page.getByLabel("Password").fill(E2E_PASSWORD!);
  await page.getByRole("button", { name: /^Sign in$/ }).click();
  await page.waitForFunction(
    () => !window.location.pathname.startsWith("/login"),
    undefined,
    { timeout: 45_000 }
  );
  await expect(page).not.toHaveURL(/\/login/);
}

async function openContentGateTemplate(page: Page) {
  await page.goto("/products");
  await expect(page).toHaveURL(/\/products/);
  await expect(page.getByRole("heading", { name: /Products/i })).toBeVisible();

  const productLink = page
    .getByRole("link", { name: /ContentGate/i })
    .first();
  await expect(productLink).toBeVisible();
  await productLink.click();
  await page.waitForURL(/\/products\//);

  const templatesLink = page.getByRole("link", { name: /Templates/i });
  if (await templatesLink.isVisible()) {
    await templatesLink.click();
  } else {
    await page.goto(`${page.url().split("?")[0]}?view=templates`);
  }

  await expect(page.getByText(TEMPLATE_NAME)).toBeVisible();
}

async function generateLeaderboardDraft(page: Page) {
  let result: {
    ok: boolean;
    status: number;
    text: string;
    json: Record<string, unknown>;
  } | null = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    result = await page.evaluate(
      async ({ platformAssignmentId, outputSize }) => {
        const response = await fetch("/api/products/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            platformAssignmentId,
            language: "English",
            outputSize,
          }),
        });
        const text = await response.text();
        let json: Record<string, unknown> = {};
        try {
          json = JSON.parse(text) as Record<string, unknown>;
        } catch {
          // Keep the raw text for diagnostics below.
        }
        return {
          ok: response.ok,
          status: response.status,
          text,
          json,
        };
      },
      {
        platformAssignmentId: PLATFORM_ASSIGNMENT_ID,
        outputSize: OUTPUT_SIZE,
      }
    );

    if (result.ok || ![429, 502, 503, 504].includes(result.status)) break;
    await page.waitForTimeout(2_000 * attempt);
  }

  expect(
    result?.ok,
    `Generation failed with ${result?.status}: ${result?.text}`
  ).toBeTruthy();

  expect(result?.json.contentId, "Generation did not return contentId.").toEqual(
    expect.any(String)
  );

  await page.goto(
    `/studio/${result?.json.contentId as string}?size=${
      (result?.json.outputSize as string | undefined) ?? OUTPUT_SIZE
    }`
  );
  await expect(page.getByText(new RegExp(`DRAFT\\s*·\\s*${OUTPUT_SIZE_LABEL}`, "i"))).toBeVisible({
    timeout: 60_000,
  });

  return result?.json.contentId as string;
}

async function getPreviewMetrics(page: Page) {
  const livePreview = page.locator("[data-template-platform-bundle]").first();
  if (await livePreview.isVisible().catch(() => false)) {
    return livePreview.evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return {
        mode: "live" as const,
        text: (node.textContent ?? "").trim(),
        displayedWidth: rect.width,
        displayedHeight: rect.height,
      };
    });
  }

  const preview = page.getByAltText("Generated template preview");
  await expect(preview).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("Preview unavailable")).toHaveCount(0);

  return preview.evaluate((node) => {
    const image = node as HTMLImageElement;
    const rect = image.getBoundingClientRect();
    return {
      mode: "image" as const,
      src: image.currentSrc || image.src,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      displayedWidth: rect.width,
      displayedHeight: rect.height,
      complete: image.complete,
    };
  });
}

async function assertPreviewIsAvailable(page: Page) {
  await expect(page.getByText("Preview unavailable")).toHaveCount(0);
  await expect(page.getByAltText("Generated template preview")).toHaveCount(0);
  await expect(page.locator("[data-template-platform-bundle]").first()).toBeVisible({
    timeout: 60_000,
  });
}

async function findEditableTextArea(page: Page) {
  const textareas = page.locator("textarea");
  const count = await textareas.count();
  for (let index = 0; index < count; index += 1) {
    const textarea = textareas.nth(index);
    const value = await textarea.inputValue();
    if (/local|content|brand|get started|see how|approved/i.test(value)) {
      return textarea;
    }
  }
  throw new Error("Could not find a populated editable text field in Studio.");
}

test.describe("ContentGate live generation QA", () => {
  test.describe.configure({ mode: "serial" });

  test("generates a sharp draft preview and updates it after text edits", async ({
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
      const url = response.url();
      if (status >= 400 && !url.includes("/_next/image")) {
        issues.push({
          kind: "http",
          message: `${status} ${response.request().method()} ${url}`,
        });
      }
    });

    await signIn(page);
    await openContentGateTemplate(page);
    await attachScreenshot(page, testInfo, "01-template-picker");

    await generateLeaderboardDraft(page);
    await attachScreenshot(page, testInfo, "02-generated-studio");
    await assertPreviewIsAvailable(page);

    const initialMetrics = await getPreviewMetrics(page);
    await testInfo.attach("initial-preview-metrics.json", {
      contentType: "application/json",
      body: Buffer.from(JSON.stringify(initialMetrics, null, 2)),
    });

    if (initialMetrics.mode === "image") {
      expect(initialMetrics.complete, "Preview image did not finish loading.").toBeTruthy();
      expect(initialMetrics.naturalWidth, "Preview image has no intrinsic width.").toBeGreaterThanOrEqual(728);
      expect(initialMetrics.naturalHeight, "Preview image has no intrinsic height.").toBeGreaterThanOrEqual(90);
      expect(
        initialMetrics.displayedWidth,
        `Preview is being upscaled, which makes it blurry. ${JSON.stringify(initialMetrics)}`
      ).toBeLessThanOrEqual(initialMetrics.naturalWidth + 1);
      expect(
        initialMetrics.displayedHeight,
        `Preview is being upscaled, which makes it blurry. ${JSON.stringify(initialMetrics)}`
      ).toBeLessThanOrEqual(initialMetrics.naturalHeight + 1);
    } else {
      expect(initialMetrics.text, "Live preview rendered no editable text.").not.toEqual("");
    }

    await page.getByRole("button", { name: /Square\s+1080×1080/i }).click();
    await expect(page.getByText(/No draft for Square yet/i)).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.getByRole("button", { name: /Generate Square draft/i }).first()
    ).toBeVisible();
    await expect(page.getByText("Preview unavailable")).toHaveCount(0);
    await attachScreenshot(page, testInfo, "03-missing-size-draft");

    await page.getByRole("button", { name: /Leaderboard\s+728×90/i }).click();
    await expect(page.getByText(new RegExp(`DRAFT\\s*·\\s*${OUTPUT_SIZE_LABEL}`, "i"))).toBeVisible({
      timeout: 20_000,
    });
    await assertPreviewIsAvailable(page);

    const editableField = await findEditableTextArea(page);
    const oldValue = await editableField.inputValue();
    await editableField.fill(LIVE_EDIT_TEXT);
    await expect(editableField).toHaveValue(LIVE_EDIT_TEXT);

    if (initialMetrics.mode === "live") {
      await expect(
        page.locator("[data-template-field]").filter({ hasText: LIVE_EDIT_TEXT }).first(),
        `Live preview did not show edited text after changing "${oldValue}" to "${LIVE_EDIT_TEXT}".`
      ).toBeVisible({ timeout: 2_000 });
    } else {
      await expect
        .poll(
          async () => {
            const metrics = await getPreviewMetrics(page);
            return metrics.mode === "image" ? metrics.src : metrics.text;
          },
          {
            timeout: 20_000,
            message: `Preview did not update after editing "${oldValue}" to "${LIVE_EDIT_TEXT}".`,
          }
        )
        .not.toBe(initialMetrics.src);
    }

    await attachScreenshot(page, testInfo, "04-after-live-edit");
    await attachBrowserIssues(testInfo, issues);

    expect(
      issues.filter((issue) => issue.kind !== "console" && !isBenignBrowserIssue(issue)),
      `Browser/network issues: ${JSON.stringify(issues, null, 2)}`
    ).toEqual([]);
  });

  test("submits, approves, and downloads the approved PNG export", async ({
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
      const url = response.url();
      if (status >= 500) {
        issues.push({
          kind: "http",
          message: `${status} ${response.request().method()} ${url}`,
        });
      }
    });

    await signIn(page);
    const contentId = await generateLeaderboardDraft(page);

    await page.getByRole("button", { name: /Submit for review/i }).click();
    await expect(page.getByText(new RegExp(`IN REVIEW\\s*·\\s*${OUTPUT_SIZE_LABEL}`, "i"))).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(/Awaiting your review/i)).toBeVisible();

    await page.getByRole("button", { name: /^Approve$/i }).click();
    await expect(page.getByText(new RegExp(`APPROVED\\s*·\\s*${OUTPUT_SIZE_LABEL}`, "i"))).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(/Approved snapshot/i)).toBeVisible();

    const exportResult = await page.evaluate(
      async ({ id, size }) => {
        const response = await fetch(
          `/api/creative/render?content=${encodeURIComponent(id)}&size=${encodeURIComponent(
            size
          )}&format=png&download=1`
        );
        if (!response.ok) {
          return {
            ok: false,
            status: response.status,
            contentType: response.headers.get("content-type"),
            disposition: response.headers.get("content-disposition"),
            text: await response.text(),
            bytes: 0,
          };
        }
        const body = await response.arrayBuffer();
        return {
          ok: true,
          status: response.status,
          contentType: response.headers.get("content-type"),
          disposition: response.headers.get("content-disposition"),
          text: "",
          bytes: body.byteLength,
        };
      },
      { id: contentId, size: OUTPUT_SIZE }
    );

    await testInfo.attach("approved-export-result.json", {
      contentType: "application/json",
      body: Buffer.from(JSON.stringify(exportResult, null, 2)),
    });

    expect(
      exportResult.ok,
      `Approved export failed with ${exportResult.status}: ${exportResult.text}`
    ).toBeTruthy();
    expect(exportResult.contentType).toMatch(/image\/png/i);
    expect(exportResult.disposition).toMatch(/attachment/i);
    expect(exportResult.bytes).toBeGreaterThan(10_000);

    await attachBrowserIssues(testInfo, issues);
    expect(
      issues.filter((issue) => issue.kind !== "console" && !isBenignBrowserIssue(issue)),
      `Browser/network issues: ${JSON.stringify(issues, null, 2)}`
    ).toEqual([]);
  });

  test("surfaces reviewer rejection notes immediately", async ({ page }, testInfo) => {
    const issues: BrowserIssue[] = [];
    const rejectionNote = `E2E rejection note ${Date.now().toString().slice(-6)}`;

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
      const url = response.url();
      if (status >= 500) {
        issues.push({
          kind: "http",
          message: `${status} ${response.request().method()} ${url}`,
        });
      }
    });

    await signIn(page);
    await generateLeaderboardDraft(page);

    await page.getByRole("button", { name: /Submit for review/i }).click();
    await expect(page.getByText(new RegExp(`IN REVIEW\\s*·\\s*${OUTPUT_SIZE_LABEL}`, "i"))).toBeVisible({
      timeout: 30_000,
    });

    await page.getByRole("button", { name: /^Reject$/i }).click();
    await page.getByPlaceholder(/What needs to change/i).fill(rejectionNote);
    await page.getByRole("button", { name: /Reject with note/i }).click();

    await expect(page.getByText(new RegExp(`REJECTED\\s*·\\s*${OUTPUT_SIZE_LABEL}`, "i"))).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText("Changes requested")).toBeVisible();
    await expect(page.getByText(rejectionNote)).toBeVisible();
    await attachScreenshot(page, testInfo, "rejection-note-visible");

    await attachBrowserIssues(testInfo, issues);
    expect(
      issues.filter((issue) => issue.kind !== "console" && !isBenignBrowserIssue(issue)),
      `Browser/network issues: ${JSON.stringify(issues, null, 2)}`
    ).toEqual([]);
  });
});
