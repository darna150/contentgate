import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type Browser, type Page, type TestInfo } from "@playwright/test";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const BASE_URL = process.env.CONTENTGATE_E2E_BASE_URL ?? "";
const ASSIGNMENT_ID = process.env.CONTENTGATE_E2E_ASSIGNMENT_ID ?? "";
const OUTPUT_SIZE = process.env.CONTENTGATE_E2E_OUTPUT_SIZE_KEY ?? "";
const STAGING_PROJECT_REF = "bncwjibscptgijgmuhrn";
const EVIDENCE_DIR = "/private/tmp/contentgate-studio-audit-2026-08-01/evidence";

test.use({ baseURL: BASE_URL });
test.describe.configure({ timeout: 600_000 });

type Role = "member" | "approver" | "admin";
type Fixture = {
  admin: SupabaseClient;
  orgId: string;
  role: Role;
  email: string;
  password: string;
  userId: string;
};
type Finding = {
  id: string;
  severity: "P0" | "P1" | "P2" | "P3";
  area: string;
  summary: string;
  evidence?: unknown;
};

const fixtures: Partial<Record<Role, Fixture>> = {};
let authorContentId = "";
let approvedContentId = "";

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for exhaustive Studio QA.`);
  return value;
}

function assertStagingTarget() {
  const projectUrl = required("NEXT_PUBLIC_SUPABASE_URL");
  const projectRef = new URL(projectUrl).hostname.split(".")[0];
  const target = new URL(BASE_URL || required("CONTENTGATE_E2E_BASE_URL"));
  if (
    process.env.CONTENTGATE_ENVIRONMENT !== "staging" ||
    projectRef !== STAGING_PROJECT_REF ||
    !target.hostname.endsWith(".vercel.app") ||
    !target.hostname.includes("-git-")
  ) {
    throw new Error(`Studio audit is staging Preview only; app=${target.hostname}, project=${projectRef}.`);
  }
}

async function provision(role: Role): Promise<Fixture> {
  assertStagingTarget();
  const admin = createClient(required("NEXT_PUBLIC_SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: assignment, error: assignmentError } = await admin
    .from("product_template_assignments")
    .select("org_id, product_id, status")
    .eq("id", ASSIGNMENT_ID)
    .single();
  if (assignmentError || !assignment || assignment.status !== "active") {
    throw assignmentError ?? new Error("Active Nimbus assignment not found.");
  }
  const suffix = randomUUID().slice(0, 8);
  const email = `generation-matrix-${suffix}@contentgate.example`;
  const password = `CgStudioAudit!${randomUUID()}aA7`;
  const fullName = `Generation matrix ${suffix}`;
  const { error: provisionError } = await admin.rpc("provision_user", {
    provision_email: email,
    provision_org_id: assignment.org_id,
    provision_role: role,
    provision_full_name: fullName,
  });
  if (provisionError) throw provisionError;
  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (authError || !authUser.user) throw authError ?? new Error(`Could not create ${role} audit user.`);
  return { admin, orgId: assignment.org_id, role, email, password, userId: authUser.user.id };
}

async function dispose(fixture: Fixture | undefined) {
  if (!fixture) return;
  const { error: disposalError } = await fixture.admin.rpc("dispose_generation_matrix_fixture", {
    p_org_id: fixture.orgId,
    p_user_id: fixture.userId,
  });
  if (disposalError) throw disposalError;
  const { error: authError } = await fixture.admin.auth.admin.deleteUser(fixture.userId, false);
  if (authError && !/not found/iu.test(authError.message)) throw authError;
  await fixture.admin.from("profiles").delete().eq("id", fixture.userId);
}

async function signIn(page: Page, fixture: Fixture) {
  await page.goto("/login");
  await page.getByLabel("Work email").fill(fixture.email);
  await page.getByLabel("Password").fill(fixture.password);
  await page.getByRole("button", { name: /^(Sign in|Enter workspace)$/ }).click();
  await page.waitForFunction(() => !location.pathname.startsWith("/login"), undefined, { timeout: 45_000 });
}

async function signedInPage(browser: Browser, fixture: Fixture) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page, fixture);
  return { context, page };
}

async function generate(page: Page, outputSize = OUTPUT_SIZE) {
  const result = await page.evaluate(async ({ assignmentId, size }) => {
    const response = await fetch("/api/products/generate", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platformAssignmentId: assignmentId, language: "English", outputSize: size }),
    });
    const text = await response.text();
    let body: Record<string, unknown> = {};
    try { body = JSON.parse(text) as Record<string, unknown>; } catch { /* retain raw body */ }
    return { status: response.status, text, body };
  }, { assignmentId: ASSIGNMENT_ID, size: outputSize });
  return result;
}

async function ensureAuthorDraft(page: Page) {
  if (authorContentId) return authorContentId;
  const result = await generate(page);
  if (result.status !== 200 || typeof result.body.contentId !== "string") {
    throw new Error(`Could not create author audit draft: ${result.status} ${result.text}`);
  }
  authorContentId = result.body.contentId;
  return authorContentId;
}

async function attachJson(testInfo: TestInfo, name: string, value: unknown) {
  const body = Buffer.from(JSON.stringify(value, null, 2));
  const prefix = testInfo.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await writeFile(path.join(EVIDENCE_DIR, `${prefix}-${name}.json`), body);
  await testInfo.attach(`${name}.json`, {
    contentType: "application/json",
    body,
  });
}

async function screenshot(page: Page, testInfo: TestInfo, name: string) {
  const prefix = testInfo.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  const screenshotPath = path.join(EVIDENCE_DIR, `${prefix}-${name}.png`);
  await mkdir(EVIDENCE_DIR, { recursive: true });
  const body = await page.screenshot({ fullPage: true, path: screenshotPath });
  await testInfo.attach(`${name}.png`, { contentType: "image/png", body });
}

async function waitForStudio(page: Page, contentId: string) {
  await page.goto(`/studio/${contentId}?size=${encodeURIComponent(OUTPUT_SIZE)}`);
  await expect(page.getByLabel("Size and format")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("studio-preview-canvas")).toBeVisible({ timeout: 60_000 });
}

async function setSafeCopy(page: Page) {
  const safe: Record<string, string> = {
    headline: "RUN ON AIR",
    subheadline_1: "MEET THE NEW NIMBUS 1",
    subheadline_2: "CLOUD-SOFT CUSHIONING FOR DAILY MILES",
  };
  for (const [key, value] of Object.entries(safe)) {
    const field = page.locator(`#studio-field-${key}`);
    if (await field.isVisible().catch(() => false)) await field.fill(value);
  }
  await expect(page.getByText(/✓ Draft saved|Draft synced/i)).toBeVisible({ timeout: 45_000 });
  await expect(page.getByRole("button", { name: /Submit for review/i })).toBeEnabled({ timeout: 45_000 });
}

