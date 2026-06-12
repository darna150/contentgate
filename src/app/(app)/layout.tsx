import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Unconfigured preview fallback so the shell is reviewable without Supabase
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return (
      <div className="flex min-h-screen">
        <Sidebar
          orgName="Demo Workspace"
          orgIndustry="Preview"
          userName="Preview User"
          userRole="admin"
          pendingCount={0}
        />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, org_id, organizations(name, industry)")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  const org = Array.isArray(profile.organizations)
    ? profile.organizations[0]
    : profile.organizations;

  const { count } = await supabase
    .from("generated_content")
    .select("id", { count: "exact", head: true })
    .eq("status", "in_review");

  return (
    <div className="flex min-h-screen">
      <Sidebar
        orgName={org?.name ?? "Workspace"}
        orgIndustry={org?.industry ?? null}
        userName={profile.full_name ?? user.email ?? "User"}
        userRole={profile.role}
        pendingCount={count ?? 0}
      />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
