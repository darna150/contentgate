import { createHmac, randomUUID } from "node:crypto";

import { expect, test, type Browser, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const RUN_ENTERPRISE_LIFECYCLE =
  process.env.CONTENTGATE_E2E_ENTERPRISE_LIFECYCLE === "1";
const STAGING_PROJECT_REF = "bncwjibscptgijgmuhrn";

type Fixture = {
  admin: SupabaseClient;
  memberSession: SupabaseClient;
  organizationId: string;
  adminId: string;
  memberId: string;
  inviteeId: string;
  adminEmail: string;
  memberEmail: string;
  password: string;
  workspaceName: string;
  memberName: string;
  inviteeName: string;
  inviteeEmail: string;
};

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for enterprise lifecycle QA.`);
  return value;
}

function decodeBase32(value: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const character of value.replace(/=+$/u, "").toUpperCase()) {
    const index = alphabet.indexOf(character);
    if (index < 0) throw new Error("The MFA secret is not valid base32.");
    bits += index.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) {
    bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2));
  }
  return Buffer.from(bytes);
}

function totp(secret: string, timestamp = Date.now()) {
  const counter = BigInt(Math.floor(timestamp / 30_000));
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(counter);
  const digest = createHmac("sha1", decodeBase32(secret)).update(message).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, "0");
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Enter workspace" }).click();
}

async function createFixture(): Promise<Fixture> {
  const supabaseUrl = required("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = required("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  if (
    process.env.CONTENTGATE_ENVIRONMENT !== "staging" ||
    projectRef !== STAGING_PROJECT_REF
  ) {
    throw new Error(
      `Enterprise lifecycle QA is staging-only; received ${projectRef || "unknown"}.`
    );
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const suffix = randomUUID().slice(0, 8);
  const organizationId = randomUUID();
  const workspaceName = `Enterprise Lifecycle QA ${suffix}`;
  const adminEmail = `enterprise-admin-${suffix}@contentgate.example`;
  const memberEmail = `enterprise-member-${suffix}@contentgate.example`;
  const memberName = `Enterprise lifecycle member ${suffix}`;
  const inviteeName = `Enterprise pending invite ${suffix}`;
  const inviteeEmail = `enterprise-invite-${suffix}@contentgate.example`;
  const password = `CgQA!${randomUUID()}aA7`;

  const { error: organizationError } = await admin.from("organizations").insert({
    id: organizationId,
    name: workspaceName,
    industry: "Disposable enterprise QA",
  });
  if (organizationError) throw organizationError;

  const createdIds: string[] = [];
  async function createRoleUser(
    email: string,
    role: "admin" | "member",
    fullName: string
  ) {
    const { error: provisionError } = await admin.rpc("provision_user", {
      provision_email: email,
      provision_org_id: organizationId,
      provision_role: role,
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
    if (!data.user) throw new Error(`Supabase did not create ${role} QA user.`);
    createdIds.push(data.user.id);
    return data.user.id;
  }

  try {
    const adminId = await createRoleUser(
      adminEmail,
      "admin",
      `Enterprise lifecycle admin ${suffix}`
    );
    const memberId = await createRoleUser(memberEmail, "member", memberName);
    // A provisioned Auth user with no sign-in has the same pending directory
    // state as an accepted invite record, without sending external email in QA.
    const inviteeId = await createRoleUser(inviteeEmail, "member", inviteeName);
    const memberSession = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: memberSignInError } =
      await memberSession.auth.signInWithPassword({
        email: memberEmail,
        password,
      });
    if (memberSignInError) throw memberSignInError;

    return {
      admin,
      memberSession,
      organizationId,
      adminId,
      memberId,
      inviteeId,
      adminEmail,
      memberEmail,
      password,
      workspaceName,
      memberName,
      inviteeName,
      inviteeEmail,
    };
  } catch (error) {
    await admin.from("audit_log").delete().eq("org_id", organizationId);
    for (const userId of createdIds.reverse()) {
      await admin.auth.admin.deleteUser(userId, false);
    }
    await admin.from("organizations").delete().eq("id", organizationId);
    throw error;
  }
}

async function deleteFixture(fixture: Fixture | null) {
  if (!fixture) return;
  await fixture.admin
    .from("audit_log")
    .delete()
    .eq("org_id", fixture.organizationId);
  for (const userId of [fixture.inviteeId, fixture.memberId, fixture.adminId]) {
    const { error } = await fixture.admin.auth.admin.deleteUser(userId, false);
    if (error && !/not found/i.test(error.message)) throw error;
  }
  const { error: organizationError } = await fixture.admin
    .from("organizations")
    .delete()
    .eq("id", fixture.organizationId);
  if (organizationError) throw organizationError;
}

test.describe.serial("enterprise identity and lifecycle @enterprise-live", () => {
  test.skip(
    !RUN_ENTERPRISE_LIFECYCLE,
    "Set CONTENTGATE_E2E_ENTERPRISE_LIFECYCLE=1 for the guarded staging journey."
  );

  let fixture: Fixture | null = null;

  test.beforeAll(async () => {
    fixture = await createFixture();
  });

  test.afterAll(async () => {
    await deleteFixture(fixture);
  });

  test("AAL1 is blocked, AAL2 manages access, and every change is auditable", async ({
    page,
    browser,
  }: {
    page: Page;
    browser: Browser;
  }) => {
    if (!fixture) throw new Error("Enterprise lifecycle fixture was not created.");

    await signIn(page, fixture.adminEmail, fixture.password);
    await expect(page).toHaveURL(/\/mfa$/u);
    await expect(
      page.getByRole("heading", { name: "Admin verification required" })
    ).toBeVisible();

    await page.getByRole("button", { name: "Set up authenticator" }).click();
    const secret = (await page.locator("p.font-mono").textContent())?.trim();
    if (!secret) throw new Error("The MFA enrollment secret was not rendered.");
    await page.getByLabel("Six-digit code").fill(totp(secret));
    await page.getByRole("button", { name: "Verify and continue" }).click();
    await expect(page).toHaveURL(/\/dashboard$/u);

    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Workspace settings" })).toBeVisible();
    await expect(page.getByText(fixture.workspaceName, { exact: true })).toBeVisible();

    const memberRow = page.locator("li").filter({ hasText: fixture.memberName });
    const roleSelect = memberRow.getByRole("combobox", {
      name: `Role for ${fixture.memberName}`,
    });
    await roleSelect.click();
    await page.getByRole("option", { name: "Approver" }).click();
    await expect(roleSelect).toHaveText(/Approver/u);

    await memberRow.getByRole("button", { name: "Disable" }).click();
    await expect(memberRow.getByText("Disabled", { exact: true })).toBeVisible();

    // This client retains the access token issued before disablement. The JWT
    // is still cryptographically valid, but the database capability must be
    // gone immediately.
    const { data: disabledOrg, error: disabledOrgError } =
      await fixture.memberSession.rpc("auth_org_id");
    expect(disabledOrgError).toBeNull();
    expect(disabledOrg).toBeNull();
    const { data: disabledProfiles, error: disabledProfilesError } =
      await fixture.memberSession.from("profiles").select("id");
    expect(disabledProfilesError).toBeNull();
    expect(disabledProfiles).toEqual([]);

    const staleSessionRpcChecks = [
      fixture.memberSession.rpc("consume_api_rate_limit", {
        p_scope: "knowledge.ask",
      }),
      fixture.memberSession.rpc("transition_generated_content", {
        p_content_id: randomUUID(),
        p_action: "submit",
        p_note: null,
      }),
      fixture.memberSession.rpc("record_generated_content_export", {
        p_content_id: randomUUID(),
        p_format: "md",
        p_size: null,
        p_surface: "api",
      }),
      fixture.memberSession.rpc("record_product_asset_download", {
        p_asset_id: randomUUID(),
      }),
      fixture.memberSession.rpc("record_uiux_measurement_event", {
        p_event_name: "studio_opened",
        p_properties: {},
      }),
    ];
    for (const [index, rpcResult] of (
      await Promise.all(staleSessionRpcChecks)
    ).entries()) {
      expect(rpcResult.error, `stale-session RPC ${index + 1}`).not.toBeNull();
      expect(rpcResult.error?.message).toContain(
        "active account access is required"
      );
    }

    const memberPage = await browser.newPage();
    await signIn(memberPage, fixture.memberEmail, fixture.password);
    await expect(memberPage.locator('p[role="alert"]')).toContainText(
      "That email and password do not match an account"
    );

    await memberRow.getByRole("button", { name: "Restore" }).click();
    await expect(memberRow.getByRole("button", { name: "Disable" })).toBeVisible();

    const inviteeRow = page.locator("li").filter({ hasText: fixture.inviteeName });
    await expect(inviteeRow.getByText("Invited", { exact: true })).toBeVisible();
    await inviteeRow.getByRole("button", { name: "Cancel invite" }).click();
    await expect(inviteeRow.getByText("Disabled", { exact: true })).toBeVisible();

    const { data: inviteeProfile, error: inviteeProfileError } = await fixture.admin
      .from("profiles")
      .select("access_status")
      .eq("id", fixture.inviteeId)
      .single();
    expect(inviteeProfileError).toBeNull();
    expect(inviteeProfile?.access_status).toBe("disabled");

    await signIn(memberPage, fixture.memberEmail, fixture.password);
    await expect(memberPage).toHaveURL(/\/dashboard$/u);

    const nonAdminAuditExport = await memberPage.evaluate(async () => {
      const response = await fetch("/api/audit/export", {
        credentials: "same-origin",
      });
      return response.status;
    });
    expect(nonAdminAuditExport).toBe(403);
    await memberPage.close();

    const exported = await page.evaluate(async () => {
      const response = await fetch("/api/audit/export", {
        credentials: "same-origin",
      });
      return {
        status: response.status,
        contentType: response.headers.get("content-type"),
        body: await response.text(),
      };
    });
    expect(exported.status).toBe(200);
    expect(exported.contentType).toContain("text/csv");
    expect(exported.body).toContain("member_role_changed");
    expect(exported.body).toContain("member_disabled");
    expect(exported.body).toContain("member_restored");

    const { data: events, error: eventsError } = await fixture.admin
      .from("audit_log")
      .select("action, entity_id")
      .eq("org_id", fixture.organizationId)
      .in("action", [
        "member_role_changed",
        "member_disabled",
        "member_restored",
        "audit.exported",
      ]);
    expect(eventsError).toBeNull();
    expect(new Set((events ?? []).map((event) => event.action))).toEqual(
      new Set([
        "member_role_changed",
        "member_disabled",
        "member_restored",
        "audit.exported",
      ])
    );
    expect(
      (events ?? []).some(
        (event) =>
          event.action === "member_disabled" && event.entity_id === fixture?.inviteeId,
      ),
    ).toBe(true);
  });
});