function captureRuntime(page: Page) {
  const issues: Array<{ kind: string; detail: string }> = [];
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) issues.push({ kind: `console:${message.type()}`, detail: message.text() });
  });
  page.on("pageerror", (error) => issues.push({ kind: "pageerror", detail: error.message }));
  page.on("requestfailed", (request) => issues.push({ kind: "requestfailed", detail: `${request.method()} ${request.url()} — ${request.failure()?.errorText}` }));
  page.on("response", (response) => {
    if (response.status() >= 400 && !response.url().includes("/_next/image")) {
      issues.push({ kind: `http:${response.status()}`, detail: `${response.request().method()} ${response.url()}` });
    }
  });
  return issues;
}

test.beforeAll(async () => {
  required("CONTENTGATE_E2E_BASE_URL");
  required("CONTENTGATE_E2E_ASSIGNMENT_ID");
  required("CONTENTGATE_E2E_OUTPUT_SIZE_KEY");
  fixtures.member = await provision("member");
  fixtures.approver = await provision("approver");
  fixtures.admin = await provision("admin");
});

test.afterAll(async () => {
  await dispose(fixtures.member);
  await dispose(fixtures.approver);
  await dispose(fixtures.admin);
});

test("01 — inventories and switches every active format without state or fit corruption", async ({ page }, testInfo) => {
  const findings: Finding[] = [];
  const runtime = captureRuntime(page);
  await signIn(page, fixtures.member!);
  const generated = await generate(page);
  if (generated.status !== 200 || typeof generated.body.contentId !== "string") {
    findings.push({ id: "GEN-BASELINE", severity: "P0", area: "Generation", summary: "Baseline generation failed", evidence: generated });
    await attachJson(testInfo, "findings", findings);
    return;
  }
  authorContentId = generated.body.contentId;
  await waitForStudio(page, authorContentId);
  const trigger = page.getByLabel("Size and format");
  await trigger.click();
  const optionLabels = await page.getByRole("option").allTextContents();
  await page.keyboard.press("Escape");
  if (optionLabels.length !== 42) {
    findings.push({ id: "FORMAT-COUNT", severity: "P1", area: "Formats", summary: `Expected 42 active formats; Studio exposed ${optionLabels.length}.`, evidence: optionLabels });
  }

  const matrix: Array<Record<string, unknown>> = [];
  for (let index = 0; index < optionLabels.length; index += 1) {
    await trigger.click();
    const options = page.getByRole("option");
    const label = (await options.nth(index).textContent())?.trim() ?? `option-${index}`;
    await options.nth(index).click();
    await page.waitForTimeout(120);
    const row = await page.evaluate(() => {
      const viewport = document.querySelector<HTMLElement>('[data-testid="studio-preview-viewport"]');
      const canvas = document.querySelector<HTMLElement>('[data-testid="studio-preview-canvas"]');
      const pageOverflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
      if (!viewport || !canvas) return { canvas: false, pageOverflow };
      const v = viewport.getBoundingClientRect();
      const c = canvas.getBoundingClientRect();
      return {
        canvas: true,
        canvasWidth: c.width,
        canvasHeight: c.height,
        fullyVisible: c.left >= v.left - 1 && c.top >= v.top - 1 && c.right <= v.right + 1 && c.bottom <= v.bottom + 1,
        stageScrollX: viewport.scrollWidth > viewport.clientWidth + 1,
        stageScrollY: viewport.scrollHeight > viewport.clientHeight + 1,
        pageOverflow,
      };
    });
    matrix.push({ label, ...row });
    if (!row.canvas || !row.fullyVisible || row.stageScrollX || row.stageScrollY || row.pageOverflow) {
      findings.push({ id: `FORMAT-${index + 1}`, severity: "P1", area: "Format/Fit", summary: `${label} did not remain completely visible in Fit mode.`, evidence: row });
    }
  }
  await attachJson(testInfo, "format-matrix", matrix);
  await attachJson(testInfo, "runtime", runtime);
  await attachJson(testInfo, "findings", findings);
  await screenshot(page, testInfo, "all-format-final-state");
});

