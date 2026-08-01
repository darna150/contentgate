import "server-only";

import { createClient } from "@/lib/supabase/server";
import { adminMfaSatisfied, type AssuranceLevel } from "./admin-mfa-policy";

type OrganizationRelation =
  | { require_admin_mfa: boolean }
  | Array<{ require_admin_mfa: boolean }>
  | null;

export type AdminMfaContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  email: string | null;
  orgId: string;
  role: string;
  required: boolean;
  currentLevel: AssuranceLevel;
  nextLevel: AssuranceLevel;
};

function organizationMfaRequired(value: OrganizationRelation) {
  const organization = Array.isArray(value) ? value[0] : value;
  return organization?.require_admin_mfa === true;
}

export async function loadAdminMfaContext(): Promise<AdminMfaContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("org_id, role, organizations(require_admin_mfa)")
    .eq("id", user.id)
    .single();
  if (profileError || !profile || profile.role !== "admin") return null;

  const { data: assurance, error: assuranceError } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  return {
    supabase,
    userId: user.id,
    email: user.email ?? null,
    orgId: profile.org_id as string,
    role: profile.role,
    required: organizationMfaRequired(
      profile.organizations as OrganizationRelation
    ),
    currentLevel: assuranceError ? null : assurance.currentLevel,
    nextLevel: assuranceError ? null : assurance.nextLevel,
  };
}

export async function requireAdminMfa(input?: {
  alwaysRequireAal2?: boolean;
}) {
  const context = await loadAdminMfaContext();
  if (!context) return null;
  return adminMfaSatisfied({
    role: context.role,
    required: context.required,
    currentLevel: context.currentLevel,
    alwaysRequireAal2: input?.alwaysRequireAal2,
  })
    ? context
    : null;
}

export async function requireAdminMfaRequest(input?: {
  alwaysRequireAal2?: boolean;
}) {
  const context = await loadAdminMfaContext();
  if (!context) {
    return { error: Response.json({ error: "Admins only." }, { status: 403 }) };
  }
  const allowed = adminMfaSatisfied({
    role: context.role,
    required: context.required,
    currentLevel: context.currentLevel,
    alwaysRequireAal2: input?.alwaysRequireAal2,
  });
  if (!allowed) {
    return {
      error: Response.json(
        { error: "Administrator MFA verification is required.", code: "MFA_REQUIRED" },
        { status: 403 }
      ),
    };
  }
  return { value: context };
}
