import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { clientFixture, escapeRegExp, requireClientFixture } from "./client-fixture";

const E2E_EMAIL = process.env.CONTENTGATE_E2E_EMAIL;
const E2E_PASSWORD = process.env.CONTENTGATE_E2E_PASSWORD;
const BASE_URL = process.env.CONTENTGATE_E2E_BASE_URL ?? "";
const DEMO_PRODUCT_ID = clientFixture.productId;
const DEMO_CONTENT_ID = clientFixture.contentId;
const DEMO_DOCUMENT_ID = clientFixture.documentId;
const DEMO_ASSIGNMENT_ID = clientFixture.assignmentId;
const PRODUCT_NAME = new RegExp(escapeRegExp(clientFixture.productName), "i");
const TEMPLATE_NAME = new RegExp(escapeRegExp(clientFixture.templateName), "i");

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
    expectedText: PRODUCT_NAME,
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
    expectedText: /Source documents|Approved claims|Knowledge/i,
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
  { name: "Source Documents", path: "/knowledge", expectedText: /Brand knowledge|Sources/i },
  { name: "Template Ops", path: "/templates", expectedText: /Template Ops/i },
];

const ACCESSIBILITY_SURFACES: Surface[] = [
  { name: "Dashboard", path: "/dashboard", expectedText: /Good morning|Recent activity/i },
  { name: "Products", path: "/products", expectedText: /Products/i },
  { name: "Content library", path: "/content", expectedText: /Content/i },
  { name: "New product", path: "/products/new", expectedText: /New product/i },
  { name: "Approvals", path: "/approvals", expectedText: /Reviews|The queue is clear/i },
  { name: "Assets", path: "/assets", expectedText: /Assets/i },
  { name: "Ask notebook", path: "/ask", expectedText: /Ask notebook|All sources/i },
  {
    name: "Ask quality",
    path: "/ask/quality",
    expectedText: /Production evidence and reliability/i,
  },
  { name: "Source documents", path: "/knowledge", expectedText: /Brand knowledge|Sources/i },
  {
    name: "New source document",
    path: "/knowledge/new",
    expectedText: /Add brand knowledge source/i,
  },
  { name: "Template Ops", path: "/templates", expectedText: /Template Ops/i },
  { name: "Settings", path: "/settings", expectedText: /Workspace settings/i },
];

const FULL_FIXTURE_ACCESSIBILITY_SURFACES: Surface[] = [
  {
    name: "Product overview",
    path: `/products/${DEMO_PRODUCT_ID}`,
    expectedText: PRODUCT_NAME,
  },
  {
    name: "Product campaigns",
    path: `/products/${DEMO_PRODUCT_ID}?view=templates`,
    expectedText: TEMPLATE_NAME,
  },
  {
    name: "Product content",
    path: `/products/${DEMO_PRODUCT_ID}?view=content`,
    expectedText: /Every piece generated|Generated content|Content/i,
  },
  {
    name: "Product reviews",
    path: `/products/${DEMO_PRODUCT_ID}?view=approvals`,
    expectedText: /Review|Approval|The queue is clear/i,
  },
  {
    name: "Product knowledge",
    path: `/products/${DEMO_PRODUCT_ID}?view=knowledge`,
    expectedText: /Source documents|Approved claims|Knowledge/i,
  },
  {
    name: "Product assets",
    path: `/products/${DEMO_PRODUCT_ID}?view=assets`,
    expectedText: /Assets|No assets/i,
  },
  {
    name: "Edit product",
    path: `/products/${DEMO_PRODUCT_ID}/edit`,
    expectedText: /Edit product/i,
  },
  {
    name: "Content detail",
    path: `/content/${DEMO_CONTENT_ID}`,
    expectedText: /Content fields|Content|Review/i,
  },
  {
    name: "Knowledge detail",
    path: `/knowledge/${DEMO_DOCUMENT_ID}`,
    expectedText: /Source text/i,
  },
  {
    name: "New Studio",
    path: `/studio/new?product=${DEMO_PRODUCT_ID}&assignment=${DEMO_ASSIGNMENT_ID}`,
    expectedText: /Studio|Create|Message|Working preview|Original design/i,
  },
  {
    name: "Existing Studio content",
    path: `/studio/${DEMO_CONTENT_ID}`,
    expectedText: /Studio|Message|Working preview|Review/i,
  },
];

function requireLoginCredentials() {
  if (!E2E_EMAIL || !E2E_PASSWORD) {
    throw new Error(
      [
        "Missing live QA credentials.",
        "Run with CONTENTGATE_E2E_EMAIL and CONTENTGATE_E2E_PASSWORD.",
      ].join("\n")
    );
  }
}

function requireCredentials() {
  requireLoginCredentials();
  requireClientFixture(["productId", "productName", "templateName"]);
}