test("02 — exercises every asset combination and adversarial copy boundary", async ({ page }, testInfo) => {
  const findings: Finding[] = [];
  const runtime = captureRuntime(page);
  await signIn(page, fixtures.member!);
  await ensureAuthorDraft(page);
  await waitForStudio(page, authorContentId);

  const productButtons = page.getByRole("button", { name: /^Product variant:/ });
  const backgroundButtons = page.getByTestId("studio-background-picker").getByRole("radio");
  const productCount = await productButtons.count();
  const backgroundCount = await backgroundButtons.count();
  const combinations: Array<Record<string, unknown>> = [];
  const baseline = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLElement>('[data-testid="studio-preview-canvas"]');
    return { width: canvas?.style.width, height: canvas?.style.height };
  });
  for (let product = 0; product < productCount; product += 1) {
    await productButtons.nth(product).click();
    for (let background = 0; background < backgroundCount; background += 1) {
      await backgroundButtons.nth(background).click();
      await page.waitForTimeout(180);
      const state = await page.evaluate(() => {
        const canvas = document.querySelector<HTMLElement>('[data-testid="studio-preview-canvas"]');
        return {
          width: canvas?.style.width,
          height: canvas?.style.height,
          fields: Array.from(document.querySelectorAll<HTMLElement>("[data-template-field]")).map((node) => ({
            key: node.dataset.templateField,
            text: node.textContent?.trim(),
            fontSize: node.dataset.templateFontSize,
          })),
        };
      });
      combinations.push({ product, background, ...state });
      if (state.width !== baseline.width || state.height !== baseline.height) {
        findings.push({ id: `ASSET-CANVAS-${product}-${background}`, severity: "P1", area: "Assets", summary: "Changing a locked visual changed canvas dimensions.", evidence: { baseline, state } });
      }
    }
  }

  const boundaryResults: Array<Record<string, unknown>> = [];
  const fields = page.locator('textarea[id^="studio-field-"]');
  const originalTextValues = await fields.evaluateAll((nodes) => nodes.map((node) => ({ id: node.id, value: (node as HTMLTextAreaElement).value })));
  for (let index = 0; index < await fields.count(); index += 1) {
    const field = fields.nth(index);
    const id = await field.getAttribute("id") ?? `field-${index}`;
    const original = await field.inputValue();
    const indicator = field.locator("xpath=preceding-sibling::div[1]//span").last();
    const read = async (caseName: string, value: string) => {
      await field.fill(value);
      await page.waitForTimeout(900);
      const status = (await indicator.textContent())?.trim() ?? "";
      const preview = await page.locator(`[data-template-field="${id.replace("studio-field-", "")}"]`).textContent().catch(() => null);
      boundaryResults.push({ id, caseName, value, status, preview });
      return status;
    };
    const initialStatus = (await indicator.textContent()) ?? "";
    const max = Number(initialStatus.match(/\/(\d+)/)?.[1] ?? 0);
    const emojiStatus = await read("visible-graphemes", "👨‍👩‍👧‍👦👍🏽é");
    if (!/^3\//.test(emojiStatus)) findings.push({ id: `${id}-GRAPHEME`, severity: "P1", area: "Copy measurement", summary: `${id} miscounted visible grapheme characters.`, evidence: emojiStatus });
    await read("cjk", "每天轻盈前行");
    await read("newlines", "Line one\nLine two\nLine three");
    await read("unbroken", "W".repeat(Math.max(20, Math.floor(max * 0.8))));
    if (max > 0) {
      const exactStatus = await read("hard-max", "i".repeat(max));
      if (/over by/i.test(exactStatus)) findings.push({ id: `${id}-MAX`, severity: "P1", area: "Copy measurement", summary: `${id} rejects its documented hard maximum.`, evidence: exactStatus });
      const overStatus = await read("hard-max-plus-one", "i".repeat(max + 1));
      if (!/over by 1/i.test(overStatus)) findings.push({ id: `${id}-OVER`, severity: "P1", area: "Copy measurement", summary: `${id} did not reject max+1 characters.`, evidence: overStatus });
    }
    await read("empty", "");
    await field.fill(original);
    await page.waitForTimeout(900);
  }
  const recoveredSavedState = await page.getByText(/✓ Draft saved|Draft synced/i).isVisible({ timeout: 45_000 }).catch(() => false);
  if (!recoveredSavedState) findings.push({ id: "BOUNDARY-SAVE-RECOVERY", severity: "P1", area: "Autosave", summary: "After invalid boundary input was restored, Studio did not return to its saved state within 45 seconds." });
  await page.reload();
  await expect(page.getByLabel("Size and format")).toBeVisible({ timeout: 45_000 });
  const persistedTextValues = await page.locator('textarea[id^="studio-field-"]').evaluateAll((nodes) => nodes.map((node) => ({ id: node.id, value: (node as HTMLTextAreaElement).value })));
  if (JSON.stringify(persistedTextValues) !== JSON.stringify(originalTextValues)) findings.push({ id: "BOUNDARY-STALE-PERSIST", severity: "P1", area: "Autosave/data integrity", summary: "After rapid boundary edits were restored, reload returned different persisted copy than the original latest values.", evidence: { originalTextValues, persistedTextValues } });
  const persistedAssetState = await Promise.all([
    page.locator('button[aria-label^="Product variant:"][aria-pressed="true"]').count().catch(() => 0),
    page.getByTestId("studio-background-picker").locator('[role="radio"][aria-checked="true"]').count().catch(() => 0),
  ]);
  if (persistedAssetState[0] !== 1) findings.push({ id: "PRODUCT-VARIANT-STATE", severity: "P1", area: "Accessibility/assets", summary: "The selected product variant is conveyed visually but exposes no programmatic selected state." });
  if (persistedAssetState[1] !== 1) findings.push({ id: "BACKGROUND-STATE", severity: "P1", area: "Accessibility/assets", summary: "The selected background was not exposed as exactly one checked radio after reload." });
  await attachJson(testInfo, "asset-combinations", combinations);
  await attachJson(testInfo, "copy-boundaries", boundaryResults);
  await attachJson(testInfo, "boundary-persistence", { originalTextValues, persistedTextValues });
  await attachJson(testInfo, "asset-persistence", persistedAssetState);
  await attachJson(testInfo, "runtime", runtime);
  await attachJson(testInfo, "findings", findings);
  await screenshot(page, testInfo, "asset-and-copy-final-state");
});

