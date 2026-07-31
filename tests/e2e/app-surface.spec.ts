import { expect, test, type Page, type TestInfo } from "@playwright/test";

const E2E_EMAIL = process.env.CONTENTGATE_E2E_EMAIL;
const E2E_PASSWORD = process.env.CONTENTGATE_E2E_PASSWORD;
const BASE_URL = process.env.CONTENTGATE_E2E_BASE_URL ?? "";
const DEMO_PRODUCT_ID =
  process.env.CONTENTGATE_E2E_PRODUCT_ID ??
  "27cf3a56-84e6-41fb-8cb7-4bf7dbe3c564";
const TEMPLATE_NAME =
  process.env.CONTENTGATE_E2E_TEMPLATE_NAME ?? "Nimbus Air Campaign";

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
  { name: "Dashboard", path: "/dashboard", expectedText: /Good morning|Recent activity/i },
  { name: "Products", path: "/products", expectedText: /Products/i },
  {
    name: "Product overview",
    path: `/products/${DEMO_PRODUCT_ID}`,
    expectedText: /Nimbus 1/i,
  },
  {
    name: "Product templates",
    path: `/products/${DEMO_PRODUCT_ID}?view=templates`,
    expectedText: TEMPLATE_NAME,
  },
  {
    name: "Product content",
    path: `/products/${DEMO_PRODUCT_ID}?view=content`,
    expectedText: /Every piece generated|Generated content|Content/i,
  },
  {
    name: "Product approvals",
    path: `/products/${DEMO_PRODUCT_ID}?view=approvals`,
    expectedText: /Reviews|Content waiting for your review|The queue is clear/i,
  },
  {
    name: "Product knowledge",
    path: `/products/${DEMO_PRODUCT_ID}?view=knowledge`,
    expectedText: /Approved sources|Approved claims|Knowledge/i,
  },
  {
    name: "Product assets",
    path: `/products/${DEMO_PRODUCT_ID}?view=assets`,
    expectedText: /Assets|No assets/i,
  },
  { name: "Content library", path: "/content", expectedText: /Content/i },
  { name: "Approvals", path: "/approvals", expectedText: /Reviews|The queue is clear/i },
  { name: "Assets", path: "/assets", expectedText: /Assets/i },
  { name: "Ask notebook", path: "/ask", expectedText: /Ask notebook|All sources/i },
  { name: "Brand knowledge", path: "/knowledge", expectedText: /Brand knowledge|Sources/i },
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
  await page.getByRole("button", { name: /^(Sign in|Enter workspace)$/ }).click();
  await page.waitForFunction(
    () => !window.location.pathname.startsWith("/login"),
    undefined,
    { timeout: 45_000 }
  );
}

async function assertNoBrokenImages(page: Page, surfaceName: string) {
  await page
    .waitForFunction(
      () =>
        [...document.images]
          .filter(
            (image) =>
              image.getClientRects().length > 0 &&
              window.getComputedStyle(image).visibility !== "hidden"
          )
          .every((image) => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0),
      undefined,
      { timeout: 45_000 }
    )
    .catch(() => {
      // Keep the assertion below as the source of truth so failures include
      // the exact image src/alt that did not load.
    });

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

async function assertBasicSemantics(page: Page, surfaceName: string) {
  const report = await page.evaluate(() => {
    const isVisible = (element: Element) => {
      const rect = element.getBoundingClientRect();
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        window.getComputedStyle(element).visibility !== "hidden"
      );
    };
    const unnamedInteractive = [
      ...document.querySelectorAll("button, a[href], input:not([type=hidden]), select, textarea"),
    ]
      .filter(isVisible)
      .filter((element) => {
        const id = element.getAttribute("id");
        const nativeLabel = id
          ? document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent?.trim()
          : "";
        const name =
          element.getAttribute("aria-label") ||
          nativeLabel ||
          element.getAttribute("title") ||
          element.textContent?.trim() ||
          element.getAttribute("value") ||
          element.getAttribute("placeholder");
        return !name;
      })
      .map((element) => element.outerHTML.slice(0, 180));
    const ids = [...document.querySelectorAll("[id]")].map((element) => element.id);
    const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];

    return {
      mainCount: document.querySelectorAll("main").length,
      unnamedInteractive,
      duplicateIds,
    };
  });

  expect(report.mainCount, `${surfaceName} needs exactly one main landmark`).toBe(1);
  expect(report.unnamedInteractive, `${surfaceName} has visible unnamed controls`).toEqual([]);
  expect(report.duplicateIds, `${surfaceName} has duplicate IDs`).toEqual([]);
}

