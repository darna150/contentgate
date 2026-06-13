import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StudioEditor } from "./studio-editor";

// Pull candidate one-liners out of approved copy so the headline is chosen
// from what's already approved, never typed from scratch.
function candidateLines(body: string): string[] {
  return body
    .replace(/\r\n/g, "\n")
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!?])\s+/))
    .map((s) =>
      s
        .replace(/^[#>*\-•\s]+/, "")
        .replace(/\*\*|__|[*_`]/g, "") // strip inline markdown emphasis
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter((s) => s.length >= 8 && s.length <= 95)
    .slice(0, 8);
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-10 py-9">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-serif text-[28px] font-semibold">Creative Studio</h1>
        <p className="text-[14.5px] text-ink-muted">
          The last step. Turn an approved piece into a finished, on-brand asset.
        </p>
      </div>
      {children}
    </div>
  );
}

function Gate({ message }: { message: string }) {
  return (
    <Shell>
      <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-edge-strong bg-surface px-8 py-16 text-center">
        <p className="text-[15px] font-semibold">{message}</p>
        <p className="max-w-md text-sm text-ink-muted">
          Only approved content can be turned into an asset. Get a piece through
          review first, then come back here.
        </p>
        <Link
          href="/content?status=approved"
          className="mt-2 rounded-control bg-brand px-[18px] py-2.5 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90"
        >
          See approved content
        </Link>
      </div>
    </Shell>
  );
}

export default async function StudioPage({
  searchParams,
}: {
  searchParams: Promise<{ content?: string }>;
}) {
  const { content: contentId } = await searchParams;

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return <Gate message="Connect a workspace to use the studio" />;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let orgName = "Your brand";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("organizations(name)")
      .eq("id", user.id)
      .single();
    const org = Array.isArray(profile?.organizations)
      ? profile?.organizations[0]
      : profile?.organizations;
    orgName = org?.name ?? orgName;
  }

  // No piece chosen yet: let them pick from approved content.
  if (!contentId) {
    const { data: approved } = await supabase
      .from("generated_content")
      .select("id, title, target_language, created_at")
      .eq("status", "approved")
      .order("created_at", { ascending: false });

    if (!approved || approved.length === 0) {
      return <Gate message="Nothing approved to turn into an asset yet" />;
    }

    return (
      <Shell>
        <div className="flex flex-col gap-3 rounded-card border border-edge bg-surface p-[22px]">
          <h2 className="text-[15px] font-bold">Pick an approved piece</h2>
          <ul className="flex flex-col">
            {approved.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/studio?content=${row.id}`}
                  className="-mx-2 flex items-center gap-3 rounded-control px-2 py-2.5 transition-colors hover:bg-page"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[13.5px] font-semibold">
                      {row.title}
                    </span>
                    <span className="text-[11.5px] text-ink-faint">
                      {row.target_language}
                    </span>
                  </span>
                  <span className="inline-flex rounded-full bg-approve-tint px-[9px] py-0.5 text-[11.5px] font-semibold text-approve">
                    Approved
                  </span>
                  <span className="text-[13px] font-semibold text-brand">
                    Make asset →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Shell>
    );
  }

  const { data: content } = await supabase
    .from("generated_content")
    .select("id, title, body, status")
    .eq("id", contentId)
    .single();

  if (!content) return <Gate message="That content could not be found" />;
  if (content.status !== "approved") {
    return <Gate message="That piece isn't approved yet" />;
  }

  const lines = candidateLines(content.body);

  return (
    <Shell>
      <StudioEditor
        contentId={content.id}
        contentTitle={content.title}
        orgName={orgName}
        lines={lines}
      />
    </Shell>
  );
}
