"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminMfa } from "@/lib/auth/admin-mfa";
import { isInvitableRole, normalizeInviteEmail } from "@/lib/invites";

type InviteResult = { ok: true; email: string } | { error: string };

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
