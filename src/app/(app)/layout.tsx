import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { UiUxMeasurementProvider } from "@/components/uiux-measurement-provider";
import { isPlatformOperator } from "@/lib/onboarding/environment";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Unconfigured preview fallback so the shell is reviewable without Supabase
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return (
      <UiUxMeasurementProvider enabled={false}>
      <TooltipProvider>
        <div className="flex min-h-screen flex-col md:flex-row">
          <Sidebar
            orgName="Demo Workspace"
            orgIndustry="Preview"
            userName="Preview User"
            userRole="admin"
            pendingCount={0}
            platformOperator={false}
          />
          <main id="main-content" tabIndex={-1} className="min-w-0 flex-1">{children}</main>
        </div>
        <Toaster />
      </TooltipProvider>
      </UiUxMeasurementProvider>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, org_id, organizations(name, industry, require_admin_mfa)")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  const org = Array.isArray(profile.organizations)
    ? profile.organizations[0]
    : profile.organizations;

  if (profile.role === "admin" && org?.require_admin_mfa === true) {
    const { data: assurance, error: assuranceError } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assuranceError || assurance.currentLevel !== "aal2") redirect("/mfa");
  }

  const { count } = await supabase
    .from("generated_content")
    .select("id", { count: "exact", head: true })
    .not("product_id", "is", null)
    .eq("status", "in_review");

  const { data: pilotFlag } = await supabase
    .from("organization_feature_flags")
    .select("uiux_campaign_pilot_enabled")
    .eq("org_id", profile.org_id)
    .maybeSingle();

  return (
    <UiUxMeasurementProvider enabled={pilotFlag?.uiux_campaign_pilot_enabled === true}>
    <TooltipProvider>
      <div className="flex min-h-screen flex-col md:flex-row">
        <Sidebar
          orgName={org?.name ?? "Workspace"}
          orgIndustry={org?.industry ?? null}
          userName={profile.full_name ?? user.email ?? "User"}
          userRole={profile.role}
          pendingCount={count ?? 0}
          platformOperator={isPlatformOperator(user.email)}
        />
        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1">{children}</main>
      </div>
      <Toaster />
    </TooltipProvider>
    </UiUxMeasurementProvider>
  );
}
