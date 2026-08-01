import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";

import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { loadEnvConfig } from "@next/env";
import { createBrowserClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

loadEnvConfig(process.cwd());

const execFileAsync = promisify(execFile);
const RUN_STATEFUL_CAPACITY = process.env.CONTENTGATE_E2E_STATEFUL_CAPACITY === "1";
const BASE_URL = process.env.CONTENTGATE_E2E_BASE_URL ?? "";
const STAGING_PROJECT_REF = "bncwjibscptgijgmuhrn";
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

test.use({ baseURL: BASE_URL });

type SessionCookie = { name: string; value: string };
type StatefulUser = {
  id: string;
  email: string;
  role: "admin" | "approver";
};
type StatefulFixture = {
  admin: SupabaseClient;
  organizationId: string;
  productId: string;
  assignmentId: string;
  outputSize: string;
  outputWidth: number;
  outputHeight: number;
  knowledgeQuestion: string;
  password: string;
  suffix: string;
  users: StatefulUser[];
  assetIds: string[];
  contentIds: string[];
  queryIds: string[];
  notebookSessionIds: string[];
  workerId: string | null;
};

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for stateful capacity QA.`);
  return value;
}

function requiredPositiveInteger(name: string) {
  const value = Number(required(name));
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return value;
}

function percentile(values: number[], quantile: number) {
  if (values.length === 0) throw new Error("Cannot calculate an empty percentile.");
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * quantile) - 1)];
}

function requireGuardedStagingTarget() {
  const projectUrl = required("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = required("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const target = new URL(BASE_URL || required("CONTENTGATE_E2E_BASE_URL"));
  const projectRef = new URL(projectUrl).hostname.split(".")[0];
  const isPreview = target.hostname.endsWith(".vercel.app") && target.hostname.includes("-git-");
  const isLocal = ["localhost", "127.0.0.1", "::1"].includes(target.hostname);
  if (
    process.env.CONTENTGATE_ENVIRONMENT !== "staging" ||
    projectRef !== STAGING_PROJECT_REF ||
    (!isPreview && !isLocal)
  ) {
    throw new Error(
      `Stateful capacity QA is staging Preview/local only; received app=${target.hostname}, project=${projectRef}.`,
    );
  }

  const productName = required("CONTENTGATE_E2E_PRODUCT_NAME");
  if (!/nimbus/iu.test(productName) || /aerform/iu.test(productName)) {
    throw new Error(`Stateful capacity QA requires the Nimbus fixture, not ${productName}.`);
  }
  return { projectUrl, serviceRoleKey, anonKey };
}

async function checkedDelete(
  query: PromiseLike<{ error: { message: string } | null }>,
  label: string,
) {
  const { error } = await query;
  if (error) throw new Error(`Cleanup ${label}: ${error.message}`);
}

async function deleteFixture(fixture: StatefulFixture | null) {
  if (!fixture) return;
  const userIds = fixture.users.map((user) => user.id);
  if (userIds.length === 0) return;

  const { data: contents, error: contentsError } = await fixture.admin
    .from("generated_content")
    .select("id")
    .eq("org_id", fixture.organizationId)
    .in("created_by", userIds);
  if (contentsError) throw contentsError;
  const contentIds = (contents ?? []).map((content) => content.id);
  const { data: discoveredAssets, error: discoveredAssetsError } = await fixture.admin
    .from("product_assets")
    .select("id, storage_path, preview_storage_path, poster_storage_path, transcoded_storage_path")
    .eq("org_id", fixture.organizationId)
    .in("uploaded_by", userIds)
    .like("title", "Enterprise stateful QA %");
  if (discoveredAssetsError) throw discoveredAssetsError;
  const assetIds = (discoveredAssets ?? []).map((asset) => asset.id);
  const { data: renderJobs, error: renderJobsError } = contentIds.length
    ? await fixture.admin
        .from("render_jobs")
        .select("output_storage_path")
        .in("generated_content_id", contentIds)
    : { data: [], error: null };
  if (renderJobsError) throw renderJobsError;

  const renderPaths = [
    ...new Set(
      (renderJobs ?? [])
        .map((row) => row.output_storage_path)
        .filter((path): path is string => typeof path === "string" && path.length > 0),
    ),
  ];
  const assetPaths = [
    ...new Set(
      (discoveredAssets ?? []).flatMap((row) =>
        [
          row.storage_path,
          row.preview_storage_path,
          row.poster_storage_path,
          row.transcoded_storage_path,
        ].filter((path): path is string => typeof path === "string" && path.length > 0),
      ),
    ),
  ];
  if (renderPaths.length > 0) {
    const { error } = await fixture.admin.storage.from("rendered-assets").remove(renderPaths);
    if (error) throw new Error(`Cleanup rendered assets: ${error.message}`);
  }
  if (assetPaths.length > 0) {
    const { error } = await fixture.admin.storage.from("product-assets").remove(assetPaths);
    if (error) throw new Error(`Cleanup product assets: ${error.message}`);
  }

  const { data: disposal, error: disposalError } = await fixture.admin.rpc(
    "dispose_enterprise_stateful_capacity_fixture",
    {
      p_org_id: fixture.organizationId,
      p_user_ids: userIds,
      p_content_ids: contentIds,
      p_asset_ids: assetIds,
      p_session_ids: fixture.notebookSessionIds,
      p_query_ids: fixture.queryIds,
      p_worker_id: fixture.workerId,
    },
  );
  if (disposalError) throw new Error(`Dispose stateful capacity fixture: ${disposalError.message}`);
  if ((disposal as { status?: unknown } | null)?.status !== "disposed") {
    throw new Error("Stateful capacity disposer did not return a completion receipt.");
  }

  for (const user of fixture.users) {
    const { error } = await fixture.admin.auth.admin.deleteUser(user.id, false);
    if (error && !/not found/iu.test(error.message)) throw error;
  }
  await checkedDelete(
    fixture.admin.from("profiles").delete().in("id", userIds),
    "profiles",
  );
}

async function createFixture(): Promise<StatefulFixture> {
  const { projectUrl, serviceRoleKey } = requireGuardedStagingTarget();
  const admin = createClient(projectUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const productId = required("CONTENTGATE_E2E_PRODUCT_ID");
  const assignmentId = required("CONTENTGATE_E2E_ASSIGNMENT_ID");
  const suffix = randomUUID().slice(0, 8);
  const fixture: StatefulFixture = {
    admin,
    organizationId: "",
    productId,
    assignmentId,
    outputSize: required("CONTENTGATE_E2E_OUTPUT_SIZE_KEY"),
    outputWidth: requiredPositiveInteger("CONTENTGATE_E2E_OUTPUT_WIDTH"),
    outputHeight: requiredPositiveInteger("CONTENTGATE_E2E_OUTPUT_HEIGHT"),
    knowledgeQuestion: required("CONTENTGATE_E2E_KNOWLEDGE_QUESTION"),
    password: `CgStateful!${randomUUID()}aA7`,
    suffix,
    users: [],
    assetIds: [],
    contentIds: [],
    queryIds: [],
    notebookSessionIds: [],
    workerId: null,
  };

  const { data: product, error: productError } = await admin
    .from("products")
    .select("id, org_id, name, status, organizations(require_admin_mfa)")
    .eq("id", productId)
    .single();
  if (productError || !product) throw productError ?? new Error("Nimbus product not found.");
  const organization = Array.isArray(product.organizations)
    ? product.organizations[0]
    : product.organizations;
  if (
    product.status !== "active" ||
    !/nimbus/iu.test(product.name) ||
    organization?.require_admin_mfa !== false
  ) {
    throw new Error("The staging Nimbus fixture is inactive, renamed, or requires an MFA-specific capacity plan.");
  }
  fixture.organizationId = product.org_id;

  const { data: assignment, error: assignmentError } = await admin
    .from("product_template_assignments")
    .select("id, org_id, product_id, status")
    .eq("id", assignmentId)
    .single();
  if (
    assignmentError ||
    !assignment ||
    assignment.status !== "active" ||
    assignment.org_id !== fixture.organizationId ||
    assignment.product_id !== productId
  ) {
    throw assignmentError ?? new Error("The Nimbus assignment does not match the guarded product.");
  }

  try {
    const roles: StatefulUser["role"][] = ["admin", "admin", "approver"];
    for (const [index, role] of roles.entries()) {
      const email = `enterprise-stateful-${suffix}-${index}@contentgate.example`;
      const fullName = `Enterprise stateful ${role} ${suffix} ${index}`;
      const { error: provisionError } = await admin.rpc("provision_user", {
        provision_email: email,
        provision_org_id: fixture.organizationId,
        provision_role: role,
        provision_full_name: fullName,
      });
      if (provisionError) throw provisionError;
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: fixture.password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });
      if (error || !data.user) throw error ?? new Error("Supabase did not create a stateful QA user.");
      fixture.users.push({ id: data.user.id, email, role });
    }
    return fixture;
  } catch (error) {
    await deleteFixture(fixture);
    throw error;
  }
}

async function createSessionCookies(
  projectUrl: string,
  anonKey: string,
  email: string,
  password: string,
) {
  let cookieJar: SessionCookie[] = [];
  const supabase = createBrowserClient(projectUrl, anonKey, {
    cookies: {
      getAll: () => cookieJar,
      setAll: (cookies) => {
        for (const cookie of cookies) {
          cookieJar = cookieJar.filter((existing) => existing.name !== cookie.name);
          if (cookie.value) cookieJar.push({ name: cookie.name, value: cookie.value });
        }
      },
    },
  });
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Stateful QA sign-in failed with ${error.status} (${error.code}).`);
  return cookieJar;
}

