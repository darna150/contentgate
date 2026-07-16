import { expect, test, type Page, type TestInfo } from "@playwright/test";

const E2E_EMAIL = process.env.CONTENTGATE_E2E_EMAIL;
const E2E_PASSWORD = process.env.CONTENTGATE_E2E_PASSWORD;
const BASE_URL = process.env.CONTENTGATE_E2E_BASE_URL ?? "";
const CONTENTGATE_PRODUCT_ID = "20000000-0000-0000-0000-000000000001";

type BrowserIssue = {
  kind: "console" | "pageerror" | "requestfailed" | "http";
  message: string;
};

type Surface = {
  name: string;
  path: string;
  expectedText: RegExp | string;
};

const SURFACES: Surface[] = [
  { name: "Dashboard", path: "/dashboard", expectedText: /Dashboard/i },
  { name: "Products", path: "/products", expectedText: /Products/i },
  {
    name: "Product overview",
    path: `/products/${CONTENTGATE_PRODUCT_ID}`,
    expectedText: /ContentGate/i,
  },
  {
    name: "Product templates",
    path: `/products/${CONTENTGATE_PRODUCT_ID}?view=templates`,
    expectedText: /ContentGate Local Friendly/i,
  },
  {
    name: "Product content",
    path: `/products/${CONTENTGATE_PRODUCT_ID}?view=content`,
    expectedText: /Every piece generated|Generated content|Content/i,
  },
  {
    name: "Product approvals",
    path: `/products/${CONTENTGATE_PRODUCT_ID}?view=approvals`,
    expectedText: /Approval|Open Approval Queue|The queue is clear/i,
  },
  {
    name: "Product knowledge",
    path: `/products/${CONTENTGATE_PRODUCT_ID}?view=knowledge`,
    expectedText: /Source documents|Approved claims|Knowledge/i,
  },
  {
    name: "Product assets",
    path: `/products/${CONTENTGATE_PRODUCT_ID}?view=assets`,
    expectedText: /Asset Library|Assets|No assets/i,
  },
  { name: "Content library", path: "/content", expectedText: /Content/i },
  { name: "Approvals", path: "/approvals", expectedText: /Approval Queue/i },
  { name: "Asset Library", path: "/assets", expectedText: /Asset Library/i },
  { name: "Ask / Knowledge Hub", path: "/ask", expectedText: /Knowledge Hub/i },
  { name: "Source Documents", path: "/knowledge", expectedText: /Source documents/i },
  { name: "Template Ops", path: "/templates", expectedText: /Template Ops/i },
];

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
  await page.getByRole("button", { name: /^Sign in$/ }).click();
  await page.waitForFunction(
    () => !window.location.pathname.startsWith("/login"),
    undefined,
    { timeout: 45_000 }
  );
}

async function assertNoBrokenImages(page: Page, surfaceName: string) {
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
    `${surfaceName} has broken visible images: ${JSON.stringify(brokenImages, null, 2)}`
  ).toEqual([]);
}

async function attachIssues(testInfo: TestInfo, issues: BrowserIssue[]) {
  await testInfo.attach("browser-issues.json", {
    contentType: "application/json",
    body: Buffer.from(JSON.stringify(issues, null, 2)),
  });
}

test.describe("ContentGate full app surface QA", () => {
  test("loads every major feature surface without broken images or app crashes", async ({
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

    await signIn(page);

    for (const surface of SURFACES) {
      await page.goto(surface.path);
      await expect(page.getByText(surface.expectedText).first(), surface.name).toBeVisible({
        timeout: 30_000,
      });
      await assertNoBrokenImages(page, surface.name);
      await testInfo.attach(
        `surface-${surface.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`,
        {
          contentType: "image/png",
          body: await page.screenshot({ fullPage: true }),
        }
      );
    }

    await attachIssues(testInfo, issues);
    expect(
      issues.filter((issue) => issue.kind !== "console" && !isBenignBrowserIssue(issue)),
      `Browser/network issues: ${JSON.stringify(issues, null, 2)}`
    ).toEqual([]);
  });

  test("health endpoint reports ok", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.ok()).toBeTruthy();
    await expect(await response.json()).toEqual(expect.objectContaining({ status: "ok" }));
  });
});