test("03 — verifies Fit/manual zoom, responsive reflow, touch targets, keyboard, and axe", async ({ page }, testInfo) => {
  const findings: Finding[] = [];
  const runtime = captureRuntime(page);
  await signIn(page, fixtures.member!);
  await ensureAuthorDraft(page);
  const viewports = [
    { label: "desktop-1440x900", width: 1440, height: 900 },
    { label: "laptop-1366x768", width: 1366, height: 768 },
    { label: "laptop-1280x800", width: 1280, height: 800 },
    { label: "tablet-768x1024", width: 768, height: 1024 },
    { label: "mobile-390x844", width: 390, height: 844 },
    { label: "small-mobile-320x568", width: 320, height: 568 },
  ];
  const results: Array<Record<string, unknown>> = [];
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await waitForStudio(page, authorContentId);
    await page.getByRole("button", { name: "Fit", exact: true }).click();
    await page.waitForTimeout(250);
    const fit = await page.evaluate(() => {
      const v = document.querySelector<HTMLElement>('[data-testid="studio-preview-viewport"]');
      const c = document.querySelector<HTMLElement>('[data-testid="studio-preview-canvas"]');
      if (!v || !c) return { present: false };
      const vr = v.getBoundingClientRect();
      const cr = c.getBoundingClientRect();
      return {
        present: true,
        complete: cr.left >= vr.left - 1 && cr.top >= vr.top - 1 && cr.right <= vr.right + 1 && cr.bottom <= vr.bottom + 1,
        stageScrollX: v.scrollWidth > v.clientWidth + 1,
        stageScrollY: v.scrollHeight > v.clientHeight + 1,
        pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      };
    });
    const beforeZoom = await page.getByLabel("Current preview zoom").textContent();
    await page.getByRole("button", { name: "Zoom in" }).click();
    await expect.poll(() => page.getByLabel("Current preview zoom").textContent(), { timeout: 3_000 }).not.toBe(beforeZoom);
    const afterZoom = await page.getByLabel("Current preview zoom").textContent();
    const undersizedTargets = await page.locator("button:visible, a:visible").evaluateAll((nodes) => nodes.flatMap((node) => {
      const rect = node.getBoundingClientRect();
      const label = (node.getAttribute("aria-label") || node.textContent || "").trim().replace(/\s+/g, " ").slice(0, 80);
      return (rect.width < 44 || rect.height < 44) ? [{ label, width: Math.round(rect.width), height: Math.round(rect.height) }] : [];
    }));
    results.push({ ...viewport, fit, beforeZoom, afterZoom, undersizedTargets });
    if (!fit.present || !fit.complete || fit.stageScrollX || fit.stageScrollY || fit.pageOverflow) findings.push({ id: `FIT-${viewport.label}`, severity: "P1", area: "Zoom/reflow", summary: `Fit did not show the complete artwork without scrolling at ${viewport.label}.`, evidence: fit });
    if (beforeZoom === afterZoom) findings.push({ id: `ZOOM-${viewport.label}`, severity: "P1", area: "Zoom", summary: `Zoom in did not change the scale at ${viewport.label}.` });
    if (undersizedTargets.length) findings.push({ id: `TOUCH-${viewport.label}`, severity: viewport.width <= 768 ? "P2" : "P3", area: "Accessibility", summary: `${undersizedTargets.length} visible controls were below 44×44 at ${viewport.label}.`, evidence: undersizedTargets });
    await screenshot(page, testInfo, viewport.label);
  }
  await page.setViewportSize({ width: 1366, height: 768 });
  await waitForStudio(page, authorContentId);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  if (axe.violations.length) findings.push({ id: "A11Y-AXE", severity: "P1", area: "Accessibility", summary: `${axe.violations.length} axe violations in Studio.`, evidence: axe.violations });
  await page.keyboard.press("Tab");
  const firstFocus = await page.evaluate(() => ({ tag: document.activeElement?.tagName, text: document.activeElement?.textContent?.trim().slice(0, 80) }));
  await page.emulateMedia({ reducedMotion: "reduce" });
  const animated = await page.locator("body *").evaluateAll((nodes) => nodes.filter((node) => {
    const rect = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    return rect.width > 1 && rect.height > 1 && style.animationName !== "none" && style.animationDuration !== "0s";
  }).slice(0, 40).map((node) => ({ tag: node.tagName, text: node.textContent?.trim().slice(0, 50) })));
  if (animated.length) findings.push({ id: "REDUCED-MOTION", severity: "P2", area: "Accessibility", summary: `${animated.length}+ elements retain motion durations under reduced-motion preference.`, evidence: animated });
  await attachJson(testInfo, "responsive-results", results);
  await attachJson(testInfo, "axe-results", axe);
  await attachJson(testInfo, "keyboard-first-focus", firstFocus);
  await attachJson(testInfo, "runtime", runtime);
  await attachJson(testInfo, "findings", findings);
});