async function authenticatedPages(browser: Browser, fixture: StatefulFixture) {
  const { projectUrl, anonKey } = requireGuardedStagingTarget();
  const contexts: BrowserContext[] = [];
  const pages = await Promise.all(
    fixture.users.map(async (user) => {
      const cookies = await createSessionCookies(projectUrl, anonKey, user.email, fixture.password);
      const context = await browser.newContext();
      contexts.push(context);
      await context.addCookies(cookies.map((cookie) => ({ ...cookie, url: BASE_URL })));
      return context.newPage();
    }),
  );
  return { contexts, pages };
}

async function uploadAsset(page: Page, fixture: StatefulFixture, index: number) {
  const startedAt = performance.now();
  await page.goto("/assets", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Assets" })).toBeVisible();
  await page.getByRole("button", { name: "Upload asset" }).click();
  const dialog = page.getByRole("dialog", { name: "Upload asset" });
  await expect(dialog).toBeVisible();
  await dialog.locator('select[name="product_id"]').selectOption(fixture.productId);
  await dialog.locator('select[name="asset_type"]').selectOption("image");
  await dialog.locator('input[name="file"]').setInputFiles({
    name: `enterprise-stateful-${fixture.suffix}-${index}.png`,
    mimeType: "image/png",
    buffer: PNG,
  });
  await dialog.locator('input[name="title"]').fill(
    `Enterprise stateful QA ${fixture.suffix} ${index}`,
  );
  await dialog.getByRole("button", { name: "Upload asset" }).click();
  await expect(dialog.getByRole("status")).toContainText("Processing has started", {
    timeout: 60_000,
  });
  return performance.now() - startedAt;
}

async function askQuestion(page: Page, sessionId: string, question: string) {
  const startedAt = performance.now();
  const result = await page.evaluate(
    async ({ sessionId: id, question: prompt }) => {
      const response = await fetch("/api/products/ask", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "x-contentgate-validation-run": "ask-production",
        },
        body: JSON.stringify({ sessionId: id, question: prompt }),
      });
      const text = await response.text();
      let json: Record<string, unknown> = {};
      try {
        json = JSON.parse(text) as Record<string, unknown>;
      } catch {
        // Raw text remains available for the assertion message.
      }
      return { status: response.status, text, json };
    },
    { sessionId, question },
  );
  return { ...result, durationMs: performance.now() - startedAt };
}

