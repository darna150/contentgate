import { randomUUID } from "node:crypto";

import { expect, test, type BrowserContext } from "@playwright/test";
import { loadEnvConfig } from "@next/env";
import { createBrowserClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

loadEnvConfig(process.cwd());

const RUN_PROVIDER_FAILURE = process.env.CONTENTGATE_E2E_PROVIDER_FAILURE === "1";
const BASE_URL = process.env.CONTENTGATE_E2E_BASE_URL ?? "";
const STAGING_PROJECT_REF = "bncwjibscptgijgmuhrn";

test.use({ baseURL: BASE_URL });

type SessionCookie = { name: string; value: string };
type FailureFixture = {
  admin: SupabaseClient;
  organizationId: string;
  productId: string;
  assignmentId: string;
  outputSize: string;
  userId: string;
  email: string;
  password: string;
  notebookSessionId: string;
  queryIds: string[];
  contentIds: string[];
};

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for provider-failure QA.`);
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
      `Provider-failure QA is staging Preview/local only; received app=${target.hostname}, project=${projectRef}.`,
    );
  }
  if (!/nimbus/iu.test(required("CONTENTGATE_E2E_PRODUCT_NAME"))) {
    throw new Error("Provider-failure QA requires the Nimbus fixture.");
  }
  return { projectUrl, serviceRoleKey, anonKey };
}

async function createFixture(): Promise<FailureFixture> {
  const { projectUrl, serviceRoleKey } = guardedTarget();
  const admin = createClient(projectUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const productId = required("CONTENTGATE_E2E_PRODUCT_ID");
  const assignmentId = required("CONTENTGATE_E2E_ASSIGNMENT_ID");
  const suffix = randomUUID().slice(0, 8);
  const email = `enterprise-provider-failure-${suffix}@contentgate.example`;
  const password = `CgProviderFailure!${randomUUID()}aA7`;
  const fullName = `Enterprise stateful provider ${suffix} 0`;
  const notebookSessionId = randomUUID();

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
    throw new Error("The staging Nimbus fixture is not safe for provider-failure QA.");
  }
  const organizationId = product.org_id;
  const { data: assignment, error: assignmentError } = await admin
    .from("product_template_assignments")
    .select("id, org_id, product_id, status")
    .eq("id", assignmentId)
    .single();
  if (
    assignmentError ||
    !assignment ||
    assignment.status !== "active" ||
    assignment.org_id !== organizationId ||
    assignment.product_id !== productId
  ) {
    throw assignmentError ?? new Error("Nimbus assignment scope is invalid.");
  }

  const fixture: FailureFixture = {
    admin,
    organizationId,
    productId,
    assignmentId,
    outputSize: required("CONTENTGATE_E2E_OUTPUT_SIZE_KEY"),
    userId: "",
    email,
    password,
    notebookSessionId,
    queryIds: [],
    contentIds: [],
  };
  try {
    const { error: provisionError } = await admin.rpc("provision_user", {
      provision_email: email,
      provision_org_id: organizationId,
      provision_role: "admin",
      provision_full_name: fullName,
    });
    if (provisionError) throw provisionError;
    const { data: authUser, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (authError || !authUser.user) throw authError ?? new Error("Auth user was not created.");
    fixture.userId = authUser.user.id;
    const { error: sessionError } = await admin.from("notebook_sessions").insert({
      id: notebookSessionId,
      org_id: organizationId,
      user_id: fixture.userId,
      product_id: productId,
      title: `Enterprise capacity provider ${suffix}`,
      messages: [],
    });
    if (sessionError) throw sessionError;
    return fixture;
  } catch (error) {
    await deleteFixture(fixture);
    throw error;
  }
}

async function deleteFixture(fixture: FailureFixture | null) {
  if (!fixture?.userId) return;
  const { data: queries, error: queryError } = await fixture.admin
    .from("knowledge_queries")
    .select("id")
    .eq("org_id", fixture.organizationId)
    .eq("user_id", fixture.userId);
  if (queryError) throw queryError;
  const queryIds = (queries ?? []).map((query) => query.id);
  const { data: receipt, error: disposalError } = await fixture.admin.rpc(
    "dispose_enterprise_stateful_capacity_fixture",
    {
      p_org_id: fixture.organizationId,
      p_user_ids: [fixture.userId],
      p_content_ids: fixture.contentIds,
      p_asset_ids: [],
      p_session_ids: [fixture.notebookSessionId],
      p_query_ids: queryIds,
      p_worker_id: null,
    },
  );
  if (disposalError) throw disposalError;
  expect((receipt as { status?: unknown } | null)?.status).toBe("disposed");
  const { error: authError } = await fixture.admin.auth.admin.deleteUser(
    fixture.userId,
    false,
  );
  if (authError && !/not found/iu.test(authError.message)) throw authError;
  const { error: profileError } = await fixture.admin
    .from("profiles")
    .delete()
    .eq("id", fixture.userId);
  if (profileError) throw profileError;
}

async function sessionCookies(fixture: FailureFixture) {
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

test.describe.serial("enterprise provider failure @enterprise-provider-failure", () => {
  test.skip(
    !RUN_PROVIDER_FAILURE,
    "Set CONTENTGATE_E2E_PROVIDER_FAILURE=1 for the guarded staging failure gate.",
  );
  test.setTimeout(180_000);

  let fixture: FailureFixture | null = null;
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

  test("fails Ask safely and returns validated generation fallback after bounded provider retries", async () => {
    if (!fixture || !context) throw new Error("Provider-failure fixture was not created.");
    const page = await context.newPage();
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    const ask = await page.evaluate(
      async ({ sessionId, question }) => {
        const response = await fetch("/api/products/ask", {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
            "x-contentgate-validation-run": "provider-failure",
          },
          body: JSON.stringify({ sessionId, question }),
        });
        return {
          status: response.status,
          retryAfter: response.headers.get("retry-after"),
          body: (await response.json()) as Record<string, unknown>,
        };
      },
      {
        sessionId: fixture.notebookSessionId,
        question: required("CONTENTGATE_E2E_KNOWLEDGE_QUESTION"),
      },
    );
    expect(ask.status).toBe(502);
    expect(ask.retryAfter).toBe("3");
    expect(ask.body.code).toBe("provider_unavailable");
    expect(ask.body.error).toMatch(/already retried automatically/iu);
    const askValidation = ask.body.validation as Record<string, unknown>;
    expect(askValidation.attempts).toBe(2);
    expect(["delivered", "unconfigured", "failed"]).toContain(
      askValidation.incidentDelivery,
    );

    const generation = await page.evaluate(
      async ({ assignmentId, outputSize }) => {
        const response = await fetch("/api/products/generate", {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
            "x-contentgate-validation-run": "provider-failure",
          },
          body: JSON.stringify({
            platformAssignmentId: assignmentId,
            language: "English",
            outputSize,
          }),
        });
        return {
          status: response.status,
          retryAfter: response.headers.get("retry-after"),
          body: (await response.json()) as Record<string, unknown>,
        };
      },
      { assignmentId: fixture.assignmentId, outputSize: fixture.outputSize },
    );
    expect(generation.status).toBe(200);
    expect(generation.retryAfter).toBeNull();
    expect(generation.body.fallbackUsed).toBe(true);
    expect(generation.body.generationMode).toBe("safe_fallback");
    expect(generation.body.contentId).toEqual(expect.any(String));
    fixture.contentIds.push(generation.body.contentId as string);

    const { data: queries, error: queriesError } = await fixture.admin
      .from("knowledge_queries")
      .select("id, outcome, traffic_class, failure_code, citation_count")
      .eq("org_id", fixture.organizationId)
      .eq("user_id", fixture.userId);
    if (queriesError) throw queriesError;
    expect(queries).toHaveLength(1);
    expect(queries?.[0]).toMatchObject({
      outcome: "provider_error",
      traffic_class: "synthetic",
      failure_code: "answer_provider_failed",
      citation_count: 0,
    });
    fixture.queryIds = (queries ?? []).map((query) => query.id);

    const { count: contentCount, error: contentError } = await fixture.admin
      .from("generated_content")
      .select("id", { count: "exact", head: true })
      .eq("org_id", fixture.organizationId)
      .eq("created_by", fixture.userId);
    if (contentError) throw contentError;
    expect(contentCount).toBe(1);

    await page.close();
  });
});
