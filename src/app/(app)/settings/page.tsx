import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadAdminMfaContext } from "@/lib/auth/admin-mfa";
import { InviteForm } from "./invite-form";
import { MfaRequirementControl } from "./mfa-requirement-control";

type MemberRow = {
  id: string;
  fullName: string | null;
  role: string;
  email: string | null;
  status: "active" | "invited";
};

// Emails and sign-in state live in auth.users, which has no Data API surface;
// the admin client reads them server-side for this admin-only page.
async function loadMemberDirectory(profileIds: Set<string>) {
  const directory = new Map<
    string,
    { email: string | null; lastSignInAt: string | null }
  >();
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return directory;
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (error) {
    console.error("listUsers failed:", error.message);
    return directory;
  }
  for (const user of data.users) {
    if (!profileIds.has(user.id)) continue;
    directory.set(user.id, {
      email: user.email ?? null,
      lastSignInAt: user.last_sign_in_at ?? null,
    });
  }
  return directory;
}

export default async function SettingsPage() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) redirect("/dashboard");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("role, org_id, organizations(name, industry, require_admin_mfa)")
    .eq("id", user.id)
    .single();
  if (!me) redirect("/login");
  if (me.role !== "admin") redirect("/dashboard");

  const org = Array.isArray(me.organizations) ? me.organizations[0] : me.organizations;
  const mfa = await loadAdminMfaContext();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .order("role")
    .order("full_name");

  const directory = await loadMemberDirectory(
    new Set((profiles ?? []).map((p) => p.id))
  );

  const members: MemberRow[] = (profiles ?? []).map((profile) => {
    const entry = directory.get(profile.id);
    return {
      id: profile.id,
      fullName: profile.full_name,
      role: profile.role,
      email: entry?.email ?? null,
      status: entry && !entry.lastSignInAt ? "invited" : "active",
    };
  });

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8">
      <PageHeader
        eyebrow="Admin"
        title="Workspace settings"
        description={`Members and access for ${org?.name ?? "your workspace"}.`}
      />

      <Card>
        <CardHeader>
          <CardTitle>Administrator MFA</CardTitle>
          <CardDescription>
            Require a time-based authenticator code before protected
            administration. Enable this only after your current session is
            verified; the setting is intentionally one-way in the beta UI.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={org?.require_admin_mfa ? "approve" : "warn"}>
              {org?.require_admin_mfa ? "Required" : "Not enforced"}
            </Badge>
            <Badge variant={mfa?.currentLevel === "aal2" ? "approve" : "neutral"}>
              {mfa?.currentLevel === "aal2" ? "Session verified" : "Session needs MFA"}
            </Badge>
          </div>
          <MfaRequirementControl
            required={org?.require_admin_mfa === true}
            sessionVerified={mfa?.currentLevel === "aal2"}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invite a teammate</CardTitle>
          <CardDescription>
            They&apos;ll get an email invitation and join this workspace with the
            role you choose. Access can only be granted here — never from the
            sign-up side.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InviteForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>
            Everyone with access to {org?.name ?? "this workspace"}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col divide-y divide-border">
            {members.map((member) => (
              <li
                key={member.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">
                    {member.fullName ?? member.email ?? "Pending member"}
                    {member.id === user.id && (
                      <span className="ml-2 text-xs font-normal text-ink-muted">
                        (you)
                      </span>
                    )}
                  </p>
                  {member.email && (
                    <p className="truncate text-xs text-ink-muted">{member.email}</p>
                  )}
                </div>
                {member.status === "invited" && (
                  <Badge variant="warn">Invited</Badge>
                )}
                <Badge variant="neutral" className="capitalize">
                  {member.role}
                </Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