async function generateDraft(page: Page, fixture: StatefulFixture) {
  const attempts: Array<{ status: number; durationMs: number; text: string }> = [];
  const startedAt = performance.now();
  const result = await page.evaluate(
      async ({ assignmentId, outputSize }) => {
        const response = await fetch("/api/products/generate", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            platformAssignmentId: assignmentId,
            language: "English",
            outputSize,
          }),
        });
        const text = await response.text();
        let json: Record<string, unknown> = {};
        try {
          json = JSON.parse(text) as Record<string, unknown>;
        } catch {
          // Raw text remains available for diagnostics.
        }
        return { status: response.status, text, json };
      },
      { assignmentId: fixture.assignmentId, outputSize: fixture.outputSize },
    );
  attempts.push({
    status: result.status,
    durationMs: performance.now() - startedAt,
    text: result.text.slice(0, 500),
  });
  if (result.status !== 200 || typeof result.json.contentId !== "string") {
    throw new Error(`First-request generation returned ${result.status}: ${result.text}`);
  }
  return { contentId: result.json.contentId, attempts };
}

async function expectStudioState(page: Page, state: "Draft" | "In review" | "Approved") {
  await expect(page.getByText(new RegExp(`^${state}$`, "iu")).first()).toBeVisible({
    timeout: 60_000,
  });
}

