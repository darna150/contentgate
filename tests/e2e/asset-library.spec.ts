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
  await page.getByRole("button", { name: /^Sign in$/ }).click();
  await page.waitForFunction(
    () => !window.location.pathname.startsWith("/login"),
    undefined,
    { timeout: 45_000 }
  );
}

async function assertNoBrokenImages(page: Page) {
  const brokenImages = await page.locator("img").evaluateAll((images) =>
    images
      .map((image) => {
        const img = image as HTMLImageElement;
        return {
          src: img.currentSrc || img.src,
          alt: img.alt,
          complete: img.complete,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
          visible:
            img.getClientRects().length > 0 &&
            window.getComputedStyle(img).visibility !== "hidden",
        };
      })
      .filter(
        (img) =>
          img.visible &&
          (!img.complete || img.naturalWidth === 0 || img.naturalHeight === 0)
      )
  );

  expect(
    brokenImages,
    `Asset Library has broken visible images: ${JSON.stringify(brokenImages, null, 2)}`
  ).toEqual([]);
}

async function attachBrowserIssues(testInfo: TestInfo, issues: BrowserIssue[]) {
  await testInfo.attach("browser-issues.json", {
    contentType: "application/json",
    body: Buffer.from(JSON.stringify(issues, null, 2)),
  });
}

test.describe("Asset Library live QA", () => {
  test("loads assets without broken previews and validates raw asset downloads when available", async ({
    page,
    request,
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

    await signIn(page);
    await page.goto("/assets");
    await expect(page.getByRole("heading", { name: /Asset Library/i })).toBeVisible({
      timeout: 30_000,
    });
    await assertNoBrokenImages(page);

    const previewButtons = page.getByRole("button", { name: /^Preview /i });
    const previewCount = await previewButtons.count();

    if (previewCount === 0) {
      await expect(page.getByText(/No assets/i)).toBeVisible();
    } else {
      await previewButtons.first().click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await assertNoBrokenImages(page);

      const downloadLink = page.getByRole("link", { name: /Download asset/i });
      if (await downloadLink.isVisible().catch(() => false)) {
        const href = await downloadLink.getAttribute("href");
        expect(href, "Download asset link is missing href.").toEqual(expect.any(String));

        const url = new URL(href!, page.url()).toString();
        const response = await request.get(url);
        const body = await response.body();

        await testInfo.attach("asset-download-result.json", {
          contentType: "application/json",
          body: Buffer.from(
            JSON.stringify(
              {
                status: response.status(),
                contentType: response.headers()["content-type"],
                bytes: body.byteLength,
              },
              null,
              2
            )
          ),
        });

        expect(response.ok(), `Asset download failed: ${response.status()} ${url}`).toBeTruthy();
        expect(body.byteLength).toBeGreaterThan(100);
      } else {
        await expect(
          page.getByText(/Raw download is available after this asset is approved/i)
        ).toBeVisible();
      }
    }

    await testInfo.attach("asset-library.png", {
      contentType: "image/png",
      body: await page.screenshot({ fullPage: true }),
    });
    await attachBrowserIssues(testInfo, issues);

    expect(
      issues.filter((issue) => issue.kind !== "console" && !isBenignBrowserIssue(issue)),
      `Browser/network issues: ${JSON.stringify(issues, null, 2)}`
    ).toEqual([]);
  });
});