test("04 — exercises author/approver lifecycle, rejection categories, self-review, and approved exports", async ({ browser }, testInfo) => {
  const findings: Finding[] = [];
  const author = await signedInPage(browser, fixtures.member!);
  const approver = await signedInPage(browser, fixtures.approver!);
  const admin = await signedInPage(browser, fixtures.admin!);
  const runtime = [...captureRuntime(author.page), ...captureRuntime(approver.page), ...captureRuntime(admin.page)];
  try {
    await ensureAuthorDraft(author.page);
    await waitForStudio(author.page, authorContentId);
    await setSafeCopy(author.page);
    const directBeforeApproval = await author.page.evaluate(async ({ id, size }) => {
      const response = await fetch(`/api/creative/render?content=${id}&size=${size}&format=png&download=1`);
      return { status: response.status, body: await response.text() };
    }, { id: authorContentId, size: OUTPUT_SIZE });
    if (directBeforeApproval.status < 400) findings.push({ id: "EXPORT-GATE", severity: "P0", area: "Governance", summary: "A member could directly export an unapproved draft.", evidence: directBeforeApproval });
    await author.page.getByRole("button", { name: /Submit for review/i }).click();
    await expect(author.page.getByText(/Submitted for review|Awaiting your review/i)).toBeVisible({ timeout: 45_000 });
    if (await author.page.getByRole("button", { name: /^Approve$/ }).isVisible().catch(() => false)) findings.push({ id: "MEMBER-APPROVE", severity: "P0", area: "Authorization", summary: "Member author was shown approval controls." });

    await waitForStudio(approver.page, authorContentId);
    await expect(approver.page.getByRole("button", { name: /^Approve$/ })).toBeVisible({ timeout: 45_000 });
    await approver.page.getByRole("button", { name: /^Request changes$/ }).click();
    const rejectSubmit = approver.page.getByRole("button", { name: /^Request changes$/ });
    if (await rejectSubmit.isEnabled()) findings.push({ id: "EMPTY-REJECTION", severity: "P1", area: "Review UX", summary: "Approver could submit an empty rejection note." });
    const category = approver.page.getByLabel("Feedback category");
    const categories = await category.locator("option").allTextContents();
    if (categories.length !== 5) findings.push({ id: "REJECTION-CATEGORIES", severity: "P2", area: "Review UX", summary: `Expected 5 rejection categories; found ${categories.length}.`, evidence: categories });
    await category.selectOption({ label: "Fit or layout" });
    await approver.page.getByLabel("Requested changes").fill("Keep the subheadline clear of the product image.");
    await rejectSubmit.click();
    await expect(approver.page.getByText(/^Rejected$/i).first()).toBeVisible({ timeout: 45_000 });

    await author.page.reload();
    await expect(author.page.getByText("Changes requested")).toBeVisible({ timeout: 45_000 });
    await expect(author.page.getByText(/Fit or layout: Keep the subheadline clear/)).toBeVisible();
    await setSafeCopy(author.page);
    await author.page.getByRole("button", { name: /Submit for review/i }).click();
    await expect(author.page.getByText(/Submitted for review/i)).toBeVisible({ timeout: 45_000 });
    await approver.page.reload();
    await expect(approver.page.getByRole("button", { name: /^Approve$/ })).toBeVisible({ timeout: 45_000 });
    await approver.page.getByRole("button", { name: /^Approve$/ }).click();
    await expect(approver.page.getByText(/^Approved$/i).first()).toBeVisible({ timeout: 45_000 });
    approvedContentId = authorContentId;

    await author.page.reload();
    const copyButton = author.page.getByRole("button", { name: /Copy generated copy/i });
    if (!(await copyButton.isEnabled())) findings.push({ id: "COPY-APPROVED", severity: "P1", area: "Export", summary: "Approved generated copy remained locked." });

    const exports: Array<Record<string, unknown>> = [];
    for (const format of ["png", "jpeg", "pdf"] as const) {
      for (const scale of ["1", "2"] as const) {
        const result = await author.page.evaluate(async ({ id, size, format, scale }) => {
          const response = await fetch(`/api/creative/render?content=${id}&size=${size}&format=${format}&scale=${scale}&download=1`);
          const bytes = new Uint8Array(await response.arrayBuffer());
          return { status: response.status, type: response.headers.get("content-type"), length: bytes.length, header: Array.from(bytes.slice(0, 16)) };
        }, { id: approvedContentId, size: OUTPUT_SIZE, format, scale });
        exports.push({ format, scale, ...result });
        if (result.status !== 200 || result.length < 1_000) findings.push({ id: `EXPORT-${format}-${scale}`, severity: "P0", area: "Export", summary: `Approved ${format} ${scale}× export failed.`, evidence: result });
      }
    }

    const adminGenerated = await generate(admin.page);
    if (adminGenerated.status === 200 && typeof adminGenerated.body.contentId === "string") {
      await waitForStudio(admin.page, adminGenerated.body.contentId);
      await setSafeCopy(admin.page);
      await admin.page.getByRole("button", { name: /Submit for review/i }).click();
      const selfApproveVisible = await admin.page.getByRole("button", { name: /^Approve$/ }).isVisible({ timeout: 20_000 }).catch(() => false);
      if (selfApproveVisible) findings.push({ id: "SELF-APPROVAL", severity: "P1", area: "Governance", summary: "An admin can approve a draft they generated themselves; four-eyes review is not enforced." });
    }
    await attachJson(testInfo, "preapproval-direct-export", directBeforeApproval);
    await attachJson(testInfo, "approved-export-matrix", exports);
    await attachJson(testInfo, "runtime", runtime);
    await attachJson(testInfo, "findings", findings);
    await screenshot(author.page, testInfo, "approved-author-state");
  } finally {
    await author.context.close();
    await approver.context.close();
    await admin.context.close();
  }
});