async function makeDraftReviewable(page: Page) {
  const submit = page.getByRole("button", { name: /Submit for review/iu });
  if (await submit.isEnabled()) return;
  const fitSafeCopy: Record<string, string> = {
    headline: "RUN ON AIR",
    subheadline_1: "INTRODUCING THE NEW NIMBUS 1",
    subheadline_2: "CLOUD-SOFT CUSHIONING MEETS REAL-WORLD SPEED",
  };
  for (const [field, value] of Object.entries(fitSafeCopy)) {
    const input = page.locator(`#studio-field-${field}`);
    if (await input.isVisible().catch(() => false)) await input.fill(value);
  }
  await expect(page.getByText(/layout over/iu)).toHaveCount(0, { timeout: 30_000 });
  await expect(submit).toBeEnabled({ timeout: 30_000 });
}

async function exportPng(page: Page, contentId: string, outputSize: string) {
  const startedAt = performance.now();
  const result = await page.evaluate(
    async ({ id, size }) => {
      const response = await fetch(
        `/api/creative/render?content=${encodeURIComponent(id)}&size=${encodeURIComponent(size)}&format=png&download=1`,
        { credentials: "same-origin" },
      );
      const body = await response.arrayBuffer();
      return {
        status: response.status,
        contentType: response.headers.get("content-type"),
        disposition: response.headers.get("content-disposition"),
        bytes: body.byteLength,
        headerBytes: Array.from(new Uint8Array(body).slice(0, 32)),
        errorText: response.ok ? "" : new TextDecoder().decode(body).slice(0, 500),
      };
    },
    { id: contentId, size: outputSize },
  );
  return { ...result, durationMs: performance.now() - startedAt };
}