function requireFullAccessibilityFixture() {
  requireLoginCredentials();
  requireClientFixture([
    "productId",
    "productName",
    "assignmentId",
    "templateName",
    "contentId",
    "documentId",
  ]);
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

async function signIn(page: Page, fixtureRequired = true) {
  if (fixtureRequired) requireCredentials();
  else requireLoginCredentials();
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
  await expect(page.locator("main h1").first(), `${surfaceName} page heading`).toBeVisible();
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
      .filter(
        (element) =>
          element.getAttribute("aria-hidden") !== "true" &&
          !element.closest('[aria-hidden="true"]'),
      )
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
      mainContentCount: document.querySelectorAll("main#main-content").length,
      h1Count: [...document.querySelectorAll("h1")].filter(isVisible).length,
      unnamedInteractive,
      duplicateIds,
    };
  });

  expect(report.mainCount, `${surfaceName} needs exactly one main landmark`).toBe(1);
  expect(report.mainContentCount, `${surfaceName} needs a skip-link target on its main landmark`).toBe(1);
  expect(report.h1Count, `${surfaceName} needs exactly one visible page-level heading`).toBe(1);
  expect(report.unnamedInteractive, `${surfaceName} has visible unnamed controls`).toEqual([]);
  expect(report.duplicateIds, `${surfaceName} has duplicate IDs`).toEqual([]);
}

async function assertMobileTouchTargets(page: Page, surfaceName: string) {
  const undersized = await evaluateWithNavigationRetry(page, () =>
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

async function assertMobileReflow(page: Page, surfaceName: string) {
  const overflow = await evaluateWithNavigationRetry(page, () => ({
    viewportWidth: document.documentElement.clientWidth,
    pageWidth: document.documentElement.scrollWidth,
  }));
  expect(
    overflow.pageWidth,
    `${surfaceName} causes page-level horizontal scrolling at 320 CSS pixels`,
  ).toBeLessThanOrEqual(overflow.viewportWidth + 1);
}

async function evaluateWithNavigationRetry<T>(page: Page, evaluate: () => T) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await page.evaluate(evaluate);
    } catch (error) {
      const navigationRace =
        error instanceof Error &&
        (error.message.includes("Execution context was destroyed") ||
          error.message.includes("Cannot read properties of null"));
      if (
        attempt === 2 ||
        !navigationRace
      ) {
        throw error;
      }
      await page.waitForLoadState("domcontentloaded");
      await page.locator("html").waitFor({ state: "attached" });
    }
  }
  throw new Error("Could not evaluate the settled page state.");
}

async function attachIssues(testInfo: TestInfo, issues: BrowserIssue[]) {
  await testInfo.attach("browser-issues.json", {
    contentType: "application/json",
    body: Buffer.from(JSON.stringify(issues, null, 2)),
  });
}

async function assertNoAxeViolations(page: Page, surfaceName: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();

  const violations = results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    nodes: violation.nodes.map((node) => ({
      target: node.target,
      summary: node.failureSummary,
    })),
  }));

  expect(
    violations,
    `${surfaceName} has axe-core violations: ${JSON.stringify(violations, null, 2)}`,
  ).toEqual([]);
}

async function waitForVisualState(element: Locator) {
  await element.evaluate(async (node) => {
    await Promise.all(
      node
        .getAnimations({ subtree: true })
        .map((animation) => animation.finished.catch(() => undefined)),
    );
  });
}

