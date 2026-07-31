import { randomUUID } from "node:crypto";

import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const RUN_CAPACITY = process.env.CONTENTGATE_E2E_CAPACITY === "1";
const BASE_URL = process.env.CONTENTGATE_E2E_BASE_URL ?? "";
const STAGING_PROJECT_REF = "bncwjibscptgijgmuhrn";

type CapacityFixture = {
  admin: SupabaseClient;
  organizationId: string;
  password: string;
  users: Array<{ id: string; email: string }>;
};

const ENVELOPE = {
  simultaneousLogins: boundedInteger("CONTENTGATE_CAPACITY_USERS", 5, 1, 10),
  concurrentHealthChecks: boundedInteger(
    "CONTENTGATE_CAPACITY_HEALTH_CONCURRENCY",
    20,
    1,
    50,
  ),
  authenticatedRoutes: ["/dashboard", "/content", "/reviews", "/ask"],
  loginP95Ms: 15_000,
  routeP95Ms: 10_000,
  healthP95Ms: 5_000,
} as const;

function boundedInteger(name: string, fallback: number, min: number, max: number) {
  const raw = process.env[name];
  const value = raw ? Number(raw) : fallback;
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer from ${min} to ${max}.`);
  }
  return value;
}

function percentile(values: number[], quantile: number) {
  if (values.length === 0) throw new Error("Cannot calculate an empty percentile.");
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * quantile) - 1)];
}

function requireGuardedStagingTarget() {
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!BASE_URL || !projectUrl || !serviceRoleKey) {
    throw new Error(
      "Capacity QA requires CONTENTGATE_E2E_BASE_URL and the staging Supabase URL and service key.",
    );
  }
  const projectRef = new URL(projectUrl).hostname.split(".")[0];
  const target = new URL(BASE_URL);
  const isPreview = target.hostname.endsWith(".vercel.app") && target.hostname.includes("-git-");
  const isLocal = ["localhost", "127.0.0.1", "::1"].includes(target.hostname);
  if (
    process.env.CONTENTGATE_ENVIRONMENT !== "staging" ||
    projectRef !== STAGING_PROJECT_REF ||
    (!isPreview && !isLocal)
  ) {
    throw new Error(
      `Enterprise capacity QA is staging Preview/local only; received app=${target.hostname}, project=${projectRef}.`,
    );
  }
  return { projectUrl, serviceRoleKey };
}

async function deleteFixture(fixture: CapacityFixture | null) {
  if (!fixture) return;
  await fixture.admin
    .from("audit_log")
    .delete()
    .eq("org_id", fixture.organizationId);
  for (const user of fixture.users) {
    const { error } = await fixture.admin.auth.admin.deleteUser(user.id, false);
    if (error && !/not found/iu.test(error.message)) throw error;
  }
  const { error: profileError } = await fixture.admin
    .from("profiles")
    .delete()
    .eq("org_id", fixture.organizationId);
  if (profileError) throw profileError;
  const { error } = await fixture.admin
    .from("organizations")
    .delete()
    .eq("id", fixture.organizationId);
  if (error) throw error;
}

async function createFixture(): Promise<CapacityFixture> {
  const { projectUrl, serviceRoleKey } = requireGuardedStagingTarget();
  const admin = createClient(projectUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const suffix = randomUUID().slice(0, 8);
  const organizationId = randomUUID();
  const password = `CgCapacity!${randomUUID()}aA7`;
  const fixture: CapacityFixture = {
    admin,
    organizationId,
    password,
    users: [],
  };
  const { error: organizationError } = await admin.from("organizations").insert({
    id: organizationId,
    name: `Enterprise Capacity QA ${suffix}`,
    industry: "Disposable enterprise QA",
  });
  if (organizationError) throw organizationError;

  try {
    for (let index = 0; index < ENVELOPE.simultaneousLogins; index += 1) {
      const email = `enterprise-capacity-${suffix}-${index}@contentgate.example`;
      const fullName = `Enterprise capacity member ${suffix} ${index}`;
      const { error: provisionError } = await admin.rpc("provision_user", {
        provision_email: email,
        provision_org_id: organizationId,
        provision_role: "member",
        provision_full_name: fullName,
      });
      if (provisionError) throw provisionError;
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });
      if (error) throw error;
      if (!data.user) throw new Error("Supabase did not create a capacity QA user.");
      fixture.users.push({ id: data.user.id, email });
    }
    return fixture;
  } catch (error) {
    await deleteFixture(fixture);
    throw error;
  }
}

async function signIn(page: Page, email: string, password: string) {
  const startedAt = performance.now();
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password").fill(password);
  const authResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/auth/v1/token") &&
      response.request().method() === "POST",
    { timeout: 15_000 },
  );
  await page.getByRole("button", { name: /^(Sign in|Enter workspace)$/ }).click();
  const authResponse = await authResponsePromise;
  if (!authResponse.ok()) {
    const payload = (await authResponse.json().catch(() => ({}))) as {
      code?: unknown;
      error_code?: unknown;
    };
    const code =
      typeof payload.code === "string"
        ? payload.code
        : typeof payload.error_code === "string"
          ? payload.error_code
          : "unknown";
    throw new Error(
      `Supabase password sign-in returned ${authResponse.status()} (${code}).`,
    );
  }
  await page.waitForFunction(
    () => !window.location.pathname.startsWith("/login"),
    undefined,
    { timeout: 45_000 },
  );
  return performance.now() - startedAt;
}

test.describe.serial("enterprise beta capacity @enterprise-capacity", () => {
  test.skip(
    !RUN_CAPACITY,
    "Set CONTENTGATE_E2E_CAPACITY=1 for the guarded staging capacity gate.",
  );
  test.setTimeout(180_000);

  let fixture: CapacityFixture | null = null;

  test.beforeAll(async () => {
    fixture = await createFixture();
  });

  test.afterAll(async () => {
    await deleteFixture(fixture);
  });

  test("serves a bounded concurrent health burst without errors", async ({
    request,
  }, testInfo) => {
    requireGuardedStagingTarget();
    const results = await Promise.all(
      Array.from({ length: ENVELOPE.concurrentHealthChecks }, async () => {
        const startedAt = performance.now();
        const response = await request.get("/api/health", {
          failOnStatusCode: false,
        });
        return {
          status: response.status(),
          durationMs: performance.now() - startedAt,
        };
      }),
    );
    const p95Ms = percentile(
      results.map((result) => result.durationMs),
      0.95,
    );
    await testInfo.attach("capacity-health.json", {
      contentType: "application/json",
      body: Buffer.from(JSON.stringify({ envelope: ENVELOPE, p95Ms, results }, null, 2)),
    });

    expect(new Set(results.map((result) => result.status))).toEqual(new Set([200]));
    expect(p95Ms).toBeLessThanOrEqual(ENVELOPE.healthP95Ms);
  });

  test("serves simultaneous sign-ins and core authenticated routes", async ({
    browser,
  }, testInfo) => {
    requireGuardedStagingTarget();
    if (!fixture) throw new Error("Capacity fixture was not created.");
    const contexts: BrowserContext[] = [];
    try {
      const sessions = await Promise.all(
        fixture.users.map(async (user, index) => {
          const context = await browser.newContext();
          contexts.push(context);
          const page = await context.newPage();
          const loginMs = await signIn(page, user.email, fixture!.password);
          return { index, page, loginMs };
        }),
      );

      const routeResults: Array<{
        session: number;
        path: string;
        status: number;
        finalPath: string;
        durationMs: number;
      }> = [];
      for (const path of ENVELOPE.authenticatedRoutes) {
        routeResults.push(
          ...(await Promise.all(
            sessions.map(async (session) => {
              const startedAt = performance.now();
              const response = await session.page.goto(path, {
                waitUntil: "domcontentloaded",
              });
              return {
                session: session.index,
                path,
                status: response?.status() ?? 0,
                finalPath: new URL(session.page.url()).pathname,
                durationMs: performance.now() - startedAt,
              };
            }),
          )),
        );
      }
      const loginP95Ms = percentile(
        sessions.map((session) => session.loginMs),
        0.95,
      );
      const routeP95Ms = percentile(
        routeResults.map((result) => result.durationMs),
        0.95,
      );
      await testInfo.attach("capacity-authenticated-routes.json", {
        contentType: "application/json",
        body: Buffer.from(
          JSON.stringify(
            {
              envelope: ENVELOPE,
              loginP95Ms,
              routeP95Ms,
              logins: sessions.map(({ index, loginMs }) => ({ index, loginMs })),
              routes: routeResults,
            },
            null,
            2,
          ),
        ),
      });

      expect(routeResults.every((result) => result.status >= 200 && result.status < 400)).toBe(true);
      expect(routeResults.every((result) => result.finalPath !== "/login")).toBe(true);
      expect(loginP95Ms).toBeLessThanOrEqual(ENVELOPE.loginP95Ms);
      expect(routeP95Ms).toBeLessThanOrEqual(ENVELOPE.routeP95Ms);
    } finally {
      await Promise.all(contexts.map((context) => context.close()));
    }
  });
});