test("05 — exercises every refinement direction and records first-request reliability", async ({ page }, testInfo) => {
  test.setTimeout(1_800_000);
  const findings: Finding[] = [];
  const runtime = captureRuntime(page);
  await signIn(page, fixtures.admin!);
  const baseline = await generate(page);
  if (baseline.status !== 200 || typeof baseline.body.contentId !== "string") {
    findings.push({ id: "REFINE-BASELINE", severity: "P0", area: "Generation", summary: "Could not create refinement baseline.", evidence: baseline });
    await attachJson(testInfo, "findings", findings);
    return;
  }
  await waitForStudio(page, baseline.body.contentId);
  const labels = ["Shorter", "Longer", "More strategic", "More playful", "More urgent", "Simpler", "On-brand voice", "Add proof point", "Lead with benefit"];
  const results: Array<Record<string, unknown>> = [];
  for (const label of labels) {
    const button = page.getByRole("button", { name: label, exact: true });
    if (!(await button.isVisible().catch(() => false))) {
      await page.locator("summary").click({ timeout: 5_000 });
      await expect(button).toBeVisible({ timeout: 5_000 });
    }
    const disabled = await button.isDisabled();
    if (disabled) {
      results.push({ label, disabled: true, title: await button.getAttribute("title") });
      continue;
    }
    await button.click();
    const requestStartedAt = Date.now();
    const responsePromise = page.waitForResponse((response) => response.url().includes("/api/products/generate") && response.request().method() === "POST", { timeout: 180_000 });
    await page.getByRole("button", { name: `Apply “${label}”`, exact: true }).click();
    const response = await responsePromise;
    const body = await response.json().catch(() => ({})) as Record<string, unknown>;
    const errorText = page.locator("p.text-reject").last();
    const visibleError = await errorText.isVisible({ timeout: 1_000 }).catch(() => false)
      ? await errorText.textContent()
      : null;
    results.push({ label, disabled: false, status: response.status(), body, visibleError });
    await attachJson(testInfo, `refinement-${label.toLowerCase().replace(/\s+/g, "-")}`, results.at(-1));
    if (!response.ok()) findings.push({ id: `REFINE-${label.toUpperCase().replace(/\s+/g, "-")}`, severity: "P1", area: "Generation/refinement", summary: `${label} failed on its first request.`, evidence: { status: response.status(), body, visibleError } });
    await expect(page.getByRole("button", { name: /^(Generate|Apply)/ }).last()).toBeEnabled({ timeout: 10_000 }).catch(() => undefined);
    const cooldownRemaining = Math.max(0, requestStartedAt + 15_500 - Date.now());
    if (cooldownRemaining > 0) await page.waitForTimeout(cooldownRemaining);
  }
  await attachJson(testInfo, "refinement-matrix", results);
  await attachJson(testInfo, "runtime", runtime);
  await attachJson(testInfo, "findings", findings);
  await screenshot(page, testInfo, "refinement-final-state");
});