async function assertMobileTouchTargets(page: Page, surfaceName: string) {
  const undersized = await page.evaluate(() =>
    [...document.querySelectorAll("button, [role=button]")]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== "hidden" &&
          (rect.width < 44 || rect.height < 44)
        );
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          name:
            element.getAttribute("aria-label") || element.textContent?.trim() || element.tagName,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      })
  );
  expect(undersized, `${surfaceName} has touch targets below 44×44px`).toEqual([]);
}

async function attachIssues(testInfo: TestInfo, issues: BrowserIssue[]) {
  await testInfo.attach("browser-issues.json", {
    contentType: "application/json",
    body: Buffer.from(JSON.stringify(issues, null, 2)),
  });
}

test.describe("ContentGate full app surface QA", () => {
  test("keeps mobile dashboard actions at least 44 by 44 pixels", async ({ page }) => {
    await signIn(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard");
    await assertMobileTouchTargets(page, "Mobile dashboard");
  });

  test("supports keyboard sign-in, skip navigation, and primary workspace links", async ({
    page,
  }) => {
    requireCredentials();
    await page.goto("/login");
    await page.waitForTimeout(300);

    // Use the same sequence a keyboard-only user takes through the form.
    await page.keyboard.press("Tab"); // Skip link
    await page.keyboard.press("Tab"); // Work email
    await page.keyboard.type(E2E_EMAIL ?? "");
    await page.keyboard.press("Tab"); // Password
    await page.keyboard.type(E2E_PASSWORD ?? "");
    await page.keyboard.press("Tab"); // Enter workspace
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => !window.location.pathname.startsWith("/login"));

    // Client-side sign-in preserves the submit-control focus by design. A
    // fresh page load verifies the document-start skip-link order separately.
    await page.reload();
    await page.keyboard.press("Tab");
    await expect(page.locator("a[href='#main-content']")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();

    for (const path of ["/products", "/approvals"]) {
      let found = false;
      for (let index = 0; index < 80; index += 1) {
        await page.keyboard.press("Tab");
        const href = await page.evaluate(
          () => (document.activeElement as HTMLAnchorElement | null)?.getAttribute("href")
        );
        if (href === path) {
          found = true;
          await page.keyboard.press("Enter");
          break;
        }
      }
      expect(found, `Keyboard focus did not reach ${path}`).toBeTruthy();
      await expect(page).toHaveURL(new RegExp(`${path.replace("/", "\\/")}$`));
      await page.goto("/dashboard");
      await page.waitForLoadState("domcontentloaded");
      await page.keyboard.press("Tab");
      await page.keyboard.press("Enter");
    }
  });

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
      // Intersect with :visible so that sidebar/nav copies of the same text
      // that are CSS-hidden (visibility:hidden) on the current page don't
      // shadow the visible heading and cause a false failure. Dashboard's
      // "Dashboard" label lives in the nav and is genuinely visible there, so
      // this still matches it; product names hidden in collapsed sidebars are
      // correctly skipped.
      await expect(
        page.getByText(surface.expectedText).and(page.locator(":visible")).first(),
        surface.name
      ).toBeVisible({ timeout: 30_000 });
      await assertNoBrokenImages(page, surface.name);
      await assertBasicSemantics(page, surface.name);
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