test.describe("ContentGate full app surface QA", () => {
  // These scenarios are independent, read-only acceptance checks. Running
  // them across the deterministic lane's workers keeps the broad route and
  // axe matrix merge-blocking without serializing every authenticated page.
  test.describe.configure({ mode: "parallel" });

  test("keeps every public surface accessible", async ({ page }) => {
    for (const surface of [
      { name: "Sign in", path: "/login", expectedText: /Sign in/i },
      { name: "Forgot password", path: "/forgot-password", expectedText: /Reset your password/i },
      { name: "Reset password", path: "/reset-password", expectedText: /Choose a new password/i },
      { name: "Invitation welcome", path: "/welcome", expectedText: /Welcome aboard/i },
    ]) {
      await page.goto(surface.path);
      await expect(page.getByRole("heading", { level: 1, name: surface.expectedText })).toBeVisible();
      await assertNoAxeViolations(page, surface.name);
      await assertBasicSemantics(page, surface.name);
    }
  });

  test("meets the Phase 1 automated accessibility gate", async ({ page }) => {
    await signIn(page, false);

    for (const surface of ACCESSIBILITY_SURFACES) {
      await page.goto(surface.path);
      await expect(
        page.getByText(surface.expectedText).and(page.locator(":visible")).first(),
        surface.name,
      ).toBeVisible({ timeout: 30_000 });
      await assertNoAxeViolations(page, surface.name);
      await assertBasicSemantics(page, surface.name);
    }

    await page.goto("/products/new");
    await expect(page.getByLabel("Product name", { exact: false })).toBeVisible();
    await expect(page.getByLabel("Description", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Mandatory disclaimer", { exact: true })).toBeVisible();
  });

  test("keeps the platform onboarding surface accessible", async ({ page }) => {
    test.skip(
      process.env.CONTENTGATE_E2E_ONBOARDING_OPERATOR !== "true",
      "Requires an allowlisted disposable platform operator.",
    );
    await signIn(page, false);
    await page.goto("/onboarding");
    await expect(page.getByRole("heading", { name: "Create a client workspace" })).toBeVisible();
    await expect(page.getByLabel("Workspace package")).toBeVisible();
    await assertNoAxeViolations(page, "Client onboarding");
  });

  test("audits every data-backed route in the build", async ({ page }) => {
    requireFullAccessibilityFixture();
    await signIn(page, false);

    for (const surface of FULL_FIXTURE_ACCESSIBILITY_SURFACES) {
      await page.goto(surface.path);
      await expect(
        page.getByText(surface.expectedText).and(page.locator(":visible")).first(),
        surface.name,
      ).toBeVisible({ timeout: 45_000 });
      await assertNoAxeViolations(page, surface.name);
      await assertBasicSemantics(page, surface.name);

      await page.setViewportSize({ width: 320, height: 800 });
      await page.goto(surface.path);
      await assertMobileReflow(page, `${surface.name} mobile`);
      await assertMobileTouchTargets(page, `${surface.name} mobile`);
      await page.setViewportSize({ width: 1280, height: 720 });
    }

    await page.goto(`/products/${DEMO_PRODUCT_ID}/templates/${DEMO_ASSIGNMENT_ID}`);
    await expect(page).toHaveURL(new RegExp(`/products/${DEMO_PRODUCT_ID}\\?view=templates$`));

    await page.goto("/studio");
    await expect(page).toHaveURL(/\/studio\/new/);

    await page.goto("/this-route-does-not-exist");
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await assertNoAxeViolations(page, "Not found");
    await assertBasicSemantics(page, "Not found");
  });

  test("provisions a reviewed package through the operator UI", async ({ page }) => {
    const packagePath = process.env.CONTENTGATE_E2E_ONBOARDING_PACKAGE;
    test.skip(!packagePath, "Requires a disposable onboarding ZIP package path.");
    await signIn(page, false);
    await page.goto("/onboarding");
    await page.getByLabel("Workspace package").setInputFiles(packagePath!);
    await page.getByRole("button", { name: "Upload and preflight" }).click();
    await expect(page.getByRole("heading", { name: "Preflight passed" })).toBeVisible({
      timeout: 60_000,
    });
    await page.getByRole("button", { name: "Create workspace" }).click();
    await expect(page.getByRole("heading", { name: "Workspace ready" })).toBeVisible({
      timeout: 120_000,
    });
  });

  test("keeps every primary route reflowable with operable mobile actions", async ({ page }) => {
    await signIn(page, false);
    await page.setViewportSize({ width: 320, height: 800 });
    for (const surface of ACCESSIBILITY_SURFACES) {
      await page.goto(surface.path);
      await assertMobileReflow(page, `${surface.name} mobile`);
      await assertMobileTouchTargets(page, `${surface.name} mobile`);
    }
  });

  test("keeps modal and mobile-navigation states accessible with focus restoration", async ({ page }) => {
    await signIn(page, false);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard");
    const menuButton = page.getByRole("button", { name: "Open navigation" });
    await menuButton.click();
    await expect(page.getByRole("button", { name: "Close navigation" }).last()).toBeFocused();
    await assertNoAxeViolations(page, "Open mobile navigation");
    await page.keyboard.press("Escape");
    await expect(menuButton).toBeFocused();

    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/assets");
    const uploadButton = page.getByRole("button", { name: /Upload asset/i });
    await uploadButton.click();
    const uploadDialog = page.getByRole("dialog");
    await expect(uploadDialog).toBeVisible();
    await waitForVisualState(uploadDialog);
    await assertNoAxeViolations(page, "Upload asset dialog");
    await page.keyboard.press("Escape");
    await expect(uploadButton).toBeFocused();
  });

  test("supports keyboard sign-in, skip navigation, and primary workspace links", async ({
    page,
  }) => {
    requireLoginCredentials();
    await page.goto("/login");
    await page.waitForTimeout(300);

    // Use the same sequence a keyboard-only user takes through the form.
    await page.keyboard.press("Tab"); // Skip link
    await page.keyboard.press("Tab"); // Work email
    await page.keyboard.type(E2E_EMAIL ?? "");
    await page.keyboard.press("Tab"); // Forgot password
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
      // Start from the top of a fresh document for each navigation check.
      // Activating the skip link intentionally moves focus past the sidebar,
      // so continuing from #main-content cannot exercise those nav links.
      await page.goto("/dashboard");
      await page.waitForLoadState("domcontentloaded");
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
    }
  });

  test("audits every major feature surface for accessibility, broken images, and app crashes", async ({
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
      await assertNoAxeViolations(page, surface.name);
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