test("06 — verifies autosave conflict and offline recovery affordances", async ({ browser }, testInfo) => {
  const findings: Finding[] = [];
  const generatedPage = await signedInPage(browser, fixtures.member!);
  const generated = await generate(generatedPage.page);
  if (generated.status !== 200 || typeof generated.body.contentId !== "string") {
    await generatedPage.context.close();
    return;
  }
  const contentId = generated.body.contentId;
  const first = generatedPage;
  const second = await signedInPage(browser, fixtures.member!);
  try {
    await waitForStudio(first.page, contentId);
    await waitForStudio(second.page, contentId);
    const firstField = first.page.locator('textarea[id^="studio-field-"]').first();
    const secondField = second.page.locator('textarea[id^="studio-field-"]').first();
    await firstField.fill("FIRST TAB");
    await expect(first.page.getByText(/✓ Draft saved/i)).toBeVisible({ timeout: 45_000 });
    await secondField.fill("SECOND TAB");
    const secondSaveFailed = await second.page.getByText(/Save failed|Changes not saved/i).isVisible({ timeout: 45_000 }).catch(() => false);
    await first.page.reload();
    const serverValueAfterStaleWrite = await first.page.locator('textarea[id^="studio-field-"]').first().inputValue();
    if (!secondSaveFailed) findings.push({ id: "CONCURRENT-EDIT", severity: "P1", area: "Autosave/concurrency", summary: serverValueAfterStaleWrite === "SECOND TAB" ? "A stale second tab silently overwrote the newer saved value without a conflict." : "A stale second tab did not surface an optimistic-lock conflict or clear persistence state." });
    else {
      if (!(await second.page.getByRole("button", { name: "Copy unsaved fields" }).isVisible())) findings.push({ id: "CONFLICT-RECOVERY", severity: "P1", area: "Autosave", summary: "Save conflict surfaced without a copy-recovery action." });
    }

    await first.page.context().setOffline(true);
    await firstField.fill("OFFLINE COPY");
    const offlineFailure = await first.page.getByText(/Save failed|Changes not saved/i).isVisible({ timeout: 45_000 }).catch(() => false);
    await first.page.context().setOffline(false);
    await first.page.reload();
    const serverValueAfterOfflineEdit = await first.page.locator('textarea[id^="studio-field-"]').first().inputValue();
    if (!offlineFailure) findings.push({ id: "OFFLINE-SAVE", severity: "P1", area: "Autosave", summary: "Offline editing did not surface a clear save failure within 45 seconds." });
    await attachJson(testInfo, "persistence-observations", { secondSaveFailed, serverValueAfterStaleWrite, offlineFailure, serverValueAfterOfflineEdit });
    await attachJson(testInfo, "findings", findings);
    await screenshot(second.page, testInfo, "concurrent-edit-second-tab");
    await screenshot(first.page, testInfo, "offline-save-state");
  } finally {
    await first.context.setOffline(false).catch(() => undefined);
    await first.context.close();
    await second.context.close();
  }
});