function pngDimensions(bytes: number[]) {
  const buffer = Buffer.from(bytes);
  if (buffer.length < 24 || buffer.toString("ascii", 1, 4) !== "PNG") return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

test.describe.serial("enterprise stateful capacity @enterprise-stateful-capacity", () => {
  test.skip(
    !RUN_STATEFUL_CAPACITY,
    "Set CONTENTGATE_E2E_STATEFUL_CAPACITY=1 for the guarded stateful staging gate.",
  );
  test.setTimeout(600_000);

  let fixture: StatefulFixture | null = null;

  test.beforeAll(async () => {
    fixture = await createFixture();
  });

  test.afterAll(async () => {
    await deleteFixture(fixture);
  });

  test("handles bounded upload, Ask, generation, review, and export concurrency", async ({
    browser,
  }, testInfo) => {
    requireGuardedStagingTarget();
    if (!fixture) throw new Error("Stateful capacity fixture was not created.");
    const { contexts, pages } = await authenticatedPages(browser, fixture);
    const evidence: Record<string, unknown> = {
      projectRef: STAGING_PROJECT_REF,
      target: new URL(BASE_URL).hostname,
      envelope: { uploads: 2, asks: 2, generations: 2, approvedExports: 3 },
    };

    try {
      const uploadDurations = await Promise.all([
        uploadAsset(pages[0], fixture, 0),
        uploadAsset(pages[1], fixture, 1),
      ]);
      const titlePrefix = `Enterprise stateful QA ${fixture.suffix}`;
      const { data: uploadedAssets, error: uploadedAssetsError } = await fixture.admin
        .from("product_assets")
        .select(
          "id, org_id, product_id, storage_path, file_size_bytes, checksum_sha256, approval_status, uploaded_by",
        )
        .eq("org_id", fixture.organizationId)
        .like("title", `${titlePrefix}%`);
      if (uploadedAssetsError) throw uploadedAssetsError;
      expect(uploadedAssets).toHaveLength(2);
      fixture.assetIds = (uploadedAssets ?? []).map((asset) => asset.id);
      for (const asset of uploadedAssets ?? []) {
        expect(asset.org_id).toBe(fixture.organizationId);
        expect(asset.product_id).toBe(fixture.productId);
        expect(asset.storage_path).toMatch(
          new RegExp(`^${fixture.organizationId}/${fixture.productId}/`, "u"),
        );
        expect(asset.file_size_bytes).toBe(PNG.length);
        expect(asset.checksum_sha256).toMatch(/^[a-f0-9]{64}$/u);
        expect(asset.approval_status).toBe("processing");
        expect(fixture.users.slice(0, 2).map((user) => user.id)).toContain(asset.uploaded_by);
      }

      const { data: queuedJobs, error: queuedJobsError } = await fixture.admin
        .from("asset_media_jobs")
        .select("id, asset_id, status")
        .eq("status", "queued");
      if (queuedJobsError) throw queuedJobsError;
      expect(new Set((queuedJobs ?? []).map((job) => job.asset_id))).toEqual(
        new Set(fixture.assetIds),
      );
      fixture.workerId = `enterprise-capacity-${fixture.suffix}`;
      await execFileAsync("npx", ["tsx", "scripts/process-asset-media.ts"], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          MEDIA_WORKER_ID: fixture.workerId,
          MEDIA_WORKER_MAX_JOBS: String(fixture.assetIds.length),
        },
        timeout: 120_000,
      });
      const { data: publishedAssets, error: publishedAssetsError } = await fixture.admin
        .from("product_assets")
        .select("id, approval_status, current_version_id, preview_storage_path")
        .in("id", fixture.assetIds);
      if (publishedAssetsError) throw publishedAssetsError;
      expect(publishedAssets).toHaveLength(2);
      for (const asset of publishedAssets ?? []) {
        expect(asset.approval_status).toBe("approved");
        expect(asset.current_version_id).toEqual(expect.any(String));
        expect(asset.preview_storage_path).toMatch(
          new RegExp(`^${fixture.organizationId}/${fixture.productId}/`, "u"),
        );
      }
      const { data: completedJobs, error: completedJobsError } = await fixture.admin
        .from("asset_media_jobs")
        .select("asset_id, status, attempt_count, error_message")
        .in("asset_id", fixture.assetIds);
      if (completedJobsError) throw completedJobsError;
      expect(completedJobs).toHaveLength(2);
      expect(new Set((completedJobs ?? []).map((job) => job.status))).toEqual(
        new Set(["completed"]),
      );
      evidence.upload = {
        durationsMs: uploadDurations,
        p95Ms: percentile(uploadDurations, 0.95),
        assetIds: fixture.assetIds,
        statuses: publishedAssets?.map((asset) => asset.approval_status),
        workerJobs: completedJobs,
      };

      const sessions = fixture.users.slice(0, 2).map((user) => ({
        id: randomUUID(),
        org_id: fixture!.organizationId,
        user_id: user.id,
        product_id: fixture!.productId,
        title: `Enterprise capacity ${fixture!.suffix}`,
        messages: [],
      }));
      const { error: sessionsError } = await fixture.admin
        .from("notebook_sessions")
        .insert(sessions);
      if (sessionsError) throw sessionsError;
      fixture.notebookSessionIds = sessions.map((session) => session.id);
      const askResults = await Promise.all(
        sessions.map((session, index) =>
          askQuestion(pages[index], session.id, fixture!.knowledgeQuestion),
        ),
      );
      for (const result of askResults) {
        expect(result.status, result.text).toBe(200);
        expect(result.json.query_id).toEqual(expect.any(String));
        const notFound = result.json.not_found === true;
        const citations = Array.isArray(result.json.citations) ? result.json.citations : [];
        if (notFound) expect(citations).toEqual([]);
        else expect(citations.length).toBeGreaterThan(0);
        fixture.queryIds.push(result.json.query_id as string);
      }
      const askP95Ms = percentile(askResults.map((result) => result.durationMs), 0.95);
      expect(askP95Ms).toBeLessThanOrEqual(15_000);
      evidence.ask = {
        p95Ms: askP95Ms,
        results: askResults.map((result) => ({
          status: result.status,
          durationMs: result.durationMs,
          queryId: result.json.query_id,
          notFound: result.json.not_found,
          citationCount: Array.isArray(result.json.citations)
            ? result.json.citations.length
            : 0,
        })),
      };

      const generations = await Promise.all([
        generateDraft(pages[0], fixture),
        generateDraft(pages[1], fixture),
      ]);
      fixture.contentIds = generations.map((generation) => generation.contentId);
      const { data: drafts, error: draftsError } = await fixture.admin
        .from("generated_content")
        .select(
          "id, status, created_by, structured_fields, current_revision_number, approved_revision_number, template_version_id, template_variant_id",
        )
        .in("id", fixture.contentIds);
      if (draftsError) throw draftsError;
      expect(drafts).toHaveLength(2);
      for (const draft of drafts ?? []) {
        expect(draft.status).toBe("draft");
        expect(fixture.users.slice(0, 2).map((user) => user.id)).toContain(draft.created_by);
        expect(Object.keys((draft.structured_fields ?? {}) as Record<string, unknown>).length).toBeGreaterThan(0);
        expect(draft.current_revision_number).toBeGreaterThan(0);
        expect(draft.approved_revision_number).toBeNull();
        expect(draft.template_version_id).toEqual(expect.any(String));
        expect(draft.template_variant_id).toEqual(expect.any(String));
      }
      const { data: draftRevisions, error: draftRevisionsError } = await fixture.admin
        .from("generated_content_revisions")
        .select("content_id, revision_number, structured_fields")
        .in("content_id", fixture.contentIds);
      if (draftRevisionsError) throw draftRevisionsError;
      for (const contentId of fixture.contentIds) {
        expect((draftRevisions ?? []).some((revision) => revision.content_id === contentId)).toBe(true);
      }
      evidence.generation = {
        contentIds: fixture.contentIds,
        attempts: generations.map((generation) => generation.attempts),
      };

      await Promise.all(
        fixture.contentIds.map(async (contentId, index) => {
          const page = pages[index];
          await page.goto(`/studio/${contentId}?size=${fixture!.outputSize}`);
          await expectStudioState(page, "Draft");
          await makeDraftReviewable(page);
          await page.getByRole("button", { name: /Submit for review/iu }).click();
          await expectStudioState(page, "In review");
        }),
      );

      const reviewerPages = [pages[2], await contexts[2].newPage()];
      await Promise.all(
        fixture.contentIds.map(async (contentId, index) => {
          const page = reviewerPages[index];
          await page.goto(`/studio/${contentId}?size=${fixture!.outputSize}`);
          await expectStudioState(page, "In review");
          await page.getByRole("button", { name: /^Approve$/iu }).click();
          await expectStudioState(page, "Approved");
        }),
      );

      const exportResults = await Promise.all([
        exportPng(pages[0], fixture.contentIds[0], fixture.outputSize),
        exportPng(pages[1], fixture.contentIds[1], fixture.outputSize),
        exportPng(reviewerPages[0], fixture.contentIds[0], fixture.outputSize),
      ]);
      for (const result of exportResults) {
        expect(result.status, result.errorText).toBe(200);
        expect(result.contentType).toMatch(/image\/png/iu);
        expect(result.disposition).toMatch(/attachment/iu);
        expect(result.bytes).toBeGreaterThan(10_000);
        expect(pngDimensions(result.headerBytes)).toEqual({
          width: fixture.outputWidth,
          height: fixture.outputHeight,
        });
      }

      const { data: approved, error: approvedError } = await fixture.admin
        .from("generated_content")
        .select("id, status, current_revision_number, approved_revision_number")
        .in("id", fixture.contentIds);
      if (approvedError) throw approvedError;
      for (const content of approved ?? []) {
        expect(content.status).toBe("approved");
        expect(content.approved_revision_number).toBe(content.current_revision_number);
      }
      const { data: events, error: eventsError } = await fixture.admin
        .from("generated_content_events")
        .select("content_id, revision_number, event_type")
        .in("content_id", fixture.contentIds)
        .in("event_type", ["content.submitted", "content.approved", "content.exported"]);
      if (eventsError) throw eventsError;
      for (const content of approved ?? []) {
        expect(
          (events ?? []).filter(
            (event) => event.content_id === content.id && event.event_type === "content.submitted",
          ),
        ).toHaveLength(1);
        expect(
          (events ?? []).filter(
            (event) => event.content_id === content.id && event.event_type === "content.approved",
          ),
        ).toHaveLength(1);
        expect(
          (events ?? []).filter(
            (event) =>
              event.content_id === content.id &&
              event.revision_number !== content.approved_revision_number,
          ),
        ).toHaveLength(0);
      }
      expect((events ?? []).filter((event) => event.event_type === "content.exported")).toHaveLength(3);
      const { data: renderJobs, error: renderJobsError } = await fixture.admin
        .from("render_jobs")
        .select(
          "generated_content_id, input_sha256, output_storage_path, output_format, status",
        )
        .in("generated_content_id", fixture.contentIds);
      if (renderJobsError) throw renderJobsError;
      expect(renderJobs).toHaveLength(3);
      for (const job of renderJobs ?? []) {
        const content = approved?.find((item) => item.id === job.generated_content_id);
        expect(content).toBeTruthy();
        expect(job.status).toBe("completed");
        expect(job.output_format).toBe("png");
        expect(job.input_sha256).toMatch(/^[a-f0-9]{64}$/u);
        expect(job.output_storage_path).toContain(
          `/${job.generated_content_id}/revision-${content?.approved_revision_number}/`,
        );
        expect(job.output_storage_path).toMatch(
          new RegExp(`^${fixture.organizationId}/`, "u"),
        );
      }
      evidence.reviewExport = {
        exportP95Ms: percentile(exportResults.map((result) => result.durationMs), 0.95),
        exports: exportResults.map((result) => ({
          status: result.status,
          durationMs: result.durationMs,
          bytes: result.bytes,
        })),
        workflowEvents: events,
        renderJobs,
      };

      await testInfo.attach("enterprise-stateful-capacity.json", {
        contentType: "application/json",
        body: Buffer.from(JSON.stringify(evidence, null, 2)),
      });
      console.log(JSON.stringify({ capacity: "stateful", ...evidence }));
    } finally {
      await Promise.all(contexts.map((context) => context.close()));
    }
  });
});
