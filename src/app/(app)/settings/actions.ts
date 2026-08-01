"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminMfa } from "@/lib/auth/admin-mfa";
import { isInvitableRole, normalizeInviteEmail } from "@/lib/invites";

type InviteResult = { ok: true; email: string } | { error: string };
type MemberLifecycleResult =
  | { ok: true; warning?: string }
  | { error: string; code?: "MFA_REQUIRED" };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function requireAdmin() {
  return requireAdminMfa();
}

async function requestOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) throw new Error("Could not determine request origin");
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

// Invite = stage org/role in the provisioning handshake, then let Supabase
// send the invite email. handle_new_user consumes the staged row when the
// Auth user is created, so the invitee lands in the right org with the
// right role — there is no client-controlled membership path.
export async function inviteMember(formData: FormData): Promise<InviteResult> {
  const ctx = await requireAdmin();
  if (!ctx) return { error: "Only admins can invite members." };

  const email = normalizeInviteEmail(formData.get("email"));
  if (!email) return { error: "Enter a valid work email address." };
  const role = formData.get("role");
  if (!isInvitableRole(role)) return { error: "Choose a valid role." };
  const fullName = String(formData.get("full_name") ?? "").trim() || null;

  const admin = createAdminClient();

  const { error: provisionError } = await admin.rpc("provision_user", {
    provision_email: email,
    provision_org_id: ctx.orgId,
    provision_role: role,
    provision_full_name: fullName,
  });
  if (provisionError) {
    return { error: `Could not stage the invite: ${provisionError.message}` };
  }

  const origin = await requestOrigin();
  const { data: invited, error: inviteError } =
    await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${origin}/welcome`,
    });
  if (inviteError) {
    return { error: `Could not send the invite: ${inviteError.message}` };
  }

  const { error: auditError } = await admin.from("audit_log").insert({
    org_id: ctx.orgId,
    actor_id: ctx.userId,
    action: "member_invited",
    entity_type: "profile",
    entity_id: invited.user.id,
    detail: { email, role },
  });
  if (auditError) console.error("audit_log insert failed:", auditError.message);

  revalidatePath("/settings");
  return { ok: true, email };
}

export async function enableAdminMfaRequirement(): Promise<
  { ok: true } | { error: string; code?: "MFA_REQUIRED" }
> {
  const context = await requireAdminMfa({ alwaysRequireAal2: true });
  if (!context) {
    return {
      error: "Verify this session with MFA before enabling workspace enforcement.",
      code: "MFA_REQUIRED",
    };
  }

  const { error } = await context.supabase.rpc("enable_admin_mfa_requirement");
  if (error) return { error: "Could not enable administrator MFA enforcement." };

  revalidatePath("/settings");
  return { ok: true };
}

async function requireLifecycleAdmin(): Promise<
  | Awaited<ReturnType<typeof requireAdminMfa>>
  | { lifecycleError: MemberLifecycleResult }
> {
  const context = await requireAdminMfa({ alwaysRequireAal2: true });
  if (context) return context;
  return {
    lifecycleError: {
      error: "Verify this session with MFA before managing member access.",
      code: "MFA_REQUIRED",
    },
  };
}

function validTargetId(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export async function changeMemberRole(
  targetProfileId: string,
  role: string
): Promise<MemberLifecycleResult> {
  if (!validTargetId(targetProfileId) || !isInvitableRole(role)) {
    return { error: "Choose a valid member and role." };
  }

  const access = await requireLifecycleAdmin();
  if (!access || "lifecycleError" in access) {
    return access?.lifecycleError ?? { error: "Administrator access is required." };
  }

  const { error } = await access.supabase.rpc("admin_change_member_role", {
    target_profile_id: targetProfileId,
    target_role: role,
  });
  if (error) {
    console.error("admin_change_member_role failed:", error.message);
    return { error: "Could not change this member’s role." };
  }

  revalidatePath("/settings");
  return { ok: true };
}

export async function disableMember(
  targetProfileId: string
): Promise<MemberLifecycleResult> {
  if (!validTargetId(targetProfileId)) return { error: "Choose a valid member." };

  const access = await requireLifecycleAdmin();
  if (!access || "lifecycleError" in access) {
    return access?.lifecycleError ?? { error: "Administrator access is required." };
  }

  // The user-context RPC is the immediate, atomic authorization boundary. It
  // also prevents self-disable, cross-tenant changes, and removing the final
  // active admin before any service-role Auth operation runs.
  const { error: disableError } = await access.supabase.rpc(
    "admin_disable_member",
    { target_profile_id: targetProfileId }
  );
  if (disableError) {
    console.error("admin_disable_member failed:", disableError.message);
    return { error: "Could not disable this member." };
  }

  const admin = createAdminClient();
  const { error: banError } = await admin.auth.admin.updateUserById(
    targetProfileId,
    { ban_duration: "876000h" }
  );

  revalidatePath("/settings");
  if (banError) {
    console.error("Supabase Auth ban failed after profile disable:", banError.message);
    return {
      ok: true,
      warning:
        "Workspace data access is disabled. Auth login blocking needs an operator retry.",
    };
  }
  return { ok: true };
}

export async function restoreMember(
  targetProfileId: string
): Promise<MemberLifecycleResult> {
  if (!validTargetId(targetProfileId)) return { error: "Choose a valid member." };

  const access = await requireLifecycleAdmin();
  if (!access || "lifecycleError" in access) {
    return access?.lifecycleError ?? { error: "Administrator access is required." };
  }

  // Confirm same-workspace visibility before lifting the Auth ban. The final
  // same-tenant and role checks still live in the atomic RPC.
  const { data: target, error: targetError } = await access.supabase
    .from("profiles")
    .select("id, access_status")
    .eq("id", targetProfileId)
    .maybeSingle();
  if (targetError || !target || target.access_status !== "disabled") {
    return { error: "This disabled member is not available to restore." };
  }

  const admin = createAdminClient();
  const { error: unbanError } = await admin.auth.admin.updateUserById(
    targetProfileId,
    { ban_duration: "none" }
  );
  if (unbanError) {
    console.error("Supabase Auth unban failed:", unbanError.message);
    return { error: "Could not restore this member’s sign-in." };
  }

  const { error: restoreError } = await access.supabase.rpc(
    "admin_restore_member",
    { target_profile_id: targetProfileId }
  );
  if (restoreError) {
    console.error("admin_restore_member failed:", restoreError.message);
    // Best-effort rollback keeps the safe state if the database restoration
    // fails after Auth has been unbanned.
    const { error: rollbackError } = await admin.auth.admin.updateUserById(
      targetProfileId,
      { ban_duration: "876000h" }
    );
    if (rollbackError) {
      console.error("Auth re-ban rollback failed:", rollbackError.message);
    }
    return { error: "Could not restore this member." };
  }

  revalidatePath("/settings");
  return { ok: true };
}
