import { randomUUID } from "node:crypto";

import { expect, test, type BrowserContext } from "@playwright/test";
import { loadEnvConfig } from "@next/env";
import { createBrowserClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

loadEnvConfig(process.cwd());

const RUN_MATRIX = process.env.CONTENTGATE_E2E_GENERATION_MATRIX === "1";
const BASE_URL = process.env.CONTENTGATE_E2E_BASE_URL ?? "";
const STAGING_PROJECT_REF = "bncwjibscptgijgmuhrn";
const MIN_REQUEST_INTERVAL_MS = 15_500;
const REQUEST_TARGET = Math.max(
  1,
  Number.parseInt(process.env.CONTENTGATE_E2E_GENERATION_MATRIX_REQUESTS ?? "0", 10) || 0
);

test.use({ baseURL: BASE_URL });

type SessionCookie = { name: string; value: string };
type MatrixFixture = {
  admin: SupabaseClient;
  orgId: string;
  productId: string;
  assignmentId: string;
  variantKeys: string[];
  userId: string;
  email: string;
  password: string;
  contentIds: string[];
};

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for generation-matrix QA.`);
  return value;
}

function guardedTarget() {
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
      `Generation matrix is staging Preview/local only; received app=${target.hostname}, project=${projectRef}.`
    );
  }
  return { projectUrl, serviceRoleKey, anonKey };
}

async function createFixture(): Promise<MatrixFixture> {
  const { projectUrl, serviceRoleKey } = guardedTarget();
  const admin = createClient(projectUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const assignmentId = required("CONTENTGATE_E2E_ASSIGNMENT_ID");
  const { data: assignment, error: assignmentError } = await admin
    .from("product_template_assignments")
    .select(
      "id, org_id, product_id, status, template_versions!product_template_assignments_template_version_id_fkey(manifest)"
    )
    .eq("id", assignmentId)
    .single();
  if (assignmentError || !assignment || assignment.status !== "active") {
    throw assignmentError ?? new Error("Active generation assignment not found.");
  }
  const version = Array.isArray(assignment.template_versions)
    ? assignment.template_versions[0]
    : assignment.template_versions;
  const manifest = version?.manifest as { variants?: Array<{ key?: unknown }> } | undefined;
  const variantKeys = (manifest?.variants ?? [])
    .map((variant) => variant.key)
    .filter((key): key is string => typeof key === "string" && key.length > 0);
  if (!variantKeys.length) throw new Error("Assignment manifest has no variants.");

  const suffix = randomUUID().slice(0, 8);
  const email = `generation-matrix-${suffix}@contentgate.example`;
  const password = `CgGenerationMatrix!${randomUUID()}aA7`;
  const fixture: MatrixFixture = {
    admin,
    orgId: assignment.org_id,
    productId: assignment.product_id,
    assignmentId,
    variantKeys,
    userId: "",
    email,
    password,
    contentIds: [],
  };
  try {
    const { error: provisionError } = await admin.rpc("provision_user", {
      provision_email: email,
      provision_org_id: fixture.orgId,
      provision_role: "admin",
      provision_full_name: `Generation matrix ${suffix}`,
    });
    if (provisionError) throw provisionError;
    const { data: authUser, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: `Generation matrix ${suffix}` },
    });
    if (authError || !authUser.user) throw authError ?? new Error("Matrix user was not created.");
    fixture.userId = authUser.user.id;
    return fixture;
  } catch (error) {
    await deleteFixture(fixture);
    throw error;
  }
}

async function deleteFixture(fixture: MatrixFixture | null) {
  if (!fixture?.userId) return;
  const { error: disposalError } = await fixture.admin.rpc(
    "dispose_enterprise_stateful_capacity_fixture",
    {
      p_org_id: fixture.orgId,
      p_user_ids: [fixture.userId],
      p_content_ids: fixture.contentIds,
      p_asset_ids: [],
      p_session_ids: [],
      p_query_ids: [],
      p_worker_id: null,
    }
  );
  if (disposalError) throw disposalError;
  const { error: authError } = await fixture.admin.auth.admin.deleteUser(fixture.userId, false);
  if (authError && !/not found/iu.test(authError.message)) throw authError;
  await fixture.admin.from("profiles").delete().eq("id", fixture.userId);
}

async function sessionCookies(fixture: MatrixFixture) {
  const { projectUrl, anonKey } = guardedTarget();
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
  const { error } = await supabase.auth.signInWithPassword({
    email: fixture.email,
    password: fixture.password,
  });
  if (error) throw error;
  return cookieJar;
}

test.describe.serial("all-format generation reliability @generation-matrix", () => {
  test.skip(!RUN_MATRIX, "Set CONTENTGATE_E2E_GENERATION_MATRIX=1 for the guarded staging gate.");
  test.setTimeout(3_600_000);

  let fixture: MatrixFixture | null = null;
  let context: BrowserContext | null = null;

  test.beforeAll(async ({ browser }) => {
    fixture = await createFixture();
    const cookies = await sessionCookies(fixture);
    context = await browser.newContext();
    await context.addCookies(cookies.map((cookie) => ({ ...cookie, url: BASE_URL })));
  });

  test.afterAll(async () => {
    await context?.close();
    await deleteFixture(fixture);
  });

  test("returns fresh compliant copy on the first request for every active format", async () => {
    if (!fixture || !context) throw new Error("Generation matrix fixture was not created.");
    const page = await context.newPage();
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    let previousRequestAt = 0;
    let fallbackCount = 0;

    const requestCount = Math.max(fixture.variantKeys.length, REQUEST_TARGET);
    const outputSizes = Array.from(
      { length: requestCount },
      (_, index) => fixture!.variantKeys[index % fixture!.variantKeys.length]
    );
    for (const outputSize of outputSizes) {
      const waitMs = Math.max(0, previousRequestAt + MIN_REQUEST_INTERVAL_MS - Date.now());
      if (waitMs > 0) await page.waitForTimeout(waitMs);
      previousRequestAt = Date.now();
      const result = await page.evaluate(
        async ({ assignmentId, size }) => {
          const response = await fetch("/api/products/generate", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              platformAssignmentId: assignmentId,
              language: "English",
              outputSize: size,
            }),
          });
          const text = await response.text();
          let body: Record<string, unknown> = {};
          try {
            body = JSON.parse(text) as Record<string, unknown>;
          } catch {
            // Raw body remains in the assertion message.
          }
          return { status: response.status, text, body };
        },
        { assignmentId: fixture.assignmentId, size: outputSize }
      );
      expect(
        result.status,
        `${outputSize} failed its first request: ${result.text}`
      ).toBe(200);
      expect(result.body.requestId).toEqual(expect.any(String));
      expect(result.body.contentId).toEqual(expect.any(String));
      expect(result.body.structured_fields).toEqual(expect.any(Object));
      fixture.contentIds.push(result.body.contentId as string);
      if (result.body.fallbackUsed === true) fallbackCount += 1;
    }

    expect(fallbackCount, "The all-format release gate must pass without conservative fallbacks.").toBe(0);
    await page.close();
  });
});
